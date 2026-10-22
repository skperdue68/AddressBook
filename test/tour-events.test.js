import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { TourEventService } from '../src/services/tour-event-service.js';
import { createHandlers } from '../src/handlers.js';

async function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-events-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'events.sqlite') });
  await migrate(db);
  await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Villa','villa')");
  await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(1,'pc_na','Owner','owner',62)");
  await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(1,'pc_na','public','g1',62,'Owner','owner',1,'active','u1','u1')");
  await db.query("INSERT INTO tours(id,eso_server,visibility,guild_id,creator_id,name,house_source) VALUES(1,'pc_na','public','g1','u1','Guild Route','public_global')");
  await db.query("INSERT INTO tour_stops(id,tour_id,position,saved_house_id) VALUES(1,1,1,1)");
  await db.query("INSERT INTO guild_settings(guild_id,eso_server,timezone) VALUES('g1','pc_na','America/Chicago')");
  return { db, events: new TourEventService(db,{now:()=>new Date('2026-01-01T00:00:00Z')}) };
}

function eventButton(customId,update){
  return {customId,guildId:'g1',channelId:'c1',guild:{name:'Guild'},channel:{name:'Housing'},user:{id:'u1',username:'Host',globalName:'Host'},member:{displayName:'Host',roles:{cache:new Map()}},update:payload=>Promise.resolve(update(payload)),reply:payload=>Promise.resolve(payload)};
}

test('creates an event in the guild timezone and lists its RSVP summary', async () => {
  const { db, events } = await fixture();
  try {
    const event = await events.create({ guildId: 'g1', guildName: 'Guild', channelId: 'c1', channelName: 'Housing', tourId: 1, title: 'Guild Night', description: 'Come tour', date: '2026-10-15', time: '7:30 PM', hostId: 'u1', hostGlobalName: 'Host', hostDisplayName: 'Host', isTourHost: true });
    assert.equal(event.start_at, '2026-10-16T00:30:00.000Z');
    assert.equal(event.schedule_revision, 1);
    const listed = await events.listUpcoming({ guildId: 'g1', esoServer: 'pc_na', viewerId: 'u2' });
    assert.equal(listed[0].title, 'Guild Night');
    assert.equal(listed[0].going_count, 0);
  } finally { await closeDatabase(db); }
});

test('supports Going/Interested RSVP and independent DM reminder preference', async () => {
  const { db, events } = await fixture();
  try {
    const event = await events.create({ guildId: 'g1', channelId: 'c1', tourId: 1, title: 'Guild Night', date: '2026-01-15', time: '19:30', hostId: 'u1', isTourHost: true });
    const rsvp = await events.setRsvp({ eventId: event.id, userId: 'u2', status: 'going', dmReminders: true, guildId: 'g1', esoServer: 'pc_na' });
    assert.equal(rsvp.status, 'going');
    assert.equal(rsvp.dm_reminders, 1);
    assert.equal((await events.setReminderPreference({ eventId: event.id, userId: 'u2', enabled: false, guildId: 'g1', esoServer: 'pc_na' })).dm_reminders, 0);
    await events.setRsvp({ eventId: event.id, userId: 'u2', status: 'interested', dmReminders: false, guildId: 'g1', esoServer: 'pc_na' });
    assert.deepEqual(await events.getRsvp(event.id, 'u2'), { status: 'interested', dm_reminders: 0 });
    await events.removeRsvp({ eventId: event.id, userId: 'u2' });
    assert.equal(await events.getRsvp(event.id, 'u2'), null);
  } finally { await closeDatabase(db); }
});

