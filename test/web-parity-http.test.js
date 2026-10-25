import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase,one} from '../src/db/database.js';
import {createWebAdminServer} from '../src/web/server.js';
import {WebAdminService} from '../src/services/web-admin-service.js';
import {createSession,readSession} from '../src/web/session.js';

test('web tools hide unauthorized administration and mutations recheck ownership, CSRF and context',async()=>{
 const {db,svc,c}=await fixture();let roles=[];
 const own=await svc.registerHouse(c,{houseId:1,esoOwner:'@Owner'}),other=await svc.registerHouse({...c,userId:'someone'},{houseId:2,esoOwner:'@Other'});
 const server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async()=>({id:'g',name:'Guild',roleIds:roles,esoServer:'pc_na'})});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const token=createSession({id:'u',username:'Member',guilds:[{id:'g',name:'Guild'}]},Date.now(),'s'),cookie=`addressbook_session=${token}`,csrf=readSession(token,Date.now(),'s').csrf,base=`http://127.0.0.1:${server.address().port}`;
 const get=path=>fetch(base+path,{headers:{cookie},redirect:'manual'}),post=(path,data)=>fetch(base+path,{method:'POST',headers:{cookie},body:new URLSearchParams({csrf,contextGuildId:'g',contextEsoServer:'pc_na',...data}),redirect:'manual'});
 try{
  const home=await get('/app/personal');const html=await home.text();assert.equal(home.status,200);assert.doesNotMatch(html,/href="\/admin"|href="\/app\/settings"|href="\/app\/catalog"/);assert.match(html,/Favorites/);
  const detail=await get(`/app/houses/${own.id}`);assert.match(await detail.text(),/Delete house|Add favorite|Comments/);
  for(const path of ['/app/settings','/app/server-settings','/app/recovery/environment',`/app/houses/${other.id}/delete`,`/app/houses/${other.id}/actions`]){
   const result=path.endsWith('/actions')?await post(path,{action:'comment',text:'forged'}):await get(path);assert.equal(result.status,403,path);
  }
  const deletion=await get(`/app/houses/${own.id}/delete`),page=await deletion.text(),version=/name="version" value="([^"]+)"/.exec(page)[1];
  assert.equal((await post(`/app/houses/${own.id}/delete`,{csrf:'bad',confirm:'delete',version})).status,400);
  assert.equal((await post(`/app/houses/${own.id}/delete`,{contextGuildId:'other',confirm:'delete',version})).status,409);
  assert.ok(await svc.saved.get(own.id));
  roles=['staff'];const admin=await get('/app/settings');const adminHtml=await admin.text();assert.equal(admin.status,200);assert.match(adminHtml,/href="\/admin"/);assert.match(adminHtml,/Server configuration/);
  roles=[];assert.equal((await post('/app/server-settings',{channelId:'',timezone:'UTC'})).status,403);
  const formerlyShared=await svc.registerHouse(await svc.authorizeContext({...c,memberRoleIds:['staff']}),{houseId:2,esoOwner:'@FormerlyShared',visibility:'public'});
  await db.query("UPDATE guild_settings SET registration_policy='roles' WHERE guild_id='g'");
  for(const path of ['/app/register',`/app/houses/${own.id}/visibility`,`/app/houses/${formerlyShared.id}/visibility`]){const response=await get(path),html=await response.text();assert.equal(response.status,200);const options=/<select name="visibility">([\s\S]*?)<\/select>/.exec(html)[1];assert.match(options,/value="private"/);assert.doesNotMatch(options,/value="public"|value="global"/);}
  assert.equal((await post('/app/register',{houseId:1,esoOwner:'@Forged',visibility:'global'})).status,403);
  assert.ok(await svc.saved.get(other.id));
 }finally{await new Promise(r=>server.close(r));await closeDatabase(db);}
});

test('web player shows the current house and rejects stale repeated next without Discord coupling',async()=>{
 const {db,svc,c}=await fixture();const h=await svc.registerHouse(c,{houseId:1,esoOwner:'@A'}),h2=await svc.registerHouse(c,{houseId:2,esoOwner:'@B'}),t=await svc.saveTourDraft(c,{details:{name:'Route',visibility:'private'},stopIds:[h.id,h2.id]});
 const server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async()=>({id:'g',name:'Guild',roleIds:[],esoServer:'pc_na'})});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const token=createSession({id:'u',username:'Member',guilds:[{id:'g',name:'Guild'}]},Date.now(),'s'),cookie=`addressbook_session=${token}`,csrf=readSession(token,Date.now(),'s').csrf,base=`http://127.0.0.1:${server.address().port}`,path=`/app/tours/${t.id}/play`;
 const post=data=>fetch(base+path,{method:'POST',headers:{cookie},body:new URLSearchParams({csrf,contextGuildId:'g',contextEsoServer:'pc_na',...data}),redirect:'manual'});
 try{
  assert.equal((await post({action:'start'})).status,302);
  const first=await fetch(base+path,{headers:{cookie}}),html=await first.text();assert.match(html,/Stop 1 of 2/);assert.match(html,/Jump to this house/);assert.match(html,/House One/);
  const currentStopId=/name="currentStopId" value="(\d+)"/.exec(html)[1];
  assert.equal((await post({action:'next',currentStopId})).status,302);assert.equal((await post({action:'next',currentStopId})).status,409);
  assert.equal(Number((await one(db,'SELECT count(*) c FROM tour_sessions')).c),0);
 }finally{await new Promise(r=>server.close(r));await closeDatabase(db);}
});

