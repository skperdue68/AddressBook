import { one, withTransaction } from '../db/database.js';
import { TourReadinessService } from './tour-readiness-service.js';
import { requireEsoServer } from '../utils/eso-server.js';

// Private sharing must be explicitly authorized when the creator starts the session.
// Legacy sessions have no snapshot and cannot acquire Private sharing authority later.
export function sharedTourStillVisible(tour,session){
  if(session?.mode!=='shared')return true;
  if(tour?.source_guild_id&&String(tour.source_guild_id)!==String(session.guild_id))return false;
  if(tour?.visibility==='private')return session.launch_visibility==='private'&&String(tour.creator_id)===String(session.started_by);
  return tour?.visibility==='global'||(tour?.visibility==='public'&&String(tour.guild_id)===String(session.guild_id));
}

export class TourSessionService{
  constructor(db){this.db=db;this.readiness=new TourReadinessService(db);}
  get(id){return one(this.db,'SELECT * FROM tour_sessions WHERE id=?',[Number(id)]);}
  passForSession(id,conn=this.db){return one(conn,'SELECT tsp.id,tsp.status,tsp.tour_id,sps.closed_at FROM share_pass_sessions sps JOIN tour_share_passes tsp ON tsp.id=sps.tour_share_pass_id WHERE sps.tour_session_id=?',[Number(id)]);}
  async #validate(conn,{tourId,guildId,userId,esoServer,passId=null}){const server=requireEsoServer(esoServer);const result=await this.readiness.check(tourId,{viewerId:userId,guildId,esoServer:server,passId,conn});if(result.blocking.length){const error=new Error(result.blocking[0].message);error.code=result.blocking[0].code;throw error;}return result;}
  async startSelfPaced({tourId,guildId,channelId,userId,esoServer,messageId=null}){
    return withTransaction(this.db,async conn=>{
      await this.#validate(conn,{tourId,guildId,userId,esoServer});
      await conn.query("DELETE FROM tour_sessions WHERE guild_id=? AND channel_id=? AND mode='self_paced' AND started_by=?",[guildId,channelId,userId]);
      const r=await conn.query("INSERT INTO tour_sessions(tour_id,guild_id,channel_id,mode,started_by,message_id,current_position) VALUES(?,?,?,'self_paced',?,?,1)",[Number(tourId),guildId,channelId,userId,messageId]);
      return one(conn,'SELECT * FROM tour_sessions WHERE id=?',[r.insertId]);
    });
  }
  async startShared({tourId,guildId,channelId,userId,esoServer,messageId=null}, connection=null){
    const start=async conn=>{
      const {tour}=await this.#validate(conn,{tourId,guildId,userId,esoServer});
      if(!sharedTourStillVisible(tour,{mode:'shared',guild_id:guildId,started_by:userId,launch_visibility:tour.visibility}))throw new Error('Only the creator can share a Private tour, and the tour must be accessible in this server.');
      await conn.query("DELETE FROM tour_sessions WHERE guild_id=? AND channel_id=? AND mode='shared'",[guildId,channelId]);
      const r=await conn.query("INSERT INTO tour_sessions(tour_id,guild_id,channel_id,mode,started_by,message_id,current_position,launch_visibility) VALUES(?,?,?,'shared',?,?,1,?)",[Number(tourId),guildId,channelId,userId,messageId,tour.visibility]);
      return one(conn,'SELECT * FROM tour_sessions WHERE id=?',[r.insertId]);
    };
    return connection ? start(connection) : withTransaction(this.db,start);
  }
  async startFromPass({passId,tourId,guildId,channelId,userId,esoServer,messageId=null}){
    return withTransaction(this.db,async conn=>{
      const pass=await one(conn,"SELECT id FROM tour_share_passes WHERE id=? AND tour_id=? AND status='active'",[Number(passId),Number(tourId)]);
      if(!pass)throw new Error('This Share Pass was revoked by its owner.');
      await this.#validate(conn,{tourId,guildId,userId,esoServer,passId});
      await conn.query("DELETE FROM tour_sessions WHERE guild_id=? AND channel_id=? AND mode='self_paced' AND started_by=?",[guildId,channelId,userId]);
      const result=await conn.query("INSERT INTO tour_sessions(tour_id,guild_id,channel_id,mode,started_by,message_id,current_position) VALUES(?,?,?,'self_paced',?,?,1)",[Number(tourId),guildId,channelId,userId,messageId]);
      await conn.query('INSERT INTO share_pass_sessions(tour_share_pass_id,tour_session_id) VALUES(?,?)',[Number(passId),result.insertId]);
      return one(conn,'SELECT * FROM tour_sessions WHERE id=?',[result.insertId]);
    });
  }
  async closeByPass(passId,reason='pass_revoked'){
    return withTransaction(this.db,async conn=>{
      const rows=await conn.query('SELECT id,tour_session_id FROM share_pass_sessions WHERE tour_share_pass_id=? AND closed_at IS NULL',[Number(passId)]);
      for(const row of rows)if(row.tour_session_id!=null)await conn.query('DELETE FROM tour_sessions WHERE id=?',[row.tour_session_id]);
      await conn.query('UPDATE share_pass_sessions SET closed_at=CURRENT_TIMESTAMP,close_reason=? WHERE tour_share_pass_id=? AND closed_at IS NULL',[reason,Number(passId)]);
      return rows.length;
    });
  }
  async advance(id,delta,maxPosition,{esoServer}={}){return withTransaction(this.db,async conn=>{const current=await one(conn,'SELECT * FROM tour_sessions WHERE id=?',[Number(id)]);if(!current)return null;const pass=await this.passForSession(id,conn);if(pass&&(pass.status!=='active'||pass.closed_at||Number(pass.tour_id)!==Number(current.tour_id)))throw new Error('This Share Pass was revoked by its owner.');const readiness=await this.#validate(conn,{tourId:current.tour_id,guildId:current.guild_id,userId:current.started_by,esoServer,passId:pass?.id});if(!sharedTourStillVisible(readiness.tour,current))throw new Error('This Shared tour has been closed because its visibility or server changed.');const next=Math.max(1,Math.min(readiness.stopCount,Number(current.current_position)+(Number(delta)||0)));await conn.query('UPDATE tour_sessions SET current_position=? WHERE id=?',[next,Number(id)]);return one(conn,'SELECT * FROM tour_sessions WHERE id=?',[Number(id)]);});}
  async end(id){const r=await this.db.query('DELETE FROM tour_sessions WHERE id=?',[Number(id)]);return Number(r.affectedRows||0)>0;}
}
