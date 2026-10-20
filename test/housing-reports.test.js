import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import { HousingReportService, HOUSING_PROBLEM_TYPES } from '../src/services/housing-report-service.js';
import { RateLimitService } from '../src/services/rate-limit-service.js';
import { SavedHouseService } from '../src/services/saved-house-service.js';
import { TourReadinessService } from '../src/services/tour-readiness-service.js';
import { TourService } from '../src/services/tour-service.js';
import { reportProblemTypePayload } from '../src/ui/report-ui.js';

async function fixture(options={}){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-reports-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'reports.sqlite')});
  await migrate(db);
  await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Psijic Villa','grand psijic villa')");
  return {db,houses:new SavedHouseService(db),tours:new TourService(db),reports:new HousingReportService(db,options)};
}

test('equivalent open report updates instead of duplicating and resolved report permits a new row',async()=>{
  const {db,houses,reports}=await fixture();
  try{
    const house=await houses.createPublic({esoServer:'pc_na',guildId:'g1',houseId:62,esoOwner:'Owner',createdBy:'submitter'});
    const target={destinationId:house.destination_id,savedHouseId:house.id};
    const first=await reports.submit({...target,esoServer:'pc_na',reporterId:'reporter',guildId:'g1',problemType:'jump_broken',explanation:'First explanation'});
    const updated=await reports.submit({...target,esoServer:'pc_na',reporterId:'reporter',guildId:'g1',problemType:'jump_broken',explanation:'Updated explanation'});
    assert.equal(updated.id,first.id);
    assert.equal(updated.explanation,'Updated explanation');
    assert.equal((await one(db,'SELECT count(*) c FROM housing_reports')).c,1);
    await reports.resolve(first.id,{reviewerId:'mod',guildId:'g1',esoServer:'pc_na',isServerModerator:true,resolution:'fixed'});
    const later=await reports.submit({...target,esoServer:'pc_na',reporterId:'reporter',guildId:'g1',problemType:'jump_broken',explanation:'It broke again'});
    assert.notEqual(later.id,first.id);
    assert.equal((await one(db,'SELECT count(*) c FROM housing_reports')).c,2);
  }finally{await closeDatabase(db);}
});

test('report limiter gives a useful retry time',async()=>{
  let now=0;const limiter=new RateLimitService({clock:()=>now});
  const {db,houses,reports}=await fixture({rateLimiter:limiter,settings:{limit:1,windowMs:1000}});
  try{
    const house=await houses.createGlobal({esoServer:'pc_na',originGuildId:'g1',houseId:62,esoOwner:'Owner',createdBy:'submitter'});
    await reports.submit({esoServer:'pc_na',destinationId:house.destination_id,savedHouseId:house.id,reporterId:'r',guildId:'g1',problemType:'other',explanation:'One'});
    await assert.rejects(()=>reports.submit({esoServer:'pc_na',destinationId:house.destination_id,savedHouseId:house.id,reporterId:'r',guildId:'g1',problemType:'duplicate_entry',explanation:'Two'}),/wait 1 second/i);
    now=1001;
    await reports.submit({esoServer:'pc_na',destinationId:house.destination_id,savedHouseId:house.id,reporterId:'r',guildId:'g1',problemType:'duplicate_entry',explanation:'Two'});
  }finally{await closeDatabase(db);}
});

test('moderator queues enforce Server Global and Private authority without leaking Private metadata',async()=>{
  const {db,houses,reports}=await fixture();
  try{
    const server=await houses.createPublic({esoServer:'pc_na',guildId:'g1',houseId:62,esoOwner:'ServerOwner',displayName:'Server Villa',createdBy:'server-owner'});
    const global=await houses.createGlobal({esoServer:'pc_na',originGuildId:'g2',houseId:62,esoOwner:'GlobalOwner',displayName:'Global Villa',createdBy:'global-owner'});
    const privateHouse=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'private-owner',houseId:62,esoOwner:'SecretOwner',displayName:'Secret Villa',description:'Never disclose',createdBy:'private-owner'});
    await reports.submit({esoServer:'pc_na',destinationId:server.destination_id,savedHouseId:server.id,reporterId:'r1',guildId:'g1',problemType:'incorrect_destination'});
    await reports.submit({esoServer:'pc_na',destinationId:global.destination_id,savedHouseId:global.id,reporterId:'r2',guildId:'g2',problemType:'misleading_information'});
    await reports.submit({esoServer:'pc_na',destinationId:privateHouse.destination_id,savedHouseId:privateHouse.id,reporterId:'r3',guildId:'g1',problemType:'other'});
    const serverQueue=await reports.listForModerator({viewerId:'server-mod',guildId:'g1',esoServer:'pc_na',isServerModerator:true});
    assert.deepEqual(serverQueue.map(row=>row.targetSummary),['Server Villa — @ServerOwner']);
    assert.equal(JSON.stringify(serverQueue).includes('Never disclose'),false);
    const globalQueue=await reports.listForModerator({viewerId:'global-mod',guildId:'g9',esoServer:'pc_na',isGlobalModerator:true});
    assert.deepEqual(globalQueue.map(row=>row.targetSummary),['Global Villa — @GlobalOwner']);
    const privateQueue=await reports.listForModerator({viewerId:'private-owner',guildId:'g1',esoServer:'pc_na'});
    assert.deepEqual(privateQueue.map(row=>row.targetSummary),['Secret Villa — @SecretOwner']);
    await assert.rejects(()=>reports.review(serverQueue[0].id,{reviewerId:'not-mod',guildId:'g1',esoServer:'pc_na'}),/authorized/i);
  }finally{await closeDatabase(db);}
});

