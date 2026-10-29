import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';import {closeDatabase} from '../src/db/database.js';
import {createWebAdminServer} from '../src/web/server.js';import {WebAdminService} from '../src/services/web-admin-service.js';import {createSession,readSession} from '../src/web/session.js';

test('a Discord account can manage Global/Private houses and tours without a bot guild',async t=>{
 const {db,svc}=await fixture();t.after(()=>closeDatabase(db));const c=await svc.authorizeContext({userId:'web-user',guildId:null,esoServer:'pc_na',personalWorkspace:true});assert.equal(c.guildId,'');assert.equal(c.isServerAdmin,false);assert.equal(c.isOwner,false);assert.deepEqual(svc.houseScopes(c),['global','private']);
 const house=await svc.registerHouse(c,{houseId:1,esoOwner:'Web Builder',visibility:'global'});assert.equal(house.guild_id,null);assert.equal(house.created_by,'web-user');const secret=await svc.registerHouse(c,{houseId:2,esoOwner:'Private Builder',visibility:'private'});assert.equal(secret.owner_user_id,'web-user');
 const tour=await svc.saveTourDraft(c,{details:{name:'Web route',visibility:'global'},stopIds:[house.id]});assert.equal(tour.creator_id,'web-user');assert.equal((await svc.getTourDraft(c,tour.id)).canEdit,true);
 const privateTour=await svc.saveTourDraft(c,{details:{name:'Private web route',visibility:'private'},stopIds:[secret.id,house.id]});assert.equal(privateTour.visibility,'private');assert.equal(privateTour.house_source,'private_global');
 assert.ok(await svc.startTour(c,tour.id));await svc.actions.houseAction(c,house.id,'favorite',{value:'1'});assert.equal(Number((await svc.actions.states.get(c.userId,{kind:'destination',id:house.destination_id})).is_favorite),1);
 await assert.rejects(()=>svc.registerHouse(c,{houseId:2,esoOwner:'Bad',visibility:'public'}),/connected.*server|Server.*connected/);await assert.rejects(()=>svc.saveTourDraft(c,{details:{name:'Bad',visibility:'public'},stopIds:[]}),/connected.*server|Server.*connected/);
 const other=await svc.authorizeContext({...c,userId:'other'});await assert.rejects(()=>svc.getHouse(other,secret.id),/not available/);
});

test('switching from personal to a single connected server persists the selected mode',async t=>{
 const {db,svc}=await fixture(),server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async()=>({id:'g',name:'Guild',roleIds:[],esoServer:'pc_na'})});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await closeDatabase(db);});const base=`http://127.0.0.1:${server.address().port}`,cookie='addressbook_session='+createSession({id:'web-user',guilds:[{id:'g'}],selectedWorkspace:'personal',personalEsoServer:'pc_na'},Date.now(),'s');
 const selected=await fetch(base+'/app?choose=1',{headers:{cookie},redirect:'manual'});assert.equal(selected.status,200);const renewed=selected.headers.get('set-cookie');assert.ok(renewed);assert.equal(readSession(renewed.split(';')[0].split('=')[1],Date.now(),'s').selectedWorkspace,'guild');
});

test('no-guild login opens a personal workspace and still cannot enter server administration',async t=>{
 const {db,svc}=await fixture(),server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async()=>null});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await closeDatabase(db);});const base=`http://127.0.0.1:${server.address().port}`,token=createSession({id:'web-user',username:'Web Member',guilds:[]},Date.now(),'s'),cookie='addressbook_session='+token;
 const response=await fetch(base+'/app',{headers:{cookie},redirect:'manual'});assert.equal(response.status,200);const html=await response.text();assert.match(html,/Personal web workspace/);assert.doesNotMatch(html,/>Administration<|Set up Server administration/);
 const register=await(await fetch(base+'/app/register',{headers:{cookie}})).text();assert.match(register,/value="global"/);assert.doesNotMatch(register,/<option value="public"/);
 const renewedCookie=response.headers.get('set-cookie').split(';')[0],signed=readSession(renewedCookie.split('=')[1],Date.now(),'s');assert.equal(signed.csrf,readSession(token,Date.now(),'s').csrf,'workspace selection preserves the rendered form CSRF token');
 const saved=await fetch(base+'/app/register',{method:'POST',headers:{cookie:renewedCookie},body:new URLSearchParams({csrf:signed.csrf,contextGuildId:'',contextEsoServer:'pc_na',houseId:'1',esoOwner:'Web Builder',visibility:'global'}),redirect:'manual'});assert.equal(saved.status,302);assert.match(saved.headers.get('location'),/^\/app\/houses\/\d+/);
 const housePage=await(await fetch(base+saved.headers.get('location'),{headers:{cookie:renewedCookie}})).text();assert.match(housePage,/Web Builder/);assert.doesNotMatch(housePage,/>Share house</);
 const newTour=await(await fetch(base+'/app/tours/new',{headers:{cookie:renewedCookie}})).text();assert.doesNotMatch(newTour,/<option value="public"/);assert.match(newTour,/<option value="global" selected/);
 const support=await(await fetch(base+'/app/support',{headers:{cookie:renewedCookie}})).text();assert.doesNotMatch(support,/Request Server access/);
 for(const path of ['/admin','/app?guildId=g'])assert.equal((await fetch(base+path,{headers:{cookie},redirect:'manual'})).status,403,path);
 const change=await fetch(base+'/app?workspace=personal&esoServer=pc_eu',{headers:{cookie},redirect:'manual'});assert.equal(change.status,200);const renewed=change.headers.get('set-cookie');assert.ok(renewed);assert.equal(readSession(renewed.split(';')[0].split('=')[1],Date.now(),'s').personalEsoServer,'pc_eu');
});
