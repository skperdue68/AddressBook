import {transferUnifiedData} from '../src/db/database-migration.js';
import {openDatabase} from '../src/db/database.js';
import {createCatalogMenu} from '../src/ui/catalog-menu.js';
import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './workspace-fixture.js';import {closeDatabase,one,migrate} from '../src/db/database.js';import {HouseCatalogService} from '../src/services/house-catalog-service.js';import {seedHouses} from '../src/db/seed-houses.js';
test('catalog add is owner-only, validated, audited and preserved across restart and seed collisions',async()=>{const {db,svc,c}=await fixture();try{const catalog=new HouseCatalogService(db,{BOT_OWNER_IDS:'1'});await assert.rejects(()=>catalog.add({id:'u'},{house_id:9000,name:'New'}),/owner/i);await assert.rejects(()=>catalog.add({id:'1'},{house_id:-1,name:'Bad'}),/ID/);const h=await catalog.add({id:'1'},{house_id:9000,name:'New Release',zone:'New Zone'});assert.equal(h.name,'New Release');assert.equal((await svc.catalog.get(9000)).name,'New Release');await assert.rejects(()=>catalog.add({id:'1'},{house_id:9000,name:'Other'}),/exists/);await catalog.add({id:'1'},{house_id:9001,name:'Other'});await db.query('DELETE FROM houses WHERE house_id=2');await catalog.add({id:'1'},{house_id:2,name:'Owner supplied official name'});await migrate(db);await seedHouses(db);assert.equal((await one(db,'SELECT name FROM houses WHERE house_id=2')).name,'Owner supplied official name');assert.ok(await one(db,"SELECT id FROM audit_log WHERE action='add_catalog_house'"));assert.ok(await one(db,'SELECT house_id FROM owner_catalog_houses WHERE house_id=9000'));}finally{await closeDatabase(db)}});


test('catalog edits are owner-only, stale-safe and survive reseeding without changing linked IDs',async()=>{const {db,svc,c}=await fixture();try{
 const service=new HouseCatalogService(db,{BOT_OWNER_IDS:'1'}),actor={id:'1'};
 await assert.rejects(()=>service.previewEdit({id:'u'},1,{name:'No'}),/owner/i);
 const h=await svc.registerHouse(c,{visibility:'private',houseId:1,esoOwner:'@Keep'}),t=await svc.saveTourDraft(c,{details:{name:'Keep route',visibility:'private'},stopIds:[h.id]});
 const preview=await service.previewEdit(actor,1,{name:'Corrected House',classification:'Classic Home',style:'New Style',use_classification_defaults:'1'});assert.equal(preview.house.furnishing_limit,250);
 await assert.rejects(()=>service.update(actor,1,{house_id:2,name:'Wrong'},{version:preview.version}),/ID/);
 await service.update(actor,1,preview.house,{version:preview.version});
 await assert.rejects(()=>service.update(actor,1,{name:'Stale'},{version:preview.version}),/changed/);
 await seedHouses(db,{logger:{warn:()=>{}}});assert.equal((await svc.catalog.get(1)).name,'Corrected House');assert.equal((await svc.saved.get(h.id)).house_id,1);assert.equal((await svc.getTourDraft(c,t.id)).stops[0].saved_house_id,h.id);
 const over=await service.previewEdit(actor,1,{furnishing_limit:42,use_classification_defaults:'1'});assert.equal(over.house.furnishing_limit,42);
 assert.ok(await one(db,"SELECT id FROM audit_log WHERE action='update_catalog_house'"));
 }finally{await closeDatabase(db)}});

