import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,migrate,closeDatabase} from '../src/db/database.js';
import {createHousingMenu} from '../src/ui/housing-menu.js';
import {HouseDiscoveryService} from '../src/services/house-discovery-service.js';
import {homePayload} from '../src/ui/housing-ui.js';
import {featuredPayload} from '../src/ui/engagement-ui.js';
const controls=p=>p.components.flatMap(r=>r.toJSON().components),labels=p=>controls(p).map(c=>c.label).filter(Boolean);
test('home follows the requested action order and authorized Administration precedes Help',()=>{
 const expected=['Search Houses','Search Housing Tours','Register New House','Random House','Featured Housing','My Address Book','Administration','Help'];assert.deepEqual(labels(homePayload({isAdmin:true})),expected);assert.deepEqual(labels(homePayload()),expected.filter(x=>x!=='Administration'));
 for(const p of [homePayload(),homePayload({isAdmin:true})]){assert.ok(p.components.length<=5);for(const r of p.components)assert.ok(r.toJSON().components.length<=5);}
});
async function fixture(t,{empty=false}={}){const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:':memory:'});t.after(()=>closeDatabase(db));await migrate(db);await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g','pc_na')");await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'Villa','villa')");if(!empty)for(const [id,scope,guild,user,server] of [[1,'global',null,null,'pc_na'],[2,'public','g',null,'pc_na'],[3,'private',null,'u','pc_na'],[4,'private',null,'other','pc_na'],[5,'public','foreign',null,'pc_na'],[6,'global',null,null,'pc_eu']]){await db.query('INSERT INTO housing_destinations(id,house_id,eso_server,eso_owner,normalized_owner) VALUES(?,1,?,?,?)',[id,server,'Owner'+id,'owner'+id]);await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,owner_user_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(?,?,?,?,?,1,?,?,?,'active','u','u')",[id,server,scope,guild,user,'Owner'+id,'owner'+id,id]);}
 let payload;const base={guildId:'g',channelId:'c',user:{id:'u'},member:{roles:{cache:new Map()}},update:async p=>payload=p,reply:async p=>payload=p};return {db,base,menu:createHousingMenu(db,{discovery:new HouseDiscoveryService({randomInt:max=>max-1})}),get payload(){return payload;}};}
test('Random House starts from Home, respects scope, retains catalog details, and returns Home',async t=>{
 const f=await fixture(t);await f.menu.button({...f.base,customId:'hu:random'});assert.match(JSON.stringify(f.payload),/Villa/);assert.doesNotMatch(JSON.stringify(f.payload),/Unknown house|Owner4|Owner5|Owner6/);const another=controls(f.payload).find(c=>c.label==='Another Random House');assert.ok(another);const first=JSON.stringify(f.payload.embeds);await f.menu.button({...f.base,customId:another.custom_id});assert.notEqual(JSON.stringify(f.payload.embeds),first);
 const back=controls(f.payload).find(c=>c.label==='Back');await f.menu.button({...f.base,customId:back.custom_id});assert.deepEqual(labels(f.payload),labels(homePayload({isAdmin:true})));
 await f.menu.button({...f.base,customId:'hu:find'});assert.ok(!labels(f.payload).includes('Surprise Me'));assert.ok(!labels(f.payload).includes('Random House'));
});
test('Random House handles no registered destinations with a route Home',async t=>{const f=await fixture(t,{empty:true});await f.menu.button({...f.base,customId:'hu:random'});assert.match(JSON.stringify(f.payload),/No accessible|No registered|no houses/i);assert.ok(controls(f.payload).find(c=>c.custom_id==='hu:home'));});
test('Featured viewer returns Home and management exposes Back to Administration within row limits',async t=>{
 const f=await fixture(t);await f.menu.button({...f.base,customId:'hu:featured'});assert.ok(controls(f.payload).find(c=>c.custom_id==='hu:home'&&/Back/.test(c.label)));
 await f.menu.button({...f.base,customId:'hu:admin:featured'});assert.ok(controls(f.payload).find(c=>c.custom_id==='hu:admin'&&c.label==='Back to Administration'));
 const full=featuredPayload({canManage:true,selectedItem:{target_kind:'house',target_id:1,position:1},items:[...Array.from({length:5},(_,n)=>({target_kind:'house',target_id:n+1,position:n+1,target_name:'House'})),...Array.from({length:5},(_,n)=>({target_kind:'tour',target_id:n+1,position:n+1,target_name:'Tour'}))]});assert.ok(full.components.length<=5);for(const r of full.components)assert.ok(r.toJSON().components.length<=5);
});

test('Featured house and tour views preserve the Home return path',async t=>{
 const f=await fixture(t);await f.db.query("INSERT INTO tours(id,eso_server,visibility,creator_id,name,house_source) VALUES(1,'pc_na','global','u','Featured Route','global')");await f.db.query('INSERT INTO tour_stops(tour_id,position,saved_house_id) VALUES(1,1,1)');await f.db.query("INSERT INTO featured_items(guild_id,target_kind,target_id,target_name,position,selected_by) VALUES('g','tour',1,'Featured Route',1,'u')");
 const click=async label=>{const control=controls(f.payload).find(c=>c.label===label);assert.ok(control,`Missing ${label}`);await f.menu.button({...f.base,customId:control.custom_id});};
 await f.menu.button({...f.base,customId:'hu:featured'});await click('Open House 1');await click('Back');assert.ok(controls(f.payload).find(c=>c.custom_id==='hu:home'));
 await click('Open Tour 1');await click('Start a Tour');await click('Back');await click('Back to Featured');assert.ok(controls(f.payload).find(c=>c.custom_id==='hu:home'));
});
test('Random House session cannot be reused in a different guild or changed environment',async t=>{
 const f=await fixture(t);await f.menu.button({...f.base,customId:'hu:random'});const another=controls(f.payload).find(c=>c.label==='Another Random House');assert.ok(another);
 await f.db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('other','pc_na')");await f.menu.button({...f.base,guildId:'other',customId:another.custom_id});assert.match(JSON.stringify(f.payload),/expired/);
 await f.db.query("UPDATE guild_settings SET eso_server='pc_eu' WHERE guild_id='g'");await f.menu.button({...f.base,customId:another.custom_id});assert.match(JSON.stringify(f.payload),/expired/);
});
