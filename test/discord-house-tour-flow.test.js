import {TourSessionService} from '../src/services/tour-session-service.js';
import {VisitService} from '../src/services/visit-service.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {destinationMenuPayload,tourDetailPayload,tourManagePayload,toursPayload} from '../src/ui/housing-ui.js';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {createHousingMenu} from '../src/ui/housing-menu.js';
import {TourService} from '../src/services/tour-service.js';
const controls=p=>p.components.flatMap(row=>(row.toJSON?.()||row).components);
const house={id:1,house_id:1,house_name:'Villa',eso_owner:'Builder',scope:'guild',status:'active'};
test('Discord readers see tour addition without source editing; pending houses omit it and payloads fit limits',()=>{
 for(const canEdit of [false,true]){
  const p=destinationMenuPayload(house,{canEdit,backId:'hu:results:back:abc:1',navigation:{stateId:'abc',index:0,total:2}}),buttons=controls(p);
  assert.equal(buttons[0].label,'Add to a Tour');assert.equal(buttons[0].custom_id,'hu:registration:tour:1');assert.equal(buttons.some(b=>b.label==='Manage House'),canEdit);assert.equal(buttons.some(b=>b.label==='Delete House'),false);assert.ok(buttons.some(b=>b.label==='Back to Results'));
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

test('self-paced stops expose personal marks and preserve tour navigation after marking',async()=>{
 const {db,svc,c}=await fixture();try{const owner=await svc.fresh({...c,userId:'1'}),house=await svc.registerHouse(owner,{houseId:1,esoOwner:'Builder',visibility:'public'}),tours=new TourService(db),tour=await tours.create({creatorId:'u',guildId:'g',esoServer:'pc_na',visibility:'public',name:'Route'});await tours.addStop(tour.id,house.id);const menu=createHousingMenu(db);let payload;const i={guildId:'g',channelId:'c',guild:{name:'Guild'},user:{id:'u',username:'Guest'},member:{roles:{cache:new Map()}},update:async p=>payload=p,reply:async p=>payload=p};await menu.button({...i,customId: 'hu:tour:startprivate:'+tour.id});const mark=controls(payload).find(b=>b.label==='Favorite');assert.ok(mark);const previous=controls(payload).find(b=>b.label==='Next').custom_id;await menu.button({...i,customId:mark.custom_id,message:{components:payload.components}});assert.ok(controls(payload).some(b=>b.label==='Unfavorite'));assert.ok(controls(payload).some(b=>b.custom_id===previous));}finally{await closeDatabase(db);}
});

test('direct self-paced stop comment returns the same route card without advancing',async()=>{
 const {db,svc,c}=await fixture();try{const owner=await svc.fresh({...c,userId:'1'}),h=await svc.registerHouse(owner,{houseId:1,esoOwner:'Builder',visibility:'public'}),tours=new TourService(db),tour=await tours.create({creatorId:'u',guildId:'g',esoServer:'pc_na',visibility:'public',name:'Route'});await tours.addStop(tour.id,h.id);const menu=createHousingMenu(db);let payload,modal;const i={guildId:'g',channelId:'c',guild:{name:'Guild'},user:{id:'u',username:'Guest'},member:{roles:{cache:new Map()}},update:async p=>payload=p,reply:async p=>payload=p,showModal:async p=>modal=p};await menu.button({...i,customId:'hu:tour:startprivate:'+tour.id});const original=payload,ids=controls(original).map(b=>b.custom_id),before=(await db.query("SELECT current_stop_id FROM tour_progress WHERE discord_user_id='u'"))[0].current_stop_id;const add=controls(original).find(b=>b.label==='Add Comment');assert.ok(add);await menu.button({...i,customId:add.custom_id,message:{embeds:original.embeds,components:original.components}});assert.ok(modal);await menu.modal({...i,customId:modal.toJSON().custom_id,fields:{getTextInputValue:()=> 'Lovely stop'},isFromMessage:()=>true});assert.deepEqual(controls(payload).map(b=>b.custom_id),ids);assert.equal((await db.query("SELECT current_stop_id FROM tour_progress WHERE discord_user_id='u'"))[0].current_stop_id,before);assert.equal((await db.query('SELECT count(*) n FROM house_comments'))[0].n,1);
 }finally{await closeDatabase(db);}
});

test('shared route direct comments reply privately and leave public controls and position untouched',async()=>{
 const {db,svc,c}=await fixture();try{const owner=await svc.fresh({...c,userId:'1'}),h=await svc.registerHouse(owner,{houseId:1,esoOwner:'Builder',visibility:'public'}),tours=new TourService(db),tour=await tours.create({creatorId:'u',guildId:'g',esoServer:'pc_na',visibility:'public',name:'Shared'});await tours.addStop(tour.id,h.id);const session=await new TourSessionService(db).startShared({tourId:tour.id,guildId:'g',channelId:'c',userId:'u',esoServer:'pc_na'}),menu=createHousingMenu(db);let payload,modal;let updates=0,replies=0;const i={guildId:'g',channelId:'c',guild:{name:'Guild'},user:{id:'guest',username:'Guest'},member:{roles:{cache:new Map()}},update:async p=>{updates++;payload=p;},reply:async p=>{replies++;payload=p;},showModal:async p=>modal=p};await menu.button({...i,customId:'tour:details:'+session.id});const original=payload,add=controls(original).find(b=>b.label==='Add Comment');assert.ok(add);updates=0;await menu.button({...i,customId:add.custom_id,message:{embeds:original.embeds,components:original.components}});assert.ok(modal);await menu.modal({...i,customId:modal.toJSON().custom_id,fields:{getTextInputValue:()=> 'A group comment'},isFromMessage:()=>true});assert.equal(updates,0);assert.equal(replies,1);assert.equal(payload.flags,64);assert.deepEqual(payload.components,[]);assert.deepEqual(payload.embeds,original.embeds.map(e=>e.toJSON()));assert.equal((await new TourSessionService(db).get(session.id)).current_position,1);
 }finally{await closeDatabase(db);}
});
