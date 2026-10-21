import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import { WebAdminService } from '../src/services/web-admin-service.js';
import { SavedHouseService } from '../src/services/saved-house-service.js';

test('web audit filters action and record type within the selected guild', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-web-audit-filters-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'audit.sqlite') });
  try {
    await migrate(db);
    await seedAuditHouses(db, [[1,'g1','Match'],[2,'g1','Wrong action'],[3,'g2','Other guild']]);
    for (const [guild, action, type, id] of [
      ['g1', 'house_updated', 'saved_house', '1'],
      ['g1', 'house_updated', 'tour', 'wrong-type'],
      ['g1', 'house_created', 'saved_house', '2'],
      ['g2', 'house_updated', 'saved_house', '3']
    ]) await db.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id) VALUES(?,?,?,?,?)', [guild, 'moderator', action, type, id]);
    const result = await new WebAdminService(db).listAudit({ guildId: 'g1', page: 1, pageSize: 25, action: 'house_updated', entityType: 'saved_house' });
    assert.equal(result.total, 1);
    assert.deepEqual(result.rows.map(row => row.entity_id), ['1']);
  } finally { await closeDatabase(db); }
});

test('web audit Action and Target match partial names and IDs within the guild', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-web-audit-partial-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'audit.sqlite') });
  try {
    await migrate(db);
    await seedAuditHouses(db, [[123,'g1','Grand Psijic Villa'],[456,'g1','Seaside Manor'],[789,'g2','Grand Psijic Villa']]);
    for (const [guild, action, id, name] of [
      ['g1','house_updated','123','Grand Psijic Villa'],
      ['g1','house_created','456','Seaside Manor'],
      ['g2','house_updated','789','Grand Psijic Villa']
    ]) await db.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,entity_name) VALUES(?,?,?,?,?,?)',[guild,'mod',action,'saved_house',id,name]);
    const service=new WebAdminService(db);
    assert.deepEqual((await service.listAudit({guildId:'g1',action:'UPDATED'})).rows.map(r=>r.entity_id),['123']);
    assert.deepEqual((await service.listAudit({guildId:'g1',target:'psijic'})).rows.map(r=>r.entity_id),['123']);
    assert.deepEqual((await service.listAudit({guildId:'g1',target:'456'})).rows.map(r=>r.entity_id),['456']);
    const csv=await service.exportAudit({guildId:'g1',action:'created',target:'456'});
    assert.match(csv,/456/);
    assert.doesNotMatch(csv,/123/);
  } finally { await closeDatabase(db); }
});

test('web audit search treats SQL wildcard characters as literal text', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-web-audit-literal-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'audit.sqlite') });
  try {
    await migrate(db);
    await seedAuditHouses(db, [[10,'g1','100% Complete abc_10'],[11,'g1','100 Complete abcX10']]);
    for (const [action,id,name] of [['house_updated','10','100% Complete'],['houseupdated','11','100 Complete']])
      await db.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,entity_name) VALUES(?,?,?,?,?,?)',['g1','mod',action,'saved_house',id,name]);
    const service=new WebAdminService(db);
    assert.deepEqual((await service.listAudit({guildId:'g1',action:'house_',target:'%'})).rows.map(r=>r.entity_id),['10']);
    assert.deepEqual((await service.listAudit({guildId:'g1',target:'abc_'})).rows.map(r=>r.entity_id),['10']);
  } finally { await closeDatabase(db); }
});

async function seedAuditHouses(db, rows) {
  await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Villa','villa')");
  for (const [id,guild,name] of rows) await db.query("INSERT INTO saved_houses(id,scope,guild_id,house_id,eso_owner,normalized_owner,display_name,created_by,updated_by) VALUES(?,'public',?,62,?,?,?,?,?)",[id,guild,`Owner${id}`,`owner${id}`,name,'u','u']);
}

