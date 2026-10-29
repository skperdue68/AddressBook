import test from 'node:test';import assert from 'node:assert/strict';
import {previewChoices,applyPermissionPreview} from '../src/services/permission-preview.js';
const owner={userId:'1',guildId:'g',guildName:'Guild',esoServer:'pc_na',isOwner:true,isGlobalAdmin:true,isServerAdmin:true,memberRoleIds:['staff'],roles:[],settings:{},setupAuthority:true,canClaimFirstAdmin:true};
test('preview caps each role independently and drops trusted role and setup authority',()=>{
 assert.deepEqual(previewChoices(owner).map(x=>x.value),['full','guest','member','server','global']);
 const member=applyPermissionPreview(owner,'member');assert.equal(member.isOwner,false);assert.equal(member.isServerAdmin,false);assert.equal(member.isGlobalAdmin,false);assert.deepEqual(member.memberRoleIds,[]);assert.equal(member.canClaimFirstAdmin,false);
 const global=applyPermissionPreview(owner,'global');assert.equal(global.isGlobalAdmin,true);assert.equal(global.isServerAdmin,false);assert.equal(global.isOwner,false);
 const server=applyPermissionPreview(owner,'server');assert.equal(server.isServerAdmin,true);assert.equal(server.isGlobalAdmin,false);
});
test('preview cannot invent grants and revoked grants fall back to member',()=>{
 const ordinary={...owner,isOwner:false,isGlobalAdmin:false,isServerAdmin:false};assert.deepEqual(previewChoices(ordinary).map(x=>x.value),['full','guest','member']);
 assert.equal(applyPermissionPreview(ordinary,'global').permissionPreview,'member');assert.equal(applyPermissionPreview(ordinary,'global').isGlobalAdmin,false);
 assert.equal(applyPermissionPreview(owner,'full'),owner);
});

import {fixture} from './workspace-fixture.js';import {closeDatabase} from '../src/db/database.js';import {createWebAdminServer} from '../src/web/server.js';import {WebAdminService} from '../src/services/web-admin-service.js';import {createSession,readSession} from '../src/web/session.js';
test('HTTP preview uses signed preferences, caps menus and direct URLs, rejects writes, and restores access',async t=>{
 const {db,svc,c}=await fixture();t.after(()=>closeDatabase(db));let liveRoles=[];
 const server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'preview'},resolveGuildMembership:async()=>({id:'g',name:'Guild',roleIds:liveRoles,esoServer:'pc_na'})});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const base=`http://127.0.0.1:${server.address().port}`;let token=createSession({id:'1',username:'Owner',selectedGuildId:'g',guilds:[{id:'g'}]},Date.now(),'preview');
 const get=path=>fetch(base+path,{headers:{cookie:'addressbook_session='+token},redirect:'manual'});
 const select=async(level,csrf=readSession(token,Date.now(),'preview').csrf)=>fetch(base+'/app/access-preview',{method:'POST',headers:{cookie:'addressbook_session='+token},body:new URLSearchParams({level,csrf}),redirect:'manual'});
 assert.match(await (await get('/app')).text(),/Explore with lower access/);assert.equal((await select('member','bad')).status,400);
 let response=await select('member');assert.equal(response.status,302);token=response.headers.get('set-cookie').split(';')[0].split('=')[1];
 const html=await (await get('/app')).text();assert.match(html,/Previewing as Member/);assert.doesNotMatch(html,/>Administration<|>House Catalog<|>Feedback inbox</);
 for(const path of ['/admin','/app/catalog','/app/feedback/review','/app/global-access'])assert.equal((await get(path)).status,403,path);
 const write=await fetch(base+'/app/register',{method:'POST',headers:{cookie:'addressbook_session='+token},body:new URLSearchParams({csrf:readSession(token,Date.now(),'preview').csrf}),redirect:'manual'});assert.equal(write.status,403);assert.match(await write.text(),/read-only/);
 response=await select('guest');token=response.headers.get('set-cookie').split(';')[0].split('=')[1];assert.equal((await get('/app')).headers.get('location'),'/browse');const guest=await (await get('/browse')).text();assert.match(guest,/Previewing as Guest/);const privateHouse=await svc.registerHouse(c,{houseId:1,esoOwner:'PrivatePreview',visibility:'private'});assert.equal((await get('/browse/houses/'+privateHouse.id)).status,404);assert.match(guest,/Restore my access/);
 response=await select('full');token=response.headers.get('set-cookie').split(';')[0].split('=')[1];assert.match(await (await get('/app')).text(),/>Administration</);
 // A signed session does not grant a Member a higher preview level.
 token=createSession({id:c.userId,username:'Member',selectedGuildId:'g',guilds:[{id:'g'}]},Date.now(),'preview');assert.equal((await select('global')).status,403);
 liveRoles=['staff'];response=await select('member');token=response.headers.get('set-cookie').split(';')[0].split('=')[1];response=await select('server');assert.equal(response.status,302);token=response.headers.get('set-cookie').split(';')[0].split('=')[1];assert.equal((await get('/app/settings')).status,200);
 liveRoles=[];assert.equal((await get('/app/settings')).status,403);assert.equal((await select('server')).status,403);
});
test('workspace refresh rechecks real grants and preserves the lower preview cap',async t=>{
 const {db,svc,c}=await fixture();t.after(()=>closeDatabase(db));const ownerContext=await svc.authorizeContext({...c,userId:'1',permissionPreview:'member'});assert.equal((await svc.fresh(ownerContext)).isOwner,false);
 const staffContext=await svc.authorizeContext({...c,memberRoleIds:['staff'],permissionPreview:'server'});assert.equal(staffContext.isServerAdmin,true);assert.equal((await svc.fresh(staffContext)).isServerAdmin,true);assert.deepEqual(staffContext.memberRoleIds,[]);
 await db.query("INSERT INTO global_moderators(discord_user_id,eso_server,approved_by) VALUES('u','pc_na','1')");const global=await svc.authorizeContext({...c,permissionPreview:'global'});assert.equal(global.isGlobalAdmin,true);
 await db.query("DELETE FROM global_moderators WHERE discord_user_id='u'");const revoked=await svc.fresh(global);assert.equal(revoked.permissionPreview,'member');assert.equal(revoked.isGlobalAdmin,false);
});
