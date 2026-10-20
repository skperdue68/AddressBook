import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AccessContextService } from '../src/services/access-context-service.js';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { RateLimitService, rateLimitSettings } from '../src/services/rate-limit-service.js';
import { SavedHouseService } from '../src/services/saved-house-service.js';
import { ShareTokenService } from '../src/services/share-token-service.js';
import { TourService } from '../src/services/tour-service.js';

async function fixture(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-pass-access-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'access.sqlite')});
  await migrate(db);
  await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Psijic Villa','grand psijic villa')");
  const houses=new SavedHouseService(db);
  return {db,houses};
}

test('house access distinguishes Global same-server Server own Private and inaccessible records',async()=>{
  const {db,houses}=await fixture();
  try{
    const global=await houses.createGlobal({esoServer:'pc_na',originGuildId:'g1',houseId:62,esoOwner:'GlobalOwner',createdBy:'u1'});
    const server=await houses.createPublic({esoServer:'pc_na',guildId:'g1',houseId:62,esoOwner:'ServerOwner',createdBy:'u1'});
    const personal=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'u1',houseId:62,esoOwner:'PrivateOwner',createdBy:'u1'});
    const access=new AccessContextService(db);
    assert.equal((await access.forHouse({userId:'u9',guildId:'g9',esoServer:'pc_na',savedHouseId:global.id})).normalAccess,true);
    assert.equal((await access.forHouse({userId:'u9',guildId:'g1',esoServer:'pc_na',savedHouseId:server.id})).normalAccess,true);
    assert.equal((await access.forHouse({userId:'u9',guildId:'g9',esoServer:'pc_na',savedHouseId:server.id})).canView,false);
    assert.equal((await access.forHouse({userId:'u1',guildId:'g9',esoServer:'pc_na',savedHouseId:personal.id})).normalAccess,true);
    assert.equal((await access.forHouse({userId:'u9',guildId:'g1',esoServer:'pc_na',savedHouseId:personal.id})).canView,false);

    const mismatch=await access.forHouse({userId:'u9',guildId:'g9',esoServer:'pc_eu',savedHouseId:global.id});
    assert.equal(mismatch.canView,false);
    assert.equal(mismatch.environmentMatch,false);
    assert.equal(mismatch.reason,'environment_mismatch');
    assert.equal('record' in mismatch,false);
    assert.match(mismatch.message,/belongs to PC NA.*uses PC EU/i);
    for(const secret of ['GlobalOwner','Grand Psijic Villa'])assert.equal(JSON.stringify(mismatch).includes(secret),false);
  }finally{await closeDatabase(db);}
});

test('active pass grants only pass-safe actions for another users Private house',async()=>{
  const {db,houses}=await fixture();
  try{
    const personal=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'PrivateOwner',createdBy:'owner'});
    const inserted=await db.query("INSERT INTO house_share_passes(token_hash,saved_house_id,created_by,status) VALUES('hash',?,'owner','active')",[personal.id]);
    const access=new AccessContextService(db);
    const context=await access.forHouse({userId:'viewer',guildId:'g1',esoServer:'pc_na',savedHouseId:personal.id,passId:inserted.insertId});
    assert.deepEqual({normalAccess:context.normalAccess,passOnly:context.passOnly,canView:context.canView,canShare:context.canShare,canEdit:context.canEdit,canCopy:context.canCopy},{normalAccess:false,passOnly:true,canView:true,canShare:false,canEdit:false,canCopy:true});
    await db.query("UPDATE house_share_passes SET status='revoked' WHERE id=?",[inserted.insertId]);
    const revoked=await access.forHouse({userId:'viewer',guildId:'g1',esoServer:'pc_na',savedHouseId:personal.id,passId:inserted.insertId});
    assert.equal(revoked.canView,false);
    assert.equal(revoked.passOnly,false);
  }finally{await closeDatabase(db);}
});

test('pass-only tour access cannot reissue or edit the original Private tour',async()=>{
  const {db}=await fixture();
  try{
    const tour=await new TourService(db).create({esoServer:'pc_na',originGuildId:'g1',creatorId:'owner',visibility:'private',sourceGuildId:'g1',name:'Private Route'});
    await db.query("UPDATE tours SET eso_server='pc_na' WHERE id=?",[tour.id]);
    const inserted=await db.query("INSERT INTO tour_share_passes(token_hash,tour_id,created_by,status) VALUES('tourhash',?,'owner','active')",[tour.id]);
    const access=new AccessContextService(db);
    const context=await access.forTour({userId:'viewer',guildId:'g1',esoServer:'pc_na',tourId:tour.id,passId:inserted.insertId});
    assert.equal(context.passOnly,true);
    assert.equal(context.canView,true);
    assert.equal(context.canShare,false);
    assert.equal(context.canEdit,false);
    assert.equal(context.canCopy,true);
    const mismatch=await access.forTour({userId:'viewer',guildId:'g1',esoServer:'pc_eu',tourId:tour.id,passId:inserted.insertId});
    assert.equal(mismatch.canView,false);
    assert.equal(mismatch.reason,'environment_mismatch');
    assert.equal('record' in mismatch,false);
    assert.equal(JSON.stringify(mismatch).includes('Private Route'),false);
  }finally{await closeDatabase(db);}
});

test('opaque share tokens are random hashed and timing-safe verifiable',()=>{
  const tokens=new ShareTokenService();
  const first=tokens.issue(),second=tokens.issue();
  assert.notEqual(first.token,second.token);
  assert.equal(first.hash.length,64);
  assert.equal(first.hash.includes(first.token),false);
  assert.equal(tokens.matches(first.token,first.hash),true);
  assert.equal(tokens.matches(first.token,second.hash),false);
  assert.equal(tokens.matches('malformed','not-a-sha256-hash'),false);
});

test('rate limiter rejects the extra request until its injected clock advances',()=>{
  let now=1000;
  const limiter=new RateLimitService({clock:()=>now});
  assert.equal(limiter.consume({bucket:'share',userId:'u1',limit:2,windowMs:1000}).allowed,true);
  assert.equal(limiter.consume({bucket:'share',userId:'u1',limit:2,windowMs:1000}).allowed,true);
  const blocked=limiter.consume({bucket:'share',userId:'u1',limit:2,windowMs:1000});
  assert.equal(blocked.allowed,false);
  assert.equal(blocked.retryAfterMs,1000);
  now=2001;
  assert.equal(limiter.consume({bucket:'share',userId:'u1',limit:2,windowMs:1000}).allowed,true);
});

test('invalid rate-limit environment values use safe defaults',()=>{
  assert.deepEqual(rateLimitSettings({SHARE_PASS_RATE_LIMIT:'0',SHARE_PASS_RATE_WINDOW_SECONDS:'bad',HOUSING_REPORT_RATE_LIMIT:'-1',HOUSING_REPORT_RATE_WINDOW_SECONDS:''}),{
    share:{limit:5,windowMs:300000},shareAccess:{limit:60,windowMs:300000},report:{limit:5,windowMs:600000}
  });
});
