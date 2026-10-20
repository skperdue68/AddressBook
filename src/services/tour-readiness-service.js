import { one } from '../db/database.js';
import { tourAllowsHouseScope } from './saved-house-service.js';
import { esoServerLabel, requireEsoServer } from '../utils/eso-server.js';

export class TourReadinessService{
  constructor(db){this.db=db;}

  async check(tourId,{viewerId,guildId,esoServer,passId=null,conn=this.db}={}){
    const server=requireEsoServer(esoServer);
    const tour=await one(conn,'SELECT * FROM tours WHERE id=?',[Number(tourId)]);
    if(!tour)return {tour:null,blocking:[{code:'tour_missing',message:'This tour is no longer available.'}],advisories:[],eligibleStops:[],stopCount:0};
    if(!tour.eso_server||tour.eso_server!==server)return {tour:null,blocking:[{code:'environment_mismatch',message:`This tour belongs to ${esoServerLabel(tour.eso_server)}, but this Discord server uses ${esoServerLabel(server)}.`}],advisories:[],eligibleStops:[],stopCount:0};
    const stops=await conn.query(`SELECT ts.*,sh.scope,sh.status,sh.destination_id,sh.eso_server,sh.guild_id,sh.owner_user_id
      FROM tour_stops ts LEFT JOIN saved_houses sh ON sh.id=ts.saved_house_id
      WHERE ts.tour_id=? ORDER BY ts.position`,[Number(tourId)]);
    const blocking=[],advisories=[],eligibleStops=[];
    if(!stops.length)blocking.push({code:'no_stops',message:'This tour has no stops yet.'});
    const destinations=new Set();
    for(const stop of stops){
      if(!stop.saved_house_id||stop.status!=='active'||!stop.destination_id){blocking.push({code:'missing_stop',stopId:stop.id,message:'A tour stop is no longer available.'});continue;}
      if(!stop.eso_server||stop.eso_server!==tour.eso_server){blocking.push({code:'environment_mismatch',stopId:stop.id,message:'A tour stop belongs to a different ESO environment.'});continue;}
      if(!tourAllowsHouseScope(tour,stop.scope)){blocking.push({code:'ineligible_visibility',stopId:stop.id,message:'A stop is no longer eligible for this tour visibility.'});continue;}
      const sourceGuild=tour.source_guild_id||tour.guild_id;
      if(stop.scope==='public'&&(!sourceGuild||String(stop.guild_id)!==String(sourceGuild))){blocking.push({code:'ineligible_context',stopId:stop.id,message:'A Server house no longer belongs to this tour’s source Discord server.'});continue;}
      if(stop.scope==='private'&&String(stop.owner_user_id)!==String(tour.creator_id)){blocking.push({code:'ineligible_context',stopId:stop.id,message:'A Private house no longer belongs to this tour’s creator.'});continue;}
      if(destinations.has(String(stop.destination_id)))blocking.push({code:'duplicate_destination',stopId:stop.id,message:'This tour contains the same ESO destination more than once.'});
      else destinations.add(String(stop.destination_id));
      eligibleStops.push(stop);
    }
    if(passId!=null){
      const pass=await one(conn,"SELECT id FROM tour_share_passes WHERE id=? AND tour_id=? AND status='active'",[Number(passId),Number(tourId)]);
      if(!pass)blocking.push({code:'pass_inactive',message:'This Share Pass was revoked by its owner.'});
    }
    const report=await one(conn,"SELECT count(*) c FROM housing_reports WHERE tour_id=? AND status IN ('open','reviewing') AND problem_type IN ('jump_broken','owner_blocks_visitors')",[Number(tourId)]);
    if(Number(report?.c||0)>0)advisories.push({code:'accessibility_reports',message:`${report.c} unresolved accessibility report(s) may affect this tour.`});
    return {tour,blocking,advisories,eligibleStops,stopCount:stops.length,viewerId,guildId};
  }
}
