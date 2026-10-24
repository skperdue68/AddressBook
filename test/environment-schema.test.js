import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import * as mariaSchema from '../src/db/schema.js';
import { SQLITE_SCHEMA_VERSION } from '../src/db/sqlite-schema.js';

const {SCHEMA_VERSION,SCHEMA_V1,SCHEMA_V4}=mariaSchema;
const SCHEMA_V6=mariaSchema.SCHEMA_V6||[];

const environmentTables=['guild_settings','housing_destinations','saved_houses','tours','global_moderator_requests','global_moderators'];

test('fresh SQLite schema stores environment context and composite environment identities',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-environment-schema-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'schema.sqlite')});
  try{
    await migrate(db);
    assert.equal(SQLITE_SCHEMA_VERSION,12);
    assert.equal(Number((await one(db,'SELECT max(version) version FROM schema_migrations')).version),12);
    for(const table of environmentTables){
      const columns=new Set((await db.query(`PRAGMA table_info(${table})`)).map(row=>row.name));
      assert.equal(columns.has('eso_server'),true,`${table}.eso_server missing`);
    }
    const guildColumns=new Set((await db.query('PRAGMA table_info(guild_settings)')).map(row=>row.name));
    assert.equal(guildColumns.has('eso_server_selected_by'),true);
    assert.equal(guildColumns.has('eso_server_selected_at'),true);

    const destinationIndexes=await db.query('PRAGMA index_list(housing_destinations)');
    const destinationUnique=destinationIndexes.find(row=>Number(row.unique)===1);
    assert.ok(destinationUnique,'environment destination unique index missing');
    const destinationKey=(await db.query(`PRAGMA index_info(${destinationUnique.name})`)).map(row=>row.name);
    assert.deepEqual(destinationKey,['eso_server','normalized_owner','house_id']);

    const moderatorPk=(await db.query('PRAGMA table_info(global_moderators)'))
      .filter(row=>Number(row.pk)>0).sort((a,b)=>Number(a.pk)-Number(b.pk)).map(row=>row.name);
    assert.deepEqual(moderatorPk,['discord_user_id','eso_server']);
  }finally{await closeDatabase(db);}
});

test('MariaDB schema declares the same environment columns and composite identities',()=>{
  assert.equal(SCHEMA_VERSION,12);
  const schema=[...SCHEMA_V1,...SCHEMA_V4,...SCHEMA_V6].join('\n');
  for(const table of environmentTables){
    const tableSql=schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\) ENGINE=InnoDB`,'i'))?.[0]||'';
    assert.match(tableSql,/eso_server VARCHAR\(32\) (?:NULL|NOT NULL)/i,`${table}.eso_server missing`);
  }
  assert.match(schema,/PRIMARY KEY\(discord_user_id,eso_server\)/i);
  assert.match(schema,/UNIQUE KEY uq_housing_destination\(eso_server,normalized_owner,house_id\)/i);
  assert.match(schema,/eso_server_selected_by VARCHAR\(32\) NULL/i);
  assert.match(schema,/eso_server_selected_at (?:DATETIME|TIMESTAMP) NULL/i);
});
