import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,migrate,closeDatabase} from '../src/db/database.js';
import {createHousingMenu} from '../src/ui/housing-menu.js';
import {TourService} from '../src/services/tour-service.js';
async function fixture(t,count=27){const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:':memory:'});t.after(()=>closeDatabase(db));await migrate(db);await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g','pc_na')");await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'Villa','villa')");for(let id=1;id<=count;id++){await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(?,'pc_na',?,?,1)",[id,'owner'+id,'owner'+id]);await db.query("INSERT INTO saved_houses(id,eso_server,scope,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by,display_name) VALUES(?,'pc_na','global',1,?,?,?,'active','u','u',?)",[id,'owner'+id,'owner'+id,id,'House '+String(id).padStart(2,'0')]);}return db;}
for(const action of ['create','add'])test(`received multi-select order survives paging and adjusted preview persists for ${action}`,async t=>{
 const db=await fixture(t),menu=createHousingMenu(db);if(action==='add')await new TourService(db).create({creatorId:'u',guildId:'g',esoServer:'pc_na',visibility:'global',name:'Ordered'});let payload,modal;const base={guildId:'g',channelId:'c',user:{id:'u'},member:{roles:{cache:new Map()}},update:async p=>payload=p,reply:async p=>payload=p,showModal:async p=>modal=p};
 const controls=()=>payload.components.flatMap(r=>r.toJSON().components),click=async label=>{const c=controls().find(c=>c.label===label);assert.ok(c,`Missing ${label}`);await menu.button({...base,customId:c.custom_id});};
 await menu.button({...base,customId:'hu:find'});await click(action==='create'?'Create New Tour From Results':'Add Results to Existing Tour');await click('Select Houses');
 const bid=controls().find(c=>c.type===3).custom_id.split(':')[2];const select=values=>menu.select({...base,customId:`hu:bulkselect:${bid}`,values});
 await select(['2','0']);await click('Next');await select(['26']);await click('Previous');await click(action==='create'?'Create Tour':'Add to Tour');
 assert.match(JSON.stringify(payload),/Confirm Order/);await menu.select({...base,customId:`hu:bulkorder:pick:${bid}`,values:['2']});await click('Move Up');await click('Move Up');await click('Confirm Order');
 if(action==='create'){await menu.modal({...base,customId:modal.toJSON().custom_id,fields:{getTextInputValue:k=>k==='name'?'Ordered':''}});await click('Global Tour');}else{const picker=controls().find(c=>c.type===3);await menu.select({...base,customId:picker.custom_id,values:['0']});}
 const tour=(await db.query("SELECT * FROM tours WHERE name='Ordered'"))[0];assert.ok(tour);assert.deepEqual((await new TourService(db).getStops(tour.id)).map(r=>r.source_id),[27,3,1]);
});
test('new tour and its selected stops are one atomic write',async t=>{
 const db=await fixture(t,2),service=new TourService(db);await db.query("UPDATE saved_houses SET status='archived' WHERE id=2");
 await assert.rejects(service.createWithStops({creatorId:'u',guildId:'g',esoServer:'pc_na',visibility:'global',name:'Atomic',savedHouseIds:[1,2]}));
 assert.equal((await db.query("SELECT COUNT(*) n FROM tours WHERE name='Atomic'"))[0].n,0);
});

for(const action of ['create','add'])test(`changed destination after order confirmation blocks ${action} without route writes`,async t=>{
 const db=await fixture(t,2),menu=createHousingMenu(db);if(action==='add')await new TourService(db).create({creatorId:'u',guildId:'g',esoServer:'pc_na',visibility:'global',name:'Existing'});
 let payload,modal;const base={guildId:'g',channelId:'c',user:{id:'u'},member:{roles:{cache:new Map()}},update:async p=>payload=p,reply:async p=>payload=p,showModal:async p=>modal=p};
 const controls=()=>payload.components.flatMap(r=>r.toJSON().components),click=async label=>{const c=controls().find(c=>c.label===label);assert.ok(c,`Missing ${label}`);await menu.button({...base,customId:c.custom_id});};
 await menu.button({...base,customId:'hu:find'});await click(action==='create'?'Create New Tour From Results':'Add Results to Existing Tour');await click('Use All Saved Results');await click('Confirm Order');
 // Keep record ID, scope, status and visibility unchanged; replace its destination.
 await db.query("UPDATE saved_houses SET eso_owner='owner2',normalized_owner='owner2',destination_id=2 WHERE id=1");
 if(action==='create'){await menu.modal({...base,customId:modal.toJSON().custom_id,fields:{getTextInputValue:k=>k==='name'?'Changed Route':''}});await click('Global Tour');}else{const picker=controls().find(c=>c.type===3);await menu.select({...base,customId:picker.custom_id,values:['0']});}
 assert.match(payload.content,/changed|review again/i);assert.equal((await db.query('SELECT COUNT(*) n FROM tour_stops'))[0].n,0);assert.equal((await db.query("SELECT COUNT(*) n FROM tours WHERE name='Changed Route'"))[0].n,0);
});

test('route preview and adjustment options distinguish ESO owners of identical houses',async()=>{
 const {tourSelectionReviewPayload}=await import('../src/ui/tour-selection-ui.js');
 const payload=tourSelectionReviewPayload({token:'route',rows:[{house_name:'Villa',eso_owner:'Alice'},{house_name:'Villa',eso_owner:'Bob'}],backId:'hu:home'});
 const description=payload.embeds[0].toJSON().description;assert.match(description,/1[^\n]*Villa[^\n]*@Alice/);assert.match(description,/2[^\n]*Villa[^\n]*@Bob/);
 const options=payload.components[0].toJSON().components[0].options;assert.match(options[0].label,/@Alice/);assert.match(options[1].label,/@Bob/);
 const long=tourSelectionReviewPayload({token:'route',rows:[{house_name:'x'.repeat(300),eso_owner:'Alice'}],backId:'hu:home'});assert.ok(long.components[0].toJSON().components[0].options[0].label.length<=100);assert.match(long.components[0].toJSON().components[0].options[0].label,/@Alice/);
});