test('web admin authorization requires configured moderator role and exact guild context', async () => {
  const service = new WebAdminService({}, { guilds: { getSettings: () => ({ eso_server: 'pc_na', staff_role_ids: ['mod'] }) } });
  assert.deepEqual(service.authorizeGuild({ guildId: 'g1', requestedGuildId: 'g1', esoServer: 'pc_na', requestedEsoServer: 'pc_na', memberRoleIds: ['mod'] }), { allowed: true, reason: null });
  assert.equal(service.authorizeGuild({ guildId: 'g1', requestedGuildId: 'g2', esoServer: 'pc_na', requestedEsoServer: 'pc_na', memberRoleIds: ['mod'] }).allowed, false);
  assert.equal(service.authorizeGuild({ guildId: 'g1', requestedGuildId: 'g1', esoServer: 'pc_na', requestedEsoServer: 'pc_eu', memberRoleIds: ['mod'] }).allowed, false);
  assert.equal(service.authorizeGuild({ guildId: 'g1', requestedGuildId: 'g1', esoServer: 'pc_na', requestedEsoServer: 'pc_na', memberRoleIds: [] }).allowed, false);
});

test('web admin export delegates to the existing guild/environment export', async () => {
  const service = new WebAdminService({}, { dataExport: { toJson: async options => JSON.stringify({ ...options, private: false }) } });
  const result = await service.exportGuild({ guildId: 'g1', esoServer: 'pc_na' });
  assert.match(result, /"guildId":"g1"/);
  assert.match(result, /"esoServer":"pc_na"/);
});

test('web administration export excludes Private entries from every user', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-web-export-private-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'export.sqlite') });
  try {
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Villa','villa')");
    const saved = new SavedHouseService(db);
    const own = await saved.createPrivate({ originGuildId: 'g1', userId: 'u1', esoServer: 'pc_na', houseId: 62, esoOwner: 'Owner', createdBy: 'u1' });
    await saved.createPrivate({ originGuildId: 'g2', userId: 'u2', esoServer: 'pc_na', houseId: 62, esoOwner: 'Other', createdBy: 'u2' });
    const result = JSON.parse(await new WebAdminService(db).exportGuild({ guildId: 'g1', esoServer: 'pc_na' }));
    assert.deepEqual(result.houses, []);
    assert.equal(result.includePrivate, false);
  } finally { await closeDatabase(db); }
});

test('pending review can retrieve submissions after the first page without mixing guilds or environments', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-web-pending-pages-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'pending.sqlite') });
  try {
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Villa','villa')");
    const houses = new SavedHouseService(db);
    for (let n = 1; n <= 27; n++) await houses.createPublic({ guildId: 'g1', esoServer: 'pc_na', houseId: 62, esoOwner: `Owner${String(n).padStart(2,'0')}`, createdBy: 'submitter', status: 'pending' });
    await houses.createGlobal({ originGuildId: 'g1', esoServer: 'pc_na', houseId: 62, esoOwner: 'Owner28', createdBy: 'submitter', status: 'pending' });
    await houses.createPublic({ guildId: 'g2', esoServer: 'pc_na', houseId: 62, esoOwner: 'OtherGuild', createdBy: 'submitter', status: 'pending' });
    await houses.createPublic({ guildId: 'g1', esoServer: 'pc_eu', houseId: 62, esoOwner: 'OtherServer', createdBy: 'submitter', status: 'pending' });
    const service = new WebAdminService(db);
    const first = await service.listPending({ guildId: 'g1', esoServer: 'pc_na', limit: 25, offset: 0 });
    const second = await service.listPending({ guildId: 'g1', esoServer: 'pc_na', limit: 25, offset: 25 });
    assert.equal(first.length, 25);
    assert.deepEqual(second.map(row => row.eso_owner), ['Owner26', 'Owner27', 'Owner28']);
    assert.deepEqual(new Set([...first, ...second].map(row => row.id)).size, 28);
  } finally { await closeDatabase(db); }
});

