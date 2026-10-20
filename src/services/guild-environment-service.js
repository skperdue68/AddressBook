import crypto from 'node:crypto';
import { one, withTransaction } from '../db/database.js';
import { assignGuildLegacyDataInConnection, assignPrivateLegacyData } from '../db/environment-migration.js';
import { requireEsoServer } from '../utils/eso-server.js';
import { SharePassService } from './share-pass-service.js';
import { tourAllowsHouseScope } from './saved-house-service.js';

const sortedIds=rows=>rows.map(row=>Number(row.id)).sort((a,b)=>a-b);
const placeholders=rows=>rows.map(()=>'?').join(',');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

export class GuildEnvironmentService{
  constructor(db,{guildService=null}={}){this.db=db;this.guildService=guildService;this.cache=new Map();this.locks=new Map();this.sharePasses=new SharePassService(db);}
  invalidate(guildId){this.cache.delete(String(guildId));this.guildService?.invalidate(String(guildId));}
  async get(guildId){const id=String(guildId||'');if(!id)return null;if(this.cache.has(id))return this.cache.get(id);await this.db.query('INSERT IGNORE INTO guild_settings(guild_id) VALUES(?)',[id]);const row=await one(this.db,'SELECT eso_server FROM guild_settings WHERE guild_id=?',[id]);const value=row?.eso_server||null;this.cache.set(id,value);return value;}
  async requireConfigured(guildId){const value=await this.get(guildId);if(!value)throw new Error('This Discord server still needs an ESO environment selected.');return value;}

