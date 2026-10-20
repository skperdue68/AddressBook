import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import { GlobalModeratorService } from '../src/services/global-moderator-service.js';
import { createHandlers } from '../src/handlers.js';

async function fixture(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-environment-global-mod-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'moderators.sqlite')});
  await migrate(db);
  return {db,moderators:new GlobalModeratorService(db,{GLOBAL_MODERATOR_APPROVER_USER_IDS:'approver'})};
}

test('one user can hold independent Global Moderator grants by ESO environment',async()=>{
  const {db,moderators}=await fixture();
  try{
    const na=await moderators.requestAccess({userId:'u1',guildId:'g-na',esoServer:'pc_na',reason:'I moderate NA'});
    const eu=await moderators.requestAccess({userId:'u1',guildId:'g-eu',esoServer:'pc_eu',reason:'I also moderate EU'});
    await assert.rejects(()=>moderators.requestAccess({userId:'u1',guildId:'g-na',esoServer:'pc_na',reason:'Duplicate'}),/pending.*this ESO environment/i);
    await moderators.approve(na.id,'approver');
    await moderators.approve(eu.id,'approver');

    assert.equal(await moderators.isGlobalModerator('u1','pc_na'),true);
    assert.equal(await moderators.isGlobalModerator('u1','pc_eu'),true);
    assert.equal(await moderators.isGlobalModerator('u1','xbox_na'),false);
    assert.equal((await moderators.statusForUser('u1')).grants.length,2);

    assert.equal(await moderators.revoke('u1','pc_na','approver'),true);
    assert.equal(await moderators.isGlobalModerator('u1','pc_na'),false);
    assert.equal(await moderators.isGlobalModerator('u1','pc_eu'),true);
    assert.equal(Number((await one(db,"SELECT count(*) c FROM global_moderators WHERE discord_user_id='u1'")).c),1);
    const audit=await one(db,"SELECT details FROM audit_log WHERE action='revoke_global_moderator'");
    assert.equal(JSON.parse(audit.details).esoServer,'pc_na');
  }finally{await closeDatabase(db);}
});

test('legacy grant with an approved origin request is assigned to that server environment', async () => {
  const { db, moderators } = await fixture();
  try {
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    await db.query('DROP TABLE global_moderators');
    await db.query('CREATE TABLE global_moderators(discord_user_id TEXT NOT NULL,eso_server TEXT,approved_by TEXT NOT NULL,request_id INTEGER,approved_at TEXT DEFAULT CURRENT_TIMESTAMP)');
    await db.query("INSERT INTO global_moderator_requests(id,discord_user_id,origin_guild_id,reason,status) VALUES(7,'u1','g1','Legacy','approved')");
    await db.query("INSERT INTO global_moderators(discord_user_id,eso_server,approved_by,request_id) VALUES('u1',NULL,'approver',7)");
    assert.equal(await moderators.ensureUser('u1','pc_na'),true);
    assert.deepEqual((await moderators.statusForUser('u1')).grants.map(row=>row.eso_server),['pc_na']);
  } finally { await closeDatabase(db); }
});

test('a legacy unassigned grant can be revoked and the member can request PC NA again', async () => {
  const { db, moderators } = await fixture();
  try {
    await db.query('DROP TABLE global_moderators');
    await db.query('CREATE TABLE global_moderators(discord_user_id TEXT NOT NULL,eso_server TEXT,approved_by TEXT NOT NULL,request_id INTEGER,approved_at TEXT DEFAULT CURRENT_TIMESTAMP)');
    await db.query("INSERT INTO global_moderators(discord_user_id,eso_server,approved_by) VALUES('u1',NULL,'approver')");
    assert.equal(await moderators.revoke('u1','legacy','approver'),true);
    const request = await moderators.requestAccess({userId:'u1',guildId:'g1',esoServer:'pc_na',reason:'Request after revocation'});
    assert.equal(request.status,'pending');
  } finally { await closeDatabase(db); }
});

test('review queue shows the applicant and originating server names', async () => {
  const { db, moderators } = await fixture();
  try {
    await moderators.requestAccess({userId:'u1',guildId:'g1',esoServer:'pc_na',reason:'Help',names:{globalName:'Stephanie',displayName:'Steph',guildName:'Alphabet Mafia'}});
    const [row] = await moderators.listPending();
    assert.equal(row.discord_display_name,'Steph');
    assert.equal(row.origin_guild_name,'Alphabet Mafia');
    const { globalModeratorRequestsPayload, globalModeratorRequestReviewPayload } = await import('../src/ui/housing-ui.js');
    assert.match(JSON.stringify(globalModeratorRequestsPayload([row])),/Steph/);
    assert.match(JSON.stringify(globalModeratorRequestReviewPayload(row)),/Alphabet Mafia/);
  } finally { await closeDatabase(db); }
});

test('older pending requests use known Discord user and server names', async () => {
  const { db, moderators } = await fixture();
  try {
    await db.query("INSERT INTO discord_users(discord_user_id,global_name) VALUES('u1','Stephanie')");
    await db.query("INSERT INTO discord_guilds(guild_id,guild_name) VALUES('g1','Alphabet Mafia')");
    await db.query("INSERT INTO global_moderator_requests(eso_server,discord_user_id,origin_guild_id,reason) VALUES('pc_na','u1','g1','Older request')");
    const [row] = await moderators.listPending();
    const { globalModeratorRequestReviewPayload } = await import('../src/ui/housing-ui.js');
    assert.match(JSON.stringify(globalModeratorRequestReviewPayload(row)),/Stephanie/);
    assert.match(JSON.stringify(globalModeratorRequestReviewPayload(row)),/Alphabet Mafia/);
  } finally { await closeDatabase(db); }
});

