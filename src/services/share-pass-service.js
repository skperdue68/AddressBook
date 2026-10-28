import { one, withTransaction } from '../db/database.js';
import { AccessContextService } from './access-context-service.js';
import { RateLimitService, rateLimitSettings } from './rate-limit-service.js';
import { ShareTokenService } from './share-token-service.js';
import { TourReadinessService } from './tour-readiness-service.js';
import { requireEsoServer } from '../utils/eso-server.js';

const movedMessage='This Share Pass is no longer valid because the house or tour moved to another ESO environment. Ask its owner for a new pass.';

export class SharePassService{
  constructor(db,{tokens=new ShareTokenService(),rateLimiter=new RateLimitService(),settings=rateLimitSettings()}={}){
    this.db=db;this.tokens=tokens;this.rateLimiter=rateLimiter;this.settings=settings;this.access=new AccessContextService(db);this.readiness=new TourReadinessService(db);
  }

  async lastPostedDestination(userId,guildId){
    const rows=await this.db.query(`SELECT channel_id,channel_name,created_at FROM house_share_passes WHERE created_by=? AND origin_guild_id=? AND message_id IS NOT NULL AND channel_id IS NOT NULL
      UNION ALL SELECT channel_id,channel_name,created_at FROM tour_share_passes WHERE created_by=? AND origin_guild_id=? AND message_id IS NOT NULL AND channel_id IS NOT NULL ORDER BY created_at DESC,channel_id DESC LIMIT 1`,[String(userId),String(guildId),String(userId),String(guildId)]);
    return rows[0]||null;
  }

