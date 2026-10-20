import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';

async function fixture(name){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),`addressbook-${name}-`));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'database.sqlite')});
  await migrate(db);
  return db;
}

test('schema version 6 creates personal discovery tables with stable columns and uniqueness',async()=>{
  const db=await fixture('personal-schema');
  try{
    const tables=new Set((await db.query("SELECT name FROM sqlite_master WHERE type='table'")).map(row=>row.name));
    assert.ok(tables.has('user_house_states'));
    assert.ok(tables.has('saved_house_searches'));
    assert.equal(Number((await one(db,'SELECT max(version) v FROM schema_migrations')).v),10);
    assert.deepEqual((await db.query('PRAGMA table_info(user_house_states)')).map(row=>row.name),[
      'id','discord_user_id','discord_global_name','discord_display_name','target_kind','target_id','house_name','eso_owner','is_favorite','visit_state','last_visited_at','created_at','updated_at'
    ]);
    assert.deepEqual((await db.query('PRAGMA table_info(saved_house_searches)')).map(row=>row.name),[
      'id','discord_user_id','discord_global_name','discord_display_name','name','normalized_name','filter_version','filters_json','created_at','updated_at'
    ]);
    await db.query("INSERT INTO user_house_states(discord_user_id,target_kind,target_id,is_favorite) VALUES('u1','official',62,1)");
    await assert.rejects(db.query("INSERT INTO user_house_states(discord_user_id,target_kind,target_id,is_favorite) VALUES('u1','official',62,1)"),/UNIQUE/i);
    await db.query("INSERT INTO saved_house_searches(discord_user_id,name,normalized_name,filters_json) VALUES('u1','Favorites','favorites','{}')");
    await assert.rejects(db.query("INSERT INTO saved_house_searches(discord_user_id,name,normalized_name,filters_json) VALUES('u1','FAVORITES','favorites','{}')"),/UNIQUE/i);
  }finally{await closeDatabase(db);}
});

test('version 5 upgrade preserves existing houses and tours',async()=>{
  const db=await fixture('personal-upgrade');
  try{
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Villa','villa')");
    await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(1,'pc_na','Owner','owner',62)");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,origin_guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(1,'pc_na','global','g1',62,'Owner','owner',1,'active','u1','u1')");
    await db.query("INSERT INTO tours(id,eso_server,visibility,origin_guild_id,creator_id,name,house_source) VALUES(1,'pc_na','global','g1','u1','Route','global')");
    await db.query('DELETE FROM schema_migrations WHERE version=6');
    await db.query('DROP TABLE IF EXISTS user_house_states');
    await db.query('DROP TABLE IF EXISTS saved_house_searches');

    await migrate(db);

    assert.equal(Number((await one(db,'SELECT count(*) c FROM saved_houses')).c),1);
    assert.equal(Number((await one(db,'SELECT count(*) c FROM tours')).c),1);
    assert.equal(Number((await one(db,'SELECT max(version) v FROM schema_migrations')).v),10);
  }finally{await closeDatabase(db);}
});
