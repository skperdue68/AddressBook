import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const env=fs.readFileSync('.env.example','utf8');
const db=fs.readFileSync('src/db/database.js','utf8');
const schema=fs.existsSync('src/db/schema.js')?fs.readFileSync('src/db/schema.js','utf8'):'';
const sqliteSchema=fs.existsSync('src/db/sqlite-schema.js')?fs.readFileSync('src/db/sqlite-schema.js','utf8'):'';

test('runtime supports SQLite by default and optional MariaDB',()=>{
  assert.ok(pkg.dependencies?.mariadb,'mariadb dependency missing');
  assert.match(env,/DB_TYPE=sqlite/);
  assert.match(env,/DATABASE_PATH=/);
  assert.match(env,/DB_HOST=/);
  assert.match(env,/DB_NAME=/);
  assert.match(env,/DB_USER=/);
  assert.match(env,/DB_PASSWORD=/);
  assert.match(env,/DB_PASSWORD_FILE=/);
  assert.match(db,/node:sqlite/);
  assert.match(db,/type:\s*['"]mariadb['"]/);
});

test('MariaDB schema has unified scopes, moderator tables, and transient sessions',()=>{
  assert.match(schema,/CREATE TABLE IF NOT EXISTS saved_houses/i);
  assert.match(schema,/scope ENUM\('private','public','global'\)/i);
  assert.match(schema,/CREATE TABLE IF NOT EXISTS global_moderators/i);
  assert.match(schema,/CREATE TABLE IF NOT EXISTS global_moderator_requests/i);
  assert.match(schema,/CREATE TABLE IF NOT EXISTS tour_sessions/i);
  assert.match(schema,/mode ENUM\('self_paced','shared'\)/i);
  assert.match(schema,/saved_house_id BIGINT UNSIGNED NOT NULL/i);
  assert.match(schema,/ON DELETE CASCADE/i);
});

test('both schemas enforce one pending global moderator request per user and environment',()=>{
  assert.match(schema,/pending_user_key/);
  assert.match(schema,/uq_global_mod_pending_user/);
  assert.match(sqliteSchema,/uq_global_mod_pending_user/);
  assert.match(sqliteSchema,/WHERE status='pending'/);
});

test('both v4 schemas define destinations sharing reports and onboarding together',()=>{
  for(const table of ['housing_destinations','house_share_passes','tour_share_passes','share_pass_sessions','housing_reports','user_onboarding']){
    assert.match(schema,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`,'i'),`MariaDB ${table}`);
    assert.match(sqliteSchema,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`,'i'),`SQLite ${table}`);
  }
  assert.match(schema,/UNIQUE KEY uq_housing_destination\(eso_server,normalized_owner,house_id\)/i);
  assert.match(sqliteSchema,/UNIQUE\(eso_server,normalized_owner,house_id\)/i);
});

test('both v6 schemas define personal state and saved searches with owner uniqueness',()=>{
  for(const table of ['user_house_states','saved_house_searches']){
    assert.match(schema,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`,'i'),`MariaDB ${table}`);
    assert.match(sqliteSchema,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`,'i'),`SQLite ${table}`);
  }
  assert.match(schema,/UNIQUE KEY uq_user_house_target\(discord_user_id,target_kind,target_id\)/i);
  assert.match(schema,/visit_state ENUM\('none','want_to_visit','visited'\)/i);
  assert.match(schema,/INDEX idx_user_house_favorite\(discord_user_id,is_favorite,updated_at\)/i);
  assert.match(schema,/INDEX idx_user_house_visit\(discord_user_id,visit_state,last_visited_at\)/i);
  assert.match(schema,/UNIQUE KEY uq_saved_search_name\(discord_user_id,normalized_name\)/i);
  assert.match(sqliteSchema,/UNIQUE\(discord_user_id,target_kind,target_id\)/i);
  assert.match(sqliteSchema,/UNIQUE\(discord_user_id,normalized_name\)/i);
});