test('Discord catalog edit uses a button between modals and confirms through the shared owner service',async()=>{const {db}=await fixture();try{const catalog=new HouseCatalogService(db,{BOT_OWNER_IDS:'1'}),handle=createCatalogMenu(catalog);let payload;const i={user:{id:'1'},guildId:'g',showModal:async p=>payload=p.toJSON(),reply:async p=>payload=p,update:async p=>payload=p};
 await handle({...i,customId:'hu:catalog:edit'});assert.equal(payload.custom_id,'hu:modal:catalog:lookup');
 await handle({...i,customId:'hu:modal:catalog:lookup',fields:{getTextInputValue:()=> '1'}});const open=payload.components[0].toJSON().components[0].custom_id;assert.match(open,/open-edit:1/);
 await handle({...i,customId:open});const edit=payload.custom_id;assert.ok(edit.length<=100);assert.equal(payload.components.length,5);
 await handle({...i,customId:edit,fields:{getTextInputValue:key=>({name:'Discord correction',zone:'Zone',classification:'Classic Home',house_type:'Medium',style:'Breton'}[key])}});const confirm=payload.components[0].toJSON().components[0].custom_id;
 assert.equal((await catalog.get(i.user,1)).name,'House One');await handle({...i,customId:confirm});assert.equal((await catalog.get(i.user,1)).name,'Discord correction');
 await handle({...i,user:{id:'u'},customId:'hu:catalog:edit'});assert.match(payload.content,/owner/i);
 }finally{await closeDatabase(db)}});

test('database classification profiles preserve exceptions across changes seeding and transfer',async()=>{const {db}=await fixture(),target=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:':memory:'});try{
 const svc=new HouseCatalogService(db,{BOT_OWNER_IDS:'1'}),actor={id:'1'};await seedHouses(db,{logger:{warn:()=>{}}});
 let p=await svc.previewEdit(actor,7,{furnishing_limit:42,furnishing_limit_plus:null,style:'Custom Architecture'});await svc.update(actor,7,p.house,{version:p.version});
 await assert.rejects(()=>svc.profilePreview(actor,{name:'x'.repeat(101)}),/100/);await assert.rejects(()=>svc.previewEdit(actor,7,{house_type:'x'.repeat(101)}),/too long/);
 const profile=(await svc.profiles(actor)).find(p=>p.name==='Classic Home');const impact=await svc.profilePreview(actor,{...profile,furnishing_limit:260,furnishing_limit_plus:520});assert.ok(impact.houses.length>1);assert.ok(impact.overrides.some(o=>o.house_id===7&&o.field==='furnishing_limit'));
 await svc.updateProfile(actor,impact.profile,{version:impact.version});assert.equal((await svc.get(actor,7)).furnishing_limit,42);assert.equal((await svc.get(actor,7)).furnishing_limit_plus,null);assert.equal((await svc.get(actor,8)).furnishing_limit,260);
 await assert.rejects(()=>svc.updateProfile(actor,impact.profile,{version:impact.version}),/changed/);await migrate(db);await seedHouses(db,{logger:{warn:()=>{}}});assert.equal((await svc.get(actor,8)).furnishing_limit,260);assert.equal((await svc.get(actor,7)).furnishing_limit,42);
 const added=await svc.add(actor,{house_id:9000,name:'New Profile House',classification:'Classic Home',use_classification_defaults:'1'});assert.equal(added.furnishing_limit,260);
 assert.ok((await svc.suggestions(actor)).style.includes('Custom Architecture'));
 const value=await svc.valuePreview(actor,{field:'style',value:'Custom Architecture',replacement:'Renamed Architecture'});await svc.manageValue(actor,{...value,action:'rename'},{version:value.version});await seedHouses(db,{logger:{warn:()=>{}}});assert.equal((await svc.get(actor,7)).style,'Renamed Architecture');await assert.rejects(async()=>svc.manageValue(actor,{field:'style',value:'Renamed Architecture',action:'delete'},{version:(await svc.valuePreview(actor,{field:'style',value:'Renamed Architecture'})).version}),/in use/);
 await migrate(target);await transferUnifiedData(db,target);assert.equal((await one(target,"SELECT furnishing_limit FROM house_classifications WHERE name='Classic Home'")).furnishing_limit,260);assert.equal((await one(target,"SELECT value FROM house_capacity_overrides WHERE house_id=7 AND field='furnishing_limit'")).value,42);
 }finally{await closeDatabase(target);await closeDatabase(db)}});
