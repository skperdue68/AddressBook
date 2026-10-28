import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {createWebAdminServer} from '../src/web/server.js';
import {WebAdminService} from '../src/services/web-admin-service.js';
import {createSession,readSession} from '../src/web/session.js';

const decode=value=>value.replaceAll('&amp;','&');
async function setup(t){
 const {db,svc,c}=await fixture();t.after(()=>closeDatabase(db));const owner=await svc.fresh({...c,userId:'1'});
 const house=await svc.registerHouse(owner,{houseId:1,esoOwner:'Builder',displayName:'Moon Garden',visibility:'public'}),tour=await svc.saveTourDraft(c,{details:{name:'My route',visibility:'public'},stopIds:[]});
 const server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async({guildId})=>({id:guildId,name:'Guild',roleIds:[],esoServer:'pc_na'})});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const auth=id=>{const token=createSession({id,selectedGuildId:'g',guilds:[{id:'g'}]},Date.now(),'s');return {cookie:'addressbook_session='+token,csrf:readSession(token,Date.now(),'s').csrf};},member=auth('u'),admin=auth('1'),base=`http://127.0.0.1:${server.address().port}`;
 return {db,svc,c,house,tour,member,admin,get:(path,actor=member)=>fetch(base+path,{headers:{cookie:actor.cookie},redirect:'manual'}),post:(path,fields,actor=member)=>fetch(base+path,{method:'POST',headers:{cookie:actor.cookie},body:new URLSearchParams({csrf:actor.csrf,contextGuildId:'g',contextEsoServer:'pc_na',...fields}),redirect:'manual'})};
}
test('house results expose tour addition and preserve search context through details and personal actions',async t=>{
 const f=await setup(t),origin='/app/houses?q=Moon&scope=public&page=1';const results=await(await f.get(origin)).text();
 const add=/<a class="button [^"]*" href="([^"]+)">Add to tour<\/a>/.exec(results);assert.ok(add,'search result must offer Add to tour');
 const destination=decode(add[1]);assert.ok(destination.endsWith('#add-to-tour'));assert.equal(new URL(destination,'https://example.test').searchParams.get('returnTo'),origin);
 const detail=await(await f.get(destination)).text();assert.match(detail,/id="add-to-tour"/);assert.ok(detail.includes(`href="${origin.replaceAll('&','&amp;')}"`));assert.match(detail,/Back to search results/);assert.doesNotMatch(detail,/>Edit house<|>Delete house</);
 const action=await f.post(`/app/houses/${f.house.id}/actions`,{action:'favorite',value:'1',returnTo:origin});assert.equal(new URL(action.headers.get('location'),'https://example.test').searchParams.get('returnTo'),origin);
 const added=await f.post(`/app/houses/${f.house.id}/add-to-tour`,{tourId:String(f.tour.id),returnTo:origin});assert.equal(added.status,302);assert.equal((await f.svc.getTourDraft(f.c,f.tour.id)).stops.length,1);
 const tour=await(await f.get(added.headers.get('location'))).text();assert.match(tour,/House added to tour/);assert.match(tour,/Back to search results/);
});
test('edit round trip preserves search and groups house management separately',async t=>{
 const f=await setup(t),origin='/app/search?tag=garden&owner=Builder',query='?returnTo='+encodeURIComponent(origin),path=`/app/houses/${f.house.id}`;
 const details=await(await f.get(path+query,f.admin)).text();assert.match(details,/<summary>Manage house<\/summary>/);
 const edited=await f.post(path+'/edit',{houseId:'1',esoOwner:'Builder',displayName:'Moon Garden',description:'',tags:'',returnTo:origin},f.admin);assert.equal(new URL(edited.headers.get('location'),'https://example.test').searchParams.get('returnTo'),origin);
});
test('return context rejects external links and unexpected application routes',async t=>{
 const f=await setup(t);
 for(const value of ['https://evil.example/','//evil.example/','/\\evil.example/','/admin?delete=1','/app/houses?guildId=other','/app/houses?returnTo=https://evil.example/']){
  const page=await(await f.get(`/app/houses/${f.house.id}?returnTo=${encodeURIComponent(value)}`)).text();assert.doesNotMatch(page,/href="https:\/\/evil|href="\/\/evil|href="\/admin\?delete|href="\/app\/houses\?guildId=other/);assert.match(page,/Back to houses/);
 }
});
test('advanced and saved searches retain their result route and offer tour shortcuts only for registered houses',async t=>{
 const f=await setup(t),origin='/app/search?owner=Builder';const html=await(await f.get(origin)).text();assert.match(html,/Add to tour/);assert.ok(html.includes(encodeURIComponent(origin)));
 const search=await f.svc.actions.saveSearch(f.c,{name:'Builders',filters:{owner:'Builder'}}),id=search.search?.id||search.id;
 assert.ok(id,'saved search created');{const page=await(await f.get(`/app/searches/${id}/run`)).text();assert.match(page,/Add to tour/);assert.ok(page.includes(encodeURIComponent(`/app/searches/${id}/run`)));}
});

test('own pending house keeps an edit entry point and return context in its management section',async t=>{
 const f=await setup(t),pending=await f.svc.registerHouse(f.c,{houseId:2,esoOwner:'PendingBuilder',visibility:'public'}),origin='/app/personal/pending';assert.equal(pending.status,'pending');
 const page=await(await f.get(`/app/houses/${pending.id}?returnTo=${encodeURIComponent(origin)}`)).text();assert.match(page,/<summary>Manage house<\/summary>/);assert.ok(page.includes(`/app/houses/${pending.id}/edit?returnTo=`));assert.doesNotMatch(page,/id="add-to-tour"/);
});
