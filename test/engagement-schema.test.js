import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import { SCHEMA_VERSION, SCHEMA_V1, SCHEMA_V4, SCHEMA_V6, SCHEMA_V7, SCHEMA_V8 } from '../src/db/schema.js';
import { SQLITE_SCHEMA_VERSION } from '../src/db/sqlite-schema.js';

const engagementTables = [
  'tour_events', 'tour_event_rsvps', 'tour_event_deliveries',
  'featured_items', 'tour_progress', 'tour_progress_stops'
];

test('fresh SQLite schema creates v8 learning columns and v7 engagement tables', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-engagement-schema-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'schema.sqlite') });
  try {
    await migrate(db);
  assert.equal(SQLITE_SCHEMA_VERSION,11);
  assert.equal(Number((await one(db, 'SELECT max(version) version FROM schema_migrations')).version),11);
    const guildColumns = new Set((await db.query('PRAGMA table_info(guild_settings)')).map(row => row.name));
    assert.ok(guildColumns.has('timezone'));
    for (const table of engagementTables) {
      assert.equal((await db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table])).length, 1, `${table} missing`);
    }
    const eventColumns = new Set((await db.query('PRAGMA table_info(tour_events)')).map(row => row.name));
    assert.ok(eventColumns.has('schedule_revision'));
    assert.ok(eventColumns.has('start_at'));
  } finally { await closeDatabase(db); }
});

test('MariaDB schema exposes the v8 learning definitions and v7 engagement definitions', () => {
  assert.equal(SCHEMA_VERSION,11);
  const schema = [...SCHEMA_V1, ...SCHEMA_V4, ...SCHEMA_V6, ...SCHEMA_V7, ...SCHEMA_V8].join('\n');
  for (const table of engagementTables) assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(`, 'i'));
  assert.match(schema, /timezone VARCHAR\(64\) NULL/i);
  assert.match(schema, /UNIQUE KEY uq_event_delivery/i);
});

test('v7 migration is idempotent', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-engagement-idempotent-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'schema.sqlite') });
  try {
    await migrate(db);
    await migrate(db);
    assert.equal(Number((await one(db, 'SELECT count(*) c FROM schema_migrations WHERE version=7')).c), 1);
  } finally { await closeDatabase(db); }
});
