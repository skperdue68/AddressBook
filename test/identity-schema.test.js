import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase, one } from '../src/db/database.js';

const columnNames=async(db,table)=>new Set((await db.query(`PRAGMA table_info(${table})`)).map(row=>row.name));

test('latest schema retains Discord identity caches and readable companion fields',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-identities-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'identities.sqlite')});
  try{
    await migrate(db);
    assert.equal(Number((await one(db,'SELECT MAX(version) version FROM schema_migrations')).version),14);
    for(const table of ['discord_guilds','discord_users','discord_guild_members','discord_channels','discord_roles']){
      assert.equal(Number((await one(db,"SELECT COUNT(*) count FROM sqlite_master WHERE type='table' AND name=?",[table])).count),1,table);
    }
    const expected={
      guild_settings:['guild_name','bot_channel_name','staff_role_names','registration_role_names','tour_role_names'],
      saved_houses:['guild_name','origin_guild_name','owner_global_name','owner_display_name','house_name','created_by_global_name','created_by_display_name','updated_by_global_name','updated_by_display_name'],
      house_comments:['saved_house_name','discord_global_name','discord_display_name'],
      tours:['guild_name','origin_guild_name','source_guild_name','creator_global_name','creator_display_name'],
      tour_stops:['tour_name','saved_house_name'],
      tour_sessions:['tour_name','guild_name','channel_name','started_by_global_name','started_by_display_name'],
      global_moderators:['discord_global_name','approved_by_global_name'],
      global_moderator_requests:['discord_global_name','discord_display_name','origin_guild_name','reviewed_by_global_name','reviewed_by_display_name'],
      audit_log:['guild_name','actor_global_name','actor_display_name','entity_name']
    };
    for(const [table,names] of Object.entries(expected)){
      const actual=await columnNames(db,table);
      for(const name of names)assert.ok(actual.has(name),`${table}.${name}`);
    }
  }finally{await closeDatabase(db);}
});

test('v9 repairs readable tour columns when an earlier MariaDB migration was already recorded',async()=>{
  const columns=new Map([
    ['guild_settings',new Set()],['saved_houses',new Set()],['house_comments',new Set()],['tours',new Set(['id','guild_name'])],
    ['tour_stops',new Set()],['tour_sessions',new Set()],['global_moderators',new Set()],['global_moderator_requests',new Set()],['audit_log',new Set()]
  ]);
  const versions=new Set([1,2,3,4,5,6,7,8,11]);
  const db={type:'mariadb',getConnection:async()=>db,beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){},query:async(sql,params=[])=>{
    if(/^CREATE TABLE IF NOT EXISTS schema_migrations/i.test(sql))return {affectedRows:0};
    if(/^SELECT version FROM schema_migrations/i.test(sql))return [...versions].map(version=>({version}));
    if(/information_schema\.COLUMNS/i.test(sql))return [...(columns.get(String(params[0]))||[])].map(name=>({name}));
    const alter=/^ALTER TABLE (\w+) ADD COLUMN (\w+)/i.exec(sql);
    if(alter){columns.get(alter[1])?.add(alter[2]);return {affectedRows:1};}
    if(/^INSERT INTO schema_migrations/i.test(sql)){versions.add(Number(params[0]));return {affectedRows:1};}
    if(/^UPDATE tours SET house_source/i.test(sql))return {affectedRows:0};
    throw new Error(`Unexpected SQL: ${sql}`);
  }};
  await migrate(db);
  assert.equal(versions.has(9),true);
  assert.equal(columns.get('tours').has('origin_guild_name'),true);
  assert.equal(columns.get('tours').has('source_guild_name'),true);
  assert.equal(columns.get('tours').has('creator_global_name'),true);
  assert.equal(columns.get('tours').has('creator_display_name'),true);
});

test('v10 upgrades existing SQLite sessions without inventing Private sharing authority',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-session-upgrade-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'upgrade.sqlite')});
  try{
    await migrate(db);
    await db.query('DELETE FROM schema_migrations WHERE version=10');
    await db.query('ALTER TABLE tour_sessions DROP COLUMN launch_visibility');
    await db.query("INSERT INTO tours(id,creator_id,name,visibility,house_source) VALUES(1,'owner','Legacy','private','all')");
    await db.query("INSERT INTO tour_sessions(tour_id,guild_id,channel_id,mode,started_by) VALUES(1,'g','c','shared','owner')");
    await migrate(db);await migrate(db);
    assert.equal((await one(db,'SELECT launch_visibility FROM tour_sessions')).launch_visibility,null);
    assert.equal(Number((await one(db,'SELECT max(version) v FROM schema_migrations')).v),14);
  }finally{await closeDatabase(db);fs.rmSync(dir,{recursive:true,force:true});}
});

test('v10 MariaDB session upgrade is nullable and safe to repeat after interrupted DDL',async()=>{
  for(const existingColumn of [false,true]){
    const versions=new Set([1,2,3,4,5,6,7,8,9]);let column=existingColumn,alters=0;
    const db={type:'mariadb',query:async(sql,params=[])=>{
      if(/^CREATE TABLE/.test(sql)||/^UPDATE tours SET house_source/.test(sql))return {};
      if(/^SELECT version/.test(sql))return [...versions].map(version=>({version}));
      if(/information_schema.COLUMNS/.test(sql)){assert.deepEqual(params,['tour_sessions']);return column?[{name:'launch_visibility'}]:[];}
      if(/^ALTER TABLE tour_sessions/.test(sql)){assert.match(sql,/launch_visibility VARCHAR\(16\) NULL$/);column=true;alters++;return {};}
      if(/^INSERT INTO schema_migrations/.test(sql)){versions.add(Number(params[0]));return {};}
      throw new Error(sql);
    }};
    await migrate(db);await migrate(db);
    assert.ok(versions.has(10));assert.equal(alters,existingColumn?0:1);
  }
});
