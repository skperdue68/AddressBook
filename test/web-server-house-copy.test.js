import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase,one} from '../src/db/database.js';
import {createWebAdminServer} from '../src/web/server.js';
import {WebAdminService} from '../src/services/web-admin-service.js';
import {createSession,readSession} from '../src/web/session.js';

test('web server copy lists only authorized guilds, previews, confirms and rechecks destination membership',async()=>{
 const {db,svc,c}=await fixture();let destinationMember=true;
 await db.query("INSERT INTO guild_settings(guild_id,eso_server,staff_role_ids) VALUES('g2','pc_na','[\"staff\"]'),('g3','pc_eu','[\"staff\"]')");
 const owner=await svc.authorizeContext({...c,userId:'1'}),house=await svc.registerHouse(owner,{houseId:1,esoOwner:'@Builder',visibility:'public'}),second=await svc.registerHouse(owner,{houseId:2,esoOwner:'@Another',visibility:'public'});
 const server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async({guildId})=>guildId==='g2'&&!destinationMember?null:{id:guildId,name:guildId==='g2'?'Destination Guild':'Source Guild',roleIds:[],esoServer:guildId==='g3'?'pc_eu':'pc_na'}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  const auth=id=>{const token=createSession({id,username:'Member',selectedGuildId:'g',guilds:[{id:'g'},{id:'g2'},{id:'g3'}]},Date.now(),'s');return {cookie:'addressbook_session='+token,csrf:readSession(token,Date.now(),'s').csrf};};
  const a=auth('1'),member=auth('u'),get=(path,actor=a)=>fetch(base+path,{headers:{cookie:actor.cookie},redirect:'manual'}),post=(path,fields,actor=a)=>fetch(base+path,{method:'POST',headers:{cookie:actor.cookie},body:new URLSearchParams({csrf:actor.csrf,contextGuildId:'g',contextEsoServer:'pc_na',...fields}),redirect:'manual'}),path=`/app/houses/${house.id}/copy-server`;
  assert.match(await (await get(`/app/houses/${house.id}`)).text(),/Copy to another server/);
  assert.doesNotMatch(await (await get(`/app/houses/${house.id}`,member)).text(),/Copy to another server/);
  assert.equal((await get(path,member)).status,403);
  const picker=await (await get(path)).text();assert.match(picker,/value="g2"/);assert.doesNotMatch(picker,/value="g3"/);
  assert.equal((await post(path,{targetGuildId:'invented'})).status,403);
  const preview=await (await post(path,{targetGuildId:'g2'})).text();assert.match(preview,/Confirm copy to Destination Guild/);assert.match(preview,/source registration and tour stops stay/);
  const version=/name="version" value="([^"]+)"/.exec(preview)[1];
  assert.equal((await post(path,{targetGuildId:'g2',confirm:'copy',version,csrf:'wrong'})).status,400);
  const copied=await post(path,{targetGuildId:'g2',confirm:'copy',version});assert.equal(copied.status,200);assert.match(await copied.text(),/guildId=g2/);
  assert.equal(Number((await one(db,"SELECT count(*) n FROM saved_houses WHERE guild_id='g2'")).n),1);
  const secondPath=`/app/houses/${second.id}/copy-server`,p2=await (await post(secondPath,{targetGuildId:'g2'})).text(),v2=/name="version" value="([^"]+)"/.exec(p2)[1];
  destinationMember=false;assert.equal((await post(secondPath,{targetGuildId:'g2',confirm:'copy',version:v2})).status,403);
  assert.equal(Number((await one(db,"SELECT count(*) n FROM saved_houses WHERE guild_id='g2'")).n),1);
 }finally{await new Promise(r=>server.close(r));await closeDatabase(db);}
});

test('HTTP copy previews departed submitter replacement and records destination member names',async()=>{
 const {db,svc,c}=await fixture();
 await db.query("INSERT INTO guild_settings(guild_id,eso_server,staff_role_ids) VALUES('g2','pc_na','[\"staff\"]')");
 const house=await svc.registerHouse(c,{houseId:1,esoOwner:'@Departed',visibility:'public'});
 await db.query("UPDATE saved_houses SET status='active' WHERE id=?",[house.id]);
 const server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async({userId,guildId})=>userId===c.userId&&guildId==='g2'?null:{id:guildId,name:guildId,roleIds:[],esoServer:'pc_na',member:{id:userId,username:'Owner',globalName:'Owner Name',displayName:'Destination Owner'}}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
  const token=createSession({id:'1',username:'Owner',selectedGuildId:'g',guilds:[{id:'g'},{id:'g2'}]},Date.now(),'s'),csrf=readSession(token,Date.now(),'s').csrf;
  const url=`http://127.0.0.1:${server.address().port}/app/houses/${house.id}/copy-server`;
  const post=fields=>fetch(url,{method:'POST',headers:{cookie:'addressbook_session='+token},body:new URLSearchParams({csrf,contextGuildId:'g',contextEsoServer:'pc_na',targetGuildId:'g2',...fields}),redirect:'manual'});
  const preview=await (await post({})).text();assert.match(preview,/Destination Owner/);assert.match(preview,/original submitter is not a member/);
  const version=/name="version" value="([^"]+)"/.exec(preview)[1];assert.equal((await post({confirm:'copy',version})).status,200);
  const copied=await one(db,"SELECT created_by,created_by_global_name,created_by_display_name FROM saved_houses WHERE guild_id='g2'");
  assert.equal(copied.created_by,'1');assert.equal(copied.created_by_global_name,'Owner Name');assert.equal(copied.created_by_display_name,'Destination Owner');
 }finally{await new Promise(r=>server.close(r));await closeDatabase(db);}
});
