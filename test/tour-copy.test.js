import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import { SavedHouseService } from '../src/services/saved-house-service.js';
import { SharePassService } from '../src/services/share-pass-service.js';
import { TourCopyService } from '../src/services/tour-copy-service.js';
import { TourService } from '../src/services/tour-service.js';
import { tourCopyPreviewPayload } from '../src/ui/share-pass-ui.js';

async function fixture({failAfterStop=null}={}){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-tour-copy-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'copy.sqlite')});
  await migrate(db);
  for(const [id,name] of [[61,'Alinor Crest Townhouse'],[62,'Grand Psijic Villa'],[63,'Hall of the Lunar Champion'],[64,'Sweetwater Cascades']])
    await db.query('INSERT INTO houses(house_id,name,normalized_name) VALUES(?,?,?)',[id,name,name.toLowerCase()]);
  const houses=new SavedHouseService(db),tours=new TourService(db),passes=new SharePassService(db);
  const global=await houses.createGlobal({esoServer:'pc_na',originGuildId:'g1',houseId:61,esoOwner:'GlobalOwner',displayName:'Global Stop',createdBy:'owner'});
  const server=await houses.createPublic({esoServer:'pc_na',guildId:'g1',houseId:62,esoOwner:'ServerOwner',displayName:'Server Stop',createdBy:'owner'});
  const recipientPrivate=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'recipient',houseId:63,esoOwner:'Recipient',displayName:'My Existing Stop',createdBy:'recipient'});
  const ownerSharedDestination=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:63,esoOwner:'Recipient',displayName:'Recipient-Compatible Stop',createdBy:'owner'});
  const ownerPrivate=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:64,esoOwner:'SecretOwner',displayName:'Secret Stop',description:'Private source details',tags:['secret'],createdBy:'owner'});
  const source=await tours.create({esoServer:'pc_na',originGuildId:'g1',creatorId:'owner',visibility:'private',sourceGuildId:'g1',name:'Shared Route',description:'Four excellent homes',tags:['featured']});
  await db.query("UPDATE tours SET eso_server='pc_na' WHERE id=?",[source.id]);
  for(const [house,title,notes] of [[global,'Global First','One'],[server,'Server Second','Two'],[ownerSharedDestination,'Recipient Third','Three'],[ownerPrivate,'Secret Fourth','Four']]){
    const stop=await tours.addStop(source.id,house.id,notes);
    await tours.updateStop(stop.id,{title,notes});
  }
  const issued=await passes.createTourPass({tourId:source.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na'});
  const copies=new TourCopyService(db,{hooks:{afterStop:async({index})=>{if(failAfterStop===index)throw new Error('injected stop failure');}}});
  return {db,houses,tours,passes,copies,source,issued,records:{global,server,recipientPrivate,ownerPrivate}};
}

test('preview reuses normally accessible stops and copies only inaccessible Private destinations',async()=>{
  const {db,copies,source,issued,records}=await fixture();
  try{
    const preview=await copies.preview({tourId:source.id,passId:issued.pass.id,userId:'recipient',guildId:'g1',esoServer:'pc_na'});
    assert.equal(preview.totalStops,4);
    assert.equal(preview.reusedStops,3);
    assert.equal(preview.copiedStops,1);
    assert.deepEqual(preview.stops.map(stop=>stop.reuseSavedHouseId),[records.global.id,records.server.id,records.recipientPrivate.id,null]);
    assert.equal(preview.stops[3].sourceSavedHouseId,records.ownerPrivate.id);
    const payload=tourCopyPreviewPayload(preview,{token:'opaque'});
    assert.match(payload.embeds[0].toJSON().description,/independent Private tour/i);
    assert.deepEqual(payload.components.flatMap(row=>row.toJSON().components.map(component=>component.label)),['Copy Private Tour','Cancel']);
  }finally{await closeDatabase(db);}
});

test('copied tour preserves route metadata and remains independent after revocation and source edits',async()=>{
  const {db,copies,tours,passes,source,issued}=await fixture();
  try{
    const copied=await copies.copy({tourId:source.id,passId:issued.pass.id,userId:'recipient',guildId:'g1',esoServer:'pc_na'});
    assert.equal(copied.visibility,'private');
    assert.equal(copied.creator_id,'recipient');
    assert.equal(copied.name,'Shared Route');
    assert.equal(copied.description,'Four excellent homes');
    assert.deepEqual(JSON.parse(copied.tags),['featured']);
    const stops=await tours.getStops(copied.id);
    assert.deepEqual(stops.map(stop=>stop.custom_title),['Global First','Server Second','Recipient Third','Secret Fourth']);
    assert.deepEqual(stops.map(stop=>stop.notes),['One','Two','Three','Four']);
    assert.equal(stops[3].source_scope,'personal');
    await passes.revokeTourPass(issued.pass.id,{actorId:'owner'});
    await tours.update(source.id,{name:'Changed Source'});
    assert.equal((await tours.get(copied.id)).name,'Shared Route');
    assert.equal((await tours.getStops(copied.id)).length,4);
  }finally{await closeDatabase(db);}
});

test('failure during stop copy rolls back tour houses stops and success audit',async()=>{
  const {db,copies,source,issued}=await fixture({failAfterStop:2});
  try{
    const before={tours:(await one(db,'SELECT count(*) c FROM tours')).c,houses:(await one(db,'SELECT count(*) c FROM saved_houses')).c,stops:(await one(db,'SELECT count(*) c FROM tour_stops')).c};
    await assert.rejects(()=>copies.copy({tourId:source.id,passId:issued.pass.id,userId:'recipient',guildId:'g1',esoServer:'pc_na'}),/nothing was copied|injected stop failure/i);
    assert.deepEqual({tours:(await one(db,'SELECT count(*) c FROM tours')).c,houses:(await one(db,'SELECT count(*) c FROM saved_houses')).c,stops:(await one(db,'SELECT count(*) c FROM tour_stops')).c},before);
    assert.equal((await one(db,"SELECT count(*) c FROM audit_log WHERE action='tour_copied'")).c,0);
  }finally{await closeDatabase(db);}
});

test('duplicate destination source is blocked and simultaneous copy clicks cannot make a partial second tour',async()=>{
  const {db,copies,tours,source,issued,records}=await fixture();
  try{
    const duplicate=await db.query('INSERT INTO saved_houses(eso_server,scope,owner_user_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?)',['pc_na','private','owner',records.global.house_id,records.global.eso_owner,records.global.normalized_owner,records.global.destination_id,'active','owner','owner']);
    await db.query('INSERT INTO tour_stops(tour_id,position,saved_house_id) VALUES(?,?,?)',[source.id,5,duplicate.insertId]);
    await assert.rejects(()=>copies.preview({tourId:source.id,passId:issued.pass.id,userId:'recipient',guildId:'g1',esoServer:'pc_na'}),/same ESO destination|duplicate/i);
    await db.query('DELETE FROM tour_stops WHERE saved_house_id=?',[duplicate.insertId]);
    const results=await Promise.allSettled([
      copies.copy({tourId:source.id,passId:issued.pass.id,userId:'recipient',guildId:'g1',esoServer:'pc_na'}),
      copies.copy({tourId:source.id,passId:issued.pass.id,userId:'recipient',guildId:'g1',esoServer:'pc_na'})
    ]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
    assert.equal(results.filter(result=>result.status==='rejected').length,1);
    assert.match(results.find(result=>result.status==='rejected').reason.message,/already being processed|stale/i);
    const recipientTours=await db.query("SELECT * FROM tours WHERE visibility='private' AND creator_id='recipient'");
    assert.equal(recipientTours.length,1);
    assert.equal((await tours.getStops(recipientTours[0].id)).length,4);
  }finally{await closeDatabase(db);}
});

test('copy rejects a source Server house moved to another guild after preview',async()=>{
  const {db,copies,source,issued,records}=await fixture();
  try{
    await copies.preview({tourId:source.id,passId:issued.pass.id,userId:'recipient',guildId:'g1',esoServer:'pc_na'});
    const before={tours:(await one(db,'SELECT count(*) c FROM tours')).c,houses:(await one(db,'SELECT count(*) c FROM saved_houses')).c,stops:(await one(db,'SELECT count(*) c FROM tour_stops')).c};
    await db.query('UPDATE saved_houses SET guild_id=? WHERE id=?',['g2',records.server.id]);
    await assert.rejects(()=>copies.copy({tourId:source.id,passId:issued.pass.id,userId:'recipient',guildId:'g1',esoServer:'pc_na'}),/source Discord server|nothing was copied/i);
    assert.deepEqual({tours:(await one(db,'SELECT count(*) c FROM tours')).c,houses:(await one(db,'SELECT count(*) c FROM saved_houses')).c,stops:(await one(db,'SELECT count(*) c FROM tour_stops')).c},before);
  }finally{await closeDatabase(db);}
});

test('copy rejects a source Private house reassigned after preview',async()=>{
  const {db,copies,source,issued,records}=await fixture();
  try{
    await copies.preview({tourId:source.id,passId:issued.pass.id,userId:'recipient',guildId:'g1',esoServer:'pc_na'});
    const before={tours:(await one(db,'SELECT count(*) c FROM tours')).c,houses:(await one(db,'SELECT count(*) c FROM saved_houses')).c,stops:(await one(db,'SELECT count(*) c FROM tour_stops')).c};
    await db.query('UPDATE saved_houses SET owner_user_id=? WHERE id=?',['other',records.ownerPrivate.id]);
    await assert.rejects(()=>copies.copy({tourId:source.id,passId:issued.pass.id,userId:'recipient',guildId:'g1',esoServer:'pc_na'}),/tour’s creator|nothing was copied/i);
    assert.deepEqual({tours:(await one(db,'SELECT count(*) c FROM tours')).c,houses:(await one(db,'SELECT count(*) c FROM saved_houses')).c,stops:(await one(db,'SELECT count(*) c FROM tour_stops')).c},before);
  }finally{await closeDatabase(db);}
});
