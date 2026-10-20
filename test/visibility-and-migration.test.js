import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, migrate, closeDatabase } from '../src/db/database.js';
import { tourAllowsHouseScope } from '../src/services/saved-house-service.js';
import { transferUnifiedData, migrationSettings } from '../src/db/database-migration.js';
import { registrationTypePayload, houseScopePayload, tourVisibilityPayload } from '../src/ui/housing-ui.js';
import { TourService } from '../src/services/tour-service.js';

const labels=payload=>payload.components.flatMap(row=>row.components).map(c=>c.data.label).filter(Boolean);

test('house visibility choices are Global Server Private',()=>{
  assert.deepEqual(registrationTypePayload().components[0].components[0].options.map(o=>o.data.label),['Global','Server','Private']);
  assert.deepEqual(labels(houseScopePayload({id:1,scope:'server',house_name:'House'})).slice(0,3),['Global','Server','Private']);
});

test('tour visibility choices are Global Server Private',()=>{
  assert.deepEqual(labels(tourVisibilityPayload('draft')).slice(0,3),['Global Tour','Server Tour','Private Tour']);
});

test('tour visibility alone determines eligible house visibility',()=>{
  for(const s of ['private','public'])assert.equal(tourAllowsHouseScope({visibility:'global'},s),false);
  assert.equal(tourAllowsHouseScope({visibility:'global'},'global'),true);
  assert.equal(tourAllowsHouseScope({visibility:'public'},'private'),false);
  assert.equal(tourAllowsHouseScope({visibility:'public'},'public'),true);
  assert.equal(tourAllowsHouseScope({visibility:'public'},'global'),true);
  for(const s of ['private','public','global'])assert.equal(tourAllowsHouseScope({visibility:'private'},s),true);
});

test('tour creation derives eligibility and candidate directories from visibility',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ab-visibility-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'visibility.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'House','house')");
    await db.query("INSERT INTO saved_houses(eso_server,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES('pc_na','global',NULL,'g1',NULL,1,'Global','global','active','u1','u1')");
    await db.query("INSERT INTO saved_houses(eso_server,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES('pc_na','public','g1','g1',NULL,1,'Server','server','active','u1','u1')");
    await db.query("INSERT INTO saved_houses(eso_server,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES('pc_na','private',NULL,'g1','u1',1,'Private','private','active','u1','u1')");
    const tours=new TourService(db);
    const global=await tours.create({esoServer:'pc_na',originGuildId:'g1',creatorId:'u1',guildId:'g1',visibility:'global',name:'G',houseSource:'all'});
    const server=await tours.create({esoServer:'pc_na',originGuildId:'g1',creatorId:'u1',guildId:'g1',visibility:'public',name:'S',houseSource:'private'});
    const personal=await tours.create({esoServer:'pc_na',originGuildId:'g1',creatorId:'u1',guildId:'g1',visibility:'private',sourceGuildId:'g1',name:'P',houseSource:'global'});
    assert.equal(global.house_source,'global');assert.equal(server.house_source,'public_global');assert.equal(personal.house_source,'all');
    assert.deepEqual((await tours.houseCandidates({creatorId:'u1',sourceGuildId:'g1',esoServer:'pc_na',visibility:'global'})).map(r=>r.source),['global']);
    assert.deepEqual(new Set((await tours.houseCandidates({creatorId:'u1',sourceGuildId:'g1',esoServer:'pc_na',visibility:'public'})).map(r=>r.source)),new Set(['global','server']));
    assert.deepEqual(new Set((await tours.houseCandidates({creatorId:'u1',sourceGuildId:'g1',esoServer:'pc_na',visibility:'private'})).map(r=>r.source)),new Set(['global','server','personal']));
  }finally{await closeDatabase(db);}
});

test('migration requires the destructive confirmation phrase',()=>{
  assert.throws(()=>migrationSettings({MIGRATE:'true',DB_TYPE:'mariadb'}),/MIGRATE_CONFIRM=ERASE_TARGET_DATABASE/);
  assert.deepEqual(migrationSettings({MIGRATE:'true',MIGRATE_CONFIRM:'ERASE_TARGET_DATABASE',DB_TYPE:'mariadb'}).direction,'sqlite-to-mariadb');
  assert.deepEqual(migrationSettings({MIGRATE:'true',MIGRATE_CONFIRM:'ERASE_TARGET_DATABASE',DB_TYPE:'sqlite'}).direction,'mariadb-to-sqlite');
});

test('unified transfer erases destination data and copies source without active sessions',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ab-transfer-'));
  const source=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'source.sqlite')});
  const target=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'target.sqlite')});
  try{
    await migrate(source); await migrate(target);
    await source.query("INSERT INTO discord_guilds(guild_id,guild_name) VALUES('guild','Source Guild')");
    await source.query("INSERT INTO discord_users(discord_user_id,global_name,username) VALUES('user','Source User','sourceuser')");
    await source.query("INSERT INTO discord_guild_members(guild_id,discord_user_id,display_name) VALUES('guild','user','Source Nickname')");
    await source.query("INSERT INTO discord_channels(channel_id,guild_id,channel_name) VALUES('channel','guild','Source Channel')");
    await source.query("INSERT INTO discord_roles(role_id,guild_id,role_name) VALUES('role','guild','Source Role')");
    await source.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'Source House','source house')");
    await source.query("INSERT INTO saved_houses(id,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by,origin_guild_name,house_name,created_by_global_name) VALUES(1,'global',NULL,'guild',NULL,1,'Owner','owner','active','user','user','Source Guild','Source House Alias','Source User')");
    await source.query("INSERT INTO tours(id,visibility,guild_id,source_guild_id,creator_id,name,house_source,creator_global_name) VALUES(1,'global',NULL,NULL,'user','Source Tour','global','Source User')");
    await source.query("INSERT INTO tour_stops(id,tour_id,position,saved_house_id,tour_name,saved_house_name) VALUES(1,1,1,1,'Source Tour','Source House Alias')");
    await source.query("INSERT INTO tour_sessions(tour_id,guild_id,channel_id,mode,started_by) VALUES(1,'guild','channel','shared','user')");
    await target.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(99,'Old House','old house')");
    const summary=await transferUnifiedData(source,target);
    assert.equal((await target.query('SELECT name FROM houses ORDER BY house_id'))[0].name,'Source House');
    assert.equal((await target.query('SELECT COUNT(*) c FROM tour_stops'))[0].c,1);
    assert.equal((await target.query('SELECT COUNT(*) c FROM tour_sessions'))[0].c,0);
    assert.equal(summary.saved_houses,1);
    assert.equal((await target.query("SELECT guild_name FROM discord_guilds WHERE guild_id='guild'"))[0].guild_name,'Source Guild');
    assert.equal((await target.query('SELECT house_name FROM saved_houses WHERE id=1'))[0].house_name,'Source House Alias');
    assert.equal((await target.query('SELECT tour_name FROM tour_stops WHERE id=1'))[0].tour_name,'Source Tour');
  }finally{await closeDatabase(source);await closeDatabase(target);}
});
