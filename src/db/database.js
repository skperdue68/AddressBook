import {migrateTourCovers} from './tour-cover-schema.js';
import {migrateHouseImages} from './house-image-schema.js';
import {migrateFeedback} from './feedback-schema.js';
import {migrateCatalog} from './catalog-schema.js';
import {migrateWorkspace} from './workspace-schema.js';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_VERSION, SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V6, SCHEMA_V7, SCHEMA_V8, SCHEMA_V2_COLUMNS, SCHEMA_V9_COLUMNS, SCHEMA_V11 } from './schema.js';
import { SQLITE_SCHEMA_VERSION, SQLITE_SCHEMA_V1, SQLITE_SCHEMA_V2, SQLITE_SCHEMA_V3, SQLITE_SCHEMA_V4, SQLITE_SCHEMA_V6, SQLITE_SCHEMA_V7, SQLITE_SCHEMA_V8, SQLITE_V2_COLUMNS, SQLITE_V9_COLUMNS, SQLITE_SCHEMA_V11 } from './sqlite-schema.js';
import { backfillDestinations, verifyDestinationBackfill } from './destination-migration.js';

const require=createRequire(import.meta.url);

function readPassword(env=process.env){
  const file=String(env.DB_PASSWORD_FILE||'').trim();
  if(file) return fs.readFileSync(file,'utf8').trimEnd();
  return env.DB_PASSWORD||'';
}

export function mariaDatabaseName(env=process.env){
  const name=String(env.DB_NAME||'').trim();
  if(!name)throw new Error('Missing MariaDB configuration: DB_NAME');
  if(!/^[A-Za-z0-9_]+$/.test(name))throw new Error('DB_NAME may contain only letters, numbers, and underscores.');
  return name;
}

export async function ensureMariaDatabase(env=process.env){
  const cfg=databaseConfig({...env,DB_TYPE:'mariadb'});
  const mariadb=require('mariadb');
  const connection=await mariadb.createConnection({host:cfg.host,port:cfg.port,user:cfg.user,password:cfg.password,connectTimeout:cfg.connectTimeout});
  const name=mariaDatabaseName(env);
  try{
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  }catch(err){
    throw new Error(`Could not create or access MariaDB database '${name}'. Grant CREATE DATABASE permission to '${cfg.user}' or create the database manually. ${err.message}`);
  }finally{await connection.end();}
}

export function databaseConfig(env=process.env){
  const type=String(env.DB_TYPE||'sqlite').trim().toLowerCase();
  if(type==='sqlite') return {type:'sqlite',path:String(env.DATABASE_PATH||'./data/eso-housing.sqlite').trim()||'./data/eso-housing.sqlite'};
  if(type!=='mariadb') throw new Error(`Unsupported DB_TYPE '${type}'. Use sqlite or mariadb.`);
  const required=['DB_HOST','DB_NAME','DB_USER'];
  const missing=required.filter(k=>!String(env[k]||'').trim());
  if(missing.length) throw new Error(`Missing MariaDB configuration: ${missing.join(', ')}`);
  return {
    type:'mariadb', host:env.DB_HOST, port:Number(env.DB_PORT||3306), database:env.DB_NAME,
    user:env.DB_USER, charset:'utf8mb4', password:readPassword(env),
    connectionLimit:Math.max(1,Number(env.DB_CONNECTION_LIMIT||5)), bigIntAsNumber:true,
    insertIdAsNumber:true, acquireTimeout:10000, connectTimeout:10000
  };
}

function sqliteSql(sql){
  let s=String(sql).replace(/\s+FOR\s+UPDATE\b/ig,'');
  s=s.replace(/^\s*INSERT\s+IGNORE\s+INTO\s+/i,'INSERT OR IGNORE INTO ');
  if(/INSERT INTO global_moderators/i.test(s) && /ON DUPLICATE KEY UPDATE/i.test(s)){
    s=s.replace(/\s+ON DUPLICATE KEY UPDATE[\s\S]*$/i,
      ' ON CONFLICT(discord_user_id,eso_server) DO UPDATE SET approved_by=excluded.approved_by, request_id=excluded.request_id, approved_at=CURRENT_TIMESTAMP');
  }
  return s;
}

