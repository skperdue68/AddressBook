import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase,one} from '../src/db/database.js';
import {ServerHouseCopyService} from '../src/services/server-house-copy-service.js';

test('administrative server copy preserves source, attribution and metadata and refuses stale or unauthorized targets',async()=>{
 const {db,svc,c}=await fixture();try{
  await db.query("INSERT INTO guild_settings(guild_id,eso_server,staff_role_ids) VALUES('g2','pc_na','[\"staff\"]'),('foreign','pc_eu','[\"staff\"]')");
  const owner=await svc.authorizeContext({...c,userId:'1'}),target=await svc.authorizeContext({...owner,guildId:'g2',guildName:'Destination'}),copy=new ServerHouseCopyService(svc,{memberLookup:async({userId})=>({id:userId,username:userId})});
  const h=await svc.registerHouse(owner,{houseId:1,esoOwner:'@Builder',visibility:'public',displayName:'My build',description:'First\n\nSecond',tags:['garden']});
  const tour=await svc.saveTourDraft(owner,{details:{name:'Keep source stops',visibility:'public'},stopIds:[h.id]});
  const p=await copy.preview(owner,h.id,target),result=await copy.copy(owner,h.id,target,p.version);
  assert.equal(result.house.guild_id,'g2');assert.equal(result.house.scope,'public');assert.equal(result.house.created_by,'1');assert.equal(result.house.description,h.description);assert.deepEqual(JSON.parse(result.house.tags),['garden']);
  assert.equal((await svc.saved.get(h.id)).guild_id,'g');assert.equal((await svc.getTourDraft(owner,tour.id)).stops.length,1);
  const again=await copy.preview(owner,h.id,target);assert.equal((await copy.copy(owner,h.id,target,again.version)).existing,true);
  const normal=await svc.authorizeContext({...c,userId:'member',guildId:'g2'});await assert.rejects(()=>copy.preview(owner,h.id,normal),/authorized/);
  const foreign=await svc.authorizeContext({...owner,guildId:'foreign',esoServer:'pc_eu'});await assert.rejects(()=>copy.preview(owner,h.id,foreign),/environment/);
  const privateHouse=await svc.registerHouse(c,{houseId:2,esoOwner:'@Private',visibility:'private'});await assert.rejects(()=>copy.preview(owner,privateHouse.id,target),/not available/);
  assert.equal(Number((await one(db,"SELECT count(*) n FROM audit_log WHERE action='copy_house_between_servers'")).n),1);
 }finally{await closeDatabase(db);}
});

test('server admins must administer both guilds; Global admins are limited to their ESO environment',async()=>{
 const {db,svc,c}=await fixture();try{
  await db.query("INSERT INTO guild_settings(guild_id,eso_server,staff_role_ids) VALUES('g2','pc_na','[\"staff\"]')");await db.query("INSERT INTO global_moderators(discord_user_id,eso_server,approved_by) VALUES('ga','pc_na','1')");
  const owner=await svc.authorizeContext({...c,userId:'1'}),h=await svc.registerHouse(owner,{houseId:1,esoOwner:'@Public',visibility:'public'}),copy=new ServerHouseCopyService(svc,{memberLookup:async({userId})=>({id:userId,username:userId})});
  const staff=await svc.authorizeContext({...c,userId:'staff',memberRoleIds:['staff']}),staffTarget=await svc.authorizeContext({...staff,guildId:'g2'});assert.equal((await copy.targets(staff,h.id,[staff,staffTarget])).length,1);
  const ga=await svc.authorizeContext({...c,userId:'ga'}),gaTarget=await svc.authorizeContext({...ga,guildId:'g2'}),preview=await copy.preview(ga,h.id,gaTarget);assert.equal((await copy.copy(ga,h.id,gaTarget,preview.version)).house.created_by,'1');
  const another=await svc.registerHouse(owner,{houseId:2,esoOwner:'@Second',visibility:'public'}),p=await copy.preview(staff,another.id,staffTarget);await svc.updateHouse(owner,another.id,{description:'Changed'});await assert.rejects(()=>copy.copy(staff,another.id,staffTarget,p.version),/changed/);
  await db.query("UPDATE guild_settings SET staff_role_ids='[]' WHERE guild_id='g2'");await assert.rejects(()=>copy.preview(staff,another.id,staffTarget),/authorized/);
 }finally{await closeDatabase(db);}
});

test('copy attribution retains current submitters, falls back to the actor for departed submitters and fails closed on lookup errors',async()=>{
 const {db,svc,c}=await fixture();try{
  await db.query("INSERT INTO guild_settings(guild_id,eso_server,staff_role_ids) VALUES('g2','pc_na','[\"staff\"]')");
  const actor=await svc.authorizeContext({...c,userId:'1'}),target=await svc.authorizeContext({...actor,guildId:'g2'});
  const h=await svc.registerHouse(c,{houseId:1,esoOwner:'@Attribution',visibility:'public'});
  let originalPresent=true,actorPresent=true,unavailable=false;
  const service=new ServerHouseCopyService(svc,{memberLookup:async({userId})=>{
   if(unavailable)throw new Error('Discord unavailable');
   if(userId==='1')return actorPresent?{id:'1',username:'Actor',displayName:'Destination Actor'}:null;
   return originalPresent?{id:userId,username:'Original',displayName:'Original Member'}:null;
  }});
  await assert.rejects(()=>service.preview(actor,h.id,target),/not available/);await db.query("UPDATE saved_houses SET status='active' WHERE id=?",[h.id]);
  const retained=await service.preview(actor,h.id,target);assert.equal(retained.attribution.submitterId,c.userId);
  originalPresent=false;await assert.rejects(()=>service.copy(actor,h.id,target,retained.version),/changed/);
  const reassigned=await service.preview(actor,h.id,target);assert.equal(reassigned.attribution.submitterId,'1');assert.equal(reassigned.attribution.reassigned,true);
  unavailable=true;await assert.rejects(()=>service.copy(actor,h.id,target,reassigned.version),/Discord unavailable/);
  unavailable=false;actorPresent=false;await assert.rejects(()=>service.copy(actor,h.id,target,reassigned.version),/no longer a member/);
  actorPresent=true;const copied=await service.copy(actor,h.id,target,reassigned.version);
  assert.equal(copied.house.created_by,'1');assert.equal(copied.house.created_by_display_name,'Destination Actor');
  assert.equal((await svc.saved.get(h.id)).created_by,c.userId);
  const audit=await one(db,"SELECT details FROM audit_log WHERE action='copy_house_between_servers'");assert.equal(JSON.parse(audit.details).attribution.originalId,c.userId);
 }finally{await closeDatabase(db);}
});
