import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, migrate, closeDatabase } from '../src/db/database.js';
import { TourService } from '../src/services/tour-service.js';
import { SavedHouseService } from '../src/services/saved-house-service.js';
import { createHousingMenu } from '../src/ui/housing-menu.js';

const controls=p=>(p.components||[]).flatMap(r=>r.toJSON().components);
async function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ab-tour-admin-'));
 const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'test.sqlite')});
 await migrate(db);
 await db.query(`INSERT INTO guild_settings(guild_id,eso_server,staff_role_ids) VALUES('g1','pc_na','["staff"]'),('g2','pc_na','["staff"]'),('eu','pc_eu','["staff"]')`);
 await db.query("INSERT INTO global_moderators(discord_user_id,eso_server,approved_by) VALUES('global','pc_na','approver')");
 const tours=new TourService(db),menu=createHousingMenu(db);
 let response;
 const i=(customId,{user='global',guild='g1',staff=false,fields={},values=[]}={})=>({customId,guildId:guild,channelId:'channel',user:{id:user},member:{roles:{cache:new Map(staff?[['staff',true]]:[])}},values,fields:{getTextInputValue:key=>fields[key]||''},update:async p=>{response=p;return p;},reply:async p=>{response=p;return p;},showModal:async p=>{response=p;return p;}});
 const make=(visibility='public',guildId='g1',esoServer='pc_na',creatorId='owner',name='Route')=>tours.create({visibility,guildId,esoServer,creatorId,name});
 return {db,tours,menu,i,make,response:()=>response,close:async()=>{await closeDatabase(db);fs.rmSync(dir,{recursive:true,force:true});}};
}

for(const [visibility,guild] of [['global','g1'],['public','g1'],['public','g2']])test(`Global administrator edits another creator's ${visibility} tour from ${guild}`,async()=>{
 const f=await fixture();try{
  const t=await f.make(visibility,guild);
  await f.menu.button(f.i('hu:tours:manage'));
  assert.ok(controls(f.response()).find(c=>c.type===3)?.options.some(o=>o.label.includes('Route')),'tour must be reachable from Edit Tour');
  await f.menu.button(f.i(`hu:tour:edittext:${t.id}`));
  assert.equal(f.response().toJSON?.().custom_id,`hu:modal:tour:edit:${t.id}`);
  await f.menu.modal(f.i(`hu:modal:tour:edit:${t.id}`,{fields:{name:'Renamed',description:'Edited by admin'}}));
  const updated=await f.tours.get(t.id);
  assert.equal(updated.name,'Renamed');assert.equal(updated.creator_id,'owner');
  assert.equal(updated.guild_id,t.guild_id);assert.equal(updated.source_guild_id,t.source_guild_id);
 }finally{await f.close();}
});

for(const [label,options,visibility,guild,server,allowed] of [
 ['server staff owns guild scope',{user:'staff-user',staff:true},'public','g1','pc_na',true],
 ['server staff cannot edit another guild',{user:'staff-user',staff:true},'public','g2','pc_na',false],
 ['server staff cannot edit Global',{user:'staff-user',staff:true},'global','g1','pc_na',false],
 ['server staff cannot edit Private',{user:'staff-user',staff:true},'private','g1','pc_na',false],
 ['Global staff cannot edit Private',{user:'global'},'private','g1','pc_na',false],
 ['Global creator keeps Private edit rights',{user:'global'},'private','g1','pc_na',true],
 ['ordinary member cannot edit others',{user:'member'},'public','g1','pc_na',false],
 ['creator keeps Private edit rights',{user:'owner'},'private','g1','pc_na',true],
 ['Global grant does not cross environments',{user:'global',guild:'eu'},'global','eu','pc_eu',false]
])test(label,async()=>{
 const f=await fixture();try{
  const t=await f.make(visibility,guild,server,label==='Global creator keeps Private edit rights'?'global':'owner');
  await f.menu.modal(f.i(`hu:modal:tour:edit:${t.id}`,{...options,fields:{name:'Changed'}}));
  assert.equal((await f.tours.get(t.id)).name,allowed?'Changed':'Route');
 }finally{await f.close();}
});

