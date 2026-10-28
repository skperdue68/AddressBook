import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {createWebAdminServer} from '../src/web/server.js';
import {WebAdminService} from '../src/services/web-admin-service.js';
import {createSession,readSession} from '../src/web/session.js';
import {safeHouseReturn,safeActionReturn} from '../src/web/flow-navigation.js';
test('saved searches retain their source page through results, houses, rename and final-page deletion',async()=>{
 const {db,svc,c}=await fixture(),server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async()=>({id:'g',name:'Guild',roleIds:[],esoServer:'pc_na'})});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
  await svc.registerHouse(c,{houseId:1,esoOwner:'Builder',displayName:'Garden',visibility:'private'});for(let n=0;n<26;n++)await svc.actions.saveSearch(c,{name:`Search ${String(n).padStart(2,'0')}`,filters:{query:'Garden'}});
  const base=`http://127.0.0.1:${server.address().port}`,token=createSession({id:'u',username:'User',selectedGuildId:'g',guilds:[{id:'g'}]},Date.now(),'s'),cookie=`addressbook_session=${token}`,csrf=readSession(token,Date.now(),'s').csrf,get=p=>fetch(base+p,{headers:{cookie},redirect:'manual'}),post=(p,data)=>fetch(base+p,{method:'POST',headers:{cookie},body:new URLSearchParams({csrf,contextGuildId:'g',contextEsoServer:'pc_na',...data}),redirect:'manual'});
  const list=await get('/app/searches?page=2'),html=await list.text(),run=/href="(\/app\/searches\/(\d+)\/run\?listPage=2)"/.exec(html);assert.ok(run);const id=run[2];
  const result=await get(run[1]),results=await result.text();assert.match(results,/href="\/app\/searches\?page=2">Back to saved searches/);assert.match(results,/%3FlistPage%3D2/);
  const edit=await get(`/app/searches/${id}/rename?listPage=2`),editHtml=await edit.text();assert.match(editHtml,/name="listPage" value="2"/);assert.match(editHtml,/href="\/app\/searches\?page=2">Cancel/);
  const rename=await post(`/app/searches/${id}/rename`,{name:'Zebra renamed',listPage:'2'});const renamed=new URL(rename.headers.get('location'),base);assert.equal(renamed.searchParams.get('page'),'2');assert.equal(renamed.searchParams.get('saved'),'1');
  const confirm=await get(`/app/searches/${id}/delete?listPage=2`);assert.match(await confirm.text(),/class="danger"[^>]*>Delete saved search/);
  const removed=await post(`/app/searches/${id}/delete`,{confirm:'delete',listPage:'2'}),target=new URL(removed.headers.get('location'),base);assert.notEqual(target.searchParams.get('page'),'2');assert.equal(target.searchParams.get('deleted'),'1');assert.match(await(await get(target.pathname+target.search)).text(),/Saved search deleted/);
  const another=(await svc.actions.searches.list(c.userId))[0],unsafe=await get(`/app/searches/${another.id}/rename?listPage=https://evil.test`);assert.doesNotMatch(await unsafe.text(),/evil\.test/);
 }finally{await new Promise(r=>server.close(r));await closeDatabase(db);}
});
test('saved search return metadata is numeric and limited to saved-search result routes',()=>{
 assert.equal(safeHouseReturn('/app/searches/7/run?listPage=2'),'/app/searches/7/run?listPage=2');assert.equal(safeActionReturn('/app/searches/7/run?listPage=2'),'/app/searches/7/run?listPage=2');
 for(const bad of ['/app/searches/7/run?listPage=https://evil.test','/app/searches/7/run?listPage=-1','/app/houses?listPage=2']){assert.equal(safeHouseReturn(bad),null);assert.equal(safeActionReturn(bad),null);}
});
