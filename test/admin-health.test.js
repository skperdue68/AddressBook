import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { AdminHealthService } from '../src/services/admin-health-service.js';
import { adminHealthPayload, adminSharePassesPayload } from '../src/ui/housing-ui.js';

test('SQLite health snapshot uses bounded counts and never claims a backup exists',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-health-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'health.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO guild_settings(guild_id,guild_name,eso_server,bot_channel_id,bot_channel_name,registration_policy,staff_role_ids,registration_role_ids,tour_role_ids) VALUES('g1','Guild','pc_na','missing','Deleted Channel','approval','[\"r1\",\"r2\"]','[]','[\"r3\"]')");
    await db.query("INSERT INTO global_moderator_requests(discord_user_id,eso_server,origin_guild_id,reason,status) VALUES('u','pc_na','g1','help','pending')");
    await db.query("INSERT INTO global_moderator_requests(discord_user_id,eso_server,origin_guild_id,reason,status) VALUES('u','pc_eu','g2','help','pending')");
    const snapshot=await new AdminHealthService(db).snapshot({guildId:'g1',availableChannelIds:['other']});
    assert.equal(snapshot.backend,'SQLite');
    assert.equal(snapshot.connection,'Connected');
    assert.equal(snapshot.version,'1.0.59');
    assert.equal(snapshot.channel.missing,true);
    assert.deepEqual(snapshot.roleCounts,{moderator:2,trusted:0,tours:1});
    assert.equal(snapshot.globalModeratorRequests,1);
    assert.deepEqual(snapshot.reminderHealth,{staleClaims:0,failedDeliveries:0});
    assert.deepEqual(snapshot.integrity,{orphanStops:0,duplicateDestinations:0,mismatchedHouses:0,staleProgress:0});
    assert.deepEqual(snapshot.freshness,{staleHouses:0});
    assert.deepEqual(snapshot.duplicates,{duplicateGroups:0});
    const all=await new AdminHealthService(db,{version:'0.8.0'}).snapshot({guildId:'g1',allEnvironments:true,isApprover:true});
    assert.equal(all.globalModeratorRequests,2);
    assert.equal(snapshot.lastMigration.version,10);
    assert.match(snapshot.backupReminder,/not recorded|configure.*backup/i);
    const rendered=JSON.stringify(adminHealthPayload(snapshot));
    for(const secret of ['password','token_hash','DB_PASSWORD','SecretDISCORD'])assert.equal(rendered.includes(secret),false);
  }finally{await closeDatabase(db);}
});

test('mocked MariaDB health reports backend connection and aggregate pass counts',async()=>{
  const db={type:'mariadb',query:async(sql,params=[])=>{
    if(sql==='SELECT 1 ok')return [{ok:1}];
    if(sql.includes('schema_migrations'))return [{version:4,applied_at:'2026-09-19'}];
    if(sql.includes('guild_settings'))return [{guild_id:params[0],eso_server:'pc_na',registration_policy:'open',staff_role_ids:'[]',registration_role_ids:'[]',tour_role_ids:'[]'}];
    if(sql.includes('housing_reports'))return [{c:4}];
    if(sql.includes('house_share_passes'))return [{kind:'house',status:'active',c:5},{kind:'house',status:'revoked',c:2},{kind:'tour',status:'active',c:6}];
    throw new Error(`Unexpected query: ${sql}`);
  }};
  const snapshot=await new AdminHealthService(db,{version:'0.8.0'}).snapshot({guildId:'g1'});
  assert.equal(snapshot.backend,'MariaDB');
  assert.deepEqual(snapshot.passes,{house:{active:5,revoked:2},tour:{active:6,revoked:0}});
  assert.equal(snapshot.openReports,4);
  const labels=adminSharePassesPayload(snapshot.passes).components.flatMap(row=>row.toJSON().components.map(component=>component.label));
  assert.ok(labels.includes('Back'));
});
