import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './workspace-fixture.js';
import {closeDatabase,one} from '../src/db/database.js';
import {createWebAdminServer} from '../src/web/server.js';
import {WebAdminService} from '../src/services/web-admin-service.js';
import {createSession,readSession} from '../src/web/session.js';

test('feedback form stores escaped private submissions and owner inbox reviews require authorization and CSRF',async()=>{
 const {db,svc}=await fixture();const server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async()=>({id:'g',name:'Guild',roleIds:['staff'],esoServer:'pc_na'})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  const auth=id=>{const token=createSession({id,username:id==='1'?'Owner':'Member',guilds:[{id:'g'}]},Date.now(),'s');return {cookie:`addressbook_session=${token}`,csrf:readSession(token,Date.now(),'s').csrf};};
  const member=auth('u'),owner=auth('1'),other=auth('other');
  const get=(path,a)=>fetch(base+path,{headers:a?{cookie:a.cookie}:{},redirect:'manual'});
  const post=(path,a,fields)=>fetch(base+path,{method:'POST',headers:{cookie:a.cookie},body:new URLSearchParams({csrf:a.csrf,contextGuildId:'g',contextEsoServer:'pc_na',...fields}),redirect:'manual'});
  const landing=await (await get('/')).text();assert.match(landing,/href="\/app\/feedback">Send feedback/);assert.doesNotMatch(landing,/>Open web portal</);
  assert.equal((await get('/app/feedback')).status,302);
  let html=await (await get('/app/feedback',member)).text();assert.match(html,/Send feedback/);assert.doesNotMatch(html,/href="\/app\/feedback\/review"/);
  const fields={eventKey:randomUUID(),category:'bug',subject:'Tour <script>title</script>',message:'First\n\n<script>alert(1)</script>'};
  assert.equal((await post('/app/feedback',member,{...fields,csrf:'wrong'})).status,400);
  assert.equal((await post('/app/feedback',member,fields)).status,302);
  assert.equal((await post('/app/feedback',member,fields)).status,302);
  assert.equal(Number((await one(db,'SELECT count(*) n FROM app_feedback')).n),1);
  html=await (await get('/app/feedback',member)).text();assert.match(html,/Tour &lt;script&gt;/);assert.match(html,/class="user-text">First\n\n&lt;script&gt;/);
  assert.doesNotMatch(await (await get('/app/feedback',other)).text(),/Tour &lt;script&gt;/);
  assert.equal((await get('/app/feedback/review',member)).status,403);
  html=await (await get('/app/feedback/review',owner)).text();assert.match(html,/Tour &lt;script&gt;/);assert.match(html,/Internal notes/);
  const item=await one(db,'SELECT * FROM app_feedback');
  const review={id:item.id,revision:1,status:'resolved',notes:'Private internal note'};
  assert.equal((await post('/app/feedback/review',member,review)).status,403);
  assert.equal((await post('/app/feedback/review',owner,{...review,csrf:'wrong'})).status,400);
  assert.equal((await post('/app/feedback/review',owner,review)).status,302);
  assert.equal((await post('/app/feedback/review',owner,review)).status,409);
  html=await (await get('/app/feedback',member)).text();assert.match(html,/Resolved/);assert.doesNotMatch(html,/Private internal note/);
  const activity=await (await get('/app/activity',member)).text();assert.doesNotMatch(activity,/Tour &lt;script&gt;|Private internal note/);
  assert.match(await (await get('/app/help',member)).text(),/Send feedback/);
  assert.equal((await post('/app/feedback',member,{eventKey:randomUUID(),category:'general',subject:'Unicode feedback',message:'🙂'.repeat(1500)})).status,302);
 }finally{await new Promise(r=>server.close(r));await closeDatabase(db);}
});

test('feedback destination survives choosing a Discord server after login',async()=>{
 const {db,svc}=await fixture();await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g2','pc_na')");
 const server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async({guildId})=>({id:guildId,name:guildId,roleIds:[],esoServer:'pc_na'})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base=`http://127.0.0.1:${server.address().port}`,cookie='addressbook_session='+createSession({id:'u',username:'Member',guilds:[{id:'g'},{id:'g2'}]},Date.now(),'s');
  const picker=await fetch(base+'/app/feedback',{headers:{cookie}});assert.match(await picker.text(),/href="\/app\/feedback\?guildId=g2"/);
  const selection=await fetch(base+'/app/feedback?guildId=g2',{headers:{cookie},redirect:'manual'});assert.equal(selection.headers.get('location'),'/app/feedback');
  const form=await fetch(base+'/app/feedback',{headers:{cookie:selection.headers.get('set-cookie')}});assert.match(await form.text(),/name="message"/);
 }finally{await new Promise(r=>server.close(r));await closeDatabase(db);}
});
