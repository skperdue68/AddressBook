import test from 'node:test';import assert from 'node:assert/strict';
import {openDatabase,migrate,closeDatabase} from '../src/db/database.js';
import {WebWorkspaceService} from '../src/services/web-workspace-service.js';
import {renderWorkspace} from '../src/web/workspace-render.js';
test('members enter workspace without administration and renderer shows every scoped role safely',async()=>{const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:':memory:'});try{await migrate(db);await db.query("INSERT INTO guild_settings(guild_id,eso_server,staff_role_ids) VALUES('g','pc_na','[\"staff\"]')");const svc=new WebWorkspaceService(db,{env:{BOT_OWNER_IDS:'1'}});const c=await svc.authorizeContext({userId:'member',guildId:'g',esoServer:'pc_na',memberRoleIds:[],guildName:'<Guild>'});assert.equal(c.isServerAdmin,false);assert.equal(c.roles[0].label,'Member');const own=await svc.authorizeContext({...c,userId:'1'});const html=renderWorkspace({title:'Home',body:'',user:{username:'<name>'},context:own,active:'home'});assert.match(html,/Bot Owner/);assert.match(html,/Global Administrator/);assert.match(html,/Server Administrator/);assert.match(html,/PC NA/);assert.doesNotMatch(html,/<name>|<Guild>/);assert.match(html,/Your Access/);assert.match(html,/Private/);}finally{await closeDatabase(db)}});

import {houseMetadata,houseTourSection} from '../src/web/house-details.js';
import {tourHousePicker} from '../src/web/tour-house-picker.js';

test('tour picker escapes house filter metadata and retains checked stops beyond the first page',()=>{
 const rows=Array.from({length:30},(_,id)=>({id:id+1,house_name:'House',display_name:id===29?'Last <house>':'House '+id,eso_owner:'" autofocus onfocus="bad',tags:JSON.stringify(['<tag>']),scope:'private',owner_user_id:'u',zone:'<Zone>'}));
 const html=tourHousePicker(rows,[{saved_house_id:30}]);assert.equal((html.match(/data-candidate-label/g)||[]).length,30);assert.match(html,/data-add-house="30"[^>]*checked/);assert.match(html,/candidate-tags/);assert.match(html,/candidate-scope/);assert.match(html,/candidate-zone/);assert.match(html,/Last &lt;house&gt;/);assert.match(html,/&lt;tag&gt;/);assert.doesNotMatch(html,/data-owner="" autofocus/);assert.match(html,/type="button" id="candidate-clear"/);
});

test('official details group capacities and prices, format numbers and escape catalog text',()=>{
 const html=houseMetadata({classification:'Classic',zone:'<script>bad</script>',furnishing_limit:250,furnishing_limit_plus:500,gold_price:250000,crown_price_unfurnished:3500,population_limit:0});
 assert.match(html,/Home &amp; location/);assert.match(html,/Furnishing capacity/);assert.match(html,/Purchase &amp; availability/);assert.match(html,/250,000/);assert.match(html,/3,500/);assert.match(html,/&lt;script&gt;bad/);assert.doesNotMatch(html,/<script>/);assert.match(html,/<dd>0<\/dd>/);assert.match(html,/aria-hidden="true"/);
 const empty=houseTourSection({id:1,status:'active',scope:'private'},[],'csrf');assert.match(empty,/Add to existing tour/);assert.match(empty,/Only your own Private tours/);assert.match(empty,/No eligible existing tours/);assert.doesNotMatch(empty,/<select/);
 const choices=houseTourSection({id:1,status:'active',scope:'global'},[{id:2,name:'Route',visibility:'global'}],'csrf');assert.match(choices,/add-to-tour/);assert.match(choices,/name="tourId"/);assert.match(choices,/Add house to tour/);
});
