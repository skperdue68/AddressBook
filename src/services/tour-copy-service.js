import { one, withTransaction } from '../db/database.js';
import { AccessContextService } from './access-context-service.js';
import { HouseCopyService } from './house-copy-service.js';
import { TourReadinessService } from './tour-readiness-service.js';
import { TourService } from './tour-service.js';

const activeCopies=new WeakMap();
const parseTags=value=>{try{return Array.isArray(value)?value:JSON.parse(value||'[]');}catch{return[];}};

export class TourCopyService{
  constructor(db,{hooks={}}={}){
    this.db=db;this.hooks=hooks;this.access=new AccessContextService(db);this.houses=new HouseCopyService(db);this.readiness=new TourReadinessService(db);this.tours=new TourService(db);
  }

  async preview({tourId,passId,userId,guildId,esoServer,conn=this.db}){
    const tourAccess=await this.access.forTour({userId,guildId,esoServer,tourId,passId,conn});
    if(!tourAccess.environmentMatch)throw new Error(tourAccess.message);
    if(!tourAccess.pass||!tourAccess.canCopy)throw new Error('This shared tour is no longer available to copy.');
    const readiness=await this.readiness.check(tourId,{viewerId:userId,guildId,esoServer,passId,conn});
    if(readiness.blocking.length)throw new Error(readiness.blocking[0].message);
    const source=await this.tours.get(tourId,conn);
    const rows=await conn.query(`SELECT ts.*,sh.destination_id,sh.scope,sh.status,sh.id source_saved_house_id,sh.display_name,sh.description,sh.tags,sh.eso_owner,sh.house_id,h.name house_name
      FROM tour_stops ts JOIN saved_houses sh ON sh.id=ts.saved_house_id JOIN houses h ON h.house_id=sh.house_id
      WHERE ts.tour_id=? ORDER BY ts.position`,[Number(tourId)]);
    const stops=[];
    for(const row of rows){
      const normal=await this.access.forHouse({userId,guildId,esoServer,savedHouseId:row.source_saved_house_id,conn});
      let reusable=normal.normalAccess?normal.record:null;
      if(!reusable)reusable=await one(conn,`SELECT * FROM saved_houses WHERE destination_id=? AND status='active' AND (scope='global' OR (scope='public' AND guild_id=?) OR (scope='private' AND owner_user_id=?)) ORDER BY CASE scope WHEN 'global' THEN 1 WHEN 'public' THEN 2 ELSE 3 END,id LIMIT 1`,[row.destination_id,guildId,String(userId)]);
      stops.push({
        position:Number(row.position),sourceSavedHouseId:Number(row.source_saved_house_id),destinationId:Number(row.destination_id),
        reuseSavedHouseId:reusable?Number(reusable.id):null,customTitle:row.custom_title||null,notes:row.notes||null,
        houseName:row.house_name,esoOwner:row.eso_owner
      });
    }
    return {
      tour:source,name:source.name,description:source.description,tags:parseTags(source.tags),advisories:readiness.advisories,
      totalStops:stops.length,reusedStops:stops.filter(stop=>stop.reuseSavedHouseId!=null).length,copiedStops:stops.filter(stop=>stop.reuseSavedHouseId==null).length,stops
    };
  }

  async copy({tourId,passId,userId,guildId,esoServer,name,description}){
    let set=activeCopies.get(this.db);if(!set){set=new Set();activeCopies.set(this.db,set);}
    const key=`${tourId}:${passId}:${userId}`;
    if(set.has(key))throw new Error('This tour copy is already being processed; the second request is stale.');
    set.add(key);
    try{
      return await withTransaction(this.db,async conn=>{
        const preview=await this.preview({tourId,passId,userId,guildId,esoServer,conn});
        const copiedTour=await this.tours.createInConnection(conn,{visibility:'private',creatorId:userId,originGuildId:guildId,sourceGuildId:guildId,esoServer,name:name??preview.name,description:description??preview.description,tags:preview.tags});
        for(let index=0;index<preview.stops.length;index++){
          const stop=preview.stops[index];
          const savedHouseId=stop.reuseSavedHouseId??(await this.houses.copyPrivateInConnection(conn,{sourceSavedHouseId:stop.sourceSavedHouseId,userId,targetEsoServer:esoServer})).id;
          await this.tours.addStopInConnection(conn,{tourId:copiedTour.id,savedHouseId,position:stop.position,customTitle:stop.customTitle,notes:stop.notes});
          await this.hooks.afterStop?.({index:index+1,stop,copiedTour,conn});
        }
        const actor=await one(conn,'SELECT global_name,username FROM discord_users WHERE discord_user_id=?',[String(userId)]);
        const member=guildId?await one(conn,'SELECT display_name FROM discord_guild_members WHERE guild_id=? AND discord_user_id=?',[String(guildId),String(userId)]):null;
        const guild=guildId?await one(conn,'SELECT guild_name FROM discord_guilds WHERE guild_id=?',[String(guildId)]):null;
        const details={sourceTourId:Number(tourId),copiedTourId:Number(copiedTour.id),passId:Number(passId),sourceEsoServer:preview.tour.eso_server,targetEsoServer:esoServer,reusedStops:preview.reusedStops,copiedStops:preview.copiedStops};
        await conn.query(`INSERT INTO audit_log(guild_id,guild_name,actor_id,actor_global_name,actor_display_name,action,entity_type,entity_id,entity_name,details)
          VALUES(?,?,?,?,?,?,?,?,?,?)`,[guildId||null,guild?.guild_name||null,String(userId),actor?.global_name||actor?.username||null,member?.display_name||null,'tour_copied','tour',String(copiedTour.id),copiedTour.name,JSON.stringify(details)]);
        return copiedTour;
      });
    }catch(error){
      if(/already being processed|no longer available to copy/i.test(error.message))throw error;
      throw new Error(`Nothing was copied and the original tour was unchanged. ${error.message}`,{cause:error});
    }finally{set.delete(key);}
  }
}
