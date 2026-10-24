import {one} from '../db/database.js';
export class CommunityStatisticsService{
 constructor(db){this.db=db;}
 async snapshot(c){
  const counts=await one(this.db,`SELECT sum(CASE WHEN scope='private' AND owner_user_id=? THEN 1 ELSE 0 END) privateHouses,sum(CASE WHEN scope='public' AND guild_id=? THEN 1 ELSE 0 END) serverRegistrations,sum(CASE WHEN scope='global' THEN 1 ELSE 0 END) globalRegistrations FROM saved_houses WHERE eso_server=? AND status='active'`,[c.userId,c.guildId,c.esoServer]);
  const tourRows=await this.db.query(`SELECT t.id,count(ts.id) stops FROM tours t LEFT JOIN tour_stops ts ON ts.tour_id=t.id WHERE t.eso_server=? AND (t.visibility='global' OR (t.visibility='public' AND t.guild_id=?)) GROUP BY t.id`,[c.esoServer,c.guildId]);
  const types=await one(this.db,"SELECT count(DISTINCT house_id) c FROM saved_houses WHERE eso_server=? AND status='active' AND (scope='global' OR (scope='public' AND guild_id=?))",[c.esoServer,c.guildId]);
  return {...Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,Number(v||0)])),tours:tourRows.length,averageStops:tourRows.length?Math.round(tourRows.reduce((n,r)=>n+Number(r.stops),0)/tourRows.length*10)/10:0,houseTypes:Number(types.c)};
 }
 async popularity(c,{metric='members'}={}){
  const rows=await this.db.query(`SELECT h.house_id,h.name,h.zone,count(*) registrations,count(DISTINCT s.created_by) members,count(DISTINCT s.normalized_owner) owners FROM saved_houses s JOIN houses h ON h.house_id=s.house_id WHERE s.eso_server=? AND s.status='active' AND (s.scope='global' OR (s.scope='public' AND s.guild_id=?)) GROUP BY h.house_id,h.name,h.zone`,[c.esoServer,c.guildId]);
  const tours=await this.db.query(`SELECT s.house_id,count(DISTINCT t.id) tours FROM tour_stops ts JOIN tours t ON t.id=ts.tour_id JOIN saved_houses s ON s.id=ts.saved_house_id WHERE t.eso_server=? AND s.eso_server=? AND s.status='active' AND (t.visibility='global' OR (t.visibility='public' AND t.guild_id=?)) AND (s.scope='global' OR (s.scope='public' AND s.guild_id=?)) GROUP BY s.house_id`,[c.esoServer,c.esoServer,c.guildId,c.guildId]);
  const byId=new Map(tours.map(t=>[Number(t.house_id),Number(t.tours)])),key=['members','owners','registrations','tours'].includes(metric)?metric:'members';
  return rows.map(r=>({...r,house_id:Number(r.house_id),registrations:Number(r.registrations),members:Number(r.members),owners:Number(r.owners),tours:byId.get(Number(r.house_id))||0})).sort((a,b)=>b[key]-a[key]||a.name.localeCompare(b.name));
 }
}
