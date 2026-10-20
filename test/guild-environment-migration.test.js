import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import { assignGuildLegacyData, inferLegacyGlobalTours, verifyEnvironmentMigration } from '../src/db/environment-migration.js';

async function fixture(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-env-migration-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'migration.sqlite')});
  await migrate(db);
  await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'Legacy House','legacy house'),(2,'Second House','second house')");
  return db;
}

test('guild legacy assignment claims deterministic houses and infers only single-environment Global tours',async()=>{
  const db=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id) VALUES('g-na'),('g-eu')");
    await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(1,NULL,'Owner','owner',1),(2,NULL,'Other','other',2)");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(1,NULL,'global',NULL,'g-na',NULL,1,'Owner','owner',1,'active','u1','u1'),(2,NULL,'global',NULL,'g-na',NULL,2,'Other','other',2,'active','u1','u1'),(3,NULL,'private',NULL,NULL,'u1',1,'Private','private',1,'active','u1','u1')");
    await db.query("INSERT INTO house_comments(id,destination_id,saved_house_id,discord_user_id,comment_text) VALUES(1,1,1,'u9','Keep this comment')");
    await db.query("INSERT INTO tours(id,eso_server,visibility,origin_guild_id,creator_id,name,house_source) VALUES(1,NULL,'global','g-na','u1','Deterministic','global'),(2,NULL,'global','g-na','u1','Conflicting','global')");
    await db.query("INSERT INTO tour_stops(id,tour_id,position,saved_house_id) VALUES(1,1,1,1),(2,2,1,1),(3,2,2,3)");

    const result=await assignGuildLegacyData(db,{guildId:'g-na',esoServer:'pc_na',actorId:'u1'});
    assert.equal(result.houses,2);
    assert.equal((await one(db,'SELECT eso_server FROM saved_houses WHERE id=1')).eso_server,'pc_na');
    assert.equal((await one(db,'SELECT eso_server FROM saved_houses WHERE id=2')).eso_server,'pc_na');
    assert.equal((await one(db,'SELECT eso_server FROM saved_houses WHERE id=3')).eso_server,null);
    assert.equal((await one(db,'SELECT eso_server FROM tours WHERE id=1')).eso_server,'pc_na');
    assert.equal((await one(db,'SELECT eso_server FROM tours WHERE id=2')).eso_server,null);
    assert.equal((await one(db,'SELECT eso_server FROM housing_destinations WHERE id=1')).eso_server,'pc_na');
    assert.equal(Number((await one(db,'SELECT count(*) c FROM house_comments WHERE destination_id=1')).c),1);
    await verifyEnvironmentMigration(db);
  }finally{await closeDatabase(db);}
});

test('a later environment claim gets a new destination without copying legacy comments',async()=>{
  const db=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id) VALUES('g-na'),('g-eu')");
    await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(1,NULL,'Owner','owner',1)");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,origin_guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(1,NULL,'global','g-na',1,'Owner','owner',1,'active','u1','u1'),(2,NULL,'global','g-eu',1,'Owner','owner',1,'active','u2','u2')");
    await db.query("INSERT INTO house_comments(id,destination_id,saved_house_id,discord_user_id,comment_text) VALUES(1,1,1,'u9','Legacy comment')");
    await assignGuildLegacyData(db,{guildId:'g-na',esoServer:'pc_na',actorId:'u1'});
    await assignGuildLegacyData(db,{guildId:'g-eu',esoServer:'pc_eu',actorId:'u2'});
    const rows=await db.query('SELECT id,eso_server FROM housing_destinations ORDER BY id');
    assert.deepEqual(rows.map(row=>row.eso_server),['pc_na','pc_eu']);
    assert.equal(Number((await one(db,'SELECT count(*) c FROM house_comments WHERE destination_id=2')).c),0);
  }finally{await closeDatabase(db);}
});
