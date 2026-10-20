import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { AuditLogService } from '../src/services/audit-log-service.js';
import { auditLogPayload } from '../src/ui/housing-ui.js';

test('audit log lists only the requested guild and paginates', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-audit-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'audit.sqlite') });
  try {
    await migrate(db);
    for (let n = 0; n < 11; n++) await db.query('INSERT INTO audit_log(guild_id,actor_id,actor_display_name,action,entity_type,entity_id,entity_name) VALUES(?,?,?,?,?,?,?)', ['g1', 'u1', 'Moderator', 'house_updated', 'saved_house', String(n), `House ${n}`]);
    await db.query("INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id) VALUES('g2','u2','other','guild','g2')");
    const result = await new AuditLogService(db).list({ guildId: 'g1', page: 2, pageSize: 10 });
    assert.equal(result.rows.length, 1); assert.equal(result.total, 11); assert.equal(result.hasNext, false); assert.equal(result.rows[0].guild_id, 'g1');
    assert.match(JSON.stringify(auditLogPayload(result)), /House 0/);
  } finally { await closeDatabase(db); }
});

test('audit CSV exports every matching row for one guild and keeps spreadsheet cells literal', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-audit-csv-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'audit.sqlite') });
  try {
    await migrate(db);
    for (let n = 0; n < 27; n++) await db.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,entity_name,details) VALUES(?,?,?,?,?,?,?)',
      ['389809119307104257', '389809119307104257', 'house_updated', 'saved_house', String(n), n === 0 ? '=2+2' : `House ${n}`, n === 0 ? 'a,"quoted"\nline' : '{}']);
    await db.query("INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id) VALUES('389809119307104257','mod','tour_updated','tour','skip')");
    await db.query("INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id) VALUES('other-guild','mod','house_updated','saved_house','hidden')");
    const csv = await new AuditLogService(db).exportCsv({ guildId: '389809119307104257', action: 'house_updated', entityType: 'saved_house' });
    assert.equal(csv.split('house_updated').length - 1, 27, 'export must include records beyond the first 25-row page');
    assert.match(csv, /'389809119307104257/, 'Discord IDs must remain text in spreadsheets');
    assert.match(csv, /'=2\+2/, 'house names must not become spreadsheet formulas');
    assert.match(csv, /"a,""quoted""\nline"/, 'quoted multi-line details must be valid CSV');
    assert.doesNotMatch(csv, /hidden|tour_updated|skip/);
    await assert.rejects(() => new AuditLogService(db).exportCsv({}), /guild/i);
  } finally { await closeDatabase(db); }
});
