import {botOwnerIds} from '../config/bot-owners.js';
import {one,withTransaction} from '../db/database.js';

// SQLite exposes one shared connection. Serialize this service's writes on it;
// MariaDB uses independent pooled connections and database row locks.
const queues=new WeakMap();
async function serialized(db,fn){
 if(db.type!=='sqlite')return fn();
 const prior=queues.get(db)||Promise.resolve();const next=prior.catch(()=>{}).then(fn);
 queues.set(db,next);try{return await next;}finally{if(queues.get(db)===next)queues.delete(db);}
}
export class ServerModeratorService{
 constructor(db,env=process.env){this.db=db;this.owners=botOwnerIds(env);}
 isOwner(userId){return this.owners.has(String(userId||''));}
 async access({guildId,userId,roleIds=[]},conn=this.db){
  if(!guildId)return {isModerator:false,hasGrant:false,activeGrantCount:0,canReviewRequests:false,bootstrap:false};
  const settings=await one(conn,'SELECT staff_role_ids FROM guild_settings WHERE guild_id=?',[String(guildId)]);
  const configured=JSON.parse(settings?.staff_role_ids||'[]');
  const grants=await conn.query('SELECT discord_user_id FROM server_moderators WHERE guild_id=?',[String(guildId)]);
  const hasGrant=grants.some(g=>g.discord_user_id===String(userId));
  const isModerator=this.isOwner(userId)||hasGrant||configured.some(r=>roleIds.includes(r));
  return {isModerator,hasGrant,activeGrantCount:grants.length,canReviewRequests:isModerator,bootstrap:configured.length===0&&grants.length===0};
 }
 async request({guildId,userId,reason,names={}}){
  if(!guildId||!userId||!String(reason||'').trim())throw new Error('A server, applicant, and reason are required.');
  return serialized(this.db,()=>withTransaction(this.db,async conn=>{
   const ids=[String(guildId),String(userId)];
   const settings=await one(conn,'SELECT guild_id FROM guild_settings WHERE guild_id=? FOR UPDATE',[ids[0]]);
   if(!settings)throw new Error('Configure AddressBook for this server first.');
   if((await this.access({guildId,userId},conn)).hasGrant)throw new Error('You already have Server Moderator access.');
   const old=await one(conn,'SELECT * FROM server_moderator_requests WHERE guild_id=? AND discord_user_id=? FOR UPDATE',ids);
   if(old?.status==='pending')throw new Error('You already have a pending Server Moderator request.');
   if(old)await conn.query("UPDATE server_moderator_requests SET reason=?,status='pending',revision=revision+1,requested_at=CURRENT_TIMESTAMP,reviewed_at=NULL,reviewed_by=NULL,discord_global_name=?,discord_display_name=?,guild_name=? WHERE id=?",[String(reason).trim(),names.globalName||null,names.displayName||null,names.guildName||null,old.id]);
   else await conn.query('INSERT INTO server_moderator_requests(guild_id,discord_user_id,reason,discord_global_name,discord_display_name,guild_name) VALUES(?,?,?,?,?,?)',[...ids,String(reason).trim(),names.globalName||null,names.displayName||null,names.guildName||null]);
   await this.audit(conn,guildId,userId,'request_server_moderator',userId);
   return one(conn,'SELECT * FROM server_moderator_requests WHERE guild_id=? AND discord_user_id=?',ids);
  }));
 }
 async review({guildId,requestId,revision,reviewer,decision}){
  if(!['approve','deny'].includes(decision))throw new Error('Invalid review decision.');
  return serialized(this.db,()=>withTransaction(this.db,async conn=>{
   await one(conn,'SELECT guild_id FROM guild_settings WHERE guild_id=? FOR UPDATE',[String(guildId)]);
   if(!(await this.access({guildId,...reviewer},conn)).canReviewRequests)throw new Error('Current AddressBook Server Moderator access is required.');
   const req=await one(conn,'SELECT * FROM server_moderator_requests WHERE guild_id=? AND id=? FOR UPDATE',[String(guildId),Number(requestId)]);
   if(!req||req.status!=='pending'||Number(req.revision)!==Number(revision))throw new Error('This request is stale or no longer pending. Refresh requests.');
   if(req.discord_user_id===String(reviewer.userId))throw new Error('You cannot review your own request.');
   const status=decision==='approve'?'approved':'denied';
   const changed=await conn.query("UPDATE server_moderator_requests SET status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending' AND revision=?",[status,String(reviewer.userId),req.id,Number(revision)]);
   if(!changed.affectedRows)throw new Error('This request is no longer pending.');
   if(decision==='approve')await conn.query('INSERT INTO server_moderators(guild_id,discord_user_id,approved_by,request_id,request_revision) VALUES(?,?,?,?,?)',[String(guildId),req.discord_user_id,String(reviewer.userId),req.id,Number(revision)]);
   await this.audit(conn,guildId,reviewer.userId,decision+'_server_moderator',req.discord_user_id);
   return {...req,status};
  }));
 }
 async revoke({guildId,userId,reviewer}){return serialized(this.db,()=>withTransaction(this.db,async conn=>{
  await one(conn,'SELECT guild_id FROM guild_settings WHERE guild_id=? FOR UPDATE',[String(guildId)]);
  if(!(await this.access({guildId,...reviewer},conn)).canReviewRequests)throw new Error('Current AddressBook Server Moderator access is required.');
  const r=await conn.query('DELETE FROM server_moderators WHERE guild_id=? AND discord_user_id=?',[String(guildId),String(userId)]);
  if(r.affectedRows){await conn.query("UPDATE server_moderator_requests SET status='revoked',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE guild_id=? AND discord_user_id=? AND status='approved'",[String(reviewer.userId),String(guildId),String(userId)]);await this.audit(conn,guildId,reviewer.userId,'revoke_server_moderator',userId);}
  return !!r.affectedRows;
 }));}
 listRequests({guildId}){return this.db.query("SELECT * FROM server_moderator_requests WHERE guild_id=? AND status='pending' ORDER BY requested_at,id",[String(guildId)]);}
 listGrants({guildId}){return this.db.query('SELECT * FROM server_moderators WHERE guild_id=? ORDER BY approved_at,discord_user_id',[String(guildId)]);}
 async status({guildId,userId}){return {hasGrant:!!await one(this.db,'SELECT discord_user_id FROM server_moderators WHERE guild_id=? AND discord_user_id=?',[String(guildId),String(userId)]),request:await one(this.db,'SELECT * FROM server_moderator_requests WHERE guild_id=? AND discord_user_id=?',[String(guildId),String(userId)])};}
 audit(conn,guildId,actor,action,applicant){return conn.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)',[String(guildId),String(actor),action,'guild',String(guildId),JSON.stringify({applicant:String(applicant)})]);}
}