test('terminal events reject stale RSVP and reminder mutations', async () => {
  const { db, events } = await fixture();
  try {
    const event = await events.create({ guildId: 'g1', channelId: 'c1', tourId: 1, title: 'Closed Route', date: '2026-01-15', time: '19:30', hostId: 'u1', isTourHost: true });
    await events.cancel({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na' });
    await assert.rejects(() => events.setRsvp({ eventId: event.id, userId: 'u2', status: 'going', guildId: 'g1', esoServer: 'pc_na' }), /closed|cancelled|completed/i);
    await assert.rejects(() => events.setReminderPreference({ eventId: event.id, userId: 'u2', enabled: true, guildId: 'g1', esoServer: 'pc_na' }), /closed|cancelled|completed/i);
  } finally { await closeDatabase(db); }
});

test('server tour events must stay in the tour guild', async () => {
  const { db, events } = await fixture();
  try {
    await assert.rejects(() => events.create({ guildId: 'g2', channelId: 'c1', tourId: 1, title: 'Wrong Guild', date: '2026-01-15', time: '19:30', hostId: 'u1', isTourHost: true }), /tour's Discord server/);
  } finally { await closeDatabase(db); }
});

test('private event details are redacted and only the host can start or cancel', async () => {
  const { db, events } = await fixture();
  try {
    await db.query("UPDATE tours SET visibility='private',guild_id=NULL,house_source='all' WHERE id=1");
    await db.query("UPDATE saved_houses SET scope='private',guild_id=NULL,owner_user_id='u1' WHERE id=1");
    const event = await events.create({ guildId: 'g1', channelId: 'c1', tourId: 1, title: 'Private Route', date: '2026-01-15', time: '19:30', hostId: 'u1' });
    const hidden = await events.get(event.id, { viewerId: 'u2', guildId: 'g1', esoServer: 'pc_na' });
    assert.equal(hidden.canView, false);
    await assert.rejects(events.start({ eventId: event.id, actorId: 'u2', guildId: 'g1', esoServer: 'pc_na' }), /host|access/i);
    await assert.rejects(events.cancel({ eventId: event.id, actorId: 'u2' }), /host|moderator/i);
    assert.equal((await events.start({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na' })).status, 'started');
    assert.equal((await db.query('SELECT status,started_at FROM tour_events WHERE id=?',[event.id]))[0].status, 'scheduled');
    assert.ok((await db.query('SELECT started_at FROM tour_events WHERE id=?',[event.id]))[0].started_at);
    assert.equal(Number((await db.query('SELECT count(*) c FROM tour_sessions WHERE tour_id=1 AND mode=\'shared\''))[0].c), 1);
    assert.equal((await events.complete({ eventId: event.id, actorId: 'u1' })).status, 'completed');
    assert.equal(Number((await db.query('SELECT count(*) c FROM tour_sessions WHERE tour_id=1 AND mode=\'shared\''))[0].c), 0);
  } finally { await closeDatabase(db); }
});

test('event edits are bound to the originating guild and environment', async () => {
  const { db, events } = await fixture();
  try {
    const event = await events.create({ guildId: 'g1', channelId: 'c1', tourId: 1, title: 'Guild Night', date: '2026-10-15', time: '19:30', hostId: 'u1', isTourHost: true });
    await assert.rejects(() => events.update({ eventId: event.id, actorId: 'u1', guildId: 'g2', esoServer: 'pc_na', date: '2026-10-16', time: '19:30', title: 'Moved' }), /different Discord server/);
  } finally { await closeDatabase(db); }
});

test('started events are omitted from Upcoming Events', async () => {
  const { db, events } = await fixture();
  try {
    const event = await events.create({ guildId: 'g1', channelId: 'c1', tourId: 1, title: 'Started Route', date: '2026-10-15', time: '19:30', hostId: 'u1', isTourHost: true });
    await events.start({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na' });
    assert.equal((await events.listUpcoming({ guildId: 'g1', esoServer: 'pc_na', viewerId: 'u1' })).length, 0);
  } finally { await closeDatabase(db); }
});

test('event start refuses an ineligible tour stop without starting a session',async()=>{
  const {db,events}=await fixture();
  try{
    const event=await events.create({guildId:'g1',channelId:'c1',tourId:1,title:'Changed Route',date:'2026-10-15',time:'19:30',hostId:'u1',isTourHost:true});
    await db.query("UPDATE saved_houses SET scope='private',guild_id=NULL,owner_user_id='other' WHERE id=1");
    await assert.rejects(()=>events.start({eventId:event.id,actorId:'u1',guildId:'g1',esoServer:'pc_na'}),/no longer eligible|Private/i);
    const [row]=await db.query('SELECT started_at FROM tour_events WHERE id=?',[event.id]);
    assert.equal(row.started_at,null);
    assert.equal((await db.query('SELECT id FROM tour_sessions WHERE tour_id=1')).length,0);
  }finally{await closeDatabase(db);}
});

test('cancelling a started event closes its shared session', async () => {
  const { db, events } = await fixture();
  try {
    const event = await events.create({ guildId: 'g1', channelId: 'c1', tourId: 1, title: 'Cancelled Route', date: '2026-10-15', time: '19:30', hostId: 'u1', isTourHost: true });
    await events.start({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na' });
    assert.equal((await events.cancel({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na' })).status, 'cancelled');
    assert.equal(Number((await db.query('SELECT count(*) c FROM tour_sessions WHERE tour_id=1 AND mode=\'shared\''))[0].c), 0);
  } finally { await closeDatabase(db); }
});

test('failed event start leaves no shared session', async () => {
  const { db, events } = await fixture();
  try {
    const event = await events.create({ guildId: 'g1', channelId: 'c1', tourId: 1, title: 'Start failure', date: '2026-10-15', time: '19:30', hostId: 'u1', isTourHost: true });
    await db.query("CREATE TRIGGER fail_event_start BEFORE UPDATE OF started_at ON tour_events BEGIN SELECT RAISE(ABORT, 'injected start failure'); END");
    await assert.rejects(events.start({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na' }), /injected start failure/);
    assert.equal((await db.query('SELECT count(*) c FROM tour_sessions'))[0].c, 0);
    assert.equal((await db.query('SELECT started_at FROM tour_events WHERE id=?', [event.id]))[0].started_at, null);
  } finally { await closeDatabase(db); }
});

test('failed event cancellation retains its shared session', async () => {
  const { db, events } = await fixture();
  try {
    const event = await events.create({ guildId: 'g1', channelId: 'c1', tourId: 1, title: 'Cancel failure', date: '2026-10-15', time: '19:30', hostId: 'u1', isTourHost: true });
    await events.start({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na' });
    await db.query("CREATE TRIGGER fail_event_cancel BEFORE UPDATE OF status ON tour_events WHEN NEW.status='cancelled' BEGIN SELECT RAISE(ABORT, 'injected cancel failure'); END");
    await assert.rejects(events.cancel({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na' }), /injected cancel failure/);
    assert.equal((await db.query("SELECT count(*) c FROM tour_sessions WHERE mode='shared'"))[0].c, 1);
    assert.equal((await db.query('SELECT status FROM tour_events WHERE id=?', [event.id]))[0].status, 'scheduled');
  } finally { await closeDatabase(db); }
});

test('failed event completion retains its shared session', async () => {
  const { db, events } = await fixture();
  try {
    const event = await events.create({ guildId: 'g1', channelId: 'c1', tourId: 1, title: 'Complete failure', date: '2026-10-15', time: '19:30', hostId: 'u1', isTourHost: true });
    await events.start({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na' });
    await db.query("CREATE TRIGGER fail_event_complete BEFORE UPDATE OF status ON tour_events WHEN NEW.status='completed' BEGIN SELECT RAISE(ABORT, 'injected complete failure'); END");
    await assert.rejects(events.complete({ eventId: event.id, actorId: 'u1' }), /injected complete failure/);
    assert.equal((await db.query("SELECT count(*) c FROM tour_sessions WHERE mode='shared'"))[0].c, 1);
    assert.equal((await db.query('SELECT status FROM tour_events WHERE id=?', [event.id]))[0].status, 'scheduled');
  } finally { await closeDatabase(db); }
});

test('event host controls the shared session when a moderator starts the event', async () => {
  const { db, events } = await fixture();
  try {
    const event = await events.create({ guildId: 'g1', channelId: 'c1', tourId: 1, title: 'Moderator start', date: '2026-10-15', time: '19:30', hostId: 'u1', isTourHost: true });
    const started = await events.start({ eventId: event.id, actorId: 'mod', guildId: 'g1', esoServer: 'pc_na', isModerator: true });
    assert.equal(started.session.started_by, 'u1');
    assert.equal(started.leaderId, 'u1');
  } finally { await closeDatabase(db); }
});

test('Global tour events appear in compatible guilds', async () => {
  const { db, events } = await fixture();
  try {
    await db.query("UPDATE tours SET visibility='global',guild_id=NULL WHERE id=1");
    const event = await events.create({ guildId: 'g1', channelId: 'c1', tourId: 1, title: 'Global Route', date: '2026-10-15', time: '19:30', hostId: 'u1', isTourHost: true });
    const rows=await events.listUpcoming({guildId:'g2',esoServer:'pc_na',viewerId:'u2'});
    assert.equal(rows[0].id,event.id); assert.equal(rows[0].canView,true);
  } finally { await closeDatabase(db); }
});

test('scheduled events cannot be completed before they start', async () => {
  const { db, events } = await fixture();
  try {
    const event = await events.create({ guildId: 'g1', channelId: 'c1', tourId: 1, title: 'Not Started', date: '2026-10-15', time: '19:30', hostId: 'u1', isTourHost: true });
    await assert.rejects(() => events.complete({ eventId: event.id, actorId: 'u1' }), /Only a started event/);
  } finally { await closeDatabase(db); }
});

test('a moderator in another guild cannot complete a started event', async () => {
  const { db, events } = await fixture();
  try {
    const event = await events.create({ guildId: 'g1', channelId: 'c1', tourId: 1, title: 'Guild Event', date: '2026-10-15', time: '19:30', hostId: 'u1', isTourHost: true });
    await events.start({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na' });
    await assert.rejects(events.complete({ eventId: event.id, actorId: 'mod', guildId: 'g2', esoServer: 'pc_na', isModerator: true }), /different Discord server/);
    assert.equal((await db.query('SELECT status FROM tour_events WHERE id=?', [event.id]))[0].status, 'scheduled');
    assert.equal((await db.query("SELECT count(*) c FROM tour_sessions WHERE mode='shared'"))[0].c, 1);
  } finally { await closeDatabase(db); }
});

test('a moderator in another ESO environment cannot complete a started event', async () => {
  const { db, events } = await fixture();
  try {
    const event = await events.create({ guildId: 'g1', channelId: 'c1', tourId: 1, title: 'NA Event', date: '2026-10-15', time: '19:30', hostId: 'u1', isTourHost: true });
    await events.start({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na' });
    await assert.rejects(events.complete({ eventId: event.id, actorId: 'mod', guildId: 'g1', esoServer: 'pc_eu', isModerator: true }), /different ESO environment/);
    assert.equal((await db.query("SELECT count(*) c FROM tour_sessions WHERE mode='shared'"))[0].c, 1);
  } finally { await closeDatabase(db); }
});

test('cancelling an event that never started preserves an unrelated shared tour', async () => {
  const { db, events } = await fixture();
  try {
    const event = await events.create({ guildId: 'g1', channelId: 'c1', tourId: 1, title: 'Not started', date: '2026-10-15', time: '19:30', hostId: 'u1', isTourHost: true });
    const { TourSessionService } = await import('../src/services/tour-session-service.js');
    const shared = await new TourSessionService(db).startShared({ tourId: 1, guildId: 'g1', channelId: 'c1', userId: 'u1', esoServer: 'pc_na' });
    await events.cancel({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na' });
    assert.equal((await db.query('SELECT id FROM tour_sessions WHERE id=?', [shared.id]))[0]?.id, shared.id);
  } finally { await closeDatabase(db); }
});

test('a completed event cannot be cancelled afterward', async () => {
  const { db, events } = await fixture();
  try {
    const event = await events.create({ guildId: 'g1', channelId: 'c1', tourId: 1, title: 'Closed', date: '2026-10-15', time: '19:30', hostId: 'u1', isTourHost: true });
    await events.start({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na' });
    await events.complete({ eventId: event.id, actorId: 'u1' });
    await assert.rejects(events.cancel({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na' }), /closed|cancel/i);
    assert.equal((await events.get(event.id, { viewerId: 'u1', guildId: 'g1', esoServer: 'pc_na' })).status, 'completed');
  } finally { await closeDatabase(db); }
});

test('closed events cannot be edited', async () => {
  const { db, events } = await fixture();
  try {
    const event = await events.create({ guildId: 'g1', channelId: 'c1', tourId: 1, title: 'Closed', date: '2026-10-15', time: '19:30', hostId: 'u1', isTourHost: true });
    await events.cancel({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na' });
    await assert.rejects(events.update({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na', title: 'Reopened' }), /closed|edit/i);
    assert.equal((await events.get(event.id, { viewerId: 'u1', guildId: 'g1', esoServer: 'pc_na' })).title, 'Closed');
  } finally { await closeDatabase(db); }
});

test('an in-progress event cannot be rescheduled', async () => {
  const { db, events } = await fixture();
  try {
    const event = await events.create({ guildId: 'g1', channelId: 'c1', tourId: 1, title: 'In progress', date: '2026-10-15', time: '19:30', hostId: 'u1', isTourHost: true });
    await events.start({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na' });
    await assert.rejects(events.update({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na', date: '2026-10-16', time: '19:30' }), /started|progress|reschedul/i);
    assert.equal((await events.get(event.id, { viewerId: 'u1', guildId: 'g1', esoServer: 'pc_na' })).schedule_revision, 1);
  } finally { await closeDatabase(db); }
});

test('an event edit rejects an empty title', async () => {
  const { db, events } = await fixture();
  try {
    const event = await events.create({ guildId: 'g1', channelId: 'c1', tourId: 1, title: 'Named', date: '2026-10-15', time: '19:30', hostId: 'u1', isTourHost: true });
    await assert.rejects(events.update({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na', title: '   ' }), /title is required/i);
    assert.equal((await events.get(event.id, { viewerId: 'u1', guildId: 'g1', esoServer: 'pc_na' })).title, 'Named');
  } finally { await closeDatabase(db); }
});

test('event create and edit enforce Discord-safe title and description limits', async () => {
  const { db, events } = await fixture();
  try {
    const common = { guildId: 'g1', channelId: 'c1', tourId: 1, date: '2026-10-15', time: '19:30', hostId: 'u1', isTourHost: true };
    await assert.rejects(events.create({ ...common, title: 'x'.repeat(201) }), /Event title must be 200 characters or fewer/);
    await assert.rejects(events.create({ ...common, title: 'Safe event', description: 'x'.repeat(2001) }), /Event description must be 2000 characters or fewer/);
    const event = await events.create({ ...common, title: 'Safe event', description: 'Safe description' });
    await assert.rejects(events.update({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na', title: 'x'.repeat(201) }), /Event title must be 200 characters or fewer/);
    await assert.rejects(events.update({ eventId: event.id, actorId: 'u1', guildId: 'g1', esoServer: 'pc_na', description: 'x'.repeat(2001) }), /Event description must be 2000 characters or fewer/);
    const unchanged = await events.get(event.id, { viewerId: 'u1', guildId: 'g1', esoServer: 'pc_na' });
    assert.equal(unchanged.title, 'Safe event');
    assert.equal(unchanged.description, 'Safe description');
  } finally { await closeDatabase(db); }
});

test('MariaDB RSVP uses duplicate-key syntax and event updates keep unique aliases', async () => {
  const calls = [];
  const db = { type: 'mariadb', query: async (sql) => { calls.push(sql); if (/SELECT status,dm_reminders/.test(sql)) return [{ status: 'going', dm_reminders: 1 }]; if (/SELECT e\.\*/.test(sql)) return [{ id: 1, host_id: 'u1', guild_id: 'g1', tour_id: 1, eso_server: 'pc_na', status: 'scheduled', schedule_revision: 1, title: 'x', start_at: new Date(), tour_name: 'x', creator_id: 'u1' }]; return { affectedRows: 1, insertId: 1 }; } };
  const events = new TourEventService(db);
  events.get = async () => ({ canView: true });
  await events.setRsvp({ eventId: 1, userId: 'u2', status: 'going', guildId: 'g1', esoServer: 'pc_na' });
  assert.match(calls[0], /ON DUPLICATE KEY UPDATE/);
  assert.doesNotMatch(calls.find(sql => /SELECT e\.\*/.test(sql)) || '', /t\.name tour_name/);
});
