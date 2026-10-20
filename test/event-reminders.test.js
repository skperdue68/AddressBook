import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { EventReminderService } from '../src/services/event-reminder-service.js';

async function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-reminders-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'reminders.sqlite') });
  await migrate(db);
  await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Villa','villa')");
  await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(1,'pc_na','Owner','owner',62)");
  await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(1,'pc_na','public','g1',62,'Owner','owner',1,'active','u1','u1')");
  await db.query("INSERT INTO tours(id,eso_server,visibility,guild_id,creator_id,name,house_source) VALUES(1,'pc_na','public','g1','u1','Guild Route','public_global')");
  await db.query("INSERT INTO tour_stops(id,tour_id,position,saved_house_id) VALUES(1,1,1,1)");
  const start = new Date('2026-09-21T17:00:00.000Z');
  await db.query("INSERT INTO tour_events(id,guild_id,channel_id,tour_id,eso_server,host_id,title,start_at,created_by,updated_by) VALUES(1,'g1','c1',1,'pc_na','u1','Guild Night',?,'u1','u1')", [start.toISOString()]);
  await db.query("INSERT INTO tour_event_rsvps(event_id,discord_user_id,status,dm_reminders) VALUES(1,'u2','going',1),(1,'u3','interested',0)");
  return { db, start };
}

test('claims and delivers one channel reminder plus opted-in DM without duplicates', async () => {
  const { db, start } = await fixture();
  const sent = [];
  const gateway = { sendChannel: async payload => sent.push(['channel', payload.reminderKey]), sendDm: async payload => sent.push(['dm', payload.userId, payload.reminderKey]) };
  try {
    const reminders = new EventReminderService(db, { now: () => new Date(start.getTime() - 60 * 60 * 1000), gateway });
    const first = await reminders.runOnce();
    assert.equal(first.sent, 2);
    assert.deepEqual(sent.sort(), [['channel', '1h'], ['dm', 'u2', '1h']]);
    sent.length = 0;
    assert.equal((await reminders.runOnce()).sent, 0);
    assert.equal(sent.length, 0);
    assert.equal(Number((await db.query("SELECT count(*) c FROM tour_event_deliveries WHERE status='sent'"))[0].c), 2);
  } finally { await closeDatabase(db); }
});

test('a claimed failure is not automatically retried and is visible as stale health', async () => {
  const { db, start } = await fixture();
  try {
    const reminders = new EventReminderService(db, { now: () => new Date(start.getTime() - 60 * 60 * 1000), gateway: { sendChannel: async () => { throw new Error('channel unavailable'); }, sendDm: async () => {} } });
    const result = await reminders.runOnce();
    assert.equal(result.failed, 1);
    assert.equal((await reminders.runOnce()).attempted, 0);
    const stale = await reminders.listStaleClaims({ olderThanMs: 0 });
    assert.equal(stale.length, 1);
    assert.equal(stale[0].status, 'failed');
  } finally { await closeDatabase(db); }
});

test('does not send a 24-hour reminder throughout the entire preceding day', async () => {
  const { db, start } = await fixture();
  let sends = 0;
  try {
    const reminders = new EventReminderService(db, { now: () => new Date(start.getTime() - 10 * 60 * 60 * 1000), gateway: { sendChannel: async () => { sends++; }, sendDm: async () => { sends++; } } });
    assert.equal((await reminders.runOnce()).attempted, 0);
    assert.equal(sends, 0);
  } finally { await closeDatabase(db); }
});
