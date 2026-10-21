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
    await seedPublicHouses(db, 'g1', 11);
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
    await seedPublicHouses(db, '389809119307104257', 27);
    await db.query("UPDATE saved_houses SET display_name='=2+2' WHERE id=0");
    for (let n = 0; n < 27; n++) await db.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,entity_name,details) VALUES(?,?,?,?,?,?,?)',
      ['389809119307104257', '389809119307104257', 'house_updated', 'saved_house', String(n), n === 0 ? '=2+2' : `House ${n}`, n === 0 ? 'a,"quoted"\nline' : '{}']);
    await db.query("INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id) VALUES('389809119307104257','mod','tour_updated','tour','skip')");
    await db.query("INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id) VALUES('other-guild','mod','house_updated','saved_house','hidden')");
    const csv = await new AuditLogService(db).exportCsv({ guildId: '389809119307104257', action: 'house_updated', entityType: 'saved_house' });
    assert.equal(csv.split('house_updated').length - 1, 27, 'export must include records beyond the first 25-row page');
    assert.match(csv, /'389809119307104257/, 'Discord IDs must remain text in spreadsheets');
    assert.match(csv, /'=2\+2/, 'house names must not become spreadsheet formulas');
    assert.doesNotMatch(csv, /quoted/, 'historical free-form details are omitted');
    assert.doesNotMatch(csv, /hidden|tour_updated|skip/);
    await assert.rejects(() => new AuditLogService(db).exportCsv({}), /guild/i);
  } finally { await closeDatabase(db); }
});

test('audit hides Private, deleted and unprovable entities before filtering and projects safe public metadata', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-audit-privacy-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'audit.sqlite') });
  try {
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Villa','villa')");
    await db.query("INSERT INTO saved_houses(id,scope,guild_id,house_id,eso_owner,normalized_owner,display_name,created_by,updated_by) VALUES(1,'public','g1',62,'Owner','owner','Public Villa','u','u')");
    await db.query("INSERT INTO tours(id,visibility,creator_id,name) VALUES(1,'private','u','Secret Tour')");
    for (const [type,id,name,details] of [
      ['saved_house','1','Secret former name','{"sourceName":"Secret source","sourceId":99}'],
      ['tour','1','Secret Tour','{}'],
      ['saved_house','99','Secret deleted house','{"scope":"private"}'],
      ['house_share_pass','1','Secret pass','{"savedHouseId":99}'],
      ['unknown','1','Secret unknown','{}'],
      ['saved_house','1oops','Secret malformed','{}']
    ]) await db.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,entity_name,details) VALUES(?,?,?,?,?,?,?)',['g1','u','updated',type,id,name,details]);
    const service = new AuditLogService(db);
    const result = await service.list({guildId:'g1',pageSize:1});
    assert.equal(result.total,1);
    assert.equal(result.hasNext,false);
    assert.equal(result.rows[0].entity_name,'Public Villa');
    assert.equal(result.rows[0].details,null);
    assert.equal((await service.list({guildId:'g1',target:'Secret'})).total,0);
    assert.equal((await service.list({guildId:'g1',entityType:'tour'})).total,0);
    assert.doesNotMatch(await service.exportCsv({guildId:'g1'}),/Secret|sourceId|sourceName/);
    await db.query("UPDATE saved_houses SET scope='private',guild_id=NULL,owner_user_id='u' WHERE id=1");
    assert.equal((await service.list({guildId:'g1'})).total,0);
  } finally { await closeDatabase(db); }
});

async function seedPublicHouses(db, guildId, count) {
  await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Villa','villa')");
  for (let n=0; n<count; n++) await db.query("INSERT INTO saved_houses(id,scope,guild_id,house_id,eso_owner,normalized_owner,display_name,created_by,updated_by) VALUES(?,'public',?,62,?,?,?,?,?)",[n,guildId,`Owner${n}`,`owner${n}`,`House ${n}`,'u','u']);
}
