import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,migrate,closeDatabase} from '../src/db/database.js';
import {createHousingMenu} from '../src/ui/housing-menu.js';
import {GuildService} from '../src/services/guild-service.js';
import {WebAdminService} from '../src/services/web-admin-service.js';
const json=p=>JSON.stringify(p);
async function setup(t){const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:':memory:'});t.after(()=>closeDatabase(db));await migrate(db);await db.query(`INSERT INTO guild_settings(guild_id,eso_server,staff_role_ids) VALUES('g1','pc_na','["staff"]')`);return db;}
function interaction(id,user='u',roles=[]){return {guildId:'g1',channelId:'c',user:{id:user},member:{roles:{cache:new Map(roles.map(r=>[r,true]))}},customId:id,update(p){this.payload=p;return Promise.resolve(p);},reply(p){this.payload=p;return Promise.resolve(p);},showModal(p){this.payload=p;return Promise.resolve(p);}};}
test('Help owns moderator requests and current Server administrators review them',async t=>{
 const db=await setup(t),menu=createHousingMenu(db),i=interaction('hu:home');await menu.button(i);assert.doesNotMatch(json(i.payload),/Global Moderator Access/);
 i.customId='hu:help';await menu.button(i);assert.match(json(i.payload),/hu:help:moderators/);
 i.customId='hu:help:moderators';await menu.button(i);assert.match(json(i.payload),/Request Server Moderator Access/);assert.match(json(i.payload),/Request Global Moderator Access/);
 i.customId='hu:modal:servermod:request';i.fields={getTextInputValue:()=> 'I help members'};await menu.modal(i);
 const req=(await db.query('SELECT * FROM server_moderator_requests'))[0];assert.equal(req.status,'pending');
 const admin=interaction(`hu:servermod:approve:${req.id}:${req.revision}`,'admin',['staff']);await menu.button(admin);
 assert.equal((await db.query('SELECT * FROM server_moderators'))[0].discord_user_id,'u');
 await menu.button(admin);assert.match(json(admin.payload),/stale|pending/i);
});
test('grant revocation refreshes Discord and web permissions without a restart',async t=>{
 const db=await setup(t);await db.query("INSERT INTO server_moderators VALUES('g1','u','admin',1,1,CURRENT_TIMESTAMP)");
 const guilds=new GuildService(db);const i=interaction('hu:home');await guilds.ensureSettings('g1');await guilds.ensureModeratorAccess(i);assert.equal(guilds.isModerator(i),true);
 const web=new WebAdminService(db);const args={guildId:'g1',requestedGuildId:'g1',esoServer:'pc_na',requestedEsoServer:'pc_na',userId:'u',memberRoleIds:[]};assert.equal((await web.authorizeGuild(args)).allowed,true);
 await db.query("DELETE FROM server_moderators WHERE guild_id='g1'");await guilds.ensureModeratorAccess(i);assert.equal(guilds.isModerator(i),false);assert.equal((await web.authorizeGuild(args)).allowed,false);
});

test('removing a configured staff role closes cached Discord administration',async t=>{
 const db=await setup(t),guilds=new GuildService(db),i=interaction('hu:home','admin',['staff']);
 await guilds.ensureSettings('g1');await guilds.ensureModeratorAccess(i);assert.equal(guilds.isModerator(i),true);
 await db.query(`UPDATE guild_settings SET staff_role_ids='["replacement"]' WHERE guild_id='g1'`);
 await guilds.ensureModeratorAccess(i);assert.equal(guilds.isModerator(i),false);assert.equal(guilds.canAdmin(i),false);
});
