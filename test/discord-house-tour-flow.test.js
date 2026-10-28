import {VisitService} from '../src/services/visit-service.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {destinationMenuPayload,tourDetailPayload,tourManagePayload,toursPayload} from '../src/ui/housing-ui.js';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {createHousingMenu} from '../src/ui/housing-menu.js';
import {TourService} from '../src/services/tour-service.js';
const controls=p=>p.components.flatMap(row=>row.toJSON().components);
const house={id:1,house_id:1,house_name:'Villa',eso_owner:'Builder',scope:'guild',status:'active'};
test('Discord readers see tour addition without source editing; pending houses omit it and payloads fit limits',()=>{
 for(const canEdit of [false,true]){
  const p=destinationMenuPayload(house,{canEdit,backId:'hu:results:back:abc:1',navigation:{stateId:'abc',index:0,total:2}}),buttons=controls(p);
  assert.equal(buttons[0].label,'Add to a Tour');assert.equal(buttons[0].custom_id,'hu:registration:tour:1');assert.equal(buttons.some(b=>b.label==='Edit House'),canEdit);assert.equal(buttons.some(b=>b.label==='Delete House'),canEdit);assert.ok(buttons.some(b=>b.label==='Back to Results'));
  assert.ok(p.components.length<=5);for(const row of p.components){assert.ok(row.toJSON().components.length<=5);for(const b of row.toJSON().components)assert.ok(b.custom_id.length<=100);}
 }
 assert.ok(!controls(destinationMenuPayload({...house,status:'pending'},{canEdit:false})).some(b=>b.label==='Add to a Tour'));
});
test('editable tour has direct add-house control and named return destinations',()=>{
 const tour={id:7,name:'Route',scope:'server'},buttons=controls(tourDetailPayload(tour,[],true));assert.ok(buttons.some(b=>b.label==='Add House'&&b.custom_id==='hu:tour:add:7'));assert.ok(buttons.some(b=>b.label==='Back to Tours'));
 assert.ok(!controls(tourDetailPayload(tour,[],false)).some(b=>b.custom_id==='hu:tour:add:7'));assert.ok(controls(tourManagePayload(tour,[])).some(b=>b.label==='Back to Tour'&&b.custom_id==='hu:tour:view:7'));assert.ok(controls(toursPayload()).some(b=>b.label==='Main Menu'));
});
test('ordinary member adds someone else shared house to own eligible tour through visible Discord controls',async()=>{
 const {db,svc,c}=await fixture();try{
  const owner=await svc.fresh({...c,userId:'1'}),h=await svc.registerHouse(owner,{houseId:1,esoOwner:'Builder',visibility:'public'}),tours=new TourService(db),tour=await tours.create({creatorId:'u',guildId:'g',esoServer:'pc_na',visibility:'public',name:'My Tour'});
  await tours.create({creatorId:'someone',guildId:'g',esoServer:'pc_na',visibility:'private',name:'Hidden Tour'});
  const menu=createHousingMenu(db);let payload;const interaction={guildId:'g',channelId:'c',guild:{name:'Guild'},user:{id:'u'},member:{roles:{cache:new Map()}},update:async p=>payload=p,reply:async p=>payload=p};
  await menu.button({...interaction,customId:`hu:registration:house:${h.id}`});const add=controls(payload).find(b=>b.label==='Add to a Tour');assert.ok(add);assert.ok(!controls(payload).some(b=>b.label==='Edit House'));
  await menu.button({...interaction,customId:add.custom_id});const picker=controls(payload).find(b=>b.type===3);assert.ok(picker);assert.deepEqual(picker.options.map(o=>o.label),['My Tour (Server Tour)']);
  await menu.select({...interaction,customId:picker.custom_id,values:['0']});assert.equal((await tours.getStops(tour.id))[0].source_id,h.id);assert.equal((await svc.saved.get(h.id)).created_by,'1');
 }finally{await closeDatabase(db);}
});

test('single-house search carries active status so the tour shortcut also appears before opening a picker',async()=>{
 const {db,svc,c}=await fixture();try{
  const owner=await svc.fresh({...c,userId:'1'});await svc.registerHouse(owner,{houseId:1,esoOwner:'Builder',visibility:'public'});
  const rows=await new VisitService(db).search({userId:'u',guildId:'g',esoServer:'pc_na',owner:'Builder'});assert.equal(rows.length,1);assert.equal(rows[0].status,'active');assert.ok(controls(destinationMenuPayload(rows[0],{canEdit:false})).some(b=>b.label==='Add to a Tour'));
 }finally{await closeDatabase(db);}
});
