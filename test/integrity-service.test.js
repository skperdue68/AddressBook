import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { IntegrityService } from '../src/services/integrity-service.js';

test('integrity scan finds orphan stops and repair renumbers the route', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-integrity-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'integrity.sqlite') });
  try {
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'House','house')");
    await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(1,'pc_na','Owner','owner',1)");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(1,'pc_na','public','g1',1,'Owner','owner',1,'active','u1','u1')");
    await db.query("INSERT INTO tours(id,eso_server,visibility,guild_id,creator_id,name,house_source) VALUES(1,'pc_na','public','g1','u1','Route','public_global')");
    db.raw.exec('PRAGMA foreign_keys=OFF');
    await db.query("INSERT INTO tour_stops(id,tour_id,position,saved_house_id) VALUES(1,1,1,1),(2,1,2,999)");
    db.raw.exec('PRAGMA foreign_keys=ON');
    const service = new IntegrityService(db); const before = await service.scan({ guildId: 'g1', esoServer: 'pc_na' });
    assert.equal(before.counts.orphanStops, 1);
    const repaired = await service.repair({ guildId: 'g1', esoServer: 'pc_na', removeOrphanStops: true });
    assert.equal(repaired.removedOrphanStops, 1); assert.equal(repaired.after.orphanStops, 0);
    assert.equal((await db.query('SELECT position FROM tour_stops WHERE id=1'))[0].position, 1);
  } finally { await closeDatabase(db); }
});
