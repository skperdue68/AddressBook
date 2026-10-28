import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {createHousingMenu} from '../src/ui/housing-menu.js';
import {CommentService} from '../src/services/comment-service.js';
const controls=p=>p.components.flatMap(r=>(r.toJSON?.()||r).components), descriptions=p=>(p.embeds||[]).map(e=>(e.toJSON?.()||e).description||'').join('\n');
test('Discord comments page beyond 25 and retain full long comments with contextual controls',async()=>{
 const {db,svc,c}=await fixture();try{
  const owner=await svc.fresh({...c,userId:'1'}),h=await svc.registerHouse(owner,{houseId:1,esoOwner:'Builder',visibility:'public'}),comments=new CommentService(db);
  for(let n=1;n<=28;n++)await comments.add({esoServer:'pc_na',savedHouseId:h.id,commenterUserId:'author',text:`Comment ${n}: `+'a'.repeat(1980)});
  const menu=createHousingMenu(db);let payload,modal;const i={guildId:'g',channelId:'c',guild:{name:'Guild'},user:{id:'u',username:'Guest'},member:{roles:{cache:new Map()}},update:async p=>payload=p,reply:async p=>payload=p,showModal:async m=>modal=m};
  await menu.button({...i,customId:`hu:comments:server:${h.id}:hu%3Afind`});
  assert.match(descriptions(payload),/Page 1 of 14/);assert.match(descriptions(payload),/Comment 28: a{1980}/);assert.match(descriptions(payload),/Comment 27: a{1980}/);
  assert.ok(payload.embeds.reduce((n,e)=>n+JSON.stringify(e.toJSON?.()||e).length,0)<6000);
  const next=controls(payload).find(b=>b.label==='Next').custom_id;
  const jump=controls(payload).find(b=>b.label==='Jump to page');assert.ok(jump);await menu.button({...i,customId:jump.custom_id});assert.ok(modal);const jumpId=modal.toJSON().custom_id;
  await menu.modal({...i,customId:jumpId,fields:{getTextInputValue:()=> '12'},isFromMessage:()=>true});assert.match(descriptions(payload),/Page 12 of 14/);
  await menu.modal({...i,customId:jumpId,fields:{getTextInputValue:()=> '99'},isFromMessage:()=>true});assert.match(payload.content,/1 to 14/);
  await menu.button({...i,customId:next,user:{id:'stranger'}});assert.match(payload.content,/another user/);
  await menu.button({...i,customId:next});assert.match(descriptions(payload),/Page 2 of 14/);
  const last=controls(payload).find(b=>b.label==='Last').custom_id;await menu.button({...i,customId:last});assert.match(descriptions(payload),/Comment 1: a{1980}/);assert.ok(controls(payload).some(b=>b.label==='Back to house'&&b.custom_id==='hu:find'));
  const add=controls(payload).find(b=>b.label==='Add Comment').custom_id;await menu.button({...i,customId:add});assert.ok(modal);await menu.modal({...i,customId:modal.toJSON().custom_id,fields:{getTextInputValue:()=> 'New thought'},isFromMessage:()=>true});assert.match(payload.content,/Comment added/);assert.match(descriptions(payload),/Page 1 of 15/);assert.match(descriptions(payload),/New thought/);
  const stale=controls(payload).find(b=>b.label==='Next').custom_id;await db.query("UPDATE saved_houses SET scope='private',owner_user_id='other',guild_id=NULL WHERE id=?",[h.id]);await menu.button({...i,customId:stale});assert.match(payload.content,/no longer available/);assert.ok(!descriptions(payload).includes('New thought'));
 }finally{await closeDatabase(db);}
});

