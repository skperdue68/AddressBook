import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {personalLibrary} from '../src/services/personal-library-service.js';
test('house and personal listings fetch the final accessible page instead of returning false empty states',async()=>{
 const {db,svc,c}=await fixture();try{
  for(let n=0;n<27;n++)await svc.registerHouse(c,{houseId:1,esoOwner:'Builder'+n,displayName:`House ${String(n).padStart(2,'0')}`,visibility:'private'});
  const other=await svc.fresh({...c,userId:'other'});await svc.registerHouse(other,{houseId:2,esoOwner:'Hidden',visibility:'private'});
  const found=await svc.listHouses(c,{page:999,scope:'private'});assert.equal(found.page,2);assert.equal(found.rows.length,2);assert.equal(found.total,27);assert.ok(found.rows.every(h=>h.owner_user_id==='u'));
  const library=await personalLibrary(svc,c,{page:999});assert.equal(library.page,2);assert.equal(library.rows.length,2);
  for(const h of found.rows)await svc.saved.delete(h.id,'u');const previous=await svc.listHouses(c,{page:2,scope:'private'});assert.equal(previous.page,1);assert.equal(previous.rows.length,25);assert.equal(previous.total,25);
  const empty=await svc.listHouses(c,{page:999,q:'does not exist'});assert.equal(empty.page,1);assert.deepEqual(empty.rows,[]);
 }finally{await closeDatabase(db);}
});
test('filtered feedback clamps to its own last page after a record leaves the queue',async()=>{
 const {db,svc,c}=await fixture();try{
  await svc.feedback.submit(c,{name:'Member'},{eventKey:'7bd610b3-6673-43c6-9722-165e654f465e',subject:'A useful idea',message:'Help users find houses.',category:'idea'});
  const owner={userId:'1',isOwner:true};const result=await svc.feedback.list(owner,{page:99,status:'new'});assert.equal(result.page,1);assert.equal(result.rows.length,1);
 }finally{await closeDatabase(db);}
});
import {createWebAdminServer} from '../src/web/server.js';
import {WebAdminService} from '../src/services/web-admin-service.js';
import {createSession} from '../src/web/session.js';
test('web list routes correct stale page links without dropping filters or permissions',async()=>{
 const {db,svc,c}=await fixture(),server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async()=>({id:'g',name:'Guild',roleIds:[],esoServer:'pc_na'})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
  const owner=await svc.fresh({...c,userId:'1'});for(let n=0;n<27;n++){await svc.registerHouse(c,{houseId:1,esoOwner:'Builder'+n,displayName:`House ${n}`,visibility:'private'});await svc.saveTourDraft(c,{details:{name:`Route ${n}`,visibility:'private'},stopIds:[]});}
  await svc.actions.saveSearch(c,{name:'My filter',filters:{query:'House'}});await svc.feedback.submit(c,{name:'Member'},{eventKey:'7bd610b3-6673-43c6-9722-165e654f465e',subject:'A useful idea',message:'Help users find houses.',category:'idea'});
  const base=`http://127.0.0.1:${server.address().port}`,cookie=userId=>`addressbook_session=${createSession({id:userId,username:'User',selectedGuildId:'g',guilds:[{id:'g'}]},Date.now(),'s')}`,get=(path,user='u')=>fetch(base+path,{headers:{cookie:cookie(user)},redirect:'manual'});
  for(const [path,expected,key,value,user] of [
   ['/app/houses?page=999&q=House&scope=private&view=list',2,'view','list'],
   ['/app/tours?page=999&q=Route&mine=1',2,'mine','1'],
   ['/app/personal?page=999',2],['/app/personal/submitted?page=999',2],
   ['/app/searches?page=999',1],['/app/catalog?page=999&q=House',1,'q','House','1'],
   ['/app/feedback/review?page=999&status=new',1,'status','new','1']
  ]){
   const response=await get(path,user);assert.equal(response.status,302,path);const location=new URL(response.headers.get('location'),base);assert.equal(location.searchParams.get('page'),String(expected),path);if(key)assert.equal(location.searchParams.get(key),value);
   const final=await get(location.pathname+location.search,user);assert.equal(final.status,200,path);const html=await final.text();assert.doesNotMatch(html,/No houses match|No tours match|No feedback matches/);
  }
  assert.equal((await get('/app/catalog?page=999')).status,403);assert.equal((await get('/app/feedback/review?page=999')).status,403);
 }finally{await new Promise(r=>server.close(r));await closeDatabase(db);}
});
