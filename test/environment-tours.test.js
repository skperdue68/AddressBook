import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import { SavedHouseService } from '../src/services/saved-house-service.js';
import { TourReadinessService } from '../src/services/tour-readiness-service.js';
import { TourService } from '../src/services/tour-service.js';
import { TourSessionService } from '../src/services/tour-session-service.js';

async function fixture(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-environment-tours-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'tours.sqlite')});
  await migrate(db);
  await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Psijic Villa','grand psijic villa')");
  return {db,houses:new SavedHouseService(db),tours:new TourService(db)};
}

test('tour candidates and stop insertion require one exact ESO environment',async()=>{
  const {db,houses,tours}=await fixture();
  try{
    const naGlobal=await houses.createGlobal({esoServer:'pc_na',originGuildId:'g-na',houseId:62,esoOwner:'NaGlobal',createdBy:'owner'});
    const euGlobal=await houses.createGlobal({esoServer:'pc_eu',originGuildId:'g-eu',houseId:62,esoOwner:'EuGlobal',createdBy:'owner'});
    const naServer=await houses.createPublic({esoServer:'pc_na',guildId:'g-na',houseId:62,esoOwner:'NaServer',createdBy:'owner'});
    const naPrivate=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g-na',userId:'owner',houseId:62,esoOwner:'NaPrivate',createdBy:'owner'});
    const globalTour=await tours.create({creatorId:'owner',originGuildId:'g-na',esoServer:'pc_na',visibility:'global',name:'NA Global'});
    assert.equal(globalTour.eso_server,'pc_na');
    assert.equal(globalTour.origin_guild_id,'g-na');
    assert.deepEqual((await tours.houseCandidates({creatorId:'owner',sourceGuildId:'g-na',esoServer:'pc_na',visibility:'global'})).map(row=>row.id),[naGlobal.id]);
    await tours.addStop(globalTour.id,naGlobal.id);
    await assert.rejects(()=>tours.addStop(globalTour.id,euGlobal.id),/belongs to PC EU.*uses PC NA/i);
    await assert.rejects(()=>tours.addStop(globalTour.id,naServer.id),/Global tours may contain Global houses only/i);
    const privateTour=await tours.create({creatorId:'owner',originGuildId:'g-na',sourceGuildId:'g-na',esoServer:'pc_na',visibility:'private',name:'NA Private'});
    for(const house of [naGlobal,naServer,naPrivate])await tours.addStop(privateTour.id,house.id);
    assert.equal((await tours.getStops(privateTour.id)).length,3);
  }finally{await closeDatabase(db);}
});

test('readiness, session start, and advance block a stale cross-environment stop',async()=>{
  const {db,houses,tours}=await fixture();
  try{
    const na=await houses.createGlobal({esoServer:'pc_na',originGuildId:'g-na',houseId:62,esoOwner:'Na',createdBy:'owner'});
    const eu=await houses.createGlobal({esoServer:'pc_eu',originGuildId:'g-eu',houseId:62,esoOwner:'Eu',createdBy:'owner'});
    const tour=await tours.create({creatorId:'owner',originGuildId:'g-na',esoServer:'pc_na',visibility:'global',name:'Route'});
    await tours.addStop(tour.id,na.id);
    const sessions=new TourSessionService(db);
    const session=await sessions.startSelfPaced({tourId:tour.id,guildId:'g-na',channelId:'c1',userId:'owner',esoServer:'pc_na'});
    await db.query('UPDATE tour_stops SET saved_house_id=? WHERE tour_id=?',[eu.id,tour.id]);
    const readiness=await new TourReadinessService(db).check(tour.id,{viewerId:'owner',guildId:'g-na',esoServer:'pc_na'});
    assert.ok(readiness.blocking.some(item=>item.code==='environment_mismatch'));
    await assert.rejects(()=>sessions.advance(session.id,1,1,{esoServer:'pc_na'}),error=>error.code==='environment_mismatch');
    await assert.rejects(()=>sessions.startShared({tourId:tour.id,guildId:'g-na',channelId:'c2',userId:'owner',esoServer:'pc_na'}),error=>error.code==='environment_mismatch');
    assert.equal(Number((await one(db,"SELECT count(*) c FROM tour_sessions WHERE channel_id='c2'")).c),0);
  }finally{await closeDatabase(db);}
});

test('shared navigation blocks a newly inaccessible stop and keeps its position',async()=>{
  const {db,houses,tours}=await fixture();
  try{
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(63,'Second House','second house')");
    const first=await houses.createGlobal({esoServer:'pc_na',originGuildId:'g-na',houseId:62,esoOwner:'First',createdBy:'owner'});
    const second=await houses.createGlobal({esoServer:'pc_na',originGuildId:'g-na',houseId:63,esoOwner:'Second',createdBy:'owner'});
    const tour=await tours.create({creatorId:'owner',originGuildId:'g-na',esoServer:'pc_na',visibility:'global',name:'Shared Route'});
    await tours.addStop(tour.id,first.id);await tours.addStop(tour.id,second.id);
    const sessions=new TourSessionService(db),session=await sessions.startShared({tourId:tour.id,guildId:'g-na',channelId:'c1',userId:'owner',esoServer:'pc_na'});
    await db.query("UPDATE saved_houses SET status='archived' WHERE id=?",[second.id]);
    await assert.rejects(()=>sessions.advance(session.id,1,2,{esoServer:'pc_na'}),error=>error.code==='missing_stop');
    assert.equal(Number((await sessions.get(session.id)).current_position),1);
  }finally{await closeDatabase(db);}
});

test('shared navigation clamps to current route length after a stop is removed',async()=>{
  const {db,houses,tours}=await fixture();
  try{
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(63,'Second House','second house')");
    const first=await houses.createGlobal({esoServer:'pc_na',originGuildId:'g-na',houseId:62,esoOwner:'First',createdBy:'owner'});
    const second=await houses.createGlobal({esoServer:'pc_na',originGuildId:'g-na',houseId:63,esoOwner:'Second',createdBy:'owner'});
    const tour=await tours.create({creatorId:'owner',originGuildId:'g-na',esoServer:'pc_na',visibility:'global',name:'Shared Route'});
    await tours.addStop(tour.id,first.id);const stop=await tours.addStop(tour.id,second.id);
    const sessions=new TourSessionService(db),session=await sessions.startShared({tourId:tour.id,guildId:'g-na',channelId:'c1',userId:'owner',esoServer:'pc_na'});
    await db.query('DELETE FROM tour_stops WHERE id=?',[stop.id]);
    const updated=await sessions.advance(session.id,1,2,{esoServer:'pc_na'});
    assert.equal(Number(updated.current_position),1);
    assert.deepEqual((await tours.getStops(tour.id)).map(row=>row.house_name),['Grand Psijic Villa']);
  }finally{await closeDatabase(db);}
});