test('web pending review transitions only eligible Server and Global records and audits actor context', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-web-review-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'review.sqlite') });
  try {
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name,zone) VALUES(62,'Grand Psijic Villa','grand psijic villa','Summerset')");
    const houses = new SavedHouseService(db);
    const server = await houses.createPublic({ guildId: 'g1', esoServer: 'pc_na', houseId: 62, esoOwner: 'ServerOwner', createdBy: 'submitter', status: 'pending' });
    const global = await houses.createGlobal({ originGuildId: 'g1', esoServer: 'pc_na', houseId: 62, esoOwner: 'GlobalOwner', createdBy: 'submitter', status: 'pending' });
    const privateHouse = await houses.createPrivate({ originGuildId: 'g1', userId: 'private-owner', esoServer: 'pc_na', houseId: 62, esoOwner: 'PrivateOwner', createdBy: 'private-owner', status: 'pending' });
    const otherGuild = await houses.createPublic({ guildId: 'g2', esoServer: 'pc_na', houseId: 62, esoOwner: 'OtherOwner', createdBy: 'submitter', status: 'pending' });
    const otherEnvironment = await houses.createGlobal({ originGuildId: 'g1', esoServer: 'pc_eu', houseId: 62, esoOwner: 'EuOwner', createdBy: 'submitter', status: 'pending' });
    const service = new WebAdminService(db);
    const actor = { id: 'moderator', globalName: 'Mod Global', displayName: 'Moderator' };

    const approved = await service.reviewPending({ id: server.id, action: 'approve', guildId: 'g1', esoServer: 'pc_na', actor });
    assert.equal(approved.action, 'approve');
    assert.equal(approved.record.status, 'active');
    const denied = await service.reviewPending({ id: global.id, action: 'deny', guildId: 'g1', esoServer: 'pc_na', actor });
    assert.equal(denied.action, 'deny');
    assert.equal(denied.record.status, 'archived');
    const audit = await one(db, "SELECT * FROM audit_log WHERE entity_type='saved_house' AND entity_id=? ORDER BY id DESC", [String(server.id)]);
    assert.equal(audit.action, 'web_approve_house');
    assert.equal(audit.guild_id, 'g1');
    assert.equal(audit.actor_id, 'moderator');
    assert.equal(audit.actor_global_name, 'Mod Global');
    assert.equal(audit.actor_display_name, 'Moderator');
    assert.equal(audit.entity_name, 'Grand Psijic Villa');
    assert.match(audit.details, /pc_na/);

    await assert.rejects(() => service.reviewPending({ id: privateHouse.id, action: 'approve', guildId: 'g1', esoServer: 'pc_na', actor }), /not available/i);
    await assert.rejects(() => service.reviewPending({ id: otherGuild.id, action: 'approve', guildId: 'g1', esoServer: 'pc_na', actor }), /not available/i);
    await assert.rejects(() => service.reviewPending({ id: otherEnvironment.id, action: 'approve', guildId: 'g1', esoServer: 'pc_na', actor }), /not available/i);
    await assert.rejects(() => service.reviewPending({ id: server.id, action: 'approve', guildId: 'g1', esoServer: 'pc_na', actor }), /already reviewed|not available/i);
    await assert.rejects(() => service.reviewPending({ id: otherGuild.id, action: 'remove', guildId: 'g1', esoServer: 'pc_na', actor }), /invalid review action/i);
  } finally {
    await closeDatabase(db);
  }
});

