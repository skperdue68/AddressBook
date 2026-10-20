import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { DestinationService } from '../src/services/destination-service.js';
import { SavedHouseService } from '../src/services/saved-house-service.js';
import { SharePassService } from '../src/services/share-pass-service.js';
import { HouseCopyService } from '../src/services/house-copy-service.js';
import { VisitService } from '../src/services/visit-service.js';
import { MyAddressBookService } from '../src/services/my-addressbook-service.js';
import { CommentService } from '../src/services/comment-service.js';
import { AccessContextService } from '../src/services/access-context-service.js';

test('the same ESO destination is distinct across environments and shared within one environment',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-environment-destination-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'destinations.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Psijic Villa','grand psijic villa')");
    const destinations=new DestinationService(db);
    const na=await destinations.resolve({esoServer:'pc_na',esoOwner:'@Owner',houseId:62});
    const eu=await destinations.resolve({esoServer:'pc_eu',esoOwner:'owner',houseId:62});
    const sameNa=await destinations.resolve({esoServer:'pc_na',esoOwner:'OWNER',houseId:62});
    assert.equal(sameNa.id,na.id);
    assert.notEqual(eu.id,na.id);
    assert.equal(na.eso_server,'pc_na');
    assert.equal(eu.eso_server,'pc_eu');

    const houses=new SavedHouseService(db);
    const privateHouse=await houses.createPrivate({userId:'u1',originGuildId:'g-na',esoServer:'pc_na',houseId:62,esoOwner:'Owner',createdBy:'u1'});
    const globalHouse=await houses.createGlobal({originGuildId:'g-eu',esoServer:'pc_eu',houseId:62,esoOwner:'Owner',createdBy:'u2'});
    assert.equal(privateHouse.eso_server,'pc_na');
    assert.equal(privateHouse.origin_guild_id,'g-na');
    assert.equal(globalHouse.eso_server,'pc_eu');
    assert.notEqual(privateHouse.destination_id,globalHouse.destination_id);
  }finally{await closeDatabase(db);}
});

test('normal destination resolution rejects Unassigned creation',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-environment-required-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'destinations.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'House','house')");
    await assert.rejects(()=>new DestinationService(db).resolve({esoOwner:'Owner',houseId:1}),/valid ESO environment/);
  }finally{await closeDatabase(db);}
});

test('a shared Private house cannot be copied into a different ESO environment',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-environment-copy-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'copy.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Psijic Villa','grand psijic villa')");
    const houses=new SavedHouseService(db);
    const source=await houses.createPrivate({userId:'owner',originGuildId:'g-na',esoServer:'pc_na',houseId:62,esoOwner:'Owner',createdBy:'owner'});
    const passes=new SharePassService(db);
    const issued=await passes.createHousePass({savedHouseId:source.id,createdBy:'owner',originGuildId:'g-na',esoServer:'pc_na'});
    const copies=new HouseCopyService(db);
    await assert.rejects(
      ()=>copies.preview({sourceSavedHouseId:source.id,userId:'recipient',guildId:'g-eu',passId:issued.pass.id,targetEsoServer:'pc_eu'}),
      /belongs to PC NA.*uses PC EU/i
    );
  }finally{await closeDatabase(db);}
});

test('changing visibility cannot move a saved house into another ESO environment',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-environment-visibility-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'visibility.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Psijic Villa','grand psijic villa')");
    const houses=new SavedHouseService(db);
    const source=await houses.createPrivate({userId:'owner',originGuildId:'g-na',esoServer:'pc_na',houseId:62,esoOwner:'Owner',createdBy:'owner'});
    await assert.rejects(
      ()=>houses.changeScope(source.id,'global',{actorId:'owner',targetGuildId:'g-eu',targetEsoServer:'pc_eu'}),
      /belongs to PC NA.*uses PC EU/i
    );
    assert.equal((await houses.get(source.id)).scope,'private');
  }finally{await closeDatabase(db);}
});

test('search, comments, and recent views stay inside the requested ESO environment',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-environment-discovery-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'discovery.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Psijic Villa','grand psijic villa')");
    const houses=new SavedHouseService(db);
    const na=await houses.createGlobal({originGuildId:'g-na',esoServer:'pc_na',houseId:62,esoOwner:'NaOwner',createdBy:'viewer'});
    const eu=await houses.createGlobal({originGuildId:'g-eu',esoServer:'pc_eu',houseId:62,esoOwner:'EuOwner',createdBy:'viewer'});
    const visits=await new VisitService(db).search({userId:'viewer',guildId:'g-na',esoServer:'pc_na',limit:null});
    assert.deepEqual(visits.map(row=>row.eso_owner),['NaOwner']);

    const comments=new CommentService(db);
    await comments.add({esoServer:'pc_na',savedHouseId:na.id,commenterUserId:'viewer',text:'NA comment'});
    await comments.add({esoServer:'pc_eu',savedHouseId:eu.id,commenterUserId:'viewer',text:'EU comment'});
    assert.deepEqual((await comments.list('global',na.id,5,'pc_na')).map(row=>row.comment_text),['NA comment']);
    await assert.rejects(()=>comments.list('global',eu.id,5,'pc_na'),/different environment/i);

    const book=new MyAddressBookService(db);
    await book.recordView('viewer',na.id);
    await book.recordView('viewer',eu.id);
    assert.deepEqual((await book.recent('viewer','g-na','pc_na')).map(row=>row.id),[na.id]);
    assert.deepEqual((await book.houses('viewer','pc_na')).map(row=>row.id),[na.id]);
  }finally{await closeDatabase(db);}
});

test('a direct Global house ID is not authorization across ESO environments',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-environment-direct-id-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'direct.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Psijic Villa','grand psijic villa')");
    const house=await new SavedHouseService(db).createGlobal({originGuildId:'g-eu',esoServer:'pc_eu',houseId:62,esoOwner:'SecretOwner',displayName:'Secret Nickname',description:'Secret description',tags:['secret'],createdBy:'owner'});
    const result=await new AccessContextService(db).forHouse({userId:'viewer',guildId:'g-na',esoServer:'pc_na',savedHouseId:house.id});
    assert.deepEqual({canView:result.canView,environmentMatch:result.environmentMatch,reason:result.reason},{canView:false,environmentMatch:false,reason:'environment_mismatch'});
    assert.equal('record' in result,false);
    for(const secret of ['SecretOwner','Secret Nickname','Secret description','secret'])assert.equal(JSON.stringify(result).includes(secret),false);
  }finally{await closeDatabase(db);}
});