test('revoked Global privileges cannot save an already opened edit modal',async()=>{
 const f=await fixture();try{
  const t=await f.make('public','g2');
  await f.menu.button(f.i(`hu:tour:edittext:${t.id}`));
  assert.equal(f.response().toJSON?.().custom_id,`hu:modal:tour:edit:${t.id}`);
  await f.db.query("DELETE FROM global_moderators WHERE discord_user_id='global'");
  await f.menu.modal(f.i(`hu:modal:tour:edit:${t.id}`,{fields:{name:'Forbidden'}}));
  assert.equal((await f.tours.get(t.id)).name,'Route');
 }finally{await f.close();}
});

test('Browse Tours sorts case-insensitively before pagination and selection opens the correct tour',async()=>{
 const f=await fixture();try{
  const names=['Zebra',...Array.from({length:25},(_,n)=>`alpha ${String(n+1).padStart(2,'0')}`),'beta'];
  for(const name of names)await f.make('public','g1','pc_na','owner',name);
  await f.menu.button(f.i('hu:tours:browse',{user:'member'}));
  let cs=controls(f.response()),select=cs.find(c=>c.type===3);
  assert.ok(select.options[0].label.includes('alpha 01'));
  const next=cs.find(c=>c.label==='Next');assert.ok(next);
  await f.menu.button(f.i(next.custom_id,{user:'member'}));
  select=controls(f.response()).find(c=>c.type===3);
  assert.deepEqual(select.options.map(o=>o.label.replace(/^.*? â€¢ /,'')),['beta (Server Tour)','Zebra (Server Tour)']);
  await f.menu.select(f.i(select.custom_id,{user:'member',values:[select.options[0].value]}));
  assert.match(JSON.stringify(f.response()),/beta/);
 }finally{await f.close();}
});


test('Global administrator visibility editing keeps a foreign Server tour in its original guild',async()=>{
 const f=await fixture();try{
  const t=await f.make('public','g2');
  await f.menu.button(f.i(`hu:tour:setvisibility:server:${t.id}`));
  const updated=await f.tours.get(t.id);
  assert.equal(updated.guild_id,'g2');assert.equal(updated.source_guild_id,'g2');
 }finally{await f.close();}
});

test('Global administrator cannot see or edit another creators Private tour or houses',async()=>{
 const f=await fixture();try{
  await f.db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Villa','villa')");
  const house=await new SavedHouseService(f.db).createPrivate({esoServer:'pc_na',originGuildId:'g2',userId:'owner',houseId:62,esoOwner:'PrivateHomeOwner',createdBy:'owner'});
  const t=await f.make('private','g2','pc_na','owner','Secret route');
  const visible=await f.make('global','g1','pc_na','owner','Public route');
  for(const route of ['hu:tours:browse','hu:tours:manage']){
   await f.menu.button(f.i(route));
   const options=controls(f.response()).find(c=>c.type===3).options;
   assert.deepEqual(options.map(o=>o.label),['Public route (Global Tour)']);
  }
  for(const route of [`hu:tour:manage:${t.id}`,`hu:tour:edittext:${t.id}`,`hu:tour:add:${t.id}`,`hu:tour:deleteconfirm:${t.id}`,`hu:context:view:personal:${house.id}`,`hu:personal:edit:${house.id}`]){
   await f.menu.button(f.i(route));
   assert.equal(f.response().toJSON?.().custom_id,undefined);
   assert.doesNotMatch(JSON.stringify(f.response()),/Secret route|PrivateHomeOwner/);
  }
  assert.ok(await f.tours.get(t.id));assert.ok(await f.tours.get(visible.id));
 }finally{await f.close();}
});

test('administrative edit access does not add private tours to ordinary Browse Tours',async()=>{
 const f=await fixture();try{
  await f.make('private','g2','pc_na','owner','Hidden private route');
  await f.make('global','g1','pc_na','owner','Visible route');
  await f.menu.button(f.i('hu:tours:browse'));
  const options=controls(f.response()).find(c=>c.type===3).options;
  assert.equal(options.length,1);assert.match(options[0].label,/Visible route/);
 }finally{await f.close();}
});

test('a Global administrator cannot edit a tour in a different ESO environment by ID',async()=>{
 const f=await fixture();try{
  const t=await f.make('private','eu','pc_eu');
  await assert.rejects(()=>f.menu.modal(f.i(`hu:modal:tour:edit:${t.id}`,{fields:{name:'Forbidden'}})),/PC EU.*PC NA/);
  assert.equal((await f.tours.get(t.id)).name,'Route');
 }finally{await f.close();}
});

