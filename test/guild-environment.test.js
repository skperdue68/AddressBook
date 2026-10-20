import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import { GuildEnvironmentService } from '../src/services/guild-environment-service.js';
import { GuildService } from '../src/services/guild-service.js';

test('the first completed guild environment selection wins and assigns legacy data once',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-guild-environment-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'guild.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'House','house')");
    await db.query("INSERT INTO guild_settings(guild_id) VALUES('g1')");
    await db.query("INSERT INTO housing_destinations(id,eso_owner,normalized_owner,house_id) VALUES(1,'Owner','owner',1)");
    await db.query("INSERT INTO saved_houses(id,scope,guild_id,origin_guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(1,'public','g1','g1',1,'Owner','owner',1,'active','u1','u1')");
    const guilds=new GuildService(db);
    const service=new GuildEnvironmentService(db,{guildService:guilds});
    const results=await Promise.all([
      service.selectInitial({guildId:'g1',esoServer:'pc_na',actorId:'u1'}),
      service.selectInitial({guildId:'g1',esoServer:'pc_eu',actorId:'u2'})
    ]);
    assert.equal(results.filter(result=>result.selected).length,1);
    const winner=results.find(result=>result.selected).esoServer;
    assert.equal(results.find(result=>!result.selected).esoServer,winner);
    assert.equal((await one(db,"SELECT eso_server FROM guild_settings WHERE guild_id='g1'")).eso_server,winner);
    assert.equal((await one(db,'SELECT eso_server FROM saved_houses WHERE id=1')).eso_server,winner);
    assert.equal(Number((await one(db,"SELECT count(*) c FROM audit_log WHERE action='select_guild_eso_server'")).c),1);
    assert.equal((await guilds.ensureSettings('g1')).eso_server,winner);
  }finally{await closeDatabase(db);}
});

test('requireConfigured rejects an unconfigured guild without inventing an environment',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-guild-required-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'guild.sqlite')});
  try{
    await migrate(db);
    const service=new GuildEnvironmentService(db);
    await assert.rejects(()=>service.requireConfigured('g1'),/still needs an ESO environment selected/);
  }finally{await closeDatabase(db);}
});
