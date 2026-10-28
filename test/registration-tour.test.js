import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,migrate,closeDatabase} from '../src/db/database.js';
import {createHousingMenu} from '../src/ui/housing-menu.js';
import {TourService} from '../src/services/tour-service.js';
async function fixture(t,{policy='open'}={}){const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:':memory:'});t.after(()=>closeDatabase(db));await migrate(db);await db.query(`INSERT INTO guild_settings(guild_id,eso_server,registration_policy,staff_role_ids) VALUES('g','pc_na',?,'["staff"]')`,[policy]);await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'Villa','villa')");let payload,modal;const menu=createHousingMenu(db),base={guildId:'g',channelId:'c',user:{id:'u'},member:{roles:{cache:new Map()}},update:async p=>payload=p,reply:async p=>payload=p,showModal:async p=>modal=p};const controls=()=>payload.components?.flatMap(r=>r.toJSON().components)||[];return {db,menu,base,controls,get payload(){return payload;},get modal(){return modal;},async click(label){const c=controls().find(c=>c.label===label);assert.ok(c,`Missing ${label}`);return menu.button({...base,customId:c.custom_id});},async register(type){return menu.modal({...base,customId:`hu:modal:register:${type}`,fields:{getTextInputValue:key=>({house:'1',owner:'MyOwner',nickname:'My Villa',description:'',tags:''})[key]||''}});}};}
for(const visibility of ['private','public','global'])test(`active ${visibility} registration offers tour addition and cancellation preserves the house`,async t=>{
 const f=await fixture(t);await f.register(visibility);assert.ok(f.controls().some(c=>c.label==='Add to a Tour'));await f.click('Add to a Tour');assert.ok(f.controls().some(c=>c.label==='Create New Tour'));await f.click('Back to House');assert.equal((await f.db.query('SELECT COUNT(*) n FROM saved_houses'))[0].n,1);assert.equal((await f.db.query('SELECT COUNT(*) n FROM tour_stops'))[0].n,0);
});
test('registration shortcut lists compatible tours alphabetically and appends to a selected tour',async t=>{
 const f=await fixture(t),tours=new TourService(f.db);await f.register('private');
 await tours.create({creatorId:'u',guildId:'g',esoServer:'pc_na',visibility:'private',name:'Zulu'});const alpha=await tours.create({creatorId:'u',guildId:'g',esoServer:'pc_na',visibility:'private',name:'Alpha'});await tours.create({creatorId:'other',guildId:'g',esoServer:'pc_na',visibility:'private',name:'Hidden'});
 await f.click('Add to a Tour');const picker=f.controls().find(c=>c.type===3);assert.deepEqual(picker.options.map(o=>o.label),['Alpha (Private Tour)','Zulu (Private Tour)']);await f.menu.select({...f.base,customId:picker.custom_id,values:['0']});assert.equal((await tours.getStops(alpha.id))[0].source_id,1);assert.ok(f.controls().some(c=>c.label==='Open Tour'));assert.ok(f.controls().some(c=>c.label==='Back to House'));assert.ok(f.controls().some(c=>c.label==='Add Tour Notes'));await f.click('Add Tour Notes');await f.menu.modal({...f.base,isFromMessage:()=>true,customId:f.modal.toJSON().custom_id,fields:{getTextInputValue:()=> 'Look at the garden path.'}});assert.equal((await tours.getStops(alpha.id))[0].notes,'Look at the garden path.');assert.ok(f.controls().some(c=>c.label==='Back to House'));
});
test('shortcut new-tour creation starts with the registered house and a stale house cannot be added',async t=>{
 const f=await fixture(t);await f.register('global');await f.click('Add to a Tour');await f.click('Create New Tour');await f.menu.modal({...f.base,customId:f.modal.toJSON().custom_id,fields:{getTextInputValue:key=>key==='name'?'New Route':''}});await f.click('Global Tour');const route=(await f.db.query("SELECT id FROM tours WHERE name='New Route'"))[0];assert.equal((await new TourService(f.db).getStops(route.id))[0].position,1);
 await f.menu.button({...f.base,customId:'hu:registration:tour:1'});await f.db.query("UPDATE saved_houses SET status='archived' WHERE id=1");const picker=f.controls().find(c=>c.type===3);await f.menu.select({...f.base,customId:picker.custom_id,values:['0']});assert.equal((await f.db.query('SELECT COUNT(*) n FROM tour_stops'))[0].n,1);
});
test('pending registrations explain approval and provide no active tour shortcut',async t=>{const f=await fixture(t,{policy:'approval'});await f.register('public');assert.match(JSON.stringify(f.payload),/added to tours.*approved|tour.*approval/i);assert.ok(!f.controls().some(c=>c.label==='Add to a Tour'&&!c.disabled));});

test('new registration review flow keeps an active house after canceling new-tour naming',async t=>{
 const f=await fixture(t);await f.menu.modal({...f.base,customId:'hu:modal:register-destination:private',fields:{getTextInputValue:k=>k==='destination'?'1':'MyOwner'}});await f.click('Continue');
 await f.menu.modal({...f.base,customId:f.modal.toJSON().custom_id,fields:{getTextInputValue:()=>''}});await f.click('Save House');await f.click('Add to a Tour');await f.click('Create New Tour');
 assert.match(JSON.stringify(f.modal),/Tour name/);assert.equal((await f.db.query('SELECT COUNT(*) n FROM saved_houses'))[0].n,1);assert.equal((await f.db.query('SELECT COUNT(*) n FROM tours'))[0].n,0);
});

test('Back to House retains the catalog name after unnamed registration',async t=>{
 const f=await fixture(t);await f.register('private');await f.db.query('UPDATE saved_houses SET display_name=NULL WHERE id=1');await f.click('Add to a Tour');await f.click('Back to House');
 assert.match(f.payload.embeds[0].toJSON().title,/Villa/);assert.doesNotMatch(JSON.stringify(f.payload),/Unknown house/);
});
