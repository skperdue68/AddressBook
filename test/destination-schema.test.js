import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import { SQLITE_SCHEMA_V1, SQLITE_SCHEMA_V2, SQLITE_SCHEMA_V3, SQLITE_V2_COLUMNS } from '../src/db/sqlite-schema.js';

function createV3Database(filename){
  const { DatabaseSync }=requireNodeSqlite();
  const raw=new DatabaseSync(filename);
  raw.exec('PRAGMA foreign_keys=ON');
  for(const sql of SQLITE_SCHEMA_V1)raw.exec(sql);
  for(const sql of SQLITE_SCHEMA_V2)raw.exec(sql);
  for(const [table,columns] of Object.entries(SQLITE_V2_COLUMNS)){
    const existing=new Set(raw.prepare(`PRAGMA table_info(${table})`).all().map(row=>row.name));
    for(const [column,type] of Object.entries(columns))if(!existing.has(column))raw.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
  for(const sql of SQLITE_SCHEMA_V3)raw.exec(sql);
  raw.prepare('INSERT INTO schema_migrations(version) VALUES(?)').run(1);
  raw.prepare('INSERT INTO schema_migrations(version) VALUES(?)').run(2);
  raw.prepare('INSERT INTO schema_migrations(version) VALUES(?)').run(3);
  return raw;
}

let DatabaseSyncClass;
function requireNodeSqlite(){
  if(!DatabaseSyncClass)throw new Error('DatabaseSync was not initialized.');
  return {DatabaseSync:DatabaseSyncClass};
}

test.before(async()=>{
  ({DatabaseSync:DatabaseSyncClass}=await import('node:sqlite'));
});

test('v3 upgrade consolidates matching destinations and preserves comments',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-v4-'));
  const dbPath=path.join(dir,'v3.sqlite');
  const raw=createV3Database(dbPath);
  raw.prepare('INSERT INTO houses(house_id,name,normalized_name) VALUES(?,?,?)').run(62,'Grand Psijic Villa','grand psijic villa');
  raw.prepare('INSERT INTO houses(house_id,name,normalized_name) VALUES(?,?,?)').run(63,'Hall of the Lunar Champion','hall of the lunar champion');
  const insert=raw.prepare(`INSERT INTO saved_houses(scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,display_name,status,created_by,updated_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
  const first=Number(insert.run('global',null,'g1',null,62,'@HouseOwner','houseowner','Global Copy','active','u1','u1').lastInsertRowid);
  const second=Number(insert.run('public','g1','g1',null,62,'HOUSEOWNER','HOUSEOWNER','Server Copy','active','u2','u2').lastInsertRowid);
  const third=Number(insert.run('private',null,null,'u3',63,'OtherOwner','otherowner','Private Other','active','u3','u3').lastInsertRowid);
  const addComment=raw.prepare('INSERT INTO house_comments(saved_house_id,discord_user_id,comment_text,created_at) VALUES(?,?,?,?)');
  addComment.run(first,'u9','first comment','2026-01-01 10:00:00');
  addComment.run(second,'u8','second comment','2026-01-02 10:00:00');
  raw.close();

  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:dbPath});
  try{
    await migrate(db);
    assert.equal(Number((await one(db,'SELECT max(version) v FROM schema_migrations')).v),13);
    const duplicate=await db.query('SELECT id,destination_id FROM saved_houses WHERE house_id=? ORDER BY id',[62]);
    assert.equal(duplicate.length,2);
    assert.equal(duplicate[0].destination_id,duplicate[1].destination_id);
    const different=await one(db,'SELECT destination_id FROM saved_houses WHERE id=?',[third]);
    assert.notEqual(different.destination_id,duplicate[0].destination_id);
    const comments=await db.query('SELECT * FROM house_comments ORDER BY created_at,id');
    assert.deepEqual(comments.map(row=>row.comment_text),['first comment','second comment']);
    assert.deepEqual(comments.map(row=>Number(row.legacy_saved_house_id)),[first,second]);
    assert.equal(Number((await one(db,'SELECT count(*) c FROM saved_houses WHERE destination_id IS NULL')).c),0);
    assert.equal(Number((await one(db,'SELECT count(*) c FROM housing_destinations')).c),2);
    await migrate(db);
    assert.equal(Number((await one(db,'SELECT count(*) c FROM housing_destinations')).c),2);
    assert.equal(Number((await one(db,'SELECT count(*) c FROM house_comments')).c),2);
  }finally{
    await closeDatabase(db);
  }
});

test('failed v4 backfill rolls back without recording or partially applying version 4',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-v4-rollback-'));
  const dbPath=path.join(dir,'v3.sqlite');
  const raw=createV3Database(dbPath);
  raw.prepare('INSERT INTO houses(house_id,name,normalized_name) VALUES(?,?,?)').run(62,'Grand Psijic Villa','grand psijic villa');
  raw.prepare(`INSERT INTO saved_houses(scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by)
    VALUES('global',NULL,'g1',NULL,62,'@','','active','u1','u1')`).run();
  raw.close();

  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:dbPath});
  try{
    await assert.rejects(()=>migrate(db),/ESO owner account name is required|invalid destination/);
    assert.equal(Number((await one(db,'SELECT max(version) v FROM schema_migrations')).v),3);
    assert.equal(Number((await one(db,"SELECT count(*) c FROM sqlite_master WHERE type='table' AND name='housing_destinations'")).c),0);
    const columns=new Set((await db.query('PRAGMA table_info(saved_houses)')).map(row=>row.name));
    assert.equal(columns.has('destination_id'),false);
  }finally{
    await closeDatabase(db);
  }
});
