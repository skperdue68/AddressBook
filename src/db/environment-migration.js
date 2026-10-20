import { one, withTransaction } from './database.js';
import { requireEsoServer } from '../utils/eso-server.js';

async function firstOrCreateDestination(conn,{esoServer,esoOwner,normalizedOwner,houseId}){
  const existing=await one(conn,'SELECT * FROM housing_destinations WHERE eso_server=? AND normalized_owner=? AND house_id=?',[esoServer,normalizedOwner,Number(houseId)]);
  if(existing)return existing;
  await conn.query('INSERT INTO housing_destinations(eso_server,eso_owner,normalized_owner,house_id) VALUES(?,?,?,?)',[esoServer,esoOwner,normalizedOwner,Number(houseId)]);
  return one(conn,'SELECT * FROM housing_destinations WHERE eso_server=? AND normalized_owner=? AND house_id=?',[esoServer,normalizedOwner,Number(houseId)]);
}

async function claimDestination(conn,house,esoServer){
  let destination=house.destination_id==null?null:await one(conn,'SELECT * FROM housing_destinations WHERE id=?',[Number(house.destination_id)]);
  if(!destination){
    destination=await firstOrCreateDestination(conn,{esoServer,esoOwner:house.eso_owner,normalizedOwner:house.normalized_owner,houseId:house.house_id});
    return destination;
  }
  if(destination.eso_server===esoServer)return destination;
  if(destination.eso_server==null){
    const assigned=await one(conn,'SELECT id FROM saved_houses WHERE destination_id=? AND eso_server IS NOT NULL LIMIT 1',[Number(destination.id)]);
    if(!assigned){
      await conn.query('UPDATE housing_destinations SET eso_server=? WHERE id=?',[esoServer,Number(destination.id)]);
      destination.eso_server=esoServer;
      return destination;
    }
  }
  return firstOrCreateDestination(conn,{esoServer,esoOwner:house.eso_owner,normalizedOwner:house.normalized_owner,houseId:house.house_id});
}

export async function inferLegacyGlobalTours(conn){
  const tours=await conn.query("SELECT id FROM tours WHERE visibility='global' AND eso_server IS NULL ORDER BY id");
  let assigned=0;
  for(const tour of tours){
    const stops=await conn.query(`SELECT s.eso_server FROM tour_stops ts
      JOIN saved_houses s ON s.id=ts.saved_house_id WHERE ts.tour_id=? ORDER BY ts.position,ts.id`,[Number(tour.id)]);
    const values=stops.map(row=>row.eso_server);
    if(!values.length||values.some(value=>!value)||new Set(values).size!==1)continue;
    await conn.query('UPDATE tours SET eso_server=? WHERE id=?',[values[0],Number(tour.id)]);
    assigned++;
  }
  return assigned;
}

export async function assignGuildLegacyDataInConnection(conn,{guildId,esoServer,actorId}){
  const server=requireEsoServer(esoServer);
  const rows=await conn.query(`SELECT * FROM saved_houses
    WHERE eso_server IS NULL AND (guild_id=? OR (scope='global' AND origin_guild_id=?))
    ORDER BY id`,[String(guildId),String(guildId)]);
  const destinationIds=new Set();
  for(const house of rows){
    const destination=await claimDestination(conn,house,server);
    await conn.query('UPDATE saved_houses SET eso_server=?,destination_id=?,normalized_owner=? WHERE id=?',[server,Number(destination.id),destination.normalized_owner,Number(house.id)]);
    destinationIds.add(Number(destination.id));
  }
  const inferredTours=await inferLegacyGlobalTours(conn);
  if(rows.length||inferredTours){
    await conn.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)',[
      String(guildId),String(actorId||'system'),'assign_legacy_environment','guild',String(guildId),
      JSON.stringify({esoServer:server,houses:rows.length,destinations:destinationIds.size,inferredTours})
    ]);
  }
  return {esoServer:server,houses:rows.length,destinations:destinationIds.size,inferredTours};
}