  #consume(userId){
    const result=this.rateLimiter.consume({bucket:'share-pass',userId,...this.settings.share});
    if(!result.allowed)throw new Error(`Please wait ${Math.ceil(result.retryAfterMs/1000)} seconds before using another Share Pass.`);
  }

  #consumeAccess(userId){
    const result=this.rateLimiter.consume({bucket:'share-pass-access',userId,...this.settings.shareAccess});
    if(!result.allowed)throw new Error(`Please wait ${Math.ceil(result.retryAfterMs/1000)} seconds before opening another Share Pass screen.`);
  }

  async createHousePass({savedHouseId,createdBy,originGuildId=null,esoServer,channelId=null,names={}}){
    const server=requireEsoServer(esoServer);
    this.#consume(createdBy);
    const access=await this.access.forHouse({userId:createdBy,guildId:originGuildId,esoServer:server,savedHouseId});
    if(!access.environmentMatch)throw new Error(access.message);
    if(!access.canShare)throw new Error('You need normal access, and Private houses can only be shared by their owner.');
    const issued=this.tokens.issue();
    const result=await this.db.query(`INSERT INTO house_share_passes(
      token_hash,saved_house_id,created_by,created_by_global_name,created_by_display_name,
      origin_guild_id,origin_guild_name,channel_id,channel_name,status
    ) VALUES(?,?,?,?,?,?,?,?,?,'active')`,[
      issued.hash,Number(savedHouseId),String(createdBy),names.createdByGlobalName||null,names.createdByDisplayName||null,
      originGuildId,names.originGuildName||null,channelId,names.channelName||null
    ]);
    const pass=await one(this.db,'SELECT * FROM house_share_passes WHERE id=?',[result.insertId]);
    await this.#audit({guildId:originGuildId,actorId:createdBy,action:'house_pass_created',entityId:pass.id,details:{savedHouseId}});
    return {pass,token:issued.token};
  }

  async markHousePassPosted(id,{guildId=null,channelId,messageId,channelName=null}){
    await this.db.query('UPDATE house_share_passes SET origin_guild_id=coalesce(?,origin_guild_id),channel_id=?,channel_name=?,message_id=? WHERE id=?',[guildId,channelId,channelName,messageId,Number(id)]);
    return one(this.db,'SELECT * FROM house_share_passes WHERE id=?',[Number(id)]);
  }

  async resolveHousePass(token,{userId,guildId,esoServer}){
    this.#consumeAccess(userId);
    const hash=this.tokens.hash(token),pass=await one(this.db,'SELECT * FROM house_share_passes WHERE token_hash=?',[hash]);
    if(!pass)throw new Error('This share card is no longer connected to an active pass.');
    if(pass.status!=='active')throw new Error(pass.revocation_reason==='environment_changed'?movedMessage:'This Share Pass was revoked by its owner.');
    if(pass.saved_house_id==null)throw new Error('This house is no longer available.');
    const access=await this.access.forHouse({userId,guildId,esoServer,savedHouseId:pass.saved_house_id,passId:pass.id});
    if(!access.environmentMatch)throw new Error(access.message);
    if(!access.canView)throw new Error('This share card is no longer connected to an active pass.');
    await this.db.query('UPDATE house_share_passes SET usage_count=usage_count+1,last_used_at=CURRENT_TIMESTAMP WHERE id=?',[pass.id]);
    await this.#audit({guildId,actorId:userId,action:'house_pass_used',entityId:pass.id,details:{savedHouseId:pass.saved_house_id}});
    return {pass:await one(this.db,'SELECT * FROM house_share_passes WHERE id=?',[pass.id]),house:access.record,access};
  }

  async repostHousePass(id,{actorId,guildId=null,channelId=null,messageId=null,channelName=null}){
    return withTransaction(this.db,async conn=>{
      const pass=await one(conn,'SELECT * FROM house_share_passes WHERE id=?',[Number(id)]);
      if(!pass||pass.status!=='active')throw new Error('That House Share Pass is not active.');
      if(String(pass.created_by)!==String(actorId))throw new Error('Only the Share Pass creator can repost this card.');
      const issued=this.tokens.issue();
      await conn.query('UPDATE house_share_passes SET token_hash=?,origin_guild_id=coalesce(?,origin_guild_id),channel_id=?,channel_name=?,message_id=? WHERE id=?',[issued.hash,guildId,channelId,channelName,messageId,pass.id]);
      await this.#audit({conn,guildId:guildId||pass.origin_guild_id,actorId,action:'house_pass_reposted',entityId:pass.id,details:{channelId,messageId}});
      return {pass:await one(conn,'SELECT * FROM house_share_passes WHERE id=?',[pass.id]),token:issued.token};
    });
  }

  async revokeHousePass(id,{actorId,reason=null,isServerModerator=false,isGlobalModerator=false}={}){
    return withTransaction(this.db,async conn=>{
      const pass=await one(conn,'SELECT * FROM house_share_passes WHERE id=?',[Number(id)]);
      if(!pass)throw new Error('House Share Pass not found.');
      const house=pass.saved_house_id==null?null:await one(conn,'SELECT * FROM saved_houses WHERE id=?',[pass.saved_house_id]);
      const creator=String(pass.created_by)===String(actorId);
      const moderatorAllowed=house?.scope==='public'&&isServerModerator||house?.scope==='global'&&isGlobalModerator;
      if(!creator&&!moderatorAllowed)throw new Error('Only the Share Pass creator or an authorized moderator can revoke it.');
      if(pass.status==='revoked')return pass;
      await conn.query("UPDATE house_share_passes SET status='revoked',revoked_at=CURRENT_TIMESTAMP,revoked_by=?,revocation_reason=? WHERE id=?",[String(actorId),reason||null,pass.id]);
      await this.#audit({conn,guildId:pass.origin_guild_id,actorId,action:'house_pass_revoked',entityId:pass.id,details:{reason}});
      return one(conn,'SELECT * FROM house_share_passes WHERE id=?',[pass.id]);
    });
  }

  listHousePasses(createdBy,{limit=25,offset=0}={}){
    return this.db.query('SELECT * FROM house_share_passes WHERE created_by=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?',[String(createdBy),Number(limit),Number(offset)]);
  }

  async createTourPass({tourId,createdBy,originGuildId=null,esoServer,channelId=null,names={}}){
    const server=requireEsoServer(esoServer);
    this.#consume(createdBy);
    const access=await this.access.forTour({userId:createdBy,guildId:originGuildId,esoServer:server,tourId});
    if(!access.environmentMatch)throw new Error(access.message);
    if(!access.canShare)throw new Error('You need normal access, and Private tours can only be shared by their creator.');
    const readiness=await this.readiness.check(tourId,{viewerId:createdBy,guildId:originGuildId,esoServer:access.record.eso_server});
    if(readiness.blocking.length)throw new Error(readiness.blocking[0].message);
    const issued=this.tokens.issue();
    const result=await this.db.query(`INSERT INTO tour_share_passes(
      token_hash,tour_id,created_by,created_by_global_name,created_by_display_name,
      origin_guild_id,origin_guild_name,channel_id,channel_name,status
    ) VALUES(?,?,?,?,?,?,?,?,?,'active')`,[
      issued.hash,Number(tourId),String(createdBy),names.createdByGlobalName||null,names.createdByDisplayName||null,
      originGuildId,names.originGuildName||null,channelId,names.channelName||null
    ]);
    const pass=await one(this.db,'SELECT * FROM tour_share_passes WHERE id=?',[result.insertId]);
    await this.#tourAudit({guildId:originGuildId,actorId:createdBy,action:'tour_pass_created',entityId:pass.id,details:{tourId}});
    return {pass,token:issued.token,readiness};
  }

  async markTourPassPosted(id,{guildId=null,channelId,messageId,channelName=null}){
    await this.db.query('UPDATE tour_share_passes SET origin_guild_id=coalesce(?,origin_guild_id),channel_id=?,channel_name=?,message_id=? WHERE id=?',[guildId,channelId,channelName,messageId,Number(id)]);
    return one(this.db,'SELECT * FROM tour_share_passes WHERE id=?',[Number(id)]);
  }

  async resolveTourPass(token,{userId,guildId,esoServer}){
    this.#consumeAccess(userId);
    const hash=this.tokens.hash(token),pass=await one(this.db,'SELECT * FROM tour_share_passes WHERE token_hash=?',[hash]);
    if(!pass)throw new Error('This share card is no longer connected to an active pass.');
    if(pass.status!=='active')throw new Error(pass.revocation_reason==='environment_changed'?movedMessage:'This Share Pass was revoked by its owner.');
    if(pass.tour_id==null)throw new Error('This tour is no longer available.');
    const access=await this.access.forTour({userId,guildId,esoServer,tourId:pass.tour_id,passId:pass.id});
    if(!access.environmentMatch)throw new Error(access.message);
    if(!access.canView)throw new Error('This share card is no longer connected to an active pass.');
    const readiness=await this.readiness.check(pass.tour_id,{viewerId:userId,guildId,esoServer,passId:pass.id});
    if(readiness.blocking.length)throw new Error(readiness.blocking[0].message);
    const stops=await this.db.query(`SELECT ts.*,sh.destination_id,sh.eso_server,sh.scope,sh.eso_owner,sh.house_id,sh.display_name,h.name house_name
      FROM tour_stops ts JOIN saved_houses sh ON sh.id=ts.saved_house_id JOIN houses h ON h.house_id=sh.house_id
      WHERE ts.tour_id=? ORDER BY ts.position`,[pass.tour_id]);
    await this.db.query('UPDATE tour_share_passes SET usage_count=usage_count+1,last_used_at=CURRENT_TIMESTAMP WHERE id=?',[pass.id]);
    await this.#tourAudit({guildId,actorId:userId,action:'tour_pass_used',entityId:pass.id,details:{tourId:pass.tour_id}});
    return {pass:await one(this.db,'SELECT * FROM tour_share_passes WHERE id=?',[pass.id]),tour:access.record,stops,access,readiness};
  }

  async repostTourPass(id,{actorId,guildId=null,channelId=null,messageId=null,channelName=null}){
    return withTransaction(this.db,async conn=>{
      const pass=await one(conn,'SELECT * FROM tour_share_passes WHERE id=?',[Number(id)]);
      if(!pass||pass.status!=='active')throw new Error('That Tour Pass is not active.');
      if(String(pass.created_by)!==String(actorId))throw new Error('Only the Tour Pass creator can repost this card.');
      const issued=this.tokens.issue();
      await conn.query('UPDATE tour_share_passes SET token_hash=?,origin_guild_id=coalesce(?,origin_guild_id),channel_id=?,channel_name=?,message_id=? WHERE id=?',[issued.hash,guildId,channelId,channelName,messageId,pass.id]);
      await this.#tourAudit({conn,guildId:guildId||pass.origin_guild_id,actorId,action:'tour_pass_reposted',entityId:pass.id,details:{channelId,messageId}});
      return {pass:await one(conn,'SELECT * FROM tour_share_passes WHERE id=?',[pass.id]),token:issued.token};
    });
  }

  async revokeTourPass(id,{actorId,reason=null,isServerModerator=false,isGlobalModerator=false}={}){
    return withTransaction(this.db,async conn=>{
      const pass=await one(conn,'SELECT * FROM tour_share_passes WHERE id=?',[Number(id)]);
      if(!pass)throw new Error('Tour Pass not found.');
      const tour=pass.tour_id==null?null:await one(conn,'SELECT * FROM tours WHERE id=?',[pass.tour_id]);
      const creator=String(pass.created_by)===String(actorId);
      const moderatorAllowed=tour?.visibility==='public'&&isServerModerator||tour?.visibility==='global'&&isGlobalModerator;
      if(!creator&&!moderatorAllowed)throw new Error('Only the Tour Pass creator or an authorized moderator can revoke it.');
      if(pass.status==='revoked')return pass;
      const sessions=await conn.query('SELECT id,tour_session_id FROM share_pass_sessions WHERE tour_share_pass_id=? AND closed_at IS NULL',[pass.id]);
      for(const session of sessions)if(session.tour_session_id!=null)await conn.query('DELETE FROM tour_sessions WHERE id=?',[session.tour_session_id]);
      await conn.query('UPDATE share_pass_sessions SET closed_at=CURRENT_TIMESTAMP,close_reason=? WHERE tour_share_pass_id=? AND closed_at IS NULL',['pass_revoked',pass.id]);
      await conn.query("UPDATE tour_share_passes SET status='revoked',revoked_at=CURRENT_TIMESTAMP,revoked_by=?,revocation_reason=? WHERE id=?",[String(actorId),reason||null,pass.id]);
      await this.#tourAudit({conn,guildId:pass.origin_guild_id,actorId,action:'tour_pass_revoked',entityId:pass.id,details:{reason,closedSessions:sessions.length}});
      return one(conn,'SELECT * FROM tour_share_passes WHERE id=?',[pass.id]);
    });
  }

  listTourPasses(createdBy,{limit=25,offset=0}={}){
    return this.db.query('SELECT * FROM tour_share_passes WHERE created_by=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?',[String(createdBy),Number(limit),Number(offset)]);
  }

  async revokeForEnvironmentMove(conn,{houseIds=[],tourIds=[],actorId,reason='environment_changed'}={}){
    const houses=[...new Set(houseIds.map(Number).filter(Number.isFinite))],tours=[...new Set(tourIds.map(Number).filter(Number.isFinite))];
    let housePasses=0,tourPasses=0,sessions=0;
    if(houses.length){const rows=await conn.query(`SELECT id,saved_house_id,origin_guild_id FROM house_share_passes WHERE status='active' AND saved_house_id IN (${houses.map(()=>'?').join(',')})`,houses);for(const row of rows){await conn.query("UPDATE house_share_passes SET status='revoked',revoked_at=CURRENT_TIMESTAMP,revoked_by=?,revocation_reason=? WHERE id=?",[String(actorId),reason,row.id]);await this.#audit({conn,guildId:row.origin_guild_id,actorId,action:'house_pass_revoked',entityId:row.id,details:{reason,savedHouseId:row.saved_house_id,environmentChange:true}});housePasses++;}}
    if(tours.length){const rows=await conn.query(`SELECT id,tour_id,origin_guild_id FROM tour_share_passes WHERE status='active' AND tour_id IN (${tours.map(()=>'?').join(',')})`,tours);for(const row of rows){const open=await conn.query('SELECT id,tour_session_id FROM share_pass_sessions WHERE tour_share_pass_id=? AND closed_at IS NULL',[row.id]);for(const session of open)if(session.tour_session_id!=null)await conn.query('DELETE FROM tour_sessions WHERE id=?',[session.tour_session_id]);await conn.query('UPDATE share_pass_sessions SET closed_at=CURRENT_TIMESTAMP,close_reason=? WHERE tour_share_pass_id=? AND closed_at IS NULL',[reason,row.id]);await conn.query("UPDATE tour_share_passes SET status='revoked',revoked_at=CURRENT_TIMESTAMP,revoked_by=?,revocation_reason=? WHERE id=?",[String(actorId),reason,row.id]);await this.#tourAudit({conn,guildId:row.origin_guild_id,actorId,action:'tour_pass_revoked',entityId:row.id,details:{reason,tourId:row.tour_id,closedSessions:open.length,environmentChange:true}});sessions+=open.length;tourPasses++;}}
    return {housePasses,tourPasses,sessions};
  }

  async #audit({conn=this.db,guildId,actorId,action,entityId,details}){
    await conn.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)',[guildId||null,String(actorId),action,'house_share_pass',String(entityId),JSON.stringify(details||{})]);
  }

  async #tourAudit({conn=this.db,guildId,actorId,action,entityId,details}){
    await conn.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)',[guildId||null,String(actorId),action,'tour_share_pass',String(entityId),JSON.stringify(details||{})]);
  }
}
