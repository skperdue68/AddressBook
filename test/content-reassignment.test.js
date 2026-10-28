import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase,one} from '../src/db/database.js';
import {ContentReassignmentService,canReassignShared} from '../src/services/content-reassignment-service.js';
import {contentReassignmentRoute} from '../src/web/content-reassignment-routes.js';

const candidate='123456789012345678';
const member={id:candidate,username:'newuser',globalName:'New Member',displayName:'Guild Nick'};
test('shared reassignment preserves ESO ownership and stops, updates readable identity and audits both identities',async()=>{
 const {db,svc,c}=await fixture();try{
  const admin=await svc.fresh({...c,userId:'1'}),house=await svc.registerHouse(admin,{houseId:1,esoOwner:'@ActualESOOwner',visibility:'public'}),tour=await svc.saveTourDraft(admin,{details:{name:'Shared route',visibility:'public'},stopIds:[house.id]});
  const calls=[],service=new ContentReassignmentService(svc,{memberLookup:async input=>{calls.push(input);return member;}});
  for(const [kind,record] of [['house',house],['tour',tour]]){
   const before=await service.preview(admin,kind,record.id,`<@!${candidate}>`);
   assert.equal((kind==='house'?await svc.saved.get(record.id):await svc.tours.get(record.id))[kind==='house'?'created_by':'creator_id'],'1');
   await service.confirm(admin,kind,record.id,candidate,before.version);
  }
  const changed=await svc.saved.get(house.id);assert.equal(changed.created_by,candidate);assert.equal(changed.created_by_global_name,'New Member');assert.equal(changed.created_by_display_name,'Guild Nick');assert.equal(changed.eso_owner,'ActualESOOwner');assert.equal(changed.updated_by,'1');assert.equal(changed.scope,'public');
  const changedTour=await svc.tours.get(tour.id);assert.equal(changedTour.creator_id,candidate);assert.equal(changedTour.creator_global_name,'New Member');assert.equal((await svc.getTourDraft(admin,tour.id)).stops.length,1);
  const audit=await one(db,"SELECT details FROM audit_log WHERE action='reassign_house_submitter'");assert.deepEqual(JSON.parse(audit.details).before,{id:'1',globalName:null,displayName:null});assert.equal(JSON.parse(audit.details).after.id,candidate);assert.equal(calls.length,4);
 }finally{await closeDatabase(db);}
});

test('reassignment permission is administrative, limited by environment and shared visibility',async()=>{
 const c={userId:'creator',guildId:'g',esoServer:'pc_na',isServerAdmin:true},house={scope:'public',guild_id:'g',eso_server:'pc_na',created_by:'creator'},tour={visibility:'public',guild_id:'g',eso_server:'pc_na',creator_id:'creator'};
 for(const [kind,row] of [['house',house],['tour',tour]]){
  assert.equal(canReassignShared(row,kind,c),true);
  assert.equal(canReassignShared({...row,[kind==='house'?'scope':'visibility']:'private'},kind,{...c,isOwner:true,isGlobalAdmin:true}),false);
  assert.equal(canReassignShared(row,kind,{...c,isServerAdmin:false}),false);
  assert.equal(canReassignShared(row,kind,{...c,esoServer:'pc_eu',isOwner:true}),false);
  assert.equal(canReassignShared({...row,guild_id:'foreign'},kind,c),false);
  assert.equal(canReassignShared({...row,[kind==='house'?'scope':'visibility']:'global'},kind,c),false);
  assert.equal(canReassignShared({...row,guild_id:'foreign'},kind,{...c,isGlobalAdmin:true}),true);
 }
});

