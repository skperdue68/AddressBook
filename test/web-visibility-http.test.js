import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {createWebAdminServer} from '../src/web/server.js';
import {WebAdminService} from '../src/services/web-admin-service.js';
import {createSession} from '../src/web/session.js';

const confirmation = html => {
 const form = /<form method="post"[^>]*>([\s\S]*?)Confirm change to [^<]+<\/button><\/form>/.exec(html);
 assert.ok(form, 'visibility preview supplies a confirmation form');
 return new URLSearchParams([...form[1].matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"[^>]*>/g)].map(([,name,value])=>[name,value]));
};

test('visibility HTTP preview and emitted confirmation work for creators and administrators under registration policies',async()=>{
 const {db,svc,c}=await fixture();let actor='u',roles=[];
 await db.query("INSERT INTO global_moderators(discord_user_id,eso_server,approved_by) VALUES('global-admin','pc_na','1')");
 const server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async()=>({id:'g',name:'Guild',roleIds:roles,esoServer:'pc_na'})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const cookie=()=>`addressbook_session=${createSession({id:actor,username:'Member',guilds:[{id:'g',name:'Guild'}]},Date.now(),'s')}`;
 try{
  for(const scenario of [
   {actor:'u',roles:[],source:'private',target:'public',policy:'approval',status:'pending'},
   {actor:'u',roles:['staff'],source:'public',target:'private',policy:'roles',status:'active'},
   {actor:'1',roles:[],source:'private',target:'global',policy:'roles',status:'active'},
   {actor:'staff-admin',roles:['staff'],source:'public',target:'global',policy:'roles',status:'active'},
   {actor:'global-admin',roles:[],source:'global',target:'private',policy:'approval',status:'active'},
  ]){
   actor=scenario.actor;roles=scenario.roles;
   await db.query('UPDATE guild_settings SET registration_policy=? WHERE guild_id=?',[scenario.policy,'g']);
   const creator=await svc.authorizeContext({...c,userId:scenario.source==='private'?actor:scenario.actor==='u'?'u':'1',memberRoleIds:['staff']});
   const house=await svc.registerHouse(creator,{houseId:1,esoOwner:`@${actor}-${scenario.target}`,visibility:scenario.source});
   const path=`/app/houses/${house.id}/visibility`,sessionCookie=cookie();
   const preview=await fetch(`${base}${path}?visibility=${scenario.target}`,{headers:{cookie:sessionCookie},redirect:'manual'});
   const html=await preview.text();assert.equal(preview.status,200,html);
   const form=confirmation(html);assert.equal(form.get('visibility'),scenario.target);
   assert.equal(form.get('contextGuildId'),'g');assert.equal(form.get('contextEsoServer'),'pc_na');assert.ok(form.get('csrf'));
   const response=await fetch(base+path,{method:'POST',headers:{cookie:sessionCookie},body:form,redirect:'manual'});
   assert.equal(response.status,302,await response.text());
   const changed=await svc.saved.get(house.id);assert.equal(changed.scope,scenario.target);assert.equal(changed.status,scenario.status);
   if(scenario.target==='private')assert.equal(changed.owner_user_id,creator.userId);
  }
 }finally{await new Promise(r=>server.close(r));await closeDatabase(db);}
});

test('visibility confirmation rejects changed impact, invalid CSRF and changed context without mutating the house',async()=>{
 const {db,svc,c}=await fixture();const house=await svc.registerHouse(c,{houseId:1,esoOwner:'@Unchanged',visibility:'private'});
 const server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async()=>({id:'g',name:'Guild',roleIds:[],esoServer:'pc_na'})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`,path=`/app/houses/${house.id}/visibility`,cookie=`addressbook_session=${createSession({id:'u',username:'Member',guilds:[{id:'g',name:'Guild'}]},Date.now(),'s')}`;
 try{
  const preview=await fetch(`${base}${path}?visibility=public`,{headers:{cookie}}),form=confirmation(await preview.text());
  const post=body=>fetch(base+path,{method:'POST',headers:{cookie},body,redirect:'manual'});
  const badCsrf=new URLSearchParams(form);badCsrf.set('csrf','bad');assert.equal((await post(badCsrf)).status,400);
  const badContext=new URLSearchParams(form);badContext.set('contextGuildId','other');assert.equal((await post(badContext)).status,409);
  await svc.updateHouse(c,house.id,{displayName:'Changed after preview'});
  const stale=await post(form);assert.equal(stale.status,409);assert.match(await stale.text(),/visibility impact changed/);
  assert.equal((await svc.saved.get(house.id)).scope,'private');
 }finally{await new Promise(r=>server.close(r));await closeDatabase(db);}
});
