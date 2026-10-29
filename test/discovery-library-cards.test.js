import test from 'node:test';import assert from 'node:assert/strict';
import {discoveryCards,personalNavigation} from '../src/web/house-discovery.js';
import {fixture} from './workspace-fixture.js';import {closeDatabase} from '../src/db/database.js';
import {myAddressBookPayload} from '../src/ui/housing-ui.js';

test('discovery cards show useful facts and reversible marks, preserving filtered return context',()=>{
 const html=discoveryCards([{id:4,destination_id:10,status:'active',scope:'public',display_name:'Garden <script>',house_name:'Villa',eso_owner:'Builder',zone:'Auridon',style:'Altmer',classification:'Notable',description:'A place to relax',tags:'["garden"]',cover_image_id:8,personal_state:{is_favorite:1,visit_state:'want_to_visit'}}],{csrf:'s',returnTo:'/app/houses?q=garden&view=cards'});
 for(const text of ['Garden &lt;script&gt;','Villa','Auridon','Altmer','Notable','A place to relax','garden','Remove from favorites','/app/houses/4/images/8','Add to tour'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('data-personal-action="visit"'));assert.ok(html.includes('name="returnTo" value="/app/houses?q=garden&amp;view=cards"'));assert.ok(!html.includes('<script>'));
 const pending=discoveryCards([{id:5,status:'pending',scope:'private',display_name:'Pending home'}],{csrf:'s'});assert.ok(!pending.includes('data-personal-action'));assert.ok(!pending.includes('Add to tour'));assert.ok(pending.includes('hearthbound-logo.png'));
});
test('decoration adds only the current member’s marks for visible houses',async()=>{
 const {db,svc,c}=await fixture();try{const h=await svc.registerHouse(c,{houseId:1,esoOwner:'Builder',visibility:'private'});await svc.actions.houseAction(c,h.id,'favorite',{value:'1'});
 const decorated=await svc.decorateHouses(c,(await svc.listHouses(c)).rows);assert.equal(decorated[0].personal_state.is_favorite,1);assert.equal(decorated[0].cover_image_id,null);
 const other=await svc.fresh({...c,userId:'1'});assert.equal((await svc.listHouses(other)).rows.length,0);
 }finally{await closeDatabase(db);}
});
test('saved-place navigation puts favorites and visit plans before management tools on web and Discord',()=>{
 const html=personalNavigation('/app/personal/favorites');assert.ok(html.includes('aria-current="page"'));assert.ok(html.indexOf('Favorites')<html.indexOf('Submitted'));assert.ok(html.includes('Organize'));
 const rows=myAddressBookPayload({}).components.map(row=>row.toJSON().components);assert.deepEqual(rows.flat().filter(button=>['hu:my:library','hu:my:favorites','hu:my:want','hu:my:visited'].includes(button.custom_id)).map(button=>button.custom_id),['hu:my:library','hu:my:favorites']);
});
import {createWebAdminServer} from '../src/web/server.js';import {WebAdminService} from '../src/services/web-admin-service.js';import {createSession,readSession} from '../src/web/session.js';

test('discovery actions stay on filtered results without JavaScript and cannot expose Private records',async()=>{
 const {db,svc,c}=await fixture(),owner=await svc.fresh({...c,userId:'1'}),h=await svc.registerHouse(owner,{houseId:1,esoOwner:'Builder',visibility:'public',displayName:'Garden',description:'A peaceful garden',tags:['garden']});await svc.registerHouse(c,{houseId:2,esoOwner:'Secret',visibility:'private',displayName:'Hidden private home'});
 await svc.saveTourDraft(owner,{details:{name:'A garden route',visibility:'public'},stopIds:[h.id]});
 const server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async()=>({id:'g',name:'Guild',roleIds:[],esoServer:'pc_na'})});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const token=createSession({id:'1',guilds:[{id:'g'}]},Date.now(),'s'),cookie=`addressbook_session=${token}`,csrf=readSession(token,Date.now(),'s').csrf,base=`http://127.0.0.1:${server.address().port}`,returnTo='/app/houses?q=Builder&view=cards';
 try{
 const get=async path=>(await fetch(base+path,{headers:{cookie}})).text();const page=await get('/app/houses');assert.match(page,/discovery-grid/);assert.match(page,/A peaceful garden/);assert.doesNotMatch(page,/Hidden private home/);
 const marked=await fetch(`${base}/app/houses/${h.id}/actions`,{method:'POST',headers:{cookie},body:new URLSearchParams({csrf,contextGuildId:'g',contextEsoServer:'pc_na',action:'favorite',value:'1',stayOnList:'1',returnTo}),redirect:'manual'});assert.equal(marked.headers.get('location'),returnTo);assert.match(await get(returnTo),/aria-label="Remove from favorites"/);
 const list=await get('/app/houses?q=Builder&view=list');assert.match(list,/<table>/);assert.ok(!list.includes('class="discovery-grid"'));
 for(const path of ['/app/tours','/app/tours?mine=1']){const tours=await get(path);assert.match(tours,/A garden route/);assert.ok(!tours.includes('Action not completed'));}
 const library=await get('/app/personal');assert.match(library,/My saved houses/);assert.ok(!library.includes('Legacy records'));
 }finally{await new Promise(r=>server.close(r));await closeDatabase(db);}
});
