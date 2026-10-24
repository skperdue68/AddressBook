import {createHash} from 'node:crypto';
import {one} from '../db/database.js';
import {ContentPolicyService} from './content-policy-service.js';
export const activityLabels={registered_house:'registered a house',updated_house:'updated a house',created_tour:'created a housing tour',updated_tour:'updated a housing tour',started_tour:'started a housing tour',resumed_tour:'resumed a housing tour',advanced_tour:'continued a housing tour',searched_houses:'searched houses',searched_tours:'browsed housing tours',viewed_house:'opened a house',viewed_tour:'opened a housing tour',random_house:'discovered a Random House',viewed_featured:'browsed Featured Housing',used_personal:'used My Address Book',opened_portal:'used the web portal',opened_bot:'used HearthBound on Discord'};
const clean=v=>String(v||'').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,100);
const retention=90*86400000;
export class UsageActivityService{
 constructor(db,{clock=()=>Date.now(),logger=console,isGuildActive=null}={}){this.db=db;this.clock=clock;this.logger=logger;this.policy=new ContentPolicyService(db);this.isGuildActive=isGuildActive;}
 async recordUsage({eventKey,kind,actor,originGuildId=null,originGuildName=null,esoServer=null,source,target=null}){
  if(!Object.hasOwn(activityLabels,kind))throw new Error('Unsupported usage event.');if(!eventKey||!actor?.id||!['web','discord'].includes(source))throw new Error('Invalid usage event.');
  let targetKind=null,targetId=null;
  if(target&&['house','tour'].includes(target.kind)){
   const row=await one(this.db,target.kind==='house'?'SELECT scope visibility,eso_server FROM saved_houses WHERE id=?': 'SELECT visibility,eso_server FROM tours WHERE id=?',[Number(target.id)]);
   if(row?.visibility==='private')kind='used_personal';
   else if(row&&['global','public'].includes(row.visibility)&&row.eso_server===esoServer){targetKind=target.kind;targetId=Number(target.id);}
  }
  const sql=this.db.type==='sqlite'?'INSERT OR IGNORE':'INSERT IGNORE';
  await this.db.query(`${sql} INTO usage_events(event_key,occurred_at,actor_id,actor_name,origin_guild_id,origin_guild_name,eso_server,source,kind,target_kind,target_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,[createHash('sha256').update(String(eventKey)).digest('hex'),new Date(this.clock()).toISOString(),String(actor.id),clean(actor.name||actor.displayName||actor.globalName||'A member'),originGuildId?String(originGuildId):null,originGuildId?clean(originGuildName||'A Discord server'):null,esoServer,source,kind,targetKind,targetId]);
  return true;
 }
 async tryRecord(event){try{return await this.recordUsage(event);}catch{this.logger.error('HearthBound usage recording failed; original action was preserved.');return false;}}
 async listActivity(c,{server='',kind='',cursor=null,limit=25}={}){
  const n=Math.max(1,Math.min(50,Math.floor(Number(limit)||25))),clauses=['occurred_at>=?'],args=[new Date(this.clock()-retention).toISOString()];
  if(server){clauses.push('origin_guild_id=?');args.push(String(server).slice(0,32));}if(Object.hasOwn(activityLabels,kind)){clauses.push('kind=?');args.push(kind);}
  if(cursor){try{if(String(cursor).length>256)throw new Error();const value=JSON.parse(Buffer.from(cursor,'base64url').toString());if(!/^\d{4}-\d{2}-\d{2}T/.test(value.time)||!Number.isSafeInteger(value.id)||value.id<=0)throw new Error();clauses.push('(occurred_at<? OR (occurred_at=? AND id<?))');args.push(value.time,value.time,value.id);}catch{throw new Error('Invalid activity page.');}}
  const rows=await this.db.query(`SELECT * FROM usage_events WHERE ${clauses.join(' AND ')} ORDER BY occurred_at DESC,id DESC LIMIT ?`,[...args,n+1]);const items=[];
  for(const row of rows.slice(0,n)){
   const active=row.origin_guild_id?(this.isGuildActive?await this.isGuildActive(row.origin_guild_id):!!await one(this.db,'SELECT guild_id FROM guild_settings WHERE guild_id=? AND eso_server IS NOT NULL',[row.origin_guild_id])):true;
   let targetTitle=null,targetUrl=null;
   if(active&&row.target_id&&row.eso_server===c.esoServer){if(row.target_kind==='house'){const h=await one(this.db,'SELECT s.*,h.name FROM saved_houses s JOIN houses h ON h.house_id=s.house_id WHERE s.id=?',[row.target_id]);if(h?.scope!=='private'&&this.policy.canViewHouse(h,c)){targetTitle=h.display_name||h.name;targetUrl=`/app/houses/${h.id}`;}}
   else if(row.target_kind==='tour'){const t=await one(this.db,'SELECT * FROM tours WHERE id=?',[row.target_id]);if(t?.visibility!=='private'&&this.policy.canViewTour(t,c)){targetTitle=t.name;targetUrl=`/app/tours/${t.id}`;}}}
   items.push({id:Number(row.id),actorName:row.actor_name,kind:row.kind,action:activityLabels[row.kind],serverName:row.origin_guild_id?(active?row.origin_guild_name:'Former server'):'Personal session',source:row.source,occurredAt:row.occurred_at,esoServer:row.eso_server,targetTitle,targetUrl});
  }
  const last=rows.slice(0,n).at(-1);return {items,nextCursor:rows.length>n?Buffer.from(JSON.stringify({time:last.occurred_at,id:Number(last.id)})).toString('base64url'):null};
 }
 async activityServers(){const rows=await this.db.query('SELECT origin_guild_id id,MAX(origin_guild_name) name FROM usage_events WHERE origin_guild_id IS NOT NULL AND occurred_at>=? GROUP BY origin_guild_id ORDER BY name LIMIT 1000',[new Date(this.clock()-retention).toISOString()]);const out=[];for(const row of rows){const active=this.isGuildActive?await this.isGuildActive(row.id):!!await one(this.db,'SELECT guild_id FROM guild_settings WHERE guild_id=? AND eso_server IS NOT NULL',[row.id]);if(active)out.push(row);}return out;}
 async usageTotals(){const since=new Date(this.clock()-retention).toISOString(),row=await one(this.db,'SELECT count(*) actions,count(DISTINCT actor_id) members,count(DISTINCT origin_guild_id) servers,min(occurred_at) since FROM usage_events WHERE occurred_at>=?',[since]);return {actions:Number(row.actions),members:Number(row.members),servers:Number(row.servers),since:row.since,retentionDays:90};}
 async purgeExpired(){const rows=await this.db.query('SELECT id FROM usage_events WHERE occurred_at<? ORDER BY occurred_at,id LIMIT 1000',[new Date(this.clock()-retention).toISOString()]);if(!rows.length)return {affectedRows:0};return this.db.query(`DELETE FROM usage_events WHERE id IN (${rows.map(()=>'?').join(',')})`,rows.map(r=>r.id));}
}