test('pending request queues may be filtered by environment while approvers can see all',async()=>{
  const {db,moderators}=await fixture();
  try{
    await moderators.requestAccess({userId:'na-user',guildId:'g-na',esoServer:'pc_na',reason:'NA queue'});
    await moderators.requestAccess({userId:'eu-user',guildId:'g-eu',esoServer:'pc_eu',reason:'EU queue'});
    assert.deepEqual((await moderators.listPending({esoServer:'pc_na'})).map(r=>r.discord_user_id),['na-user']);
    assert.deepEqual((await moderators.listPending()).map(r=>r.discord_user_id),['eu-user','na-user']);
  }finally{await closeDatabase(db);}
});

test('denial audit retains request and environment context',async()=>{
  const {db,moderators}=await fixture();
  try{
    const request=await moderators.requestAccess({userId:'u2',guildId:'g-eu',esoServer:'pc_eu',reason:'Help EU'});
    await moderators.deny(request.id,'approver');
    const audit=await one(db,"SELECT details FROM audit_log WHERE action='deny_global_moderator'");
    assert.deepEqual(JSON.parse(audit.details),{requestId:request.id,esoServer:'pc_eu'});
  }finally{await closeDatabase(db);}
});

test('moderator authorization refreshes a cached grant changed by another process',async()=>{
  const {db,moderators}=await fixture();
  try{
    assert.equal(await moderators.ensureUser('u1','pc_na'),false);
    await db.query("INSERT INTO global_moderators(discord_user_id,eso_server,approved_by) VALUES('u1','pc_na','approver')");
    assert.equal(await moderators.ensureUser('u1','pc_na'),true);
    await db.query("DELETE FROM global_moderators WHERE discord_user_id='u1' AND eso_server='pc_na'");
    assert.equal(await moderators.ensureUser('u1','pc_na'),false);
    assert.equal(moderators.isGlobalModeratorCached('u1','pc_na'),false);
  }finally{await closeDatabase(db);}
});

test('failed approval rolls back grant and does not cache moderator access',async()=>{
  const {db,moderators}=await fixture();
  try{
    const request=await moderators.requestAccess({userId:'u1',guildId:'g1',esoServer:'pc_na',reason:'Moderation'});
    await db.query("CREATE TRIGGER reject_global_approval BEFORE INSERT ON audit_log WHEN NEW.action='approve_global_moderator' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
    await assert.rejects(()=>moderators.approve(request.id,'approver'),/audit unavailable/i);
    assert.equal((await one(db,"SELECT count(*) c FROM global_moderators WHERE discord_user_id='u1'")).c,0);
    assert.equal(moderators.isGlobalModeratorCached('u1','pc_na'),false);
    assert.equal((await one(db,'SELECT status FROM global_moderator_requests WHERE id=?',[request.id])).status,'pending');
  }finally{await closeDatabase(db);}
});

test('denial rechecks pending status before writing an audit entry',async()=>{
  const {db,moderators}=await fixture();
  try{
    const request=await moderators.requestAccess({userId:'u2',guildId:'g1',esoServer:'pc_na',reason:'Help'});
    const original=db.query.bind(db);
    let changed=false;
    db.query=async(sql,args)=>{
      const rows=await original(sql,args);
      if(!changed && /FROM global_moderator_requests WHERE id=\? AND status='pending'/i.test(sql)){
        changed=true;
        await original("UPDATE global_moderator_requests SET status='approved' WHERE id=?",[request.id]);
      }
      return rows;
    };
    await assert.rejects(()=>moderators.deny(request.id,'approver'),/pending.*not found|already reviewed/i);
    assert.equal((await one(db,'SELECT status FROM global_moderator_requests WHERE id=?',[request.id])).status,'pending');
    assert.equal((await one(db,"SELECT count(*) c FROM audit_log WHERE action='deny_global_moderator'")).c,0);
  }finally{await closeDatabase(db);}
});

test('stale Global Moderator review acknowledges and refreshes without a raw error', async () => {
  const { db, moderators } = await fixture();
  const prior = process.env.GLOBAL_MODERATOR_APPROVER_USER_IDS;
  process.env.GLOBAL_MODERATOR_APPROVER_USER_IDS = 'approver';
  try {
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const request = await moderators.requestAccess({ userId:'u1', guildId:'g1', esoServer:'pc_na', reason:'Help' });
    await moderators.approve(request.id, 'approver');
    let deferred = false, response;
    await createHandlers(db).button({
      customId:`hu:globalmod:deny:${request.id}:1`, guildId:'g1', channelId:'c1', guild:{name:'Guild One'},
      user:{id:'approver',username:'Approver',globalName:'Approver'}, member:{displayName:'Approver',roles:{cache:{has:()=>false}}},
      deferUpdate:async()=>{deferred=true;}, editReply:async payload=>{response=payload;}, update:async payload=>{response=payload;}, reply:async payload=>{response=payload;}
    });
    assert.equal(deferred, true);
    assert.match(response.content, /already reviewed|no longer pending/i);
    assert.match(JSON.stringify(response.embeds), /Pending Global Moderator Requests/);
  } finally {
    if (prior === undefined) delete process.env.GLOBAL_MODERATOR_APPROVER_USER_IDS; else process.env.GLOBAL_MODERATOR_APPROVER_USER_IDS = prior;
    await closeDatabase(db);
  }
});
