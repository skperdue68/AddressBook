import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase, withTransaction } from '../src/db/database.js';
import { SavedHouseService } from '../src/services/saved-house-service.js';
import { SharePassService } from '../src/services/share-pass-service.js';
import { TourService } from '../src/services/tour-service.js';
import { TourSessionService } from '../src/services/tour-session-service.js';

async function fixture(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-environment-passes-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'passes.sqlite')});
  await migrate(db);
  await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Psijic Villa','grand psijic villa')");
  return {db,houses:new SavedHouseService(db),passes:new SharePassService(db),tours:new TourService(db),sessions:new TourSessionService(db)};
}

test('Share Pass use is environment-bound and a mismatch has no side effects',async()=>{
  const {db,houses,passes}=await fixture();
  try{
    const house=await houses.createPrivate({esoServer:'pc_eu',originGuildId:'g-eu',userId:'owner',houseId:62,esoOwner:'Owner',createdBy:'owner'});
    const issued=await passes.createHousePass({savedHouseId:house.id,createdBy:'owner',originGuildId:'g-eu',esoServer:'pc_eu'});
    await assert.rejects(()=>passes.resolveHousePass(issued.token,{userId:'viewer',guildId:'g-na',esoServer:'pc_na'}),/belongs to PC EU.*uses PC NA/i);
    assert.equal(Number((await one(db,'SELECT usage_count c FROM house_share_passes WHERE id=?',[issued.pass.id])).c),0);
    assert.equal(Number((await one(db,"SELECT count(*) c FROM audit_log WHERE action='house_pass_used' AND entity_id=?",[String(issued.pass.id)])).c),0);
  }finally{await closeDatabase(db);}
});

test('Share Pass creation requires an assigned matching environment',async()=>{
  const {db,houses,passes}=await fixture();
  try{
    const house=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g-na',userId:'owner',houseId:62,esoOwner:'Owner',createdBy:'owner'});
    await assert.rejects(()=>passes.createHousePass({savedHouseId:house.id,createdBy:'owner',originGuildId:'g-na'}),/valid ESO environment/i);
    await db.query('UPDATE saved_houses SET eso_server=NULL WHERE id=?',[house.id]);
    await assert.rejects(()=>passes.createHousePass({savedHouseId:house.id,createdBy:'owner',originGuildId:'g-na',esoServer:'pc_na'}),/Unassigned/i);
    assert.equal(Number((await one(db,'SELECT count(*) c FROM house_share_passes')).c),0);
  }finally{await closeDatabase(db);}
});

test('environment moves revoke affected passes and close derived tour sessions atomically',async()=>{
  const {db,houses,passes,tours,sessions}=await fixture();
  try{
    const house=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g-na',userId:'owner',houseId:62,esoOwner:'Owner',createdBy:'owner'});
    const housePass=await passes.createHousePass({savedHouseId:house.id,createdBy:'owner',originGuildId:'g-na',esoServer:'pc_na'});
    const tour=await tours.create({creatorId:'owner',originGuildId:'g-na',sourceGuildId:'g-na',esoServer:'pc_na',visibility:'private',name:'Private Route'});
    await tours.addStop(tour.id,house.id);
    const tourPass=await passes.createTourPass({tourId:tour.id,createdBy:'owner',originGuildId:'g-na',esoServer:'pc_na'});
    const session=await sessions.startFromPass({passId:tourPass.pass.id,tourId:tour.id,guildId:'g-na',channelId:'c1',userId:'viewer',esoServer:'pc_na'});

    const counts=await withTransaction(db,conn=>passes.revokeForEnvironmentMove(conn,{houseIds:[house.id],tourIds:[tour.id],actorId:'admin'}));
    assert.deepEqual(counts,{housePasses:1,tourPasses:1,sessions:1});
    assert.equal((await one(db,'SELECT status FROM house_share_passes WHERE id=?',[housePass.pass.id])).status,'revoked');
    assert.equal((await one(db,'SELECT revocation_reason FROM tour_share_passes WHERE id=?',[tourPass.pass.id])).revocation_reason,'environment_changed');
    assert.equal(await sessions.get(session.id),null);
    assert.equal((await one(db,'SELECT close_reason FROM share_pass_sessions WHERE tour_share_pass_id=?',[tourPass.pass.id])).close_reason,'environment_changed');
    await assert.rejects(()=>passes.resolveHousePass(housePass.token,{userId:'viewer',guildId:'g-na',esoServer:'pc_na'}),/moved to another ESO environment.*new pass/i);
    await assert.rejects(()=>passes.resolveTourPass(tourPass.token,{userId:'viewer',guildId:'g-na',esoServer:'pc_na'}),/moved to another ESO environment.*new pass/i);
  }finally{await closeDatabase(db);}
});