test('web report moderation is paginated, environment scoped, Private-safe, and audited with actor names', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-web-reports-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'reports.sqlite') });
  try {
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Psijic Villa','grand psijic villa')");
    const houses = new SavedHouseService(db);
    const serverHouse = await houses.createPublic({ guildId: 'g1', esoServer: 'pc_na', houseId: 62, esoOwner: 'ServerOwner', displayName: 'Server Villa', createdBy: 'submitter' });
    const otherGuild = await houses.createPublic({ guildId: 'g2', esoServer: 'pc_na', houseId: 62, esoOwner: 'OtherGuild', createdBy: 'submitter' });
    const otherEnvironment = await houses.createPublic({ guildId: 'g1', esoServer: 'pc_eu', houseId: 62, esoOwner: 'EuOwner', createdBy: 'submitter' });
    const privateHouse = await houses.createPrivate({ originGuildId: 'g1', userId: 'owner', esoServer: 'pc_na', houseId: 62, esoOwner: 'SecretOwner', displayName: 'Secret Villa', description: 'Never disclose', createdBy: 'owner' });
    const pass = await db.query("INSERT INTO house_share_passes(token_hash,saved_house_id,created_by,origin_guild_id) VALUES('private-token',?,'owner','g1')", [privateHouse.id]);
    const insertReport = (house, guildId, reporter, extra = {}) => db.query(`INSERT INTO housing_reports(destination_id,saved_house_id,house_share_pass_id,reporter_id,guild_id,problem_type,explanation)
      VALUES(?,?,?,?,?,?,?)`, [house.destination_id, house.id, extra.passId || null, reporter, guildId, 'other', extra.explanation || 'Needs attention']);
    for (let n = 1; n <= 26; n++) await insertReport(serverHouse, 'g1', `reporter-${String(n).padStart(2, '0')}`);
    await insertReport(otherGuild, 'g2', 'wrong-guild');
    await insertReport(otherEnvironment, 'g1', 'wrong-environment');
    await insertReport(privateHouse, 'g1', 'private-reporter', { passId: Number(pass.insertId), explanation: 'Private details must stay hidden' });

    const service = new WebAdminService(db);
    const actor = { id: 'moderator', globalName: 'Mod Global', displayName: 'Moderator' };
    const first = await service.listReports({ guildId: 'g1', esoServer: 'pc_na', actor, page: 1, pageSize: 25 });
    const second = await service.listReports({ guildId: 'g1', esoServer: 'pc_na', actor, page: 2, pageSize: 25 });
    assert.equal(first.total, 27);
    assert.equal(first.rows.length, 25);
    assert.equal(second.rows.length, 2);
    const privateRow = [...first.rows, ...second.rows].find(row => row.house_share_pass_id);
    assert.match(privateRow.targetSummary, /Private House Share Pass/);
    assert.equal(privateRow.explanation, undefined);
    assert.equal(JSON.stringify([first, second]).includes('Private details must stay hidden'), false);
    assert.equal(JSON.stringify([first, second]).includes('SecretOwner'), false);
    assert.equal(JSON.stringify([first, second]).includes('wrong-guild'), false);
    assert.equal(JSON.stringify([first, second]).includes('wrong-environment'), false);

    const selected = second.rows.find(row => !row.house_share_pass_id);
    await service.moderateReport({ id: selected.id, action: 'review', guildId: 'g1', esoServer: 'pc_na', actor });
    await service.moderateReport({ id: selected.id, action: 'resolve', guildId: 'g1', esoServer: 'pc_na', actor });
    assert.equal((await one(db, 'SELECT status FROM housing_reports WHERE id=?', [selected.id])).status, 'resolved');
    const audit = await one(db, "SELECT * FROM audit_log WHERE action='housing_report_resolved' AND entity_id=? ORDER BY id DESC", [String(selected.id)]);
    assert.equal(audit.guild_id, 'g1');
    assert.equal(audit.actor_global_name, 'Mod Global');
    assert.equal(audit.actor_display_name, 'Moderator');
    await assert.rejects(() => service.moderateReport({ id: selected.id, action: 'dismiss', guildId: 'g1', esoServer: 'pc_na', actor }), /no longer available/i);
    await assert.rejects(() => service.moderateReport({ id: selected.id, action: 'remove', guildId: 'g1', esoServer: 'pc_na', actor }), /invalid report action/i);
  } finally { await closeDatabase(db); }
});

test('web maintenance verification requires an active house in the current guild and environment', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-web-verify-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'verify.sqlite') });
  try {
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name,last_verified) VALUES(62,'Grand Psijic Villa','grand psijic villa',NULL),(63,'Other House','other house',NULL)");
    const houses = new SavedHouseService(db);
    const visible = await houses.createPublic({ guildId: 'g1', esoServer: 'pc_na', houseId: 62, esoOwner: 'Owner', createdBy: 'u1', status: 'active' });
    await houses.createPublic({ guildId: 'g2', esoServer: 'pc_na', houseId: 63, esoOwner: 'Other', createdBy: 'u1', status: 'active' });
    const service = new WebAdminService(db);
    const result = await service.verifyHouse({ houseId: 62, guildId: 'g1', esoServer: 'pc_na', actor: { id: 'mod', globalName: 'Mod', displayName: 'Moderator' } });
    assert.equal(result.houseId, 62);
    assert.ok((await one(db, 'SELECT last_verified FROM houses WHERE house_id=62')).last_verified);
    assert.equal((await one(db, "SELECT action,actor_id FROM audit_log WHERE entity_type='house' AND entity_id='62' ORDER BY id DESC")).action, 'house_verified');
    await assert.rejects(() => service.verifyHouse({ houseId: 63, guildId: 'g1', esoServer: 'pc_na', actor: { id: 'mod' } }), /not available/i);
    await assert.rejects(() => service.verifyHouse({ houseId: 62, guildId: 'g1', esoServer: 'pc_eu', actor: { id: 'mod' } }), /not available/i);
    assert.equal(visible.houseId || visible.id, visible.id);
  } finally {
    await closeDatabase(db);
  }
});