test('confirmation rechecks permission, record version and live membership and never accepts client names',async()=>{
 const {db,svc,c}=await fixture();try{
  const admin=await svc.fresh({...c,userId:'staff',memberRoleIds:['staff']}),house=await svc.registerHouse(admin,{houseId:1,esoOwner:'@A',visibility:'public'});let current=member;
  const service=new ContentReassignmentService(svc,{memberLookup:async()=>current}),preview=await service.preview(admin,'house',house.id,candidate);
  current=null;await assert.rejects(()=>service.confirm(admin,'house',house.id,candidate,preview.version),/current member/);
  current={...member,id:'999'};await assert.rejects(()=>service.confirm(admin,'house',house.id,candidate,preview.version),/current member/);
  current=member;await svc.updateHouse(admin,house.id,{description:'changed'});await assert.rejects(()=>service.confirm(admin,'house',house.id,candidate,preview.version),/changed/);
  const fresh=await service.preview(admin,'house',house.id,candidate);await db.query("UPDATE guild_settings SET staff_role_ids='[]' WHERE guild_id='g'");
  await assert.rejects(()=>service.confirm({...admin,memberRoleIds:[]},'house',house.id,candidate,fresh.version),/not available/);
  assert.equal((await svc.saved.get(house.id)).created_by,'staff');
 }finally{await closeDatabase(db);}
});

test('foreign Server records require both actor and candidate in their actual source guild',async()=>{
 const {db,svc,c}=await fixture();try{
  await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('foreign','pc_na')");const owner=await svc.fresh({...c,userId:'1'}),foreign=await svc.fresh({...owner,guildId:'foreign'}),tour=await svc.saveTourDraft(foreign,{details:{name:'Foreign',visibility:'public'},stopIds:[]});
  const calls=[];let actorMember=true;const service=new ContentReassignmentService(svc,{memberLookup:async input=>{calls.push(input);return input.userId==='1'?(actorMember?{id:'1'}:null):member;}});
  const preview=await service.preview(owner,'tour',tour.id,candidate);assert.deepEqual(calls,[{guildId:'foreign',userId:'1'},{guildId:'foreign',userId:candidate}]);
  actorMember=false;await assert.rejects(()=>service.confirm(owner,'tour',tour.id,candidate,preview.version),/current member/);
 }finally{await closeDatabase(db);}
});

test('reassignment route looks up an ID, previews escaped identity and confirms only server-resolved identity',async()=>{
 const {db,svc,c}=await fixture();try{
  const admin=await svc.fresh({...c,userId:'1'}),house=await svc.registerHouse(admin,{houseId:1,esoOwner:'@Route',visibility:'global'});
  const args={workspace:svc,context:admin,session:{csrf:'csrf'},url:new URL(`http://local/app/houses/${house.id}/reassign`),render:(title,body)=>({title,body}),memberLookup:async()=>({...member,displayName:'<b>New</b>'})};
  const initial=await contentReassignmentRoute({...args,form:null});assert.match(initial.body,/Discord member ID or mention/);assert.doesNotMatch(initial.body,/name="confirm"/);
  const preview=await contentReassignmentRoute({...args,form:new URLSearchParams({memberId:`<@${candidate}>`,displayName:'Untrusted'})});assert.match(preview.body,/&lt;b&gt;New&lt;\/b&gt;/);assert.doesNotMatch(preview.body,/<b>New<\/b>|Untrusted/);assert.match(preview.body,/creator editing rights/);
  const version=/name="version" value="([^"]+)"/.exec(preview.body)[1];
  const saved=await contentReassignmentRoute({...args,form:new URLSearchParams({memberId:candidate,version,confirm:'reassign',displayName:'Forged'})});assert.equal(saved.title,'Reassignment saved');assert.equal((await svc.saved.get(house.id)).created_by_display_name,'<b>New</b>');
  assert.equal(await contentReassignmentRoute({...args,url:new URL('http://local/app/houses'),form:null}),null);
 }finally{await closeDatabase(db);}
});

test('Private house and tour reassignment is rejected even by their bot owner creator',async()=>{
 const {db,svc,c}=await fixture();try{
  const admin=await svc.fresh({...c,userId:'1'}),house=await svc.registerHouse(admin,{houseId:1,esoOwner:'@Private',visibility:'private'}),tour=await svc.saveTourDraft(admin,{details:{name:'Private',visibility:'private'},stopIds:[house.id]});
  const service=new ContentReassignmentService(svc,{memberLookup:async()=>{assert.fail('Private records cannot reach member lookup');}});
  for(const [kind,record] of [['house',house],['tour',tour]]){await assert.rejects(()=>service.preview(admin,kind,record.id,candidate),/not available/);await assert.rejects(()=>service.confirm(admin,kind,record.id,candidate,'forged'),/not available/);}
 }finally{await closeDatabase(db);}
});