export async function assignGuildLegacyData(dbOrConnection,args){
  if(dbOrConnection?.getConnection)return withTransaction(dbOrConnection,conn=>assignGuildLegacyDataInConnection(conn,args));
  return assignGuildLegacyDataInConnection(dbOrConnection,args);
}

export async function assignPrivateLegacyData(conn,{userId,esoServer,houseIds=[],tourIds=[],actorId,guildId=null,names={}}){
  const server=requireEsoServer(esoServer);
  const houses=await conn.query(`SELECT * FROM saved_houses WHERE eso_server IS NULL AND owner_user_id=?
    AND id IN (${houseIds.length?houseIds.map(()=>'?').join(','):'NULL'})`,[String(userId),...houseIds.map(Number)]);
  for(const house of houses){
    const destination=await claimDestination(conn,house,server);
    await conn.query('UPDATE saved_houses SET eso_server=?,destination_id=? WHERE id=?',[server,Number(destination.id),Number(house.id)]);
  }
  const tours=await conn.query(`SELECT * FROM tours WHERE eso_server IS NULL AND creator_id=?
    AND id IN (${tourIds.length?tourIds.map(()=>'?').join(','):'NULL'})`,[String(userId),...tourIds.map(Number)]);
  let removedStops=0;
  const allowed=(visibility,scope)=>visibility==='private'||visibility==='public'&&scope!=='private'||visibility==='global'&&scope==='global';
  for(const tour of tours){
    const stops=await conn.query(`SELECT ts.id,sh.eso_server,sh.scope FROM tour_stops ts
      JOIN saved_houses sh ON sh.id=ts.saved_house_id WHERE ts.tour_id=? ORDER BY ts.position,ts.id`,[Number(tour.id)]);
    const remove=stops.filter(stop=>stop.eso_server!==server||!allowed(tour.visibility,stop.scope));
    if(remove.length){await conn.query(`DELETE FROM tour_stops WHERE id IN (${remove.map(()=>'?').join(',')})`,remove.map(row=>row.id));removedStops+=remove.length;}
    const remaining=await conn.query('SELECT id FROM tour_stops WHERE tour_id=? ORDER BY position,id',[Number(tour.id)]);
    for(let n=0;n<remaining.length;n++)await conn.query('UPDATE tour_stops SET position=? WHERE id=?',[n+1,remaining[n].id]);
    await conn.query('UPDATE tours SET eso_server=? WHERE id=?',[server,Number(tour.id)]);
  }
  const inferredTours=await inferLegacyGlobalTours(conn);
  const result={esoServer:server,houses:houses.length,tours:tours.length,removedStops,inferredTours};
  if(houses.length||tours.length)await conn.query('INSERT INTO audit_log(guild_id,guild_name,actor_id,actor_global_name,actor_display_name,action,entity_type,entity_id,entity_name,details) VALUES(?,?,?,?,?,?,?,?,?,?)',[guildId,names.guildName||null,String(actorId||userId),names.actorGlobalName||null,names.actorDisplayName||null,'assign_private_legacy_environment','discord_user',String(userId),names.actorGlobalName||null,JSON.stringify(result)]);
  return result;
}

export async function verifyEnvironmentMigration(conn){
  const badHouse=await one(conn,`SELECT s.id FROM saved_houses s
    LEFT JOIN housing_destinations d ON d.id=s.destination_id
    WHERE s.eso_server IS NOT NULL AND (d.id IS NULL OR d.eso_server<>s.eso_server) LIMIT 1`);
  if(badHouse)throw new Error(`Environment migration left saved house ${badHouse.id} inconsistent with its destination.`);
  const badStop=await one(conn,`SELECT ts.id FROM tour_stops ts
    JOIN tours t ON t.id=ts.tour_id JOIN saved_houses s ON s.id=ts.saved_house_id
    WHERE t.eso_server IS NOT NULL AND (s.eso_server IS NULL OR t.eso_server<>s.eso_server) LIMIT 1`);
  if(badStop)throw new Error(`Environment migration left tour stop ${badStop.id} inconsistent with its tour.`);
  return true;
}
