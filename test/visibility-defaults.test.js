import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {registrationTypePayload,tourVisibilityPayload} from '../src/ui/housing-ui.js';
import {createHousingMenu} from '../src/ui/housing-menu.js';
import {createWebAdminServer} from '../src/web/server.js';
import {WebAdminService} from '../src/services/web-admin-service.js';
import {createSession,readSession} from '../src/web/session.js';

test('Discord creation emphasizes Server and offers a direct continuation with that default',()=>{
 const registration=registrationTypePayload(),rows=registration.components.map(r=>r.toJSON());
 assert.equal(rows[0].components[0].options.find(o=>o.default).value,'public');
 assert.ok(rows.flatMap(r=>r.components).some(b=>b.custom_id==='hu:register:continue:public'));
 const restricted=registrationTypePayload({defaultVisibility:'private'}).components[0].toJSON();assert.equal(restricted.components[0].options.find(o=>o.default).value,'private');
 const buttons=tourVisibilityPayload('draft').components.flatMap(r=>r.toJSON().components);assert.equal(buttons.find(b=>b.style===1).custom_id,'hu:tour:createvis:server:draft');
});

test('Discord default continuation opens the Server registration modal',async()=>{
 const {db}=await fixture();try{
  let modal;await createHousingMenu(db).button({customId:'hu:register:continue:public',guildId:'g',guild:{name:'Guild'},user:{id:'u',username:'Member'},member:{roles:{cache:new Map()}},reply:async()=>{},update:async()=>{},showModal:async value=>{modal=value.toJSON();}});
  assert.equal(modal.custom_id,'hu:modal:register-destination:public');
 }finally{await closeDatabase(db);}
});

test('restricted Discord members default Private from Home, Help and onboarding',async()=>{
 const {db}=await fixture();try{
  await db.query("UPDATE guild_settings SET registration_policy='roles' WHERE guild_id='g'");const menu=createHousingMenu(db);
  for(const customId of ['hu:register','hu:help:topic:houses','hu:onboarding:go:register:2']){
   let payload;await menu.button({customId,guildId:'g',guild:{name:'Guild'},user:{id:'u',username:'Member'},member:{roles:{cache:new Map()}},reply:async()=>{},update:async value=>{payload=value;}});
   assert.equal(payload.components[0].toJSON().components[0].options.find(o=>o.default).value,'private',customId);
  }
 }finally{await closeDatabase(db);}
});

test('web creation forms select Server while editing and Private-house tour starts retain Private',async()=>{
 const {db,svc,c}=await fixture();const server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async()=>({id:'g',name:'Guild',roleIds:[],esoServer:'pc_na'})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
  const cookie='addressbook_session='+createSession({id:'u',username:'Member',guilds:[{id:'g'}]},Date.now(),'s'),base=`http://127.0.0.1:${server.address().port}`;
  const select=async path=>{const html=await (await fetch(base+path,{headers:{cookie}})).text();return /<select name="visibility">([\s\S]*?)<\/select>/.exec(html)[1];};
  assert.match(await select('/app/register'),/^<option value="public"/);
  assert.match(await select('/app/tours/new'),/<option value="public" selected/);
  const h=await svc.registerHouse(c,{houseId:1,esoOwner:'@Private',visibility:'private'});
  assert.match(await select('/app/tours/new?houseId='+h.id),/<option value="private" selected/);
  const t=await svc.saveTourDraft(c,{details:{name:'Private',visibility:'private'},stopIds:[]});assert.match(await select(`/app/tours/${t.id}/edit`),/<option value="private" selected/);
  await db.query("UPDATE guild_settings SET registration_policy='open' WHERE guild_id='g'");
  const shared=await svc.registerHouse(c,{houseId:2,esoOwner:'@Shared',visibility:'public'}),csrf=readSession(cookie.slice('addressbook_session='.length),Date.now(),'s').csrf;
  for(const [house,expected] of [[shared,'public'],[h,'private']]){
   const result=await fetch(base+'/app/search-to-tour',{method:'POST',headers:{cookie},body:new URLSearchParams({csrf,contextGuildId:'g',contextEsoServer:'pc_na',filters:'{}',confirm:'order',houseIds:String(house.id)})});
   assert.match(await result.text(),new RegExp('<option value="'+expected+'" selected'));
  }

 }finally{await new Promise(r=>server.close(r));await closeDatabase(db);}
});

test('web defaults new houses and tours to Server while respecting restricted registration and explicit Private',async()=>{
 const {db,svc,c}=await fixture();try{
  assert.equal(svc.houseScopes(c)[0],'public');
  const h=await svc.registerHouse(c,{houseId:1,esoOwner:'@ServerDefault'});assert.equal(h.scope,'public');assert.equal(h.status,'pending');
  const t=await svc.saveTourDraft(c,{details:{name:'Server default'},stopIds:[]});assert.equal(t.visibility,'public');
  const p=await svc.saveTourDraft(c,{details:{name:'Chosen private',visibility:'private'},stopIds:[]});assert.equal(p.visibility,'private');
  const draft=await svc.getTourDraft(c,p.id);const edited=await svc.saveTourDraft(c,{id:p.id,version:draft.version,details:{name:'Still private'},stopIds:[]});assert.equal(edited.visibility,'private');
  await db.query("UPDATE guild_settings SET registration_policy='roles' WHERE guild_id='g'");
  const restricted=await svc.fresh(c);assert.deepEqual(svc.houseScopes(restricted),['private']);
  assert.equal((await svc.registerHouse(restricted,{houseId:2,esoOwner:'@Restricted'})).scope,'private');
 }finally{await closeDatabase(db);}
});