class SQLiteConnection{
  constructor(filename){
    this.type='sqlite'; this.filename=filename;
    fs.mkdirSync(path.dirname(path.resolve(filename)),{recursive:true});
    this.raw=new DatabaseSync(filename);
    this.raw.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  }
  async query(sql,params=[]){
    const q=sqliteSql(sql);
    const stmt=this.raw.prepare(q);
    if(/^\s*(SELECT|WITH|PRAGMA)\b/i.test(q)) return stmt.all(...params);
    const r=stmt.run(...params);
    return {affectedRows:Number(r.changes||0),insertId:Number(r.lastInsertRowid||0)};
  }
  async beginTransaction(){this.raw.exec('BEGIN IMMEDIATE');}
  async commit(){this.raw.exec('COMMIT');}
  async rollback(){this.raw.exec('ROLLBACK');}
  release(){}
  async getConnection(){return this;}
  async end(){this.raw.close();}
}

export function openDatabase(env=process.env){
  const cfg=databaseConfig(env);
  if(cfg.type==='sqlite') return new SQLiteConnection(cfg.path);
  const mariadb=require('mariadb');
  const {type,...poolCfg}=cfg;
  const pool=mariadb.createPool(poolCfg); pool.type='mariadb'; return pool;
}


function sqliteTableExists(raw,name){
  return !!raw.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
}

function cleanLegacyOwner(value){return String(value??'').trim().replace(/^@+/, '');}

