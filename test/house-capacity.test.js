import test from 'node:test';import assert from 'node:assert/strict';
import {discoveryCards} from '../src/web/house-discovery.js';
import {titleWithPlayerCap} from '../src/utils/render.js';
import {tourManagePayload} from '../src/ui/housing-ui.js';
import {tourSelectionReviewPayload} from '../src/ui/tour-selection-ui.js';
import {fixture} from './workspace-fixture.js';import {closeDatabase} from '../src/db/database.js';
import {createWebAdminServer} from '../src/web/server.js';import {WebAdminService} from '../src/services/web-admin-service.js';import {createSession} from '../src/web/session.js';

test('house cards display recorded capacity and never guess missing or invalid limits',()=>{
 const h={id:1,display_name:'Small Garden',house_name:'Cottage',scope:'public',status:'active',population_limit:6};
 assert.match(discoveryCards([h]),/class="house-capacity"/);assert.match(discoveryCards([h]),/fill="currentColor"/);assert.match(discoveryCards([h]),/Maximum house capacity: 6 players/);assert.match(discoveryCards([h]),/>6 max</);
 for(const population_limit of [null,'',0,-1,'not a number']){assert.doesNotMatch(discoveryCards([{...h,population_limit}]),/class="house-capacity"/);assert.equal(titleWithPlayerCap('Cottage',{population_limit}),'Cottage');}
});
test('Discord tour routes and selected-stop reviews show capacity beside each house',()=>{
 const stop={id:1,position:1,display_name:'Cottage',house_name:'Cottage',eso_owner:'Builder',population_limit:6};
 const route=tourManagePayload({id:1,name:'Route'},[stop]);assert.match(JSON.stringify(route.embeds.map(e=>e.toJSON())),/👥 6 max/);
 const review=tourSelectionReviewPayload({token:'t',rows:[stop],backId:'back'});assert.match(review.embeds[0].toJSON().description,/👥 6 max/);assert.match(review.components[0].toJSON().components[0].options[0].label,/👥 6 max/);
});
test('capacity reaches web searches, details, tour building, routes and player without leaking restricted stops',async t=>{
 const {db,svc,c}=await fixture();t.after(()=>closeDatabase(db));await db.query('UPDATE houses SET population_limit=6,population_limit_plus=6 WHERE house_id=1');const owner=await svc.fresh({...c,userId:'1'}),h=await svc.registerHouse(owner,{houseId:1,esoOwner:'Builder',visibility:'public'}),tour=await svc.saveTourDraft(c,{details:{name:'Small-house route',visibility:'public'},stopIds:[h.id]});
 await svc.registerHouse(c,{houseId:1,esoOwner:'Pending builder',visibility:'public'});assert.equal((await new WebAdminService(db).listPending({guildId:'g',esoServer:'pc_na'}))[0].population_limit,6);assert.equal((await svc.listHouses(c)).rows[0].population_limit,6);assert.equal((await svc.tourHouseCandidates(c))[0].population_limit,6);assert.equal((await svc.getTourDraft(c,tour.id)).stops[0].population_limit,6);
 const server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async()=>({id:'g',name:'Guild',roleIds:[],esoServer:'pc_na'})});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base=`http://127.0.0.1:${server.address().port}`,cookie='addressbook_session='+createSession({id:'u',selectedGuildId:'g',guilds:[{id:'g'}]},Date.now(),'s');
 for(const path of ['/app/houses','/app/houses?view=list',`/app/houses/${h.id}`,'/app/random',`/app/tours/${tour.id}`,`/app/tours/${tour.id}/edit`]){const response=await fetch(base+path,{headers:{cookie}});assert.equal(response.status,200,path);assert.match(await response.text(),/Maximum house capacity: 6 players/,path);}
 const run=await svc.startTour(c,tour.id);assert.match(await(await fetch(base+`/app/tours/${tour.id}/play`,{headers:{cookie}})).text(),/Maximum house capacity: 6 players/);
 await svc.progress.advance({progressId:run.id,userId:c.userId,guildId:c.guildId,esoServer:c.esoServer});assert.equal((await svc.progress.completedStops({progressId:run.id,userId:c.userId,guildId:c.guildId,esoServer:c.esoServer}))[0].population_limit,6);
 await db.query("UPDATE saved_houses SET scope='private',owner_user_id='1',guild_id=NULL WHERE id=?",[h.id]);const restricted=(await svc.getTourDraft(c,tour.id)).stops[0];assert.equal(restricted.house_name,null);assert.equal(restricted.population_limit,null);
});

import './tour-route-columns.test.js';
