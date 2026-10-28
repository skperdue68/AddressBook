import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase,one} from '../src/db/database.js';
import {createWebAdminServer} from '../src/web/server.js';
import {WebAdminService} from '../src/services/web-admin-service.js';
import {createSession,readSession} from '../src/web/session.js';

async function serverFixture(t){
 const f=await fixture();await f.db.query("UPDATE guild_settings SET staff_role_ids='[]' WHERE guild_id='g'");await f.db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('other','pc_na')");
 const authority=new Map(),lookups=[];
 const server=createWebAdminServer({service:new WebAdminService(f.db),workspace:f.svc,config:{sessionSecret:'test-secret'},resolveGuildMembership:async args=>{lookups.push(args);return {id:args.guildId,name:args.guildId,esoServer:'pc_na',roleIds:[],setupAuthority:authority.get(`${args.guildId}:${args.userId}`)===true,member:{id:String(args.userId),displayName:`Person ${args.userId}`}};}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{await new Promise(resolve=>server.close(resolve));await closeDatabase(f.db);});
 const base=`http://127.0.0.1:${server.address().port}`;
 const session=(id,extra={})=>{const token=createSession({id,username:`Person ${id}`,guilds:[{id:'g'},{id:'other'}],selectedGuildId:'g',...extra},Date.now(),'test-secret');return {cookie:`addressbook_session=${token}`,csrf:readSession(token,Date.now(),'test-secret').csrf};};
 const request=(auth,path,body=null)=>fetch(base+path,{headers:{cookie:auth.cookie},redirect:'manual',...(body?{method:'POST',body}:{} )});
 const claim=(auth,extra={})=>new URLSearchParams({csrf:auth.csrf,contextGuildId:'g',contextEsoServer:'pc_na',confirm:'claim',...extra});
 return {...f,authority,lookups,session,request,claim};
}

test('ordinary members cannot bootstrap with forged session or body authority and retain ordinary access',async t=>{
 const f=await serverFixture(t),auth=f.session('ordinary',{setupAuthority:true,isServerAdmin:true,canClaimFirstAdmin:true});
 const house=await f.svc.saved.createPublic({guildId:'g',esoServer:'pc_na',houseId:1,esoOwner:'SomeoneElse',createdBy:'else'});
 assert.equal((await f.request(auth,'/app')).status,200);assert.equal((await f.request(auth,'/app/settings')).status,403);assert.equal((await f.request(auth,`/app/houses/${house.id}/edit`)).status,403);
 assert.equal((await f.request(auth,'/app/setup-admin')).status,403);
 const forged=await f.request(auth,'/app/setup-admin',f.claim(auth,{setupAuthority:'true',isServerAdmin:'true',canClaimFirstAdmin:'true'}));assert.ok(forged.status>=400);assert.match(await forged.text(),/verified Discord server owner|Manage Server/);
 assert.equal((await one(f.db,'SELECT count(*) n FROM server_moderators')).n,0);assert.ok(f.lookups.some(args=>args.userId==='ordinary'&&args.strict===true));
});

test('eligible first admin explicitly claims current server after strict verification before editing rights activate',async t=>{
 const f=await serverFixture(t),auth=f.session('initial');f.authority.set('g:initial',true);
 const house=await f.svc.saved.createPublic({guildId:'g',esoServer:'pc_na',houseId:1,esoOwner:'Other',createdBy:'else'});
 const support=await (await f.request(auth,'/app/support')).text();assert.match(support,/href="\/app\/setup-admin"/);assert.match(support,/\/app\/request-access\?kind=global/);assert.match(support,/\/app\/guide/);
 assert.equal((await f.request(auth,'/app/settings')).status,403);assert.equal((await f.request(auth,`/app/houses/${house.id}/edit`)).status,403);
 const setup=await f.request(auth,'/app/setup-admin');assert.equal(setup.status,200);assert.match(await setup.text(),/Confirm administrator setup/);
 const before=f.lookups.length,result=await f.request(auth,'/app/setup-admin',f.claim(auth));assert.equal(result.status,302);assert.equal(result.headers.get('location'),'/app/settings?adminReady=1');assert.ok(f.lookups.slice(before).some(args=>args.strict===true&&args.guildId==='g'&&args.userId==='initial'));
 assert.equal((await one(f.db,"SELECT count(*) n FROM server_moderators WHERE guild_id='g' AND discord_user_id='initial'")).n,1);assert.equal((await one(f.db,"SELECT count(*) n FROM server_moderators WHERE guild_id='other'")).n,0);
 assert.equal((await one(f.db,"SELECT count(*) n FROM audit_log WHERE action='claim_first_server_admin' AND guild_id='g'")).n,1);
 assert.equal((await f.request(auth,'/app/settings')).status,200);assert.equal((await f.request(auth,`/app/houses/${house.id}/edit`)).status,200);
});

test('initial setup rejects permissions revoked since preview and concurrent claims produce only one grant',async t=>{
 const f=await serverFixture(t),revoked=f.session('revoked');f.authority.set('g:revoked',true);assert.equal((await f.request(revoked,'/app/setup-admin')).status,200);f.authority.set('g:revoked',false);
 const rejected=await f.request(revoked,'/app/setup-admin',f.claim(revoked));assert.ok(rejected.status>=400);assert.equal((await one(f.db,'SELECT count(*) n FROM server_moderators')).n,0);
 const first=f.session('first'),second=f.session('second');f.authority.set('g:first',true);f.authority.set('g:second',true);
 const responses=await Promise.all([f.request(first,'/app/setup-admin',f.claim(first)),f.request(second,'/app/setup-admin',f.claim(second))]);assert.equal(responses.filter(r=>r.status===302).length,1);assert.equal(responses.filter(r=>r.status>=400).length,1);
 assert.equal((await one(f.db,"SELECT count(*) n FROM server_moderators WHERE guild_id='g'")).n,1);assert.equal((await one(f.db,"SELECT count(*) n FROM server_moderators WHERE guild_id='other'")).n,0);
});

test('bot owner setup needs no native permission and Server and Global request entry points stay explicit and pending',async t=>{
 const f=await serverFixture(t),owner=f.session('1');assert.equal((await f.request(owner,'/app/setup-admin')).status,200);assert.equal((await f.request(owner,'/app/setup-admin',f.claim(owner))).status,302);
 const applicant=f.session('applicant'),support=await (await f.request(applicant,'/app/support')).text();assert.match(support,/\/app\/request-access\?kind=server/);assert.match(support,/\/app\/request-access\?kind=global/);
 for(const kind of ['server','global']){
  const response=await f.request(applicant,`/app/request-access?kind=${kind}`);assert.equal(response.status,200);const html=await response.text();assert.match(html,new RegExp(`name="kind" value="${kind}"`));assert.doesNotMatch(html,new RegExp(`name="kind" value="${kind==='server'?'global':'server'}"`));
  const body=f.claim(applicant,{kind,reason:`Help with ${kind}`});body.delete('confirm');const submitted=await f.request(applicant,`/app/request-access?kind=${kind}`,body);assert.equal(submitted.status,302);assert.equal(submitted.headers.get('location'),`/app/request-access?saved=1&kind=${kind}`);
 }
 assert.equal((await one(f.db,"SELECT count(*) n FROM server_moderator_requests WHERE discord_user_id='applicant' AND guild_id='g' AND status='pending'")).n,1);
 assert.equal((await one(f.db,"SELECT count(*) n FROM global_moderator_requests WHERE discord_user_id='applicant' AND eso_server='pc_na' AND status='pending'")).n,1);
 assert.equal((await one(f.db,"SELECT count(*) n FROM server_moderators WHERE discord_user_id='applicant'")).n,0);assert.equal((await one(f.db,"SELECT count(*) n FROM global_moderators WHERE discord_user_id='applicant'")).n,0);
});

test('routine pages prompt only eligible first-server administrators, not bot owners or ordinary members',async t=>{
 const f=await serverFixture(t),owner=f.session('1'),ordinary=f.session('ordinary'),eligible=f.session('server-owner');
 const ownerPage=await(await f.request(owner,'/app')).text();assert.doesNotMatch(ownerPage,/class="setup-banner"/);assert.match(ownerPage,/Bot Owner/);
 assert.doesNotMatch(await(await f.request(ordinary,'/app')).text(),/class="setup-banner"/);
 f.authority.set('g:server-owner',true);assert.match(await(await f.request(eligible,'/app')).text(),/class="setup-banner"/);
 assert.match(await(await f.request(owner,'/app/support')).text(),/Set up Server administration/);assert.equal((await f.request(owner,'/app/setup-admin')).status,200);
});