test('Global report queues include only the moderators ESO environment',async()=>{
  const {db,houses,reports}=await fixture();
  try{
    const na=await houses.createGlobal({esoServer:'pc_na',originGuildId:'g1',houseId:62,esoOwner:'NaOwner',createdBy:'na-owner'});
    const eu=await houses.createGlobal({esoServer:'pc_eu',originGuildId:'g2',houseId:62,esoOwner:'EuOwner',createdBy:'eu-owner'});
    await reports.submit({esoServer:'pc_na',destinationId:na.destination_id,savedHouseId:na.id,reporterId:'r1',guildId:'g1',problemType:'other'});
    await reports.submit({esoServer:'pc_eu',destinationId:eu.destination_id,savedHouseId:eu.id,reporterId:'r2',guildId:'g2',problemType:'other'});
    const queue=await reports.listForModerator({viewerId:'mod',guildId:'g1',esoServer:'pc_na',isGlobalModerator:true});
    assert.deepEqual(queue.map(row=>row.eso_owner),['NaOwner']);
  }finally{await closeDatabase(db);}
});

test('approved problem types render and accessibility reports advise but do not block tour readiness',async()=>{
  const {db,houses,tours,reports}=await fixture();
  try{
    assert.deepEqual(Object.keys(HOUSING_PROBLEM_TYPES),['jump_broken','owner_blocks_visitors','incorrect_destination','misleading_information','duplicate_entry','other']);
    const payload=reportProblemTypePayload({kind:'tour',token:'opaque'});
    const options=payload.components[0].toJSON().components[0].options;
    assert.equal(options.length,6);
    const house=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'Owner',createdBy:'owner'});
    const tour=await tours.create({esoServer:'pc_na',originGuildId:'g1',creatorId:'owner',visibility:'private',sourceGuildId:'g1',name:'Route'});
    await db.query("UPDATE tours SET eso_server='pc_na' WHERE id=?",[tour.id]);
    await tours.addStop(tour.id,house.id);
    await reports.submit({esoServer:'pc_na',destinationId:house.destination_id,savedHouseId:house.id,tourId:tour.id,reporterId:'owner',guildId:'g1',problemType:'owner_blocks_visitors'});
    const readiness=await new TourReadinessService(db).check(tour.id,{viewerId:'owner',guildId:'g1',esoServer:'pc_na'});
    assert.equal(readiness.stopCount,1);
    assert.equal(readiness.blocking.length,0);
    assert.ok(readiness.advisories.some(item=>item.code==='accessibility_reports'));
  }finally{await closeDatabase(db);}
});

test('readiness blocks a Server house that no longer belongs to the tour source guild',async()=>{
  const {db,houses,tours}=await fixture();
  try{
    const house=await houses.createPublic({guildId:'g1',esoServer:'pc_na',houseId:62,esoOwner:'Owner',createdBy:'owner'});
    const tour=await tours.create({creatorId:'owner',guildId:'g1',sourceGuildId:'g1',esoServer:'pc_na',scope:'server',name:'Route'});
    await tours.addStop(tour.id,house.id);
    await db.query("UPDATE saved_houses SET guild_id='g2' WHERE id=?",[house.id]);
    const result=await new TourReadinessService(db).check(tour.id,{viewerId:'owner',guildId:'g1',esoServer:'pc_na'});
    assert.ok(result.blocking.some(item=>item.code==='ineligible_context'));
  }finally{await closeDatabase(db);}
});
