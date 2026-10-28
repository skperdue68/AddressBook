import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {createHousingMenu} from '../src/ui/housing-menu.js';
const controls=p=>p.components.flatMap(r=>(r.toJSON?.()||r).components);
const fields=p=>p.embeds[0].toJSON().fields;
test('Discord house card groups management and comments refresh the original expanded card',async()=>{
 const {db,svc,c}=await fixture();try{
 const owner=await svc.fresh({...c,userId:'1'}),h=await svc.registerHouse(owner,{houseId:1,esoOwner:'Builder',visibility:'private'});
 const menu=createHousingMenu(db);let payload,modal;const i={guildId:'g',channelId:'c',guild:{name:'Guild'},user:{id:'1',username:'Owner'},member:{roles:{cache:new Map()}},update:async p=>payload=p,reply:async p=>payload=p,showModal:async m=>modal=m};
 const click=async label=>{const control=controls(payload).find(b=>b.label===label);assert.ok(control,`Missing ${label}`);await menu.button({...i,message:payload,customId:control.custom_id});};
 await menu.button({...i,customId:`hu:details:personal:${h.id}:show:hu%3Amy`});
 assert.ok(controls(payload).some(b=>b.label==='Favorite'));
 for(const label of ['Add Comment','Want to Visit','Visited','Edit House','Change Visibility','Delete House'])assert.ok(!controls(payload).some(b=>b.label===label),`Unexpected ${label}`);
 const labels=controls(payload).map(b=>b.label);assert.equal(labels[labels.indexOf('Add to a Tour')+1],'Share House');
 await click('Comments');await click('Add Comment');await menu.modal({...i,customId:modal.toJSON().custom_id,fields:{getTextInputValue:()=> 'A comment'},isFromMessage:()=>true});await click('Back to house');
 assert.ok(controls(payload).some(b=>b.label==='Hide Details'));assert.equal(fields(payload).find(f=>f.name.includes('Comments')).value,'1 comment');
 await click('Manage House');assert.ok(controls(payload).some(b=>b.label==='Edit House'));await click('Delete House');await click('Cancel');assert.ok(controls(payload).some(b=>b.label==='Hide Details'));
 await click('Manage House');await click('Back to house');assert.ok(controls(payload).some(b=>b.label==='Hide Details'));assert.ok(controls(payload).some(b=>b.custom_id==='hu:my'));
 }finally{await closeDatabase(db);}
});
test('legacy quick comment refreshes house-card count without changing controls',async()=>{
 const {db,svc,c}=await fixture();try{
 const owner=await svc.fresh({...c,userId:'1'}),h=await svc.registerHouse(owner,{houseId:1,esoOwner:'Builder',visibility:'private'});
 const menu=createHousingMenu(db);let payload,modal;const i={guildId:'g',channelId:'c',guild:{name:'Guild'},user:{id:'1',username:'Owner'},member:{roles:{cache:new Map()}},update:async p=>payload=p,reply:async p=>payload=p,showModal:async m=>modal=m};
 await menu.button({...i,customId:`hu:details:personal:${h.id}:show:hu%3Amy`});const original=payload,ids=controls(payload).map(b=>b.custom_id),favorite=controls(payload).find(b=>b.label==='Favorite');
 await menu.button({...i,message:original,customId:favorite.custom_id.replace('hu:mark:favorite:','hu:comment:quick:')});
 await menu.modal({...i,customId:modal.toJSON().custom_id,fields:{getTextInputValue:()=> 'Legacy comment'},isFromMessage:()=>true});
 assert.deepEqual(controls(payload).map(b=>b.custom_id),ids);assert.equal((payload.embeds[0].toJSON?.()||payload.embeds[0]).fields.find(f=>f.name.includes('Comments')).value,'1 comment');
 }finally{await closeDatabase(db);}
});
test('management edit and visibility preserve list navigation and expanded details, and reject another user',async()=>{
 const {db,svc,c}=await fixture();try{
 const owner=await svc.fresh({...c,userId:'1'}),h=await svc.registerHouse(owner,{houseId:1,esoOwner:'Builder',visibility:'private'});await svc.registerHouse(owner,{houseId:2,esoOwner:'Builder',visibility:'private'});
 const menu=createHousingMenu(db);let payload,modal;const i={guildId:'g',channelId:'c',guild:{name:'Guild'},user:{id:'1',username:'Owner'},member:{roles:{cache:new Map()}},update:async p=>payload=p,reply:async p=>payload=p,showModal:async m=>modal=m};
 const click=async label=>{const b=controls(payload).find(b=>b.label===label);assert.ok(b,`Missing ${label}`);await menu.button({...i,message:payload,customId:b.custom_id});};
 await menu.button({...i,customId:'hu:my:houses'});await menu.select({...i,customId:controls(payload).find(b=>b.type===3).custom_id,values:['0']});await click('More Details');const back=controls(payload).find(b=>b.label==='Back to Results').custom_id;
 const manage=controls(payload).find(b=>b.label==='Manage House').custom_id;await menu.button({...i,user:{id:'other'},message:payload,customId:manage});assert.match(payload.content,/expired/);
 await menu.button({...i,customId:`hu:details:personal:${h.id}:show:${encodeURIComponent(back)}`});await click('Manage House');await click('Edit House');
 await menu.modal({...i,customId:modal.toJSON().custom_id,fields:{getTextInputValue:id=>({house:'1',owner:'Builder',nickname:'Updated',description:'New description',tags:''})[id]},isFromMessage:()=>true});
 assert.ok(controls(payload).some(b=>b.label==='Hide Details'));assert.ok(controls(payload).some(b=>b.label==='Next House'));assert.ok(controls(payload).some(b=>b.custom_id===back));
 await click('Manage House');await click('Change Visibility');await click('Private');assert.ok(controls(payload).some(b=>b.label==='Hide Details'));assert.ok(controls(payload).some(b=>b.custom_id===back));
 await click('Manage House');await click('Change Visibility');await click('Global');assert.ok(controls(payload).some(b=>b.label==='Hide Details'));assert.ok(controls(payload).some(b=>b.custom_id===back));
 for(const row of payload.components){assert.ok(row.toJSON().components.length<=5);for(const b of row.toJSON().components)assert.ok(b.custom_id.length<=100);}assert.ok(payload.components.length<=5);
 }finally{await closeDatabase(db);}
});
test('deleting from management returns to the refreshed house list',async()=>{
 const {db,svc,c}=await fixture();try{
 const owner=await svc.fresh({...c,userId:'1'});await svc.registerHouse(owner,{houseId:1,esoOwner:'Builder',visibility:'private'});await svc.registerHouse(owner,{houseId:2,esoOwner:'Builder',visibility:'private'});
 const menu=createHousingMenu(db);let payload;const i={guildId:'g',channelId:'c',guild:{name:'Guild'},user:{id:'1',username:'Owner'},member:{roles:{cache:new Map()}},update:async p=>payload=p,reply:async p=>payload=p};
 const click=async label=>{const b=controls(payload).find(b=>b.label===label);assert.ok(b,`Missing ${label}`);await menu.button({...i,message:payload,customId:b.custom_id});};
 await menu.button({...i,customId:'hu:my:houses'});await menu.select({...i,customId:controls(payload).find(b=>b.type===3).custom_id,values:['0']});await click('Manage House');await click('Delete House');await click('Confirm');
 assert.match(payload.embeds[0].toJSON().title,/My Houses/);assert.equal(controls(payload).find(b=>b.type===3).options.length,1);
 }finally{await closeDatabase(db);}
});
test('pending house management remains available to the creator',async()=>{
 const {db,svc,c}=await fixture();try{
 const h=await svc.registerHouse(c,{houseId:1,esoOwner:'Builder',visibility:'private'});
 const menu=createHousingMenu(db);let payload;const i={guildId:'g',channelId:'c',guild:{name:'Guild'},user:{id:'u'},member:{roles:{cache:new Map()}},update:async p=>payload=p,reply:async p=>payload=p};
 await menu.button({...i,customId:`hu:scope:set:public:${h.id}:hu%3Amy`});assert.equal((await svc.saved.get(h.id)).status,'pending');
 const manage=controls(payload).find(b=>b.label==='Manage House');assert.ok(manage);await menu.button({...i,message:payload,customId:manage.custom_id});
 assert.ok(controls(payload).some(b=>b.label==='Delete House'));assert.ok(controls(payload).some(b=>b.label==='Change Visibility'));
 }finally{await closeDatabase(db);}
});
