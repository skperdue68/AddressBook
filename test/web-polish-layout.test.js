import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {TourService} from '../src/services/tour-service.js';
import {createWebAdminServer} from '../src/web/server.js';
import {WebAdminService} from '../src/services/web-admin-service.js';
import {createSession} from '../src/web/session.js';
import {linkButton} from '../src/web/workspace-render.js';

test('house page shows visit commands, catalog details and only normally visible tour memberships upfront',async()=>{
 const {db,svc,c}=await fixture(),owner=await svc.fresh({...c,userId:'1'});let server;
 try{
  const h=await svc.registerHouse(owner,{houseId:1,esoOwner:'Builder',visibility:'global'}),tours=new TourService(db);
  for(const [name,visibility,creatorId,guildId] of [['Our shared route','public','u','g'],['Global garden route','global','u','g'],['My quiet route','private','u','g'],['Secret other route','private','other','g'],['Another server route','public','other','foreign']]){const t=await tours.create({creatorId,guildId,esoServer:'pc_na',visibility,name});await tours.addStop(t.id,h.id);}
  server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async({guildId})=>({id:guildId,name:'Guild',roleIds:[],esoServer:'pc_na'})});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const cookie='addressbook_session='+createSession({id:'u',selectedGuildId:'g',guilds:[{id:'g'}]},Date.now(),'s'),res=await fetch(`http://127.0.0.1:${server.address().port}/app/houses/${h.id}`,{headers:{cookie}}),html=await res.text();assert.equal(res.status,200);
  assert.match(html,/<details[^>]*id="visit-house"[^>]*open/);assert.match(html,/<details[^>]*house-metadata[^>]*open/);assert.match(html,/Tours featuring this house/);for(const name of ['Our shared route','Global garden route','My quiet route'])assert.ok(html.includes(name));assert.doesNotMatch(html,/Secret other route|Another server route/);
  assert.doesNotMatch(html,/Help &amp; Access|Help & Access|Help & Learning/);assert.match(html,/Support/);
 }finally{if(server)await new Promise(r=>server.close(r));await closeDatabase(db);}
});
test('shared action styles convey danger and positive actions with text as well as color',()=>{
 assert.match(linkButton('Delete house','/app/houses/1/delete','danger'),/class="button danger"/);assert.match(linkButton('Saved','/app/personal','positive'),/class="button positive"/);assert.match(linkButton('Cancel','/app','secondary'),/class="button secondary"/);
});
test('action return context is bounded internal navigation, preserves nested search state and rejects unsafe origins',async()=>{
 const {safeActionReturn,withActionReturn}=await import('../src/web/flow-navigation.js');
 const value='/app/tours/7/edit#tour-stops-section';assert.equal(safeActionReturn(value),value);const nested='/app/houses/1?returnTo='+encodeURIComponent('/app/search?owner=Builder');assert.equal(safeActionReturn(nested),nested);assert.equal(new URL(withActionReturn('/app/tours/7/stops/2',value),'https://test.invalid').searchParams.get('backTo'),value);
 for(const bad of ['https://evil.example/','//evil.example/','/\\evil.example/','/app/houses?guildId=other','/auth/logout','/app/houses/1?returnTo=https://evil.example/'])assert.equal(safeActionReturn(bad),null);
});