function upgradeLegacySqlite(db){
  const raw=db.raw;
  if(!sqliteTableExists(raw,'registered_houses') || sqliteTableExists(raw,'saved_houses')) return false;
  raw.exec('BEGIN IMMEDIATE');
  try{
    const rename=[['house_comments','legacy_house_comments_v0347'],['tours','legacy_tours_v0347'],['tour_stops','legacy_tour_stops_v0347'],['tour_sessions','legacy_tour_sessions_v0347']];
    for(const [from,to] of rename) if(sqliteTableExists(raw,from) && !sqliteTableExists(raw,to)) raw.exec(`ALTER TABLE ${from} RENAME TO ${to}`);
    raw.exec('DROP INDEX IF EXISTS idx_house_comments_target');
    for(const sql of SQLITE_SCHEMA_V1) raw.exec(sql);

    const registered=raw.prepare('SELECT * FROM registered_houses ORDER BY id').all();
    const bookmarks=raw.prepare('SELECT * FROM personal_bookmarks ORDER BY id').all();
    const used=new Set();
    const publicMap=new Map(), privateMap=new Map();
    let next=Math.max(0,...registered.map(r=>Number(r.id)||0),...bookmarks.map(r=>Number(r.id)||0))+1;
    for(const r of registered){const old=Number(r.id);let id=old;if(used.has(id))id=next++;used.add(id);publicMap.set(old,id);}
    for(const r of bookmarks){const old=Number(r.id);let id=old;if(used.has(id)){while(used.has(next))next++;id=next++;}used.add(id);privateMap.set(old,id);}

    const insertSaved=raw.prepare(`INSERT INTO saved_houses(id,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,display_name,description,tags,status,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for(const r of registered){
      const owner=cleanLegacyOwner(r.eso_owner);
      insertSaved.run(publicMap.get(Number(r.id)),'public',String(r.guild_id),String(r.guild_id),null,Number(r.house_id),owner,String(r.normalized_owner||owner.toLowerCase()),r.display_name||null,r.description||null,r.tags||'[]',r.status||'active',String(r.created_by),String(r.updated_by||r.created_by),r.created_at||new Date().toISOString(),r.updated_at||r.created_at||new Date().toISOString());
    }
    for(const r of bookmarks){
      const owner=cleanLegacyOwner(r.eso_owner), user=String(r.discord_user_id);
      insertSaved.run(privateMap.get(Number(r.id)),'private',null,null,user,Number(r.house_id),owner,String(r.normalized_owner||owner.toLowerCase()),r.nickname||null,r.notes||null,r.tags||'[]','active',user,user,r.created_at||new Date().toISOString(),r.updated_at||r.created_at||new Date().toISOString());
    }

    if(sqliteTableExists(raw,'legacy_house_comments_v0347')){
      const insertComment=raw.prepare('INSERT INTO house_comments(id,saved_house_id,discord_user_id,comment_text,created_at) VALUES(?,?,?,?,?)');
      for(const r of raw.prepare('SELECT * FROM legacy_house_comments_v0347 ORDER BY id').all()){
        const savedId=r.scope==='personal'?privateMap.get(Number(r.target_id)):r.scope==='server'?publicMap.get(Number(r.target_id)):null;
        if(!savedId) throw new Error(`Cannot upgrade legacy comment #${r.id}: saved house ${r.target_id} was not found.`);
        insertComment.run(Number(r.id),savedId,String(r.discord_user_id),String(r.comment_text),r.created_at||new Date().toISOString());
      }
    }

    if(sqliteTableExists(raw,'legacy_tours_v0347')){
      const insertTour=raw.prepare('INSERT INTO tours(id,visibility,guild_id,source_guild_id,creator_id,name,description,tags,house_source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
      for(const r of raw.prepare('SELECT * FROM legacy_tours_v0347 ORDER BY id').all()){
        const visibility=r.scope==='server'?'public':'private';
        const source=['private','public','both'].includes(String(r.house_source||''))?String(r.house_source):(visibility==='private'?'private':'public');
        const sourceGuild=['public','both'].includes(source)?(r.source_guild_id||r.guild_id||null):null;
        insertTour.run(Number(r.id),visibility,visibility==='public'?String(r.guild_id):null,sourceGuild==null?null:String(sourceGuild),String(r.creator_id),String(r.name),r.description||null,r.tags||'[]',source,r.created_at||new Date().toISOString(),r.updated_at||r.created_at||new Date().toISOString());
      }
    }

    if(sqliteTableExists(raw,'legacy_tour_stops_v0347')){
      const insertStop=raw.prepare('INSERT INTO tour_stops(id,tour_id,position,saved_house_id,custom_title,notes) VALUES(?,?,?,?,?,?)');
      const seenByTour=new Map(), nextPositionByTour=new Map();
      for(const r of raw.prepare('SELECT * FROM legacy_tour_stops_v0347 ORDER BY tour_id,position,id').all()){
        let savedId=null;
        if(r.personal_bookmark_id!=null)savedId=privateMap.get(Number(r.personal_bookmark_id))||null;
        if(savedId==null && r.registered_house_id!=null)savedId=publicMap.get(Number(r.registered_house_id))||null;
        if(savedId==null)throw new Error(`Cannot upgrade legacy tour stop #${r.id}: its saved-house source was not found.`);
        const tourId=Number(r.tour_id);
        let seen=seenByTour.get(tourId);
        if(!seen){seen=new Set();seenByTour.set(tourId,seen);}
        if(seen.has(savedId))continue;
        seen.add(savedId);
        const position=(nextPositionByTour.get(tourId)||0)+1;
        nextPositionByTour.set(tourId,position);
        insertStop.run(Number(r.id),tourId,position,savedId,r.custom_title??r.title??null,r.notes||null);
      }
    }

    raw.prepare('INSERT OR IGNORE INTO schema_migrations(version) VALUES (?)').run(1);
    raw.exec('COMMIT');
    return true;
  }catch(err){
    try{raw.exec('ROLLBACK');}catch{}
    throw err;
  }
}

