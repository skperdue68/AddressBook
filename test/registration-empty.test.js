import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,migrate,closeDatabase} from '../src/db/database.js';
import {createHousingMenu} from '../src/ui/housing-menu.js';
import {pickerPayload} from '../src/ui/housing-ui.js';
for(const destination of ['Imaginary Palace','999999'])for(const owner of ['', 'MyOwner'])test(`unknown house ${destination} with owner ${owner} offers valid retry`,async t=>{
 const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:':memory:'});t.after(()=>closeDatabase(db));await migrate(db);await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g','pc_na'),('other','pc_eu')");
 const menu=createHousingMenu(db);let result;const i={guildId:'g',user:{id:'u'},member:{roles:{cache:new Map()}},customId:'hu:modal:register-destination:private',fields:{getTextInputValue:k=>k==='destination'?destination:owner},reply:async p=>result=p,update:async p=>result=p,showModal:async p=>result=p};
 await menu.modal(i);assert.match(JSON.stringify(result),/No matching ESO house found/);const controls=result.components.flatMap(r=>r.toJSON().components);assert.ok(controls.every(c=>c.type!==3));const retry=controls.find(c=>c.label==='Try Again');assert.ok(retry);
 i.customId=retry.custom_id;await menu.button(i);const modal=result.toJSON();assert.match(JSON.stringify(modal),new RegExp(destination));if(owner)assert.match(JSON.stringify(modal),/MyOwner/);
 i.guildId='other';await menu.button(i);assert.match(JSON.stringify(result),/expired|server|environment/i);assert.equal((await db.query('SELECT COUNT(*) n FROM saved_houses'))[0].n,0);
});
test('empty generic picker renders navigation without an invalid String Select',()=>{
 const result=pickerPayload({title:'No results',description:'Try another search',customId:'hu:test',options:[]});assert.ok(result.components.length);assert.ok(result.components.flatMap(r=>r.toJSON().components).every(c=>c.type!==3));
});

test('legacy registration not-found recovery retains all entered fields',async t=>{
 const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:':memory:'});t.after(()=>closeDatabase(db));await migrate(db);await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g','pc_na')");const menu=createHousingMenu(db);let payload;
 const data={house:'Imaginary Palace',owner:'MyOwner',nickname:'My Nickname',description:'My notes',tags:'garden, cozy'},base={guildId:'g',user:{id:'u'},member:{roles:{cache:new Map()}},reply:async p=>payload=p,update:async p=>payload=p,showModal:async p=>payload=p};
 await menu.modal({...base,customId:'hu:modal:register:private',fields:{getTextInputValue:k=>data[k]}});assert.match(JSON.stringify(payload),/No matching ESO house found/);
 const controls=payload.components.flatMap(r=>r.toJSON().components),retry=controls.find(c=>c.label==='Try Again');assert.ok(retry);assert.ok(controls.find(c=>c.label==='Back'));
 await menu.button({...base,customId:retry.custom_id});const text=JSON.stringify(payload);for(const entered of Object.values(data))assert.ok(text.includes(entered),`Missing ${entered}`);
 assert.equal((await db.query('SELECT COUNT(*) n FROM saved_houses'))[0].n,0);
});