  async #selectInitialUnlocked({guildId,esoServer,actorId,names={}}){
    const id=String(guildId),server=requireEsoServer(esoServer);
    const result=await withTransaction(this.db,async conn=>{
      await conn.query('INSERT IGNORE INTO guild_settings(guild_id) VALUES(?)',[id]);
      const changed=await conn.query(`UPDATE guild_settings SET eso_server=?,eso_server_selected_by=?,eso_server_selected_at=CURRENT_TIMESTAMP WHERE guild_id=? AND eso_server IS NULL`,[server,String(actorId),id]);
      if(Number(changed.affectedRows)!==1){const current=await one(conn,'SELECT eso_server FROM guild_settings WHERE guild_id=?',[id]);return {selected:false,esoServer:current?.eso_server||null,assignment:null};}
      const assignment=await assignGuildLegacyDataInConnection(conn,{guildId:id,esoServer:server,actorId});
      await conn.query(`INSERT INTO audit_log(guild_id,guild_name,actor_id,actor_global_name,actor_display_name,action,entity_type,entity_id,entity_name,details) VALUES(?,?,?,?,?,?,?,?,?,?)`,[id,names.guildName||null,String(actorId),names.actorGlobalName||null,names.actorDisplayName||null,'select_guild_eso_server','guild',id,names.guildName||null,JSON.stringify({esoServer:server,assignment})]);
      return {selected:true,esoServer:server,assignment};
    });
    this.invalidate(id);return result;
  }
  selectInitial(args){const id=String(args.guildId),prior=this.locks.get(id)||Promise.resolve(),next=prior.then(()=>this.#selectInitialUnlocked(args)),tracked=next.catch(()=>{});this.locks.set(id,tracked);return next.finally(()=>{if(this.locks.get(id)===tracked)this.locks.delete(id);});}

  async #buildChangePreview(conn,{guildId,toEsoServer}){
    const id=String(guildId),to=requireEsoServer(toEsoServer),settings=await one(conn,'SELECT guild_id,eso_server,updated_at FROM guild_settings WHERE guild_id=?',[id]);
    if(!settings?.eso_server)throw new Error('This Discord server still needs an ESO environment selected.');
    const from=requireEsoServer(settings.eso_server);if(from===to)throw new Error('Choose a different ESO environment.');
    const houses=await conn.query(`SELECT id,eso_server,destination_id,scope,guild_id,origin_guild_id,normalized_owner,eso_owner,house_id,updated_at FROM saved_houses WHERE eso_server=? AND ((scope='public' AND guild_id=?) OR (scope IN ('global','private') AND origin_guild_id=?)) ORDER BY id`,[from,id,id]);
    const tours=await conn.query(`SELECT id,eso_server,visibility,guild_id,origin_guild_id,updated_at FROM tours WHERE eso_server=? AND ((visibility='public' AND guild_id=?) OR (visibility IN ('global','private') AND origin_guild_id=?)) ORDER BY id`,[from,id,id]);
    const houseIds=sortedIds(houses),tourIds=sortedIds(tours),movingHouses=new Set(houseIds),movingTours=new Set(tourIds),strategies=[];
    const engagementEvents=tourIds.length?await conn.query(`SELECT id FROM tour_events WHERE tour_id IN (${placeholders(tourIds)}) ORDER BY id`,tourIds):[];
    for(const house of houses){
      if(strategies.some(item=>item.sourceId===Number(house.destination_id)))continue;
      const target=await one(conn,'SELECT id FROM housing_destinations WHERE eso_server=? AND normalized_owner=? AND house_id=?',[to,house.normalized_owner,Number(house.house_id)]);
      const unmoved=await one(conn,`SELECT count(*) c FROM saved_houses WHERE destination_id=?${houseIds.length?` AND id NOT IN (${placeholders(houseIds)})`:''}`,[Number(house.destination_id),...houseIds]);
      strategies.push({sourceId:Number(house.destination_id),targetId:target?Number(target.id):null,action:target?'reuse':Number(unmoved?.c||0)===0?'claim':'create',normalizedOwner:house.normalized_owner,esoOwner:house.eso_owner,houseId:Number(house.house_id)});
    }
    strategies.sort((a,b)=>a.sourceId-b.sourceId);
    const stops=await conn.query(`SELECT ts.id,ts.tour_id,ts.position,ts.saved_house_id,t.eso_server tour_eso_server,t.visibility,sh.eso_server house_eso_server,sh.scope FROM tour_stops ts JOIN tours t ON t.id=ts.tour_id JOIN saved_houses sh ON sh.id=ts.saved_house_id ORDER BY ts.tour_id,ts.position,ts.id`);
    const removedStops=stops.filter(stop=>{if(!movingTours.has(Number(stop.tour_id))&&!movingHouses.has(Number(stop.saved_house_id)))return false;const tourServer=movingTours.has(Number(stop.tour_id))?to:stop.tour_eso_server,houseServer=movingHouses.has(Number(stop.saved_house_id))?to:stop.house_eso_server;return !tourServer||!houseServer||tourServer!==houseServer||!tourAllowsHouseScope({visibility:stop.visibility},stop.scope);});
    const housePasses=houseIds.length?await conn.query(`SELECT id FROM house_share_passes WHERE status='active' AND saved_house_id IN (${placeholders(houseIds)}) ORDER BY id`,houseIds):[];
    const tourPasses=tourIds.length?await conn.query(`SELECT id FROM tour_share_passes WHERE status='active' AND tour_id IN (${placeholders(tourIds)}) ORDER BY id`,tourIds):[];
    const tourPassIds=sortedIds(tourPasses),sessions=tourPassIds.length?await conn.query(`SELECT id FROM share_pass_sessions WHERE closed_at IS NULL AND tour_share_pass_id IN (${placeholders(tourPassIds)}) ORDER BY id`,tourPassIds):[];
    const unresolvedHouses=await one(conn,'SELECT count(*) c FROM saved_houses WHERE eso_server IS NULL AND (guild_id=? OR origin_guild_id=?)',[id,id]),unresolvedTours=await one(conn,'SELECT count(*) c FROM tours WHERE eso_server IS NULL AND (guild_id=? OR origin_guild_id=?)',[id,id]);
    const canonical={guildId:id,fromEsoServer:from,toEsoServer:to,settingsUpdatedAt:String(settings.updated_at||''),houses:houses.map(row=>[Number(row.id),row.eso_server,Number(row.destination_id),row.scope,row.guild_id,row.origin_guild_id,String(row.updated_at||'')]),tours:tours.map(row=>[Number(row.id),row.eso_server,row.visibility,row.guild_id,row.origin_guild_id,String(row.updated_at||'')]),destinations:strategies,engagementEventIds:sortedIds(engagementEvents),affectedStops:stops.filter(row=>movingTours.has(Number(row.tour_id))||movingHouses.has(Number(row.saved_house_id))).map(row=>[Number(row.id),Number(row.tour_id),Number(row.position),Number(row.saved_house_id),row.tour_eso_server,row.house_eso_server,row.visibility,row.scope]),removedStopIds:sortedIds(removedStops),removedStopTourIds:[...new Set(removedStops.map(row=>Number(row.tour_id)))].sort((a,b)=>a-b),housePassIds:sortedIds(housePasses),tourPassIds,sessionIds:sortedIds(sessions),unresolved:[Number(unresolvedHouses?.c||0),Number(unresolvedTours?.c||0)]};
    const counts={houses:houses.length,serverHouses:houses.filter(row=>row.scope==='public').length,globalHouses:houses.filter(row=>row.scope==='global').length,privateHouses:houses.filter(row=>row.scope==='private').length,tours:tours.length,serverTours:tours.filter(row=>row.visibility==='public').length,globalTours:tours.filter(row=>row.visibility==='global').length,privateTours:tours.filter(row=>row.visibility==='private').length,engagementEvents:engagementEvents.length,removedStops:removedStops.length,destinations:strategies.length,destinationsClaimed:strategies.filter(row=>row.action==='claim').length,destinationsReused:strategies.filter(row=>row.action==='reuse').length,destinationsCreated:strategies.filter(row=>row.action==='create').length,housePasses:housePasses.length,tourPasses:tourPasses.length,sessions:sessions.length,unresolvedRecords:Number(unresolvedHouses?.c||0)+Number(unresolvedTours?.c||0)};
    return {...canonical,houseIds,tourIds,counts,fingerprint:hash(canonical)};
  }
  previewChange({guildId,toEsoServer}){return this.#buildChangePreview(this.db,{guildId,toEsoServer});}

  listGuildLegacyTours({guildId}){
    const id=String(guildId);
    return this.db.query(`SELECT id,visibility,guild_id,origin_guild_id,creator_id,creator_global_name,creator_display_name,name,description,updated_at
      FROM tours WHERE eso_server IS NULL AND ((visibility='public' AND guild_id=?) OR (visibility='global' AND origin_guild_id=?))
      ORDER BY CASE visibility WHEN 'global' THEN 1 ELSE 2 END,name,id`,[id,id]);
  }

  async #buildGuildLegacyTourPreview(conn,{guildId,tourId}){
    const id=String(guildId),settings=await one(conn,'SELECT eso_server,updated_at FROM guild_settings WHERE guild_id=?',[id]);
    if(!settings?.eso_server)throw new Error('This Discord server still needs an ESO environment selected.');
    const tour=await one(conn,`SELECT id,visibility,guild_id,origin_guild_id,creator_id,creator_global_name,creator_display_name,name,description,updated_at
      FROM tours WHERE id=? AND eso_server IS NULL AND ((visibility='public' AND guild_id=?) OR (visibility='global' AND origin_guild_id=?))`,[Number(tourId),id,id]);
    if(!tour)throw new Error('That legacy tour is no longer available to this Discord server.');
    const stops=await conn.query(`SELECT ts.id,ts.position,ts.saved_house_id,sh.eso_server,sh.scope
      FROM tour_stops ts JOIN saved_houses sh ON sh.id=ts.saved_house_id WHERE ts.tour_id=? ORDER BY ts.position,ts.id`,[Number(tour.id)]);
    const retained=stops.filter(stop=>stop.eso_server===settings.eso_server&&tourAllowsHouseScope(tour,stop.scope));
    const retainedIds=new Set(retained.map(stop=>Number(stop.id))),removed=stops.filter(stop=>!retainedIds.has(Number(stop.id)));
    const canonical={guildId:id,esoServer:settings.eso_server,settingsUpdatedAt:String(settings.updated_at||''),tour:[Number(tour.id),tour.visibility,tour.guild_id,tour.origin_guild_id,tour.creator_id,tour.name,String(tour.updated_at||'')],stops:stops.map(stop=>[Number(stop.id),Number(stop.position),Number(stop.saved_house_id),stop.eso_server,stop.scope]),removedStopIds:sortedIds(removed)};
    return {...canonical,...tour,tourId:Number(tour.id),retainedStopIds:sortedIds(retained),counts:{stops:stops.length,retainedStops:retained.length,removedStops:removed.length},fingerprint:hash(canonical)};
  }
  previewGuildLegacyTour(args){return this.#buildGuildLegacyTourPreview(this.db,args);}

  async confirmGuildLegacyTour({guildId,tourId,actorId,expectedFingerprint,names={}}){
    return withTransaction(this.db,async conn=>{
      const preview=await this.#buildGuildLegacyTourPreview(conn,{guildId,tourId});
      if(preview.fingerprint!==String(expectedFingerprint||''))throw new Error('The legacy-tour impact changed before confirmation. Review the updated impact and try again.');
      if(preview.removedStopIds.length)await conn.query(`DELETE FROM tour_stops WHERE id IN (${placeholders(preview.removedStopIds)})`,preview.removedStopIds);
      const remaining=await conn.query('SELECT id FROM tour_stops WHERE tour_id=? ORDER BY position,id',[Number(preview.tourId)]);
      for(let n=0;n<remaining.length;n++)await conn.query('UPDATE tour_stops SET position=? WHERE id=?',[n+1,Number(remaining[n].id)]);
      await conn.query('UPDATE tours SET eso_server=? WHERE id=?',[preview.esoServer,Number(preview.tourId)]);
      const details={tourId:preview.tourId,tourName:preview.name,visibility:preview.visibility,esoServer:preview.esoServer,counts:preview.counts,fingerprint:preview.fingerprint};
      await conn.query(`INSERT INTO audit_log(guild_id,guild_name,actor_id,actor_global_name,actor_display_name,action,entity_type,entity_id,entity_name,details) VALUES(?,?,?,?,?,?,?,?,?,?)`,[String(guildId),names.guildName||null,String(actorId),names.actorGlobalName||null,names.actorDisplayName||null,'claim_legacy_tour','tour',String(preview.tourId),preview.name,JSON.stringify(details)]);
      return {...preview,details};
    });
  }

  async confirmChange({guildId,toEsoServer,actorId,expectedFingerprint,names={}}){
    const id=String(guildId),to=requireEsoServer(toEsoServer);
    const result=await withTransaction(this.db,async conn=>{
      const preview=await this.#buildChangePreview(conn,{guildId:id,toEsoServer:to});
      if(preview.fingerprint!==String(expectedFingerprint||''))throw new Error('The environment impact changed before confirmation. Review the updated impact and try again.');
      for(const strategy of preview.destinations){
        let targetId=strategy.targetId;
        if(strategy.action==='claim'){await conn.query('UPDATE housing_destinations SET eso_server=? WHERE id=?',[to,strategy.sourceId]);targetId=strategy.sourceId;}
        else if(strategy.action==='create'){const inserted=await conn.query('INSERT INTO housing_destinations(eso_server,eso_owner,normalized_owner,house_id) VALUES(?,?,?,?)',[to,strategy.esoOwner,strategy.normalizedOwner,strategy.houseId]);targetId=Number(inserted.insertId);}
        const matching=await conn.query(`SELECT id FROM saved_houses WHERE id IN (${placeholders(preview.houseIds)}) AND destination_id=?`,[...preview.houseIds,strategy.sourceId]);
        for(const row of matching)await conn.query('UPDATE saved_houses SET destination_id=?,eso_server=? WHERE id=?',[targetId,to,Number(row.id)]);
      }
      if(preview.tourIds.length)await conn.query(`UPDATE tours SET eso_server=? WHERE id IN (${placeholders(preview.tourIds)})`,[to,...preview.tourIds]);
      if(preview.engagementEventIds?.length)await conn.query(`UPDATE tour_events SET eso_server=? WHERE id IN (${placeholders(preview.engagementEventIds)})`,[to,...preview.engagementEventIds]);
      if(preview.tourIds.length)await conn.query(`UPDATE tour_progress SET eso_server=? WHERE tour_id IN (${placeholders(preview.tourIds)})`,[to,...preview.tourIds]);
      if(preview.removedStopIds.length)await conn.query(`DELETE FROM tour_stops WHERE id IN (${placeholders(preview.removedStopIds)})`,preview.removedStopIds);
      if(preview.removedStopIds.length)await conn.query(`DELETE FROM tour_progress_stops WHERE stop_id IN (${placeholders(preview.removedStopIds)})`,preview.removedStopIds);
      for(const tourId of new Set([...preview.tourIds,...preview.removedStopTourIds])){const rows=await conn.query('SELECT id FROM tour_stops WHERE tour_id=? ORDER BY position,id',[tourId]);for(let n=0;n<rows.length;n++)await conn.query('UPDATE tour_stops SET position=? WHERE id=?',[n+1,rows[n].id]);}
      const revoked=await this.sharePasses.revokeForEnvironmentMove(conn,{houseIds:preview.houseIds,tourIds:preview.tourIds,actorId});
      await conn.query('UPDATE guild_settings SET eso_server=?,eso_server_selected_by=?,eso_server_selected_at=CURRENT_TIMESTAMP WHERE guild_id=?',[to,String(actorId),id]);
      const details={fromEsoServer:preview.fromEsoServer,toEsoServer:to,counts:{...preview.counts,revokedHousePasses:revoked.housePasses,revokedTourPasses:revoked.tourPasses,closedSessions:revoked.sessions},fingerprint:preview.fingerprint};
      await conn.query(`INSERT INTO audit_log(guild_id,guild_name,actor_id,actor_global_name,actor_display_name,action,entity_type,entity_id,entity_name,details) VALUES(?,?,?,?,?,?,?,?,?,?)`,[id,names.guildName||null,String(actorId),names.actorGlobalName||null,names.actorDisplayName||null,'change_guild_eso_server','guild',id,names.guildName||null,JSON.stringify(details)]);
      return {...preview,revoked,details};
    });
    this.invalidate(id);return result;
  }

  async #buildPrivateLegacy(conn,{userId,esoServer}){
    const server=requireEsoServer(esoServer),id=String(userId),houses=await conn.query("SELECT id,destination_id,updated_at FROM saved_houses WHERE eso_server IS NULL AND scope='private' AND owner_user_id=? ORDER BY id",[id]),tours=await conn.query("SELECT id,visibility,updated_at FROM tours WHERE eso_server IS NULL AND creator_id=? ORDER BY id",[id]),canonical={userId:id,esoServer:server,houses:houses.map(row=>[Number(row.id),Number(row.destination_id),String(row.updated_at||'')]),tours:tours.map(row=>[Number(row.id),row.visibility,String(row.updated_at||'')])};
    const tourIds=sortedIds(tours),stops=tourIds.length?await conn.query(`SELECT ts.id,ts.tour_id,ts.position,t.visibility,sh.eso_server,sh.scope,sh.id saved_house_id FROM tour_stops ts JOIN tours t ON t.id=ts.tour_id JOIN saved_houses sh ON sh.id=ts.saved_house_id WHERE ts.tour_id IN (${placeholders(tourIds)}) ORDER BY ts.tour_id,ts.position,ts.id`,tourIds):[],selectedHouses=new Set(sortedIds(houses));
    const removedStops=stops.filter(stop=>{const future=selectedHouses.has(Number(stop.saved_house_id))?server:stop.eso_server;return future!==server||stop.visibility==='global'&&stop.scope!=='global'||stop.visibility==='public'&&stop.scope==='private';}).length;
    canonical.stops=stops.map(row=>[Number(row.id),Number(row.tour_id),Number(row.position),Number(row.saved_house_id),row.eso_server,row.scope,row.visibility]);
    return {...canonical,houseIds:sortedIds(houses),tourIds,counts:{houses:houses.length,tours:tours.length,removedStops},fingerprint:hash(canonical)};
  }
  previewPrivateLegacy(args){return this.#buildPrivateLegacy(this.db,args);}
  async confirmPrivateLegacy({userId,esoServer,actorId,expectedFingerprint,guildId=null,names={}}){const server=requireEsoServer(esoServer);return withTransaction(this.db,async conn=>{const preview=await this.#buildPrivateLegacy(conn,{userId,esoServer:server});if(preview.fingerprint!==String(expectedFingerprint||''))throw new Error('The legacy-data impact changed before confirmation. Review it again.');return assignPrivateLegacyData(conn,{userId,esoServer:server,houseIds:preview.houseIds,tourIds:preview.tourIds,actorId,guildId,names});});}
}
