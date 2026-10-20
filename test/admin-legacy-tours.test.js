import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import { GuildEnvironmentService } from '../src/services/guild-environment-service.js';
import { createHousingMenu } from '../src/ui/housing-menu.js';

async function fixture(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-admin-legacy-tours-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'legacy-tours.sqlite')});
  await migrate(db);
  await db.query("INSERT INTO guild_settings(guild_id,guild_name,eso_server) VALUES('g1','Guild One','pc_na'),('g2','Guild Two','pc_eu')");
  await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'House One','house one'),(2,'House Two','house two'),(3,'House Three','house three')");
  await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(1,'pc_na','One','one',1),(2,'pc_na','Two','two',2),(3,'pc_eu','Three','three',3)");
  await db.query(`INSERT INTO saved_houses(id,destination_id,eso_server,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES
    (1,1,'pc_na','public','g1','g1',NULL,1,'One','one','active','u1','u1'),
    (2,2,'pc_na','global',NULL,'g1',NULL,2,'Two','two','active','u1','u1'),
    (3,3,'pc_eu','public','g2','g2',NULL,3,'Three','three','active','u2','u2')`);
  return db;
}

test('legacy-tour administration lists only provably guild-linked Server and Global tours',async()=>{
  const db=await fixture();
  try{
    await db.query(`INSERT INTO tours(id,eso_server,visibility,guild_id,origin_guild_id,creator_id,name,house_source) VALUES
      (1,NULL,'public','g1','g1','u1','Guild One Server Tour','public'),
      (2,NULL,'global',NULL,'g1','u1','Guild One Global Tour','global'),
      (3,NULL,'public','g2','g2','u2','Other Guild Tour','public'),
      (4,NULL,'private',NULL,'g1','u1','Private Tour','all'),
      (5,NULL,'global',NULL,NULL,'u3','Unproven Global Tour','global')`);
    const rows=await new GuildEnvironmentService(db).listGuildLegacyTours({guildId:'g1'});
    assert.deepEqual(rows.map(row=>row.id),[2,1]);
    assert.deepEqual(rows.map(row=>row.name),['Guild One Global Tour','Guild One Server Tour']);
  }finally{await closeDatabase(db);}
});

test('legacy-tour confirmation rejects stale previews and removes incompatible stops atomically',async()=>{
  const db=await fixture();
  try{
    await db.query("INSERT INTO tours(id,eso_server,visibility,guild_id,origin_guild_id,creator_id,name,house_source) VALUES(1,NULL,'global',NULL,'g1','u1','Recover Me','global')");
    await db.query("INSERT INTO tour_stops(id,tour_id,position,saved_house_id) VALUES(1,1,1,2),(2,1,2,1),(3,1,3,3)");
    const service=new GuildEnvironmentService(db);
    const stale=await service.previewGuildLegacyTour({guildId:'g1',tourId:1});
    assert.deepEqual(stale.counts,{stops:3,retainedStops:1,removedStops:2});
    await db.query("DELETE FROM tour_stops WHERE id=3");
    await assert.rejects(()=>service.confirmGuildLegacyTour({guildId:'g1',tourId:1,actorId:'mod',expectedFingerprint:stale.fingerprint}),/impact changed/i);
    assert.equal((await one(db,'SELECT eso_server FROM tours WHERE id=1')).eso_server,null);

    const preview=await service.previewGuildLegacyTour({guildId:'g1',tourId:1});
    const result=await service.confirmGuildLegacyTour({guildId:'g1',tourId:1,actorId:'mod',expectedFingerprint:preview.fingerprint,names:{guildName:'Guild One',actorDisplayName:'Moderator'}});
    assert.equal(result.counts.removedStops,1);
    assert.equal((await one(db,'SELECT eso_server FROM tours WHERE id=1')).eso_server,'pc_na');
    assert.deepEqual((await db.query('SELECT position,saved_house_id FROM tour_stops WHERE tour_id=1 ORDER BY position')).map(row=>[row.position,row.saved_house_id]),[[1,2]]);
    const audit=await one(db,"SELECT actor_display_name,details FROM audit_log WHERE action='claim_legacy_tour'");
    assert.equal(audit.actor_display_name,'Moderator');
    assert.equal(JSON.parse(audit.details).tourId,1);
  }finally{await closeDatabase(db);}
});

test('Legacy Tours administration paginates more than 25 recoverable tours',async()=>{
  const db=await fixture();
  try{
    for(let id=1;id<=26;id++)await db.query("INSERT INTO tours(id,eso_server,visibility,guild_id,origin_guild_id,creator_id,name,house_source) VALUES(?,NULL,'public','g1','g1','u1',?,'public')",[id,`Legacy Tour ${String(id).padStart(2,'0')}`]);
    const updates=[];
    const interaction={customId:'hu:admin:legacy-tours',guildId:'g1',channelId:'c1',user:{id:'mod',username:'Moderator'},guild:{name:'Guild One'},member:{displayName:'Moderator',roles:{cache:new Map()}},update:async payload=>{updates.push(payload);return payload;},reply:async payload=>{throw new Error(`Unexpected reply: ${payload.content}`);}};
    await createHousingMenu(db).button(interaction);
    assert.equal(updates.length,1);
    const json=JSON.stringify(updates[0].components.map(row=>row.toJSON()));
    assert.match(json,/Legacy Tour 01/);
    assert.match(json,/Next/);
    assert.doesNotMatch(json,/Private Tour/);
  }finally{await closeDatabase(db);}
});