export async function closeDatabase(db){ if(db) await db.end(); }

const sqliteTransactions=new WeakMap();
export async function withTransaction(db,fn){
  if(db.type!=='sqlite')return runTransaction(db,fn);
  const previous=sqliteTransactions.get(db)||Promise.resolve();
  const current=previous.catch(()=>{}).then(()=>runTransaction(db,fn));
  sqliteTransactions.set(db,current);
  try{return await current;}finally{if(sqliteTransactions.get(db)===current)sqliteTransactions.delete(db);}
}
async function runTransaction(db,fn){
  const conn=await db.getConnection();
  conn.type=db.type;
  try{
    await conn.beginTransaction(); const value=await fn(conn); await conn.commit(); return value;
  }catch(err){try{await conn.rollback();}catch{} throw err;}
  finally{if(conn!==db && conn.release)conn.release();}
}

export async function migrate(db){
  if(db.type==='sqlite'){
    const upgraded=upgradeLegacySqlite(db);
    if(!upgraded) for(const sql of SQLITE_SCHEMA_V1) db.raw.exec(sql);
    const rows=await db.query('SELECT version FROM schema_migrations ORDER BY version');
    const applied=new Set(rows.map(r=>Number(r.version)));
    if(!applied.has(1)) await db.query('INSERT INTO schema_migrations(version) VALUES (?)',[1]);
    await db.query("UPDATE tours SET house_source=CASE visibility WHEN 'global' THEN 'global' WHEN 'public' THEN 'public_global' ELSE 'all' END");
    if(!applied.has(2)){
      for(const sql of SQLITE_SCHEMA_V2)db.raw.exec(sql);
      for(const [table,columns] of Object.entries(SQLITE_V2_COLUMNS)){
        const existing=new Set(db.raw.prepare(`PRAGMA table_info(${table})`).all().map(r=>r.name));
        for(const [column,type] of Object.entries(columns))if(!existing.has(column))db.raw.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      }
      await db.query('INSERT INTO schema_migrations(version) VALUES (?)',[2]);
      applied.add(2);
    }
    if(!applied.has(3)){
      for(const sql of SQLITE_SCHEMA_V3)db.raw.exec(sql);
      await db.query('INSERT INTO schema_migrations(version) VALUES (?)',[3]);
      applied.add(3);
    }
    if(!applied.has(4)){
      await withTransaction(db,async conn=>{
        const expectedHouses=Number((await one(conn,'SELECT count(*) c FROM saved_houses'))?.c||0);
        const expectedComments=Number((await one(conn,'SELECT count(*) c FROM house_comments'))?.c||0);
        for(const sql of SQLITE_SCHEMA_V4.slice(0,2))await conn.query(sql);
        const savedColumns=new Set((await conn.query('PRAGMA table_info(saved_houses)')).map(row=>row.name));
        if(!savedColumns.has('destination_id'))await conn.query('ALTER TABLE saved_houses ADD COLUMN destination_id INTEGER');
        await backfillDestinations(conn,'sqlite');
        for(const sql of SQLITE_SCHEMA_V4.slice(2))await conn.query(sql);
        await conn.query('CREATE INDEX IF NOT EXISTS idx_saved_destination_id ON saved_houses(destination_id)');
        await verifyDestinationBackfill(conn,'sqlite',{expectedHouses,expectedComments});
        await conn.query('INSERT INTO schema_migrations(version) VALUES (?)',[4]);
      });
      applied.add(4);
    }
    if(!applied.has(5)){
      const additions={
        guild_settings:{eso_server:'TEXT',eso_server_selected_by:'TEXT',eso_server_selected_at:'TEXT'},
        housing_destinations:{eso_server:'TEXT'},
        saved_houses:{eso_server:'TEXT'},
        tours:{eso_server:'TEXT',origin_guild_id:'TEXT'},
        global_moderator_requests:{eso_server:'TEXT'},
        global_moderators:{eso_server:'TEXT'}
      };
      for(const [table,columns] of Object.entries(additions)){
        const existing=new Set((await db.query(`PRAGMA table_info(${table})`)).map(row=>row.name));
        for(const [column,type] of Object.entries(columns))if(!existing.has(column))await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      }
      await db.query('DROP INDEX IF EXISTS uq_global_mod_pending_user');
      await db.query("CREATE UNIQUE INDEX IF NOT EXISTS uq_global_mod_pending_user ON global_moderator_requests(discord_user_id,eso_server) WHERE status='pending'");
      await db.query('CREATE INDEX IF NOT EXISTS idx_saved_environment ON saved_houses(eso_server,scope,status)');
      await db.query('CREATE INDEX IF NOT EXISTS idx_tours_environment ON tours(eso_server,visibility)');
      await db.query('INSERT INTO schema_migrations(version) VALUES (?)',[5]);
      applied.add(5);
    }
    if(!applied.has(6)){
      await withTransaction(db,async conn=>{
        for(const sql of SQLITE_SCHEMA_V6)await conn.query(sql);
        await conn.query('INSERT INTO schema_migrations(version) VALUES (?)',[6]);
      });
      applied.add(6);
    }
    if(!applied.has(7)){
      await withTransaction(db,async conn=>{
        for(const sql of SQLITE_SCHEMA_V7)await conn.query(sql);
        await conn.query('INSERT INTO schema_migrations(version) VALUES (?)',[7]);
      });
      applied.add(7);
    }
    if(!applied.has(8)){
      await withTransaction(db,async conn=>{
        const existing=new Set((await conn.query('PRAGMA table_info(user_onboarding)')).map(row=>row.name));
        for(const [column,type] of SQLITE_SCHEMA_V8)if(!existing.has(column))await conn.query(`ALTER TABLE user_onboarding ADD COLUMN ${column} ${type}`);
        await conn.query('INSERT INTO schema_migrations(version) VALUES (?)',[8]);
      });
      applied.add(8);
    }
    if(!applied.has(9)){
      await withTransaction(db,async conn=>{
        for(const [table,columns] of Object.entries(SQLITE_V9_COLUMNS)){
          const existing=new Set((await conn.query(`PRAGMA table_info(${table})`)).map(row=>row.name));
          for(const [column,type] of Object.entries(columns))if(!existing.has(column))await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
        }
        await conn.query('INSERT INTO schema_migrations(version) VALUES (?)',[9]);
      });
      applied.add(9);
    }
    if(!applied.has(10)){
      await withTransaction(db,async conn=>{
        const existing=new Set((await conn.query('PRAGMA table_info(tour_sessions)')).map(row=>row.name));
        if(!existing.has('launch_visibility'))await conn.query('ALTER TABLE tour_sessions ADD COLUMN launch_visibility TEXT');
        await conn.query('INSERT INTO schema_migrations(version) VALUES (?)',[10]);
      });
      applied.add(10);
    }
    if(!applied.has(11)){for(const sql of SQLITE_SCHEMA_V11)await db.query(sql);await db.query('INSERT INTO schema_migrations(version) VALUES (11)');applied.add(11);}
    await migrateWorkspace(db);applied.add(12);await migrateCatalog(db);applied.add(13);await migrateFeedback(db);applied.add(14);await migrateHouseImages(db);applied.add(15);await migrateTourCovers(db);applied.add(16);
    const latest=Math.max(0,...applied,1);
    if(latest>SQLITE_SCHEMA_VERSION) throw new Error(`Database schema version ${latest} is newer than this HearthBound release (${SQLITE_SCHEMA_VERSION}).`);
    return;
  }
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version INT NOT NULL PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  const rows=await db.query('SELECT version FROM schema_migrations ORDER BY version');
  const applied=new Set(rows.map(r=>Number(r.version)));
  if(!applied.has(1)){
    await withTransaction(db,async conn=>{for(const sql of SCHEMA_V1) await conn.query(sql); await conn.query('INSERT INTO schema_migrations(version) VALUES (?)',[1]);});
    applied.add(1);
  }
  if(!applied.has(2)){
    for(const sql of SCHEMA_V2)await db.query(sql);
    for(const [table,columns] of Object.entries(SCHEMA_V2_COLUMNS)){
      const rows=await db.query('SELECT COLUMN_NAME name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[table]);
      const existing=new Set(rows.map(r=>String(r.name)));
      for(const [column,type] of Object.entries(columns))if(!existing.has(column))await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
    await db.query('INSERT INTO schema_migrations(version) VALUES (?)',[2]);
    applied.add(2);
  }
  if(!applied.has(3)){
    for(const sql of SCHEMA_V3)await db.query(sql);
    await db.query('INSERT INTO schema_migrations(version) VALUES (?)',[3]);
    applied.add(3);
  }
  if(!applied.has(4)){
    for(const sql of SCHEMA_V4.slice(0,1))await db.query(sql);
    const savedColumns=await db.query('SELECT COLUMN_NAME name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',['saved_houses']);
    if(!new Set(savedColumns.map(row=>String(row.name))).has('destination_id'))await db.query('ALTER TABLE saved_houses ADD COLUMN destination_id BIGINT UNSIGNED NULL');
    const commentColumns=await db.query('SELECT COLUMN_NAME name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',['house_comments']);
    const existingComments=new Set(commentColumns.map(row=>String(row.name)));
    const additions={
      destination_id:'BIGINT UNSIGNED NULL',legacy_saved_house_id:'BIGINT UNSIGNED NULL',
      status:"ENUM('active','removed') NOT NULL DEFAULT 'active'",edited_at:'TIMESTAMP NULL'
    };
    for(const [column,type] of Object.entries(additions))if(!existingComments.has(column))await db.query(`ALTER TABLE house_comments ADD COLUMN ${column} ${type}`);
    const expectedHouses=Number((await one(db,'SELECT count(*) c FROM saved_houses'))?.c||0);
    const expectedComments=Number((await one(db,'SELECT count(*) c FROM house_comments'))?.c||0);
    await backfillDestinations(db,'mariadb');
    await verifyDestinationBackfill(db,'mariadb',{expectedHouses,expectedComments});
    const constraints=await db.query('SELECT CONSTRAINT_NAME name FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',['saved_houses']);
    if(!new Set(constraints.map(row=>String(row.name))).has('fk_saved_destination'))await db.query('ALTER TABLE saved_houses ADD CONSTRAINT fk_saved_destination FOREIGN KEY(destination_id) REFERENCES housing_destinations(id)');
    const commentConstraints=await db.query('SELECT CONSTRAINT_NAME name FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',['house_comments']);
    if(!new Set(commentConstraints.map(row=>String(row.name))).has('fk_comment_destination'))await db.query('ALTER TABLE house_comments ADD CONSTRAINT fk_comment_destination FOREIGN KEY(destination_id) REFERENCES housing_destinations(id)');
    await db.query('CREATE INDEX idx_saved_destination_id ON saved_houses(destination_id)');
    await db.query('CREATE INDEX idx_house_comments_destination ON house_comments(destination_id,created_at)');
    for(const sql of SCHEMA_V4.slice(1))await db.query(sql);
    await db.query('INSERT INTO schema_migrations(version) VALUES (?)',[4]);
    applied.add(4);
  }
  if(!applied.has(5)){
    const additions={
      guild_settings:{eso_server:'VARCHAR(32) NULL',eso_server_selected_by:'VARCHAR(32) NULL',eso_server_selected_at:'DATETIME NULL'},
      housing_destinations:{eso_server:'VARCHAR(32) NULL'},
      saved_houses:{eso_server:'VARCHAR(32) NULL'},
      tours:{eso_server:'VARCHAR(32) NULL',origin_guild_id:'VARCHAR(32) NULL'},
      global_moderator_requests:{eso_server:'VARCHAR(32) NULL'},
      global_moderators:{eso_server:'VARCHAR(32) NULL'}
    };
    for(const [table,columns] of Object.entries(additions)){
      const rows=await db.query('SELECT COLUMN_NAME name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[table]);
      const existing=new Set(rows.map(row=>String(row.name)));
      for(const [column,type] of Object.entries(columns))if(!existing.has(column))await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
    await db.query('INSERT INTO schema_migrations(version) VALUES (?)',[5]);
    applied.add(5);
  }
  if(!applied.has(6)){
    await withTransaction(db,async conn=>{
      for(const sql of SCHEMA_V6)await conn.query(sql);
      await conn.query('INSERT INTO schema_migrations(version) VALUES (?)',[6]);
    });
    applied.add(6);
  }
  if(!applied.has(7)){
    await withTransaction(db,async conn=>{
      const columns=await conn.query('SELECT COLUMN_NAME name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',['guild_settings']);
      if(!new Set(columns.map(row=>String(row.name))).has('timezone'))await conn.query(SCHEMA_V7[0]);
      for(const sql of SCHEMA_V7.slice(1))await conn.query(sql);
      await conn.query('INSERT INTO schema_migrations(version) VALUES (?)',[7]);
    });
    applied.add(7);
  }
  if(!applied.has(8)){
    const rows=await db.query('SELECT COLUMN_NAME name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',['user_onboarding']);
    const existing=new Set(rows.map(row=>String(row.name)));
    for(const [column,type] of SCHEMA_V8)if(!existing.has(column))await db.query(`ALTER TABLE user_onboarding ADD COLUMN ${column} ${type}`);
    await db.query('INSERT INTO schema_migrations(version) VALUES (?)',[8]);
    applied.add(8);
  }
  if(!applied.has(9)){
    await withTransaction(db,async conn=>{
      for(const [table,columns] of Object.entries(SCHEMA_V9_COLUMNS)){
        const rows=await conn.query('SELECT COLUMN_NAME name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[table]);
        const existing=new Set(rows.map(row=>String(row.name)));
        for(const [column,type] of Object.entries(columns))if(!existing.has(column))await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      }
      await conn.query('INSERT INTO schema_migrations(version) VALUES (?)',[9]);
    });
    applied.add(9);
  }
  await db.query("UPDATE tours SET house_source=CASE visibility WHEN 'global' THEN 'global' WHEN 'public' THEN 'public_global' ELSE 'all' END");
  if(!applied.has(10)){
    const columns=await db.query('SELECT COLUMN_NAME name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',['tour_sessions']);
    if(!columns.some(row=>row.name==='launch_visibility'))await db.query('ALTER TABLE tour_sessions ADD COLUMN launch_visibility VARCHAR(16) NULL');
    await db.query('INSERT INTO schema_migrations(version) VALUES (?)',[10]);
    applied.add(10);
  }
  if(!applied.has(11)){for(const sql of SCHEMA_V11)await db.query(sql);await db.query('INSERT INTO schema_migrations(version) VALUES (11)');applied.add(11);}
  await migrateWorkspace(db);applied.add(12);await migrateCatalog(db);applied.add(13);await migrateFeedback(db);applied.add(14);await migrateHouseImages(db);applied.add(15);await migrateTourCovers(db);applied.add(16);
  const latest=Math.max(0,...applied);
  if(latest>SCHEMA_VERSION) throw new Error(`Database schema version ${latest} is newer than this HearthBound release (${SCHEMA_VERSION}).`);
}

export async function one(db,sql,params=[]){const rows=await db.query(sql,params);return rows[0]||null;}
