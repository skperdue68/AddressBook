import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { databaseConfig, openDatabase, closeDatabase, migrate, one, mariaDatabaseName } from '../src/db/database.js';
import { seedHouses } from '../src/db/seed-houses.js';

test('databaseConfig defaults to sqlite when DB_TYPE is omitted',()=>{
  const cfg=databaseConfig({DATABASE_PATH:'./data/test.sqlite'});
  assert.equal(cfg.type,'sqlite');
  assert.equal(cfg.path,'./data/test.sqlite');
});

test('databaseConfig selects mariadb only when requested',()=>{
  const cfg=databaseConfig({DB_TYPE:'mariadb',DB_HOST:'db',DB_NAME:'addressbook',DB_USER:'bot',DB_PASSWORD:'secret'});
  assert.equal(cfg.type,'mariadb');
  assert.equal(cfg.host,'db');
});

test('MariaDB database names are safely validated before CREATE DATABASE',()=>{
  assert.equal(mariaDatabaseName({DB_NAME:'addressbook_50'}),'addressbook_50');
  assert.throws(()=>mariaDatabaseName({DB_NAME:'addressbook; DROP DATABASE x'}),/letters, numbers, and underscores/);
});

test('sqlite backend migrates, seeds, and supports the common query interface',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-sqlite-'));
  const dbPath=path.join(dir,'addressbook.sqlite');
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:dbPath});
  try{
    await migrate(db);
    await seedHouses(db);
    const count=await one(db,'SELECT COUNT(*) count FROM houses');
    assert.ok(Number(count.count)>=100);
    const info=await db.query("INSERT INTO guild_settings(guild_id) VALUES(?)",['guild-1']);
    assert.ok(Number(info.affectedRows)>=1);
    const row=await one(db,'SELECT guild_id FROM guild_settings WHERE guild_id=?',['guild-1']);
    assert.equal(row.guild_id,'guild-1');
  }finally{
    await closeDatabase(db);
  }
});

import { SavedHouseService } from '../src/services/saved-house-service.js';
import { CommentService } from '../src/services/comment-service.js';
import { TourService } from '../src/services/tour-service.js';
import { TourSessionService } from '../src/services/tour-session-service.js';
import { GlobalModeratorService } from '../src/services/global-moderator-service.js';

test('sqlite backend supports AddressBook v0.4 house, comment, tour, session, and moderator flows',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-sqlite-flow-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'addressbook.sqlite')});
  try{
    await migrate(db); await seedHouses(db);
    const catalog=await one(db,'SELECT house_id FROM houses ORDER BY house_id LIMIT 1');
    const houses=new SavedHouseService(db);
    const comments=new CommentService(db);
    const tours=new TourService(db);
    const sessions=new TourSessionService(db);
    const moderators=new GlobalModeratorService(db,{GLOBAL_MODERATOR_APPROVER_USER_IDS:'9001'});

    const privateHouse=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'u1',houseId:catalog.house_id,esoOwner:'@privateowner',displayName:'Private',createdBy:'u1'});
    const publicHouse=await houses.createPublic({esoServer:'pc_na',guildId:'g1',houseId:catalog.house_id,esoOwner:'@publicowner',displayName:'Public',createdBy:'u1'});
    const globalHouse=await houses.createGlobal({esoServer:'pc_na',originGuildId:'g1',houseId:catalog.house_id,esoOwner:'@globalowner',displayName:'Global',createdBy:'u1'});
    assert.equal(privateHouse.scope,'private'); assert.equal(publicHouse.scope,'public'); assert.equal(globalHouse.scope,'global');

    const comment=await comments.add({esoServer:'pc_na',savedHouseId:globalHouse.id,commenterUserId:'u2',text:'Great house'});
    assert.equal(comment.comment_text,'Great house');

    const tour=await tours.create({esoServer:'pc_na',originGuildId:'g1',creatorId:'u1',visibility:'global',name:'Global Tour'});
    await tours.addStop(tour.id,globalHouse.id,'First stop');
    assert.equal((await tours.getStops(tour.id)).length,1);

    const shared=await sessions.startShared({tourId:tour.id,guildId:'g1',channelId:'c1',userId:'u1',esoServer:'pc_na'});
    const self=await sessions.startSelfPaced({tourId:tour.id,guildId:'g1',channelId:'c1',userId:'u2',esoServer:'pc_na'});
    assert.equal(shared.mode,'shared'); assert.equal(self.mode,'self_paced');

    const request=await moderators.requestAccess({userId:'u3',guildId:'g1',esoServer:'pc_na',reason:'I help moderate global listings'});
    await moderators.approve(request.id,'9001');
    assert.equal(await moderators.isGlobalModerator('u3','pc_na'),true);
    assert.equal(await moderators.isGlobalModerator('u3','pc_eu'),false);

    const changed=await houses.changeScope(globalHouse.id,'public',{actorId:'u1',targetGuildId:'g1',targetEsoServer:'pc_na'});
    assert.equal(changed.house.scope,'public');
    assert.equal(changed.removedStops,1);
    assert.equal((await tours.getStops(tour.id)).length,0);
  }finally{await closeDatabase(db);}
});

