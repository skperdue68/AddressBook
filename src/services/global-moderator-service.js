import {botOwnerIds} from '../config/bot-owners.js';
import { one, withTransaction } from '../db/database.js';
import { requireEsoServer } from '../utils/eso-server.js';

export function globalModeratorApproverIds(env=process.env){
  return new Set(String(env.GLOBAL_MODERATOR_APPROVER_USER_IDS||'').split(',').map(v=>v.trim()).filter(Boolean));
}

export class GlobalModeratorService{
  constructor(db,env=process.env){this.db=db;this.owners=botOwnerIds(env);this.approvers=globalModeratorApproverIds(env);this.cache=new Map();}
  isOwner(userId){return this.owners.has(String(userId||''));}
  isApprover(userId){return this.isOwner(userId)||this.approvers.has(String(userId||''));}
  #cacheKey(userId,esoServer){return `${String(userId||'')}:${requireEsoServer(esoServer)}`;}
  async #repairLegacyGrant(userId){
    const matches=await this.db.query(`SELECT DISTINCT gs.eso_server FROM global_moderators m
      JOIN global_moderator_requests r ON r.id=m.request_id AND r.discord_user_id=m.discord_user_id AND r.status='approved'
      JOIN guild_settings gs ON gs.guild_id=r.origin_guild_id
      WHERE m.discord_user_id=? AND m.eso_server IS NULL AND gs.eso_server IS NOT NULL`,[String(userId)]);
    if(matches.length!==1)return;
    const server=requireEsoServer(matches[0].eso_server);
    await this.db.query(`UPDATE global_moderators SET eso_server=? WHERE discord_user_id=? AND eso_server IS NULL
      AND NOT EXISTS (SELECT 1 FROM (SELECT discord_user_id FROM global_moderators WHERE discord_user_id=? AND eso_server=?) existing)`,[server,String(userId),String(userId),server]);
  }
  async ensureUser(userId,esoServer){if(!esoServer)return false;const key=this.#cacheKey(userId,esoServer);if(this.isOwner(userId))return true;await this.#repairLegacyGrant(userId);const value=!!await one(this.db,'SELECT discord_user_id FROM global_moderators WHERE discord_user_id=? AND eso_server=?',[String(userId||''),requireEsoServer(esoServer)]);this.cache.set(key,value);return value;}
  isGlobalModeratorCached(userId,esoServer){if(!esoServer)return false;const key=this.#cacheKey(userId,esoServer);if(this.isOwner(userId))return true;return this.cache.get(key)===true;}
  isGlobalModerator(userId,esoServer){return this.ensureUser(userId,esoServer);}
  async requestAccess({userId,guildId,esoServer,reason,names={}}){
    const server=requireEsoServer(esoServer);
    const text=String(reason||'').trim();if(!text)throw new Error('A reason is required when requesting Global Housing Moderator access.');
    if(await this.isGlobalModerator(userId,server))throw new Error('You already have Global Housing Moderator access for this ESO environment.');
    const pending=await one(this.db,"SELECT id FROM global_moderator_requests WHERE discord_user_id=? AND eso_server=? AND status='pending'",[String(userId),server]);if(pending)throw new Error('You already have a pending Global Housing Moderator request for this ESO environment.');
    const r=await this.db.query('INSERT INTO global_moderator_requests(eso_server,discord_user_id,origin_guild_id,reason,discord_global_name,discord_display_name,origin_guild_name) VALUES(?,?,?,?,?,?,?)',[server,String(userId),String(guildId),text,names.globalName||null,names.displayName||null,names.guildName||null]);return one(this.db,'SELECT * FROM global_moderator_requests WHERE id=?',[r.insertId]);
  }
  listPending({esoServer=null}={}){const sql=`SELECT r.*,COALESCE(r.discord_display_name,r.discord_global_name,m.display_name,u.global_name,u.username) review_user_name,
    COALESCE(r.origin_guild_name,g.guild_name,gs.guild_name) review_guild_name
    FROM global_moderator_requests r LEFT JOIN discord_users u ON u.discord_user_id=r.discord_user_id
    LEFT JOIN discord_guild_members m ON m.guild_id=r.origin_guild_id AND m.discord_user_id=r.discord_user_id
    LEFT JOIN discord_guilds g ON g.guild_id=r.origin_guild_id LEFT JOIN guild_settings gs ON gs.guild_id=r.origin_guild_id
    WHERE r.status='pending' ${esoServer?'AND r.eso_server=?':''} ORDER BY r.eso_server,r.requested_at,r.id`;return this.db.query(sql,esoServer?[requireEsoServer(esoServer)]:[]);}
  listModerators({esoServer=null}={}){return esoServer?this.db.query('SELECT * FROM global_moderators WHERE eso_server=? ORDER BY approved_at,discord_user_id',[requireEsoServer(esoServer)]):this.db.query('SELECT * FROM global_moderators ORDER BY eso_server,approved_at,discord_user_id');}
  async statusForUser(userId){const id=String(userId);await this.#repairLegacyGrant(id);const [grants,requests]=await Promise.all([this.db.query('SELECT * FROM global_moderators WHERE discord_user_id=? ORDER BY eso_server',[id]),this.db.query("SELECT * FROM global_moderator_requests WHERE discord_user_id=? AND status='pending' ORDER BY eso_server,requested_at,id",[id])]);return {grants,requests,isOwner:this.isOwner(userId)};}
  async approve(requestId,approverId){if(!this.isApprover(approverId))throw new Error('Only a configured Global Moderator approver can approve this request.');const req=await withTransaction(this.db,async conn=>{const req=await one(conn,"SELECT * FROM global_moderator_requests WHERE id=? AND status='pending' FOR UPDATE",[Number(requestId)]);if(!req)throw new Error('Pending Global Moderator request not found.');const server=requireEsoServer(req.eso_server);await conn.query(`INSERT INTO global_moderators(discord_user_id,eso_server,approved_by,request_id) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE approved_by=VALUES(approved_by),request_id=VALUES(request_id),approved_at=CURRENT_TIMESTAMP`,[req.discord_user_id,server,String(approverId),req.id]);await conn.query("UPDATE global_moderator_requests SET status='approved',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?",[String(approverId),req.id]);await conn.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)',[req.origin_guild_id||null,String(approverId),'approve_global_moderator','discord_user',String(req.discord_user_id),JSON.stringify({requestId:req.id,esoServer:server})]);return req;});this.cache.set(this.#cacheKey(req.discord_user_id,req.eso_server),true);return req;}
  async deny(requestId,approverId){if(!this.isApprover(approverId))throw new Error('Only a configured Global Moderator approver can deny this request.');return withTransaction(this.db,async conn=>{const req=await one(conn,"SELECT * FROM global_moderator_requests WHERE id=? AND status='pending' FOR UPDATE",[Number(requestId)]);if(!req)throw new Error('Pending Global Moderator request not found.');const server=requireEsoServer(req.eso_server);const changed=await conn.query("UPDATE global_moderator_requests SET status='denied',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'",[String(approverId),Number(requestId)]);if(!Number(changed.affectedRows||0))throw new Error('Pending Global Moderator request not found.');await conn.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)',[req.origin_guild_id||null,String(approverId),'deny_global_moderator','discord_user',String(req.discord_user_id),JSON.stringify({requestId:req.id,esoServer:server})]);return req;});}
  async revoke(userId,esoServer,approverId){if(this.isOwner(userId))throw new Error('Bot owner access is configured through BOT_OWNER_IDS and cannot be revoked here.');if(!this.isApprover(approverId))throw new Error('Only a configured Global Moderator approver can revoke Global Moderator access.');const legacy=esoServer==='legacy',server=legacy?null:requireEsoServer(esoServer),condition=legacy?'eso_server IS NULL':'eso_server=?',args=legacy?[String(userId)]:[String(userId),server];const removed=await withTransaction(this.db,async conn=>{const existing=await one(conn,`SELECT request_id FROM global_moderators WHERE discord_user_id=? AND ${condition}`,args);const r=await conn.query(`DELETE FROM global_moderators WHERE discord_user_id=? AND ${condition}`,args);if(Number(r.affectedRows||0)>0)await conn.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,details) VALUES(NULL,?,?,?,?,?)',[String(approverId),'revoke_global_moderator','discord_user',String(userId),JSON.stringify({requestId:existing?.request_id||null,esoServer:server,legacy})]);return Number(r.affectedRows||0)>0;});if(!legacy)this.cache.set(this.#cacheKey(userId,server),false);return removed;}
}
