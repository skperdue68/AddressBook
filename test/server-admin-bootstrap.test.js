import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase,one} from '../src/db/database.js';
import {GuildService} from '../src/services/guild-service.js';
import {resolveCurrentGuildMembership} from '../src/web/guild-membership.js';

test('an unconfigured server grants no implicit editing authority; first claim is verified and atomic',async()=>{
 const {db,svc,c}=await fixture();try{
 await db.query("UPDATE guild_settings SET staff_role_ids='[]' WHERE guild_id='g'");
 const ordinary=await svc.authorizeContext(c);
 assert.equal(ordinary.bootstrap,false);assert.equal(ordinary.isServerAdmin,false);assert.equal(ordinary.adminSetupRequired,true);assert.equal(ordinary.canClaimFirstAdmin,false);
 const guilds=new GuildService(db,{env:{BOT_OWNER_IDS:'1'}});await guilds.ensureSettings('g');
 assert.equal(guilds.canAdmin({guildId:'g',user:{id:'u'},member:{roles:{cache:new Map()},permissions:{has:()=>true}}}),false);
 await assert.rejects(svc.policy.server.claimFirstAdmin({guildId:'g',userId:'u'}),/verified|owner|Manage Server/i);
 const claims=await Promise.allSettled(['first','second'].map(userId=>svc.policy.server.claimFirstAdmin({guildId:'g',userId,setupAuthority:true})));
 assert.equal(claims.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await one(db,"SELECT count(*) c FROM server_moderators WHERE guild_id='g'")).c,1);
 assert.equal((await svc.authorizeContext({...c,setupAuthority:true})).isServerAdmin,false);
 assert.equal((await svc.authorizeContext({...c,setupAuthority:true})).canClaimFirstAdmin,false);
 }finally{await closeDatabase(db);}
});

test('membership setup authority comes from a fresh Discord owner or ManageGuild check',async()=>{
 let manage=false,memberFetch=0;
 const guild={id:'g',name:'Guild',ownerId:'owner',members:{fetch:async options=>{assert.equal(options.force,true);memberFetch++;return {id:options.user,roles:{cache:new Map()},permissions:{has:()=>manage}};}}};
 const args={client:{guilds:{cache:new Map([['g',guild]])}},guilds:{ensureSettings:async()=>({eso_server:'pc_na'})},guildId:'g',userId:'ordinary',strict:true};
 assert.equal((await resolveCurrentGuildMembership(args)).setupAuthority,false);
 manage=true;assert.equal((await resolveCurrentGuildMembership(args)).setupAuthority,true);
 manage=false;assert.equal((await resolveCurrentGuildMembership({...args,userId:'owner'})).setupAuthority,true);
 assert.equal(memberFetch,3);
});

test('Discord claim rechecks live authority and does not trust stale interaction permissions',async()=>{
 const {db}=await fixture();try{
 await db.query("UPDATE guild_settings SET staff_role_ids='[]' WHERE guild_id='g'");
 const guilds=new GuildService(db,{env:{BOT_OWNER_IDS:'1'}});
 let liveManage=false,fetches=0;
 const guild={id:'g',ownerId:'owner',fetch:async()=>guild,members:{fetch:async()=>{fetches++;return {permissions:{has:()=>liveManage}};}}};
 const i={guildId:'g',guild,user:{id:'u'},member:{roles:{cache:new Map()},permissions:{has:()=>true}}};
 await assert.rejects(guilds.claimFirstAdmin(i),/verified|owner|Manage Server/i);
 assert.equal((await one(db,'SELECT count(*) c FROM server_moderators')).c,0);
 liveManage=true;await guilds.claimFirstAdmin(i);assert.equal(guilds.canAdmin(i),true);assert.equal(fetches,2);
 const different={...i,user:{id:'different'}};assert.equal(guilds.canAdmin(different),false);
 await assert.rejects(guilds.claimFirstAdmin(different),/already configured/);
 }finally{await closeDatabase(db);}
});

test('configured bot owners can seed first access and configured staff roles close first setup',async()=>{
 const {db,svc}=await fixture();try{
 await assert.rejects(svc.policy.server.claimFirstAdmin({guildId:'g',userId:'1'}),/already configured/);
 await db.query("UPDATE guild_settings SET staff_role_ids='[]' WHERE guild_id='g'");
 await svc.policy.server.claimFirstAdmin({guildId:'g',userId:'1'});
 assert.equal((await svc.policy.server.access({guildId:'g',userId:'1'})).hasGrant,true);
 assert.equal((await one(db,"SELECT count(*) c FROM audit_log WHERE action='claim_first_server_admin'")).c,1);
 }finally{await closeDatabase(db);}
});