test('sqlite backend automatically upgrades a v0.3.47 database without losing saved houses, comments, or tours',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-legacy-'));
  const dbPath=path.join(dir,'legacy.sqlite');
  const { DatabaseSync }=await import('node:sqlite');
  const legacy=new DatabaseSync(dbPath);
  legacy.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE houses(house_id INTEGER PRIMARY KEY,name TEXT NOT NULL,normalized_name TEXT NOT NULL,zone TEXT,subzone TEXT,category TEXT,classification TEXT,house_type TEXT,style TEXT,furnishing_limit INTEGER,furnishing_limit_plus INTEGER,special_furnishing_limit INTEGER,special_furnishing_limit_plus INTEGER,collectible_limit INTEGER,collectible_limit_plus INTEGER,special_collectible_limit INTEGER,special_collectible_limit_plus INTEGER,population_limit INTEGER,population_limit_plus INTEGER,purchase_type TEXT,gold_price INTEGER,crown_price INTEGER,crown_price_unfurnished INTEGER,crown_price_furnished INTEGER,requirements TEXT,availability TEXT,uesp_url TEXT,last_verified TEXT);
    CREATE TABLE guild_settings(guild_id TEXT PRIMARY KEY,registration_policy TEXT NOT NULL DEFAULT 'open',staff_role_ids TEXT NOT NULL DEFAULT '[]',registration_role_ids TEXT NOT NULL DEFAULT '[]',tour_role_ids TEXT NOT NULL DEFAULT '[]',bot_channel_id TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE registered_houses(id INTEGER PRIMARY KEY AUTOINCREMENT,guild_id TEXT NOT NULL,house_id INTEGER NOT NULL,eso_owner TEXT NOT NULL,normalized_owner TEXT NOT NULL,display_name TEXT,description TEXT,tags TEXT NOT NULL DEFAULT '[]',discord_manager_id TEXT,status TEXT NOT NULL DEFAULT 'active',created_by TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_by TEXT NOT NULL,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE personal_bookmarks(id INTEGER PRIMARY KEY AUTOINCREMENT,discord_user_id TEXT NOT NULL,registered_house_id INTEGER,house_id INTEGER NOT NULL,eso_owner TEXT NOT NULL,normalized_owner TEXT NOT NULL,nickname TEXT,notes TEXT,tags TEXT NOT NULL DEFAULT '[]',created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE house_comments(id INTEGER PRIMARY KEY AUTOINCREMENT,scope TEXT NOT NULL,target_id INTEGER NOT NULL,discord_user_id TEXT NOT NULL,comment_text TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE tours(id INTEGER PRIMARY KEY AUTOINCREMENT,scope TEXT NOT NULL,guild_id TEXT,creator_id TEXT NOT NULL,name TEXT NOT NULL,description TEXT,tags TEXT NOT NULL DEFAULT '[]',house_source TEXT NOT NULL DEFAULT 'public',source_guild_id TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE tour_stops(id INTEGER PRIMARY KEY AUTOINCREMENT,tour_id INTEGER NOT NULL,position INTEGER NOT NULL,registered_house_id INTEGER,personal_bookmark_id INTEGER,house_id INTEGER NOT NULL,eso_owner TEXT NOT NULL,title TEXT,custom_title TEXT,notes TEXT);
    CREATE TABLE tour_sessions(id INTEGER PRIMARY KEY AUTOINCREMENT,tour_id INTEGER NOT NULL,guild_id TEXT NOT NULL,channel_id TEXT NOT NULL,message_id TEXT,started_by TEXT NOT NULL,current_position INTEGER NOT NULL DEFAULT 1,active INTEGER NOT NULL DEFAULT 1,started_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,guild_id TEXT,actor_id TEXT NOT NULL,action TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id TEXT,details TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'Legacy House','legacy house');
    INSERT INTO registered_houses(id,guild_id,house_id,eso_owner,normalized_owner,display_name,description,tags,status,created_by,updated_by) VALUES(5,'g1',1,'Owner','owner','Public Legacy','desc','[]','active','u1','u1');
    INSERT INTO personal_bookmarks(id,discord_user_id,house_id,eso_owner,normalized_owner,nickname,notes,tags) VALUES(5,'u1',1,'Friend','friend','Private Legacy','notes','[]');
    INSERT INTO house_comments(scope,target_id,discord_user_id,comment_text) VALUES('server',5,'u2','public comment'),('personal',5,'u2','private comment');
    INSERT INTO tours(id,scope,guild_id,creator_id,name,description,tags,house_source,source_guild_id) VALUES(7,'server','g1','u1','Legacy Tour',NULL,'[]','public','g1');
    INSERT INTO tour_stops(id,tour_id,position,registered_house_id,house_id,eso_owner,title) VALUES
      (9,7,1,5,1,'Owner','Legacy House'),
      (10,7,2,5,1,'Owner','Duplicate Legacy House');
  `);
  legacy.close();

  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:dbPath});
  try{
    await migrate(db);
    const saved=await db.query('SELECT * FROM saved_houses ORDER BY id');
    assert.equal(saved.length,2);
    assert.deepEqual(new Set(saved.map(r=>r.scope)),new Set(['public','private']));
    assert.equal((await db.query('SELECT * FROM house_comments')).length,2);
    const tour=await one(db,'SELECT * FROM tours WHERE id=?',[7]);
    assert.equal(tour.visibility,'public');
    const stops=await db.query('SELECT * FROM tour_stops WHERE tour_id=? ORDER BY position',[7]);
    assert.equal(stops.length,1);
    assert.equal(stops[0].id,9);
    assert.equal(stops[0].position,1);
  }finally{await closeDatabase(db);}
});
