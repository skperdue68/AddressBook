import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { DataExportService } from '../src/services/data-export-service.js';

test('guild export preserves environment and excludes unrelated private data', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-export-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'export.sqlite') });
  try {
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'House','house')");
    await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(1,'pc_na','Owner','owner',1)");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,owner_user_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(1,'pc_na','public','g1',NULL,1,'Owner','owner',1,'active','u1','u1'),(2,'pc_na','private',NULL,'u1',1,'Owner','owner',1,'active','u1','u1'),(3,'pc_na','private',NULL,'u2',1,'Owner','owner',1,'active','u2','u2')");
    await db.query("INSERT INTO tours(id,eso_server,visibility,guild_id,creator_id,name,house_source) VALUES(1,'pc_na','public','g1','u1','Guild Route','public_global'),(2,'pc_na','private',NULL,'u1','Private Route','private'),(3,'pc_na','private',NULL,'u2','Other Route','private')");
    await db.query("INSERT INTO tour_stops(id,tour_id,position,saved_house_id) VALUES(1,1,1,1),(2,2,1,2),(3,3,1,3)");
    const service = new DataExportService(db);
    const normal = await service.exportGuild({ guildId: 'g1', esoServer: 'pc_na' });
    assert.deepEqual(normal.houses.map(row => row.id), [1]); assert.deepEqual(normal.tours.map(row => row.id), [1]); assert.deepEqual(normal.stops.map(row => row.id), [1]);
    const privateExport = await service.exportGuild({ guildId: 'g1', esoServer: 'pc_na', userId: 'u1', includePrivate: true });
    assert.deepEqual(privateExport.houses.map(row => row.id), [1, 2]); assert.deepEqual(privateExport.tours.map(row => row.id), [1, 2]);
    assert.match(await service.toJson({ guildId: 'g1', esoServer: 'pc_na' }), /addressbook-export/);
  } finally { await closeDatabase(db); }
});

test('guild administration export includes Private houses and tours from its guild and environment', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-export-private-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'export.sqlite') });
  try {
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'House','house')");
    await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(1,'pc_na','Owner','owner',1),(2,'pc_eu','Owner','owner',1)");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(1,'pc_na','private',NULL,'g1','u1',1,'Owner','owner',1,'active','u1','u1'),(2,'pc_na','private',NULL,'g2','u2',1,'Owner','owner',1,'active','u2','u2'),(3,'pc_eu','private',NULL,'g1','u1',1,'Owner','owner',2,'active','u1','u1'),(4,'pc_na','private',NULL,NULL,'u3',1,'Owner','owner',1,'active','u3','u3')");
    await db.query("INSERT INTO tours(id,eso_server,visibility,origin_guild_id,creator_id,name,house_source) VALUES(1,'pc_na','private','g1','u1','My Tour','private'),(2,'pc_na','private','g2','u2','Other Guild','private'),(3,'pc_eu','private','g1','u1','Other Environment','private'),(4,'pc_na','private',NULL,'u3','Legacy','private')");
    await db.query("INSERT INTO tour_stops(id,tour_id,position,saved_house_id) VALUES(1,1,1,1),(2,2,1,2),(3,3,1,3),(4,4,1,4)");
    await db.query("INSERT INTO house_comments(saved_house_id,destination_id,discord_user_id,comment_text) VALUES(1,1,'u1','Private note'),(2,1,'u2','Other note')");
    const result = await new DataExportService(db).exportGuild({ guildId: 'g1', esoServer: 'pc_na', includePrivate: 'guild' });
    assert.deepEqual(result.houses.map(row => row.id), [1]);
    assert.deepEqual(result.tours.map(row => row.id), [1]);
    assert.deepEqual(result.stops.map(row => row.id), [1]);
    assert.deepEqual(result.comments.map(row => row.comment_text), ['Private note']);
    assert.equal(result.includePrivate, true);
  } finally { await closeDatabase(db); }
});

test('guild export excludes other guild events for Global tours and stale Featured entries from another environment',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-export-boundaries-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'export.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    await db.query("INSERT INTO tours(id,eso_server,visibility,creator_id,name,house_source) VALUES(1,'pc_na','global','u1','Global Route','global')");
    await db.query("INSERT INTO tour_events(guild_id,channel_id,tour_id,eso_server,host_id,title,start_at,created_by,updated_by) VALUES('g1','c1',1,'pc_na','u1','Our Event','2026-10-01','u1','u1'),('g2','c2',1,'pc_na','u2','Other Guild Event','2026-10-01','u2','u2')");
    await db.query("INSERT INTO featured_items(guild_id,target_kind,target_id,position,selected_by) VALUES('g1','tour',1,1,'u1')");
    await db.query("UPDATE tours SET eso_server='pc_eu' WHERE id=1");
    const exportNa=await new DataExportService(db).exportGuild({guildId:'g1',esoServer:'pc_na'});
    assert.deepEqual(exportNa.featured,[]);
    await db.query("UPDATE tours SET eso_server='pc_na' WHERE id=1");
    const exported=await new DataExportService(db).exportGuild({guildId:'g1',esoServer:'pc_na'});
    assert.deepEqual(exported.events.map(e=>e.title),['Our Event']);
  }finally{await closeDatabase(db);}
});

test('guild export omits expired Featured rows',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-export-expiry-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'export.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO tours(id,eso_server,visibility,creator_id,name,house_source) VALUES(1,'pc_na','global','u1','Route','global')");
    await db.query("INSERT INTO featured_items(guild_id,target_kind,target_id,position,expires_at,selected_by) VALUES('g1','tour',1,1,'2020-01-01','u1')");
    assert.deepEqual((await new DataExportService(db).exportGuild({guildId:'g1',esoServer:'pc_na'})).featured,[]);
  }finally{await closeDatabase(db);}
});

test('guild export omits tour stops pointing at another owner’s Private house',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-export-stop-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'export.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'House','house')");
    await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(1,'pc_na','Owner','owner',1)");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(1,'pc_na','private','g2','other',1,'Owner','owner',1,'active','other','other')");
    await db.query("INSERT INTO tours(id,eso_server,visibility,origin_guild_id,creator_id,name,house_source) VALUES(1,'pc_na','private','g1','owner','My Route','all')");
    await db.query('INSERT INTO tour_stops(id,tour_id,position,saved_house_id) VALUES(1,1,1,1)');
    const result=await new DataExportService(db).exportGuild({guildId:'g1',esoServer:'pc_na',includePrivate:'guild'});
    assert.deepEqual(result.houses,[]);
    assert.deepEqual(result.stops,[]);
  }finally{await closeDatabase(db);}
});
