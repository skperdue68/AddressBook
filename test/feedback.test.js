import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase,migrate,one,openDatabase} from '../src/db/database.js';
import {transferUnifiedData} from '../src/db/database-migration.js';
import {FeedbackService} from '../src/services/feedback-service.js';
import {feedbackSchema} from '../src/db/feedback-schema.js';
import {randomUUID} from 'node:crypto';

test('feedback persists across migration, remains private and restricts reviews to current bot owners',async()=>{
 const {db,c}=await fixture();const env={BOT_OWNER_IDS:'1'},service=new FeedbackService(db,env);
 try{
  const data={eventKey:randomUUID(),category:'idea',subject:'A better tour picker',message:'First paragraph\n\n<script>text</script>'};
  const item=await service.submit(c,{name:'Evaine'},data);assert.equal(item.status,'new');
  const again=await service.submit(c,{name:'Evaine'},data);assert.equal(again.id,item.id);
  assert.equal((await service.mine(c.userId)).length,1);assert.equal((await service.mine('other')).length,0);
  await assert.rejects(()=>service.list({userId:'u',isOwner:true}),/owner/i);
  await assert.rejects(()=>service.review({userId:'u',isGlobalAdmin:true},{id:item.id,revision:1,status:'resolved',notes:'secret'}),/owner/i);
  const owner={userId:'1'},inbox=await service.list(owner);assert.equal(inbox.rows[0].message,data.message);
  await service.review(owner,{id:item.id,revision:1,status:'reviewed',notes:'Internal note'});
  assert.equal((await service.mine(c.userId))[0].status,'reviewed');assert.equal((await service.mine(c.userId))[0].review_notes,undefined);
  await assert.rejects(()=>service.review(owner,{id:item.id,revision:1,status:'resolved',notes:''}),/changed/i);
  await migrate(db);assert.equal((await service.list(owner,{status:'reviewed'})).total,1);
  env.BOT_OWNER_IDS='2';await assert.rejects(()=>service.list(owner),/owner/i);
  assert.equal(Number((await one(db,'SELECT max(version) v FROM schema_migrations')).v),15);
 }finally{await closeDatabase(db);}
});

test('feedback validates limits and both schema dialects support the same stored fields',async()=>{
 const {db,c}=await fixture();const service=new FeedbackService(db,{BOT_OWNER_IDS:'1'});
 try{for(const change of [{message:''},{message:'a'.repeat(4001)},{subject:'a'.repeat(121)},{category:'admin'},{eventKey:'bad'}])await assert.rejects(()=>service.submit(c,{name:'User'},{eventKey:randomUUID(),category:'general',subject:'Hello',message:'Description',...change}));
  assert.equal((await service.mine(c.userId)).length,0);
  assert.match(feedbackSchema('mariadb')[0],/AUTO_INCREMENT/);assert.match(feedbackSchema('sqlite')[0],/AUTOINCREMENT/);
 }finally{await closeDatabase(db);}
});

test('feedback survives backend transfers and schema13 sources remain compatible',async()=>{
 const {db,c}=await fixture(),target=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:':memory:'});
 try{
  await migrate(target);const service=new FeedbackService(db,{BOT_OWNER_IDS:'1'});
  await service.submit(c,{name:'Evaine'},{eventKey:randomUUID(),category:'general',subject:'Keep me',message:'Persistent feedback'});
  await transferUnifiedData(db,target);
  assert.equal((await one(target,'SELECT * FROM app_feedback')).message,'Persistent feedback');
  assert.equal((await one(target,'SELECT created_at FROM app_feedback')).created_at,(await one(db,'SELECT created_at FROM app_feedback')).created_at);
  await db.query('DROP TABLE app_feedback');await db.query('DELETE FROM schema_migrations WHERE version>=14');
  await transferUnifiedData(db,target);assert.equal(Number((await one(target,'SELECT count(*) n FROM app_feedback')).n),0);
  await migrate(db);await migrate(db);assert.equal(Number((await one(db,'SELECT count(*) n FROM schema_migrations WHERE version=14')).n),1);
 }finally{await closeDatabase(db);await closeDatabase(target);}
});

test('owner inbox paginates newest first while member history stays limited to their latest ten',async()=>{
 const {db,c}=await fixture(),service=new FeedbackService(db,{BOT_OWNER_IDS:'1'});
 try{
  for(let n=1;n<=26;n++)await service.submit(c,{name:'Member'},{eventKey:randomUUID(),category:'idea',subject:`Idea ${n}`,message:'Description'});
  const first=await service.list({userId:'1'}),second=await service.list({userId:'1'},{page:2});
  assert.equal(first.total,26);assert.equal(first.rows.length,25);assert.equal(first.rows[0].subject,'Idea 26');assert.equal(second.rows[0].subject,'Idea 1');assert.equal(first.hasNext,true);assert.equal(second.hasNext,false);
  assert.equal((await service.mine(c.userId)).length,10);
  await service.review({userId:'1'},{id:first.rows[0].id,revision:1,status:'resolved'});
  assert.equal((await service.list({userId:'1'},{status:'resolved'})).total,1);
 }finally{await closeDatabase(db);}
});
