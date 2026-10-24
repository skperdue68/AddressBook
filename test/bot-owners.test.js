import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,migrate,closeDatabase} from '../src/db/database.js';
import {GuildService} from '../src/services/guild-service.js';
import {GlobalModeratorService} from '../src/services/global-moderator-service.js';
import {WebAdminService} from '../src/services/web-admin-service.js';
import {createHousingMenu} from '../src/ui/housing-menu.js';
const owner='111111111111111111',second='222222222222222222',env={BOT_OWNER_IDS:`${owner}, ${second}`,GLOBAL_MODERATOR_APPROVER_USER_IDS:'legacy'};
async function fixture(t){const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:':memory:'});t.after(()=>closeDatabase(db));await migrate(db);await db.query(`INSERT INTO guild_settings(guild_id,eso_server,registration_policy,staff_role_ids,registration_role_ids,tour_role_ids,bot_channel_id) VALUES('g','pc_na','roles','["staff"]','["trusted"]','["tours"]','housing')`);return db;}
const interaction=id=>({guildId:'g',channelId:'other',user:{id},member:{roles:{cache:new Map()}}});
test('owner configuration accepts one or multiple Discord IDs and rejects names',async()=>{
 const {botOwnerIds}=await import('../src/config/bot-owners.js');assert.deepEqual([...botOwnerIds({BOT_OWNER_IDS:owner})],[owner]);assert.deepEqual([...botOwnerIds({BOT_OWNER_IDS:`${owner}, ${second} ${owner}`})],[owner,second]);assert.throws(()=>botOwnerIds({BOT_OWNER_IDS:'role-name'}),/Discord.*ID|BOT_OWNER_IDS/i);assert.equal(botOwnerIds({}).size,0);
});
test('owners receive every HearthBound role permission and role-free web access',async t=>{
 const db=await fixture(t),guilds=new GuildService(db,{env});await guilds.ensureSettings('g');const i=interaction(owner);await guilds.ensureModeratorAccess(i);
 for(const method of ['isModerator','canAdmin','hasTrustedSubmitterRole','hasHousingToursRole','canBypassHousingChannel','canRunSharedPublicTour'])assert.equal(guilds[method](i),true,method);
 assert.deepEqual(guilds.canRegister(i),{allowed:true,status:'active'});assert.equal((await guilds.serverModerators.access({guildId:'g',userId:owner,roleIds:[]})).canReviewRequests,true);
 const web=new WebAdminService(db,{guilds});const args={guildId:'g',requestedGuildId:'g',esoServer:'pc_na',requestedEsoServer:'pc_na',userId:owner,memberRoleIds:[]};assert.equal((await web.authorizeGuild(args)).allowed,true);assert.equal((await web.authorizeGuild({...args,userId:'ordinary'})).allowed,false);
});
test('owners automatically moderate every environment and approve or revoke scoped Global admins',async t=>{
 const db=await fixture(t),mods=new GlobalModeratorService(db,env);assert.equal(mods.isApprover(owner),true);await assert.rejects(mods.ensureUser(owner,'invalid-environment'),/ESO|environment/i);assert.throws(()=>mods.isGlobalModeratorCached(owner,'invalid-environment'),/ESO|environment/i);
 for(const server of ['pc_na','pc_eu','xbox_na','pts']){assert.equal(await mods.ensureUser(owner,server),true);assert.equal(mods.isGlobalModeratorCached(owner,server),true);}
 const request=await mods.requestAccess({userId:'applicant',guildId:'g',esoServer:'pc_na',reason:'Help members'});await mods.approve(request.id,owner);assert.equal(await mods.ensureUser('applicant','pc_na'),true);assert.equal(await mods.ensureUser('applicant','pc_eu'),false);await mods.revoke('applicant','pc_na',owner);assert.equal(await mods.ensureUser('applicant','pc_na'),false);
 assert.equal(mods.isApprover('legacy'),true);assert.equal(await mods.ensureUser('legacy','pc_na'),false);await assert.rejects(mods.revoke(owner,'pc_na',second),/BOT_OWNER_IDS|owner.*config/i);
});
test('owners can administer Server and Global tours but cannot open another owners Private tour',async t=>{
 const old=process.env.BOT_OWNER_IDS;process.env.BOT_OWNER_IDS=owner;t.after(()=>{if(old===undefined)delete process.env.BOT_OWNER_IDS;else process.env.BOT_OWNER_IDS=old;});const db=await fixture(t);
 for(const [id,visibility,guild] of [[1,'public','g'],[2,'global',null],[3,'private',null]])await db.query('INSERT INTO tours(id,eso_server,visibility,guild_id,source_guild_id,creator_id,name,house_source) VALUES(?,?,?,?,?,?,?,?)',[id,'pc_na',visibility,guild,'g','other',`Tour ${id}`,visibility==='global'?'global':visibility==='public'?'public_global':'all']);
 const menu=createHousingMenu(db);for(const id of [1,2,3]){let result;const i={...interaction(owner),customId:`hu:tour:manage:${id}`,update:async p=>result=p,reply:async p=>result=p};await menu.button(i);if(id===3)assert.match(JSON.stringify(result),/cannot|not.*available|not found/i);else assert.match(JSON.stringify(result),new RegExp(`Tour ${id}`));}
});
