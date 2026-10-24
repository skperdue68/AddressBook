import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,migrate,closeDatabase,one} from '../src/db/database.js';
test('v11 adds grant and cycle tables and upgrades v10 without erasing data',async t=>{
 const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:':memory:'});t.after(()=>closeDatabase(db));await migrate(db);
 assert.equal((await one(db,'SELECT MAX(version) n FROM schema_migrations')).n,12);
 await db.query("INSERT INTO guild_settings(guild_id) VALUES('preserve')");
 for(const name of ['server_moderators','server_moderator_requests','featured_house_cycles'])await db.query(`DROP TABLE ${name}`);
 await db.query('DELETE FROM schema_migrations WHERE version=11');await migrate(db);await migrate(db);
 assert.equal((await one(db,'SELECT COUNT(*) n FROM guild_settings')).n,1);
 for(const name of ['server_moderators','server_moderator_requests','featured_house_cycles'])assert.deepEqual(await db.query(`SELECT * FROM ${name}`),[]);
});