test('web duplicate merge is exact-context, transactional, and audited', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-web-merge-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'merge.sqlite') });
  try {
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Psijic Villa','grand psijic villa')");
    const houses = new SavedHouseService(db);
    const keep = await houses.createPublic({ guildId: 'g1', esoServer: 'pc_na', houseId: 62, esoOwner: 'Owner', createdBy: 'u1', status: 'active' });
    await db.query("INSERT INTO saved_houses(eso_server,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,destination_id,display_name,description,tags,status,created_by,updated_by) SELECT eso_server,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,destination_id,display_name,description,tags,status,created_by,updated_by FROM saved_houses WHERE id=?", [keep.id]);
    const remove = await one(db, 'SELECT * FROM saved_houses WHERE id<>? ORDER BY id DESC LIMIT 1', [keep.id]);
    const service = new WebAdminService(db);
    const merged = await service.mergeDuplicate({ keepId: keep.id, removeId: remove.id, guildId: 'g1', esoServer: 'pc_na', actor: { id: 'mod', globalName: 'Mod', displayName: 'Moderator' } });
    assert.equal(merged.keepId, keep.id);
    assert.equal((await one(db, 'SELECT status FROM saved_houses WHERE id=?', [remove.id])).status, 'archived');
    const audit = await one(db, "SELECT * FROM audit_log WHERE action='web_merge_duplicate_house' ORDER BY id DESC");
    assert.equal(audit.actor_display_name, 'Moderator');
    assert.equal(audit.guild_id, 'g1');
    await assert.rejects(() => service.mergeDuplicate({ keepId: keep.id, removeId: remove.id, guildId: 'g1', esoServer: 'pc_eu', actor: { id: 'mod' } }), /not available|active/i);
    await assert.rejects(() => service.mergeDuplicate({ keepId: keep.id, removeId: remove.id, guildId: 'g2', esoServer: 'pc_na', actor: { id: 'mod' } }), /not available|active/i);
  } finally {
    await closeDatabase(db);
  }
});

test('web maintenance cannot list verify or merge Private houses', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-web-private-merge-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'merge.sqlite') });
  try {
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Psijic Villa','grand psijic villa')");
    const houses = new SavedHouseService(db);
    const own = await houses.createPrivate({ originGuildId: 'g1', userId: 'owner', esoServer: 'pc_na', houseId: 62, esoOwner: 'Owner', createdBy: 'owner' });
    const other = await houses.createPrivate({ originGuildId: 'g2', userId: 'other', esoServer: 'pc_na', houseId: 62, esoOwner: 'Owner', createdBy: 'other' });
    const copy = async id => {
      const result = await db.query("INSERT INTO saved_houses(eso_server,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,destination_id,display_name,description,tags,status,created_by,updated_by) SELECT eso_server,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,destination_id,display_name,description,tags,status,created_by,updated_by FROM saved_houses WHERE id=?", [id]);
      return Number(result.insertId);
    };
    const ownDuplicateId = await copy(own.id);
    const otherDuplicateId = await copy(other.id);
    const service = new WebAdminService(db);
    const maintenance = await service.listMaintenance({ guildId: 'g1', esoServer: 'pc_na' });
    assert.deepEqual(maintenance.duplicates,[]);
    assert.deepEqual(maintenance.stale,[]);
    const actor={id:'mod'};
    await assert.rejects(()=>service.verifyHouse({houseId:62,guildId:'g1',esoServer:'pc_na',actor}),/available/i);
    await assert.rejects(()=>service.mergeDuplicate({keepId:own.id,removeId:ownDuplicateId,guildId:'g1',esoServer:'pc_na',actor}),/available|Private/i);
    assert.equal((await one(db,'SELECT status FROM saved_houses WHERE id=?',[ownDuplicateId])).status,'active');
  } finally { await closeDatabase(db); }
});