test('web links grant only revocable viewing, private copies remain independent, and passes stay scoped',async()=>{
 const {db,svc,c}=await fixture();try{
  const h=await svc.registerHouse(c,{houseId:1,esoOwner:'@A'}),t=await svc.saveTourDraft(c,{details:{name:'Private route',visibility:'private'},stopIds:[h.id]}),viewer=await svc.authorizeContext({...c,userId:'viewer'});
  const house=await svc.actions.createPass(c,'house',h.id),tour=await svc.actions.createPass(c,'tour',t.id);
  assert.ok((await svc.actions.resolvePass(viewer,'house',house.token)).access.passOnly);
  const copied=await svc.actions.copyPass(viewer,'house',house.token,{visibility:'private'});assert.equal(copied.house.owner_user_id,'viewer');
  const copiedTour=await svc.actions.copyPass(viewer,'tour',tour.token,{name:'My copy'});assert.equal(copiedTour.creator_id,'viewer');
  await assert.rejects(()=>svc.actions.deletePreview(viewer,'house',h.id),/not available/);
  await assert.rejects(()=>svc.actions.revokePass(viewer,'house',house.pass.id),/not available/);
  await svc.actions.revokePass(c,'house',house.pass.id);await assert.rejects(()=>svc.actions.resolvePass(viewer,'house',house.token),/revoked/);
  assert.ok(await svc.getHouse(viewer,copied.house.id));
 }finally{await closeDatabase(db);}
});

test('initial web setup matches the Discord environment gate and does not expose administration',async()=>{
 const {db,svc}=await fixture();await db.query('UPDATE guild_settings SET eso_server=NULL WHERE guild_id=?',['g']);
 const server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async()=>({id:'g',name:'Guild',roleIds:[],esoServer:null})});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const token=createSession({id:'u',username:'Member',guilds:[{id:'g',name:'Guild'}]},Date.now(),'s'),cookie=`addressbook_session=${token}`,csrf=readSession(token,Date.now(),'s').csrf,base=`http://127.0.0.1:${server.address().port}`;
 try{
  const page=await fetch(base+'/app',{headers:{cookie}}),html=await page.text();assert.match(html,/Complete initial setup/);assert.doesNotMatch(html,/href="\/admin"|href="\/app\/catalog"/);
  const denied=await fetch(base+'/app/setup',{method:'POST',headers:{cookie},body:new URLSearchParams({csrf:'bad',contextGuildId:'g',contextEsoServer:'',esoServer:'pc_na'}),redirect:'manual'});assert.equal(denied.status,400);assert.equal((await one(db,'SELECT eso_server FROM guild_settings WHERE guild_id=?',['g'])).eso_server,null);
  const done=await fetch(base+'/app/setup',{method:'POST',headers:{cookie},body:new URLSearchParams({csrf,contextGuildId:'g',contextEsoServer:'',esoServer:'pc_na'}),redirect:'manual'});assert.equal(done.status,302);assert.equal((await one(db,'SELECT eso_server FROM guild_settings WHERE guild_id=?',['g'])).eso_server,'pc_na');
 }finally{await new Promise(r=>server.close(r));await closeDatabase(db);}
});

test('official catalog editing is owner-only, previewed, CSRF-bound and rejects stale confirmation',async()=>{
 const {db,svc}=await fixture();const server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async()=>({id:'g',name:'Guild',roleIds:['staff'],esoServer:'pc_na'})});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const token=createSession({id:'1',username:'Owner',guilds:[{id:'g',name:'Guild'}]},Date.now(),'s'),csrf=readSession(token,Date.now(),'s').csrf,cookie=`addressbook_session=${token}`,base=`http://127.0.0.1:${server.address().port}`,path='/app/catalog/1/edit';
 const post=data=>fetch(base+path,{method:'POST',headers:{cookie},body:new URLSearchParams({csrf,contextGuildId:'g',contextEsoServer:'pc_na',...data}),redirect:'manual'});
 try{const response=await fetch(base+path,{headers:{cookie}}),html=await response.text();assert.equal(response.status,200);assert.match(html,/datalist id="catalog-style"/);const version=/name="version" value="([^"]+)"/.exec(html)[1];
 assert.equal((await post({version,name:'Changed',csrf:'bad'})).status,400);assert.equal((await post({version,name:'Changed',contextGuildId:'other'})).status,409);
 const preview=await post({version,name:'Changed',style:'Custom Style'});assert.equal(preview.status,200);assert.match(await preview.text(),/Confirm catalog changes/);assert.equal((await svc.catalog.get(1)).name,'House One');
 assert.equal((await post({version,name:'Changed',style:'Custom Style',confirm:'edit'})).status,200);assert.equal((await svc.catalog.get(1)).name,'Changed');assert.equal((await post({version,name:'Stale',confirm:'edit'})).status,409);
 const member=createSession({id:'u',username:'Staff',guilds:[{id:'g',name:'Guild'}]},Date.now(),'s');assert.equal((await fetch(base+path,{headers:{cookie:`addressbook_session=${member}`}})).status,403);
 }finally{await new Promise(r=>server.close(r));await closeDatabase(db);}
});
