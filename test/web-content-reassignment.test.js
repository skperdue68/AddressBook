import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {createWebAdminServer} from '../src/web/server.js';
import {WebAdminService} from '../src/services/web-admin-service.js';
import {createSession,readSession} from '../src/web/session.js';

test('web reassignment uses live candidate membership, preview, CSRF and shared-only controls',async()=>{
 const {db,svc,c}=await fixture(),candidate='123456789012345678';let present=true;
 const owner=await svc.fresh({...c,userId:'1'}),house=await svc.registerHouse(owner,{houseId:1,esoOwner:'Builder',visibility:'public'}),privateHouse=await svc.registerHouse(owner,{houseId:2,esoOwner:'PrivateBuilder',visibility:'private'});
 const server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async({guildId,userId,strict})=>strict&&userId===candidate&&!present?null:{id:guildId,name:'Guild',roleIds:[],esoServer:'pc_na',member:{id:userId,displayName:'New Submitter'}}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const token=createSession({id:'1',selectedGuildId:'g',guilds:[{id:'g'}]},Date.now(),'s'),csrf=readSession(token,Date.now(),'s').csrf,base=`http://127.0.0.1:${server.address().port}`,headers={cookie:'addressbook_session='+token};
  const get=p=>fetch(base+p,{headers}),post=(p,data)=>fetch(base+p,{method:'POST',headers,body:new URLSearchParams({csrf,contextGuildId:'g',contextEsoServer:'pc_na',...data}),redirect:'manual'}),path=`/app/houses/${house.id}/reassign`;
  assert.match(await(await get(`/app/houses/${house.id}`)).text(),/Change submitter/);
  assert.doesNotMatch(await(await get(`/app/houses/${privateHouse.id}`)).text(),/Change submitter/);
  const preview=await(await post(path,{memberId:candidate})).text();assert.match(preview,/New Submitter/);const version=/name="version" value="([^"]+)"/.exec(preview)[1];
  assert.equal((await post(path,{memberId:candidate,confirm:'reassign',version,csrf:'bad'})).status,400);
  present=false;await post(path,{memberId:candidate,confirm:'reassign',version});assert.equal((await svc.saved.get(house.id)).created_by,'1');
  present=true;const result=await post(path,{memberId:candidate,confirm:'reassign',version});assert.equal(result.status,200);assert.match(await result.text(),/Reassignment saved/);assert.equal((await svc.saved.get(house.id)).created_by,candidate);
  assert.equal((await svc.saved.get(privateHouse.id)).created_by,'1');
 }finally{await new Promise(r=>server.close(r));await closeDatabase(db);}
});