test('an empty moderator configuration and Discord Administrator permission do not grant tour edits',async()=>{
 const f=await fixture();try{
  await f.db.query("UPDATE guild_settings SET staff_role_ids='[]' WHERE guild_id='g1'");
  const t=await f.make();
  const i=f.i(`hu:modal:tour:edit:${t.id}`,{user:'member',fields:{name:'Forbidden'}});
  i.member.permissions={has:()=>true};
  await f.menu.modal(i);
  assert.equal((await f.tours.get(t.id)).name,'Route');
 }finally{await f.close();}
});


for(const navigation of ['next','return'])test(`revoking Global access invalidates cached administrative picker ${navigation}`,async()=>{
 const f=await fixture();try{
  for(let n=0;n<26;n++)await f.make('public','g2','pc_na','owner',`Foreign ${String(n).padStart(2,'0')}`);
  await f.menu.button(f.i('hu:tours:manage'));
  const cs=controls(f.response()),select=cs.find(c=>c.type===3),state=select.custom_id.split(':').pop();
  await f.db.query("DELETE FROM global_moderators WHERE discord_user_id='global'");
  const id=navigation==='next'?cs.find(c=>c.label==='Next').custom_id:`hu:picker:return:${state}`;
  await f.menu.button(f.i(id));
  assert.equal(controls(f.response()).some(c=>c.type===3),false);
  assert.match(f.response().content,/expired/);
 }finally{await f.close();}
});

test('administrative tour access does not grant direct playback or Share Pass creation',async()=>{
 const f=await fixture();try{
  const t=await f.make('private','g2');
  await f.menu.button(f.i(`hu:tour:startprivate:${t.id}`));
  assert.match(f.response().content,/not found/);
  const {SharePassService}=await import('../src/services/share-pass-service.js');
  await assert.rejects(()=>new SharePassService(f.db).createTourPass({tourId:t.id,createdBy:'global',originGuildId:'g1',esoServer:'pc_na'}),/normal access|creator|owner/i);
 }finally{await f.close();}
});

test('Global administrator can edit, reorder, and remove foreign Server tour stops',async()=>{
 const f=await fixture();try{
  await f.db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Villa','villa')");
  const houses=new SavedHouseService(f.db),t=await f.make('public','g2');
  for(const owner of ['First','Second']){
   const h=await houses.createPublic({esoServer:'pc_na',guildId:'g2',houseId:62,esoOwner:owner,createdBy:'owner'});
   await f.tours.addStop(t.id,h.id);
  }
  const original=await f.tours.getStops(t.id),first=original[0].id;
  await f.menu.button(f.i(`hu:tour:editstop:${t.id}`));
  const select=controls(f.response()).find(c=>c.type===3);
  await f.menu.select(f.i(select.custom_id,{values:[select.options[0].value]}));
  assert.equal(f.response().toJSON?.().custom_id,`hu:modal:stop:edit:${t.id}:${first}`);
  await f.menu.modal(f.i(`hu:modal:stop:edit:${t.id}:${first}`,{fields:{title:'Updated stop',description:'New notes'}}));
  assert.equal((await f.tours.getStops(t.id))[0].custom_title,'Updated stop');
  await f.menu.button(f.i(`hu:reorder:down:${t.id}:${first}`));
  assert.equal((await f.tours.getStops(t.id))[1].id,first);
  await f.menu.button(f.i(`hu:stop:removeconfirm:${t.id}:${first}`));
  assert.deepEqual((await f.tours.getStops(t.id)).map(s=>s.id),[original[1].id]);
 }finally{await f.close();}
});


test('Global administrators cannot change an owners Private tour visibility or add its stops',async()=>{
 const f=await fixture();try{
  const t=await f.make('private','g2');
  for(const route of [`hu:tour:setvisibility:global:${t.id}`,`hu:tour:setvisibilityconfirm:global:${t.id}`])await f.menu.button(f.i(route));
  assert.equal((await f.tours.get(t.id)).visibility,'private');
 }finally{await f.close();}
});


test('making another creators Server tour Private closes the administrative editor',async()=>{
 const f=await fixture();try{
  const t=await f.make('public','g1');
  await f.menu.button(f.i(`hu:tour:setvisibility:personal:${t.id}`,{user:'staff-user',staff:true}));
  assert.equal((await f.tours.get(t.id)).visibility,'private');
  assert.equal(controls(f.response()).some(c=>c.custom_id?.startsWith('hu:tour:edit')),false);
  await f.menu.button(f.i(`hu:tour:manage:${t.id}`,{user:'staff-user',staff:true}));
  assert.match(f.response().content,/not found/);
 }finally{await f.close();}
});
