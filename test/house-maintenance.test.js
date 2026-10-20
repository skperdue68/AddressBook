import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { HouseMaintenanceService } from '../src/services/house-maintenance-service.js';

test('house maintenance finds stale entries and merges safe duplicates', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-maintenance-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'maintenance.sqlite') });
  try {
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name,last_verified) VALUES(1,'House','house',NULL)");
    await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(1,'pc_na','Owner','owner',1)");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(1,'pc_na','public','g1',1,'Owner','owner',1,'active','u1','u1'),(2,'pc_na','public','g1',1,'Owner','owner',1,'active','u1','u1')");
    await db.query("INSERT INTO tours(id,eso_server,visibility,guild_id,creator_id,name,house_source) VALUES(1,'pc_na','public','g1','u1','Route','public_global')");
    await db.query("INSERT INTO tour_stops(id,tour_id,position,saved_house_id) VALUES(1,1,1,2)");
    const service = new HouseMaintenanceService(db, { now: () => new Date('2026-09-21T00:00:00.000Z') });
    assert.equal((await service.stale({ guildId: 'g1', esoServer: 'pc_na' })).length, 2);
    assert.equal((await service.duplicates({ guildId: 'g1', esoServer: 'pc_na' })).length, 1);
    const merged = await service.mergeDuplicate({ keepId: 1, removeId: 2, actorId: 'u1', guildId: 'g1' });
    assert.equal(merged.movedStops, 1); assert.equal((await db.query("SELECT status FROM saved_houses WHERE id=2"))[0].status, 'archived');
    assert.equal((await db.query('SELECT saved_house_id FROM tour_stops WHERE id=1'))[0].saved_house_id, 1);
    assert.equal(await service.markVerified({ houseId: 1, actorId: 'u1', guildId: 'g1' }), true);
  } finally { await closeDatabase(db); }
});
