import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { transferUnifiedData } from '../src/db/database-migration.js';

test('v4 persistent transfer preserves destinations, passes, reports, onboarding, identities and omits runtime sessions',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-v4-transfer-'));
  const source=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'source.sqlite')}),target=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'target.sqlite')});
  try{
    await migrate(source);await migrate(target);
    await source.query("INSERT INTO discord_guilds(guild_id,guild_name) VALUES('g1','Source Guild')");
    await source.query("INSERT INTO discord_users(discord_user_id,global_name) VALUES('u1','Source User')");
    await source.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Villa','villa')");
    await source.query("INSERT INTO housing_destinations(id,eso_owner,normalized_owner,house_id) VALUES(7,'Owner','owner',62)");
    await source.query("INSERT INTO saved_houses(id,scope,guild_id,origin_guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(8,'global',NULL,'g1',62,'Owner','owner',7,'active','u1','u1')");
    await source.query("INSERT INTO house_comments(id,destination_id,saved_house_id,discord_user_id,comment_text) VALUES(9,7,8,'u1','Comment')");
    await source.query("INSERT INTO tours(id,visibility,creator_id,name,house_source) VALUES(10,'global','u1','Route','global')");
    await source.query("INSERT INTO tour_stops(id,tour_id,position,saved_house_id) VALUES(11,10,1,8)");
    await source.query("INSERT INTO house_share_passes(id,token_hash,saved_house_id,created_by,status) VALUES(12,'hash-house',8,'u1','revoked')");
    await source.query("INSERT INTO tour_share_passes(id,token_hash,tour_id,created_by,status) VALUES(13,'hash-tour',10,'u1','active')");
    await source.query("INSERT INTO housing_reports(id,destination_id,saved_house_id,tour_id,reporter_id,problem_type,status) VALUES(14,7,8,10,'u1','other','open')");
    await source.query("INSERT INTO user_onboarding(discord_user_id,status) VALUES('u1','completed')");
    await source.query("INSERT INTO tour_sessions(tour_id,guild_id,channel_id,mode,started_by) VALUES(10,'g1','c1','shared','u1')");
    await source.query("INSERT INTO share_pass_sessions(tour_share_pass_id,tour_session_id) VALUES(13,1)");
    await transferUnifiedData(source,target);
    for(const [table,count] of [['housing_destinations',1],['saved_houses',1],['house_comments',1],['tours',1],['tour_stops',1],['house_share_passes',1],['tour_share_passes',1],['housing_reports',1],['user_onboarding',1],['tour_sessions',0],['share_pass_sessions',0]])
      assert.equal((await target.query(`SELECT count(*) c FROM ${table}`))[0].c,count,table);
    assert.equal((await target.query('SELECT destination_id FROM saved_houses WHERE id=8'))[0].destination_id,7);
    assert.equal((await target.query('SELECT tour_id FROM housing_reports WHERE id=14'))[0].tour_id,10);
  }finally{await closeDatabase(source);await closeDatabase(target);}
});
