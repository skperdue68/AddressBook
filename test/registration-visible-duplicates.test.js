import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {BookmarkService} from '../src/services/bookmark-service.js';
import {RegistrationService} from '../src/services/registration-service.js';
import {registerHousePage} from '../src/web/registration-routes.js';

test('registration rejects active visible houses at the same or a higher scope across web and Discord service entry points',async()=>{
 for(const [source,targets] of [['global',['global','public','private']],['public',['public','private']],['private',['private']]]){
  const {db,svc,c}=await fixture();try{
   const owner=await svc.fresh({...c,userId:'1'}),existing=await svc.registerHouse(owner,{houseId:1,esoOwner:'@MixedCase',visibility:source});
   for(const target of targets){
    const input={esoServer:'pc_na',houseId:1,esoOwner:'mixedcase',createdBy:'1'};
    const create=target==='private'?()=>new BookmarkService(db).create({...input,userId:'1',originGuildId:'g'}):()=>new RegistrationService(db).create({...input,guildId:'g',scope:target});
    await assert.rejects(create,error=>error.code==='VISIBLE_REGISTRATION_EXISTS'&&error.existingHouseId===existing.id);
   }
  }finally{await closeDatabase(db);}
 }
});

test('registration allows upgrading visibility and excludes unrelated Private, Server and environment records',async()=>{
 const {db,svc,c}=await fixture();try{
  const owner=await svc.fresh({...c,userId:'1'}),base={esoServer:'pc_na',houseId:1,esoOwner:'@Upgrade',createdBy:'1'};
  await svc.saved.createPrivate({...base,userId:'other',originGuildId:'g'});
  await svc.saved.createPublic({...base,guildId:'foreign'});
  await svc.saved.createGlobal({...base,esoServer:'pc_eu'});
  const privateHouse=await svc.saved.createPrivate({...base,userId:'1',originGuildId:'g'});assert.equal(privateHouse.scope,'private');
  const serverHouse=await svc.registerHouse(owner,{...base,visibility:'public'});assert.equal(serverHouse.scope,'public');
  const globalHouse=await svc.registerHouse(owner,{...base,visibility:'global'});assert.equal(globalHouse.scope,'global');
 }finally{await closeDatabase(db);}
});

test('pending higher visibility is not disclosed, same-context pending stays guarded, archived records do not block',async()=>{
 const {db,svc}=await fixture();try{
  const base={esoServer:'pc_na',houseId:1,esoOwner:'@Awaiting',createdBy:'first'};
  const pending=await svc.saved.createGlobal({...base,originGuildId:'g',status:'pending'});
  assert.ok(await svc.saved.createPublic({...base,guildId:'g',createdBy:'other'}));
  await assert.rejects(()=>svc.saved.createGlobal({...base,originGuildId:'g',createdBy:'other'}),error=>!error.existingHouseId);
  await svc.saved.setStatus(pending.id,'archived','1');
  assert.ok(await svc.saved.createGlobal({...base,originGuildId:'g'}));
 }finally{await closeDatabase(db);}
});

test('concurrent same-destination registrations serialize so only one equal-scope registration succeeds',async()=>{
 const {db,svc}=await fixture();try{
  const input={esoServer:'pc_na',houseId:1,esoOwner:'@Concurrent',originGuildId:'g',createdBy:'u'};
  const results=await Promise.allSettled([svc.saved.createGlobal(input),svc.saved.createGlobal(input)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 }finally{await closeDatabase(db);}
});

test('web registration offers a safe existing-house link instead of creating a lower-scope duplicate',async()=>{
 const {db,svc,c}=await fixture();try{
  const admin=await svc.fresh({...c,userId:'1'}),existing=await svc.registerHouse(admin,{houseId:1,esoOwner:'@Existing',visibility:'global'});
  const result=await registerHousePage({workspace:svc,context:c,form:new URLSearchParams({registrationAction:'save',houseId:'1',esoOwner:'@existing',visibility:'private'}),render:(title,body,active,status)=>({title,body,status})});
  assert.equal(result.status,409);assert.match(result.body,new RegExp(`href="/app/houses/${existing.id}"`));assert.match(result.body,/Open existing house/);
 }finally{await closeDatabase(db);}
});
