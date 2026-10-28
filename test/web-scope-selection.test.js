import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {createWebAdminServer} from '../src/web/server.js';
import {WebAdminService} from '../src/services/web-admin-service.js';
import {createSession,readSession} from '../src/web/session.js';

test('visibility selection cannot submit an older hidden target and confirmation clearly names the selected target',async()=>{
 const {db,svc,c}=await fixture(),owner=await svc.authorizeContext({...c,userId:'1'}),h=await svc.registerHouse(owner,{houseId:1,esoOwner:'@Owner',visibility:'global'});
 const server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async()=>({id:'g',name:'Guild',roleIds:[],esoServer:'pc_na'})});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base=`http://127.0.0.1:${server.address().port}`,token=createSession({id:'1',username:'Owner',guilds:[{id:'g'}]},Date.now(),'s'),cookie='addressbook_session='+token,csrf=readSession(token,Date.now(),'s').csrf,path=`/app/houses/${h.id}/visibility`;
  const initial=await (await fetch(base+path,{headers:{cookie}})).text();assert.doesNotMatch(initial,/value="change"|Confirm visibility change/);assert.match(initial,/Preview impact/);
  const preview=await (await fetch(base+path,{method:'POST',headers:{cookie},body:new URLSearchParams({csrf,contextGuildId:'g',contextEsoServer:'pc_na',confirm:'preview',visibility:'public'})})).text();
  assert.match(preview,/Confirm change to Server/);assert.doesNotMatch(preview,/<select name="visibility">/);
  const version=/name="version" value="([^"]+)"/.exec(preview)[1];
  const result=await fetch(base+path,{method:'POST',headers:{cookie},body:new URLSearchParams({csrf,contextGuildId:'g',contextEsoServer:'pc_na',confirm:'change',visibility:'public',version}),redirect:'manual'});assert.equal(result.status,302);assert.equal((await svc.saved.get(h.id)).scope,'public');
 }finally{await new Promise(r=>server.close(r));await closeDatabase(db);}
});
