import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';import {closeDatabase} from '../src/db/database.js';
import {GuestBrowseService} from '../src/services/guest-browse-service.js';

test('guests can read only active Global entries in the selected environment and never restricted stops',async t=>{
 const {db,svc,c}=await fixture();t.after(()=>closeDatabase(db));const owner=await svc.fresh({...c,userId:'1'}),publicHouse=await svc.registerHouse(owner,{houseId:1,esoOwner:'Global builder',visibility:'global',tags:['spooky']}),privateHouse=await svc.registerHouse(c,{houseId:2,esoOwner:'Secret builder',visibility:'private'}),serverHouse=await svc.registerHouse(owner,{houseId:1,esoOwner:'Guild builder',visibility:'public'});
 const tour=await svc.saveTourDraft(owner,{details:{name:'Global route',visibility:'global'},stopIds:[publicHouse.id]}),privateTour=await svc.saveTourDraft(c,{details:{name:'Secret route',visibility:'private'},stopIds:[privateHouse.id]});
 const guests=new GuestBrowseService(svc);assert.equal((await guests.houses('pc_na')).total,1);assert.equal((await guests.houses('pc_eu')).total,0);assert.equal((await guests.houses('pc_na',{q:'builder',tag:'spooky'})).total,1);assert.equal((await guests.tours('pc_na')).total,1);assert.equal((await guests.house(publicHouse.id)).eso_server,'pc_na');
 await assert.rejects(()=>guests.house(privateHouse.id),/unavailable/);await assert.rejects(()=>guests.house(serverHouse.id),/unavailable/);await assert.rejects(()=>guests.tour(privateTour.id),/unavailable/);
 await db.query('INSERT INTO tour_stops(tour_id,position,saved_house_id,notes) VALUES(?,?,?,?)',[tour.id,2,privateHouse.id,'Secret tour note']);const view=await guests.tour(tour.id);assert.equal(view.stops.length,2);assert.equal(view.stops[1].available,false);assert.ok(!JSON.stringify(view.stops[1]).includes('Secret'));
 await db.query("UPDATE saved_houses SET status='pending' WHERE id=?",[publicHouse.id]);assert.equal((await guests.houses('pc_na')).total,0);await assert.rejects(()=>guests.house(publicHouse.id),/unavailable/);assert.equal((await guests.tour(tour.id)).stops[0].available,false);
});

test('guest queries keep all supported platforms and regions separate and paginate sorted houses',async t=>{
 const {db,svc,c}=await fixture();t.after(()=>closeDatabase(db));const guests=new GuestBrowseService(svc);
 for(const environment of ['pc_na','pc_eu','xbox_na','xbox_eu','playstation_na','playstation_eu','pts']){
  const guild='guild_'+environment;await db.query('INSERT INTO guild_settings(guild_id,eso_server) VALUES(?,?)',[guild,environment]);const context=await svc.authorizeContext({userId:'1',guildId:guild,esoServer:environment,memberRoleIds:[]});await svc.registerHouse(context,{houseId:1,esoOwner:'Builder-'+environment,visibility:'global'});
  const rows=await guests.houses(environment);assert.equal(rows.total,1);assert.ok(rows.rows.every(h=>h.eso_server===environment));
 }
 const owner=await svc.fresh({...c,userId:'1'});for(let i=0;i<26;i++)await svc.registerHouse(owner,{houseId:2,esoOwner:'Builder'+i,displayName:'House '+String(i).padStart(2,'0'),visibility:'global'});
 const page=await guests.houses('pc_na',{page:2});assert.equal(page.total,27);assert.equal(page.rows.length,2);assert.equal(page.page,2);assert.ok(page.rows.every(h=>h.eso_server==='pc_na'));await assert.rejects(()=>guests.houses('unknown'),/valid ESO/);
});
