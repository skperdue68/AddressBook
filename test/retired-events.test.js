import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,migrate,closeDatabase} from '../src/db/database.js';
import {createHousingMenu} from '../src/ui/housing-menu.js';
import {EngagementWorker} from '../src/services/engagement-worker.js';
import {homePayload,helpPayload,toursPayload,tourManagePayload} from '../src/ui/housing-ui.js';
test('retired event actions never write data or launch sessions',async t=>{
 const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:':memory:'});t.after(()=>closeDatabase(db));await migrate(db);await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g','pc_na')");const menu=createHousingMenu(db);
 for(const [method,id] of [['button','hu:tours:events'],['button','hu:events:next:2'],['button','hu:event:rsvp:going:1'],['button','hu:tour:event:1'],['modal','hu:modal:tour:event:1'],['modal','hu:modal:event:edit:1'],['select','hu:event:any:1']]){
 let payload;const i={customId:id,guildId:'g',user:{id:'u'},member:{roles:{cache:new Map()}},reply:async p=>payload=p,update:async p=>payload=p};await menu[method](i);assert.match(JSON.stringify(payload),/Scheduled events are no longer available/);assert.match(JSON.stringify(payload),/hu:tours/);
 }
 for(const table of ['tour_events','tour_event_rsvps','tour_sessions'])assert.equal((await db.query(`SELECT COUNT(*) n FROM ${table}`))[0].n,0);
});
test('active menus omit scheduled events and worker never executes reminders',async()=>{
 for(const p of [homePayload(),helpPayload(),toursPayload(),tourManagePayload({id:1,name:'Tour'},[])])assert.doesNotMatch(JSON.stringify(p),/Upcoming Events|Schedule Event|RSVP|DM reminders/i);
 let reminders=0;const worker=new EngagementWorker({reminders:{runOnce:async()=>reminders++}});await worker.runOnce();assert.equal(reminders,0);
});