test('Discord comment reader rechecks house Share Pass revocation on paging and modal submit',async()=>{
 const {db,svc,c}=await fixture();try{
  const {SharePassService}=await import('../src/services/share-pass-service.js'),passes=new SharePassService(db),owner=await svc.fresh({...c,userId:'1'}),h=await svc.registerHouse(owner,{houseId:1,esoOwner:'PrivateBuilder',visibility:'private'}),comments=new CommentService(db);
  for(let n=1;n<=4;n++)await comments.add({esoServer:'pc_na',savedHouseId:h.id,commenterUserId:'author',text:`Private pass comment ${n}`});
  const pass=await passes.createHousePass({savedHouseId:h.id,createdBy:'1',originGuildId:'g',esoServer:'pc_na',channelId:'c'});await passes.markHousePassPosted(pass.pass.id,{guildId:'g',channelId:'c',messageId:'m'});
  const menu=createHousingMenu(db);let payload,modal;const i={guildId:'g',channelId:'c',guild:{name:'Guild'},user:{id:'u',username:'Guest'},member:{roles:{cache:new Map()}},update:async p=>payload=p,reply:async p=>payload=p,showModal:async m=>modal=m};
  await menu.button({...i,customId:`hu:pass:house:comments:${pass.token}`});assert.match(descriptions(payload),/Private pass comment 4/);
  const next=controls(payload).find(b=>b.label==='Next').custom_id;await menu.button({...i,customId:controls(payload).find(b=>b.label==='Add Comment').custom_id});assert.ok(modal);
  await passes.revokeHousePass(pass.pass.id,{actorId:'1',reason:'Finished sharing'});
  await menu.button({...i,customId:next});assert.match(payload.content,/revoked/);assert.ok(!descriptions(payload).includes('Private pass comment'));
  await menu.modal({...i,customId:modal.toJSON().custom_id,fields:{getTextInputValue:()=> 'Must not save'},isFromMessage:()=>true});assert.match(payload.content,/revoked/);assert.equal(await comments.count('personal',h.id,'pc_na'),4);
 }finally{await closeDatabase(db);}
});
import {commentReaderPayload} from '../src/ui/comment-reader.js';
test('comment reader timestamps support MariaDB Date objects and offset timestamps',()=>{
 for(const date of [new Date('2026-10-28T00:00:00Z'),'2026-10-28 00:00:00','2026-10-28T02:00:00+02:00']){
 const p=commentReaderPayload({house:{name:'House',eso_owner:'Builder'},rows:[{author_name:'A',created_at:date,comment_text:'Hello'}],total:1,page:1,token:'t',backId:'hu:home'});assert.match(descriptions(p),/<t:1793145600:f>/);
 }
});

test('tour-only comment readers retain stop context and close when the route advances',async()=>{
 const {db,svc,c}=await fixture();try{
  const {SharePassService}=await import('../src/services/share-pass-service.js'),{TourService}=await import('../src/services/tour-service.js'),{TourSessionService}=await import('../src/services/tour-session-service.js');
  const passes=new SharePassService(db),tours=new TourService(db),sessions=new TourSessionService(db),owner=await svc.fresh({...c,userId:'1'}),h=await svc.registerHouse(owner,{houseId:1,esoOwner:'PrivateBuilder',visibility:'private'}),second=await svc.registerHouse(owner,{houseId:2,esoOwner:'PrivateBuilder',visibility:'private'}),tour=await tours.create({creatorId:'1',guildId:'g',sourceGuildId:'g',esoServer:'pc_na',visibility:'private',name:'Private route'});
  await tours.addStop(tour.id,h.id);await tours.addStop(tour.id,second.id);const pass=await passes.createTourPass({tourId:tour.id,createdBy:'1',originGuildId:'g',esoServer:'pc_na',channelId:'c'}),session=await sessions.startFromPass({passId:pass.pass.id,tourId:tour.id,guildId:'g',channelId:'c',userId:'u',esoServer:'pc_na'}),comments=new CommentService(db);for(let n=1;n<=4;n++)await comments.add({esoServer:'pc_na',savedHouseId:h.id,commenterUserId:'author',text:`Stop comment ${n}`});
  const menu=createHousingMenu(db);let payload;const i={guildId:'g',channelId:'c',guild:{name:'Guild'},user:{id:'u',username:'Guest'},member:{roles:{cache:new Map()}},update:async p=>payload=p,reply:async p=>payload=p};
  await menu.button({...i,customId:`tour:comments:${session.id}:compact`});assert.match(descriptions(payload),/Stop comment 4/);const next=controls(payload).find(b=>b.label==='Next').custom_id;assert.ok(controls(payload).some(b=>b.label==='Back to tour'&&b.custom_id.startsWith(`tour:return:${session.id}:`)));
  await sessions.advance(session.id,1,2,{esoServer:'pc_na'});await menu.button({...i,customId:next});assert.match(payload.content,/stop changed/);assert.ok(!descriptions(payload).includes('Stop comment'));
 }finally{await closeDatabase(db);}
});
