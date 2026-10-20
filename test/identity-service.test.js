import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import { createHandlers } from '../src/handlers.js';
import { SavedHouseService } from '../src/services/saved-house-service.js';

function interaction({guildName='Alphabet Mafia',globalName='Stephanie',displayName='Consigliere Stephanie',channelName='housing',roleName='Housing Moderator'}={}){
  const roles=new Map([['r1',{id:'r1',name:roleName}]]);
  return {
    commandName:'not-housing',guildId:'g1',channelId:'c1',
    guild:{id:'g1',name:guildName},channel:{id:'c1',name:channelName},
    user:{id:'u1',globalName,username:'stephanie'},
    member:{displayName,roles:{cache:roles}}
  };
}

async function seedReferences(db){
  await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'Grand Psijic Villa','grand psijic villa')");
  await db.query("INSERT INTO guild_settings(guild_id,staff_role_ids,bot_channel_id) VALUES('g1','[\"r1\"]','c1')");
  await db.query("INSERT INTO housing_destinations(id,eso_owner,normalized_owner,house_id) VALUES(1,'Owner','owner',1)");
  await db.query("INSERT INTO saved_houses(id,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,destination_id,display_name,status,created_by,updated_by) VALUES(1,'public','g1','g1',NULL,1,'Owner','owner',1,'Pride Palace','active','u1','u1')");
  await db.query("INSERT INTO house_comments(id,destination_id,saved_house_id,legacy_saved_house_id,discord_user_id,comment_text) VALUES(1,1,1,1,'u1','Wonderful')");
  await db.query("INSERT INTO tours(id,visibility,guild_id,origin_guild_id,source_guild_id,creator_id,name,house_source) VALUES(1,'public','g1','g1','g1','u1','Mafia Tour','public_global')");
  await db.query("INSERT INTO tour_stops(id,tour_id,position,saved_house_id) VALUES(1,1,1,1)");
  await db.query("INSERT INTO tour_sessions(id,tour_id,guild_id,channel_id,mode,started_by) VALUES(1,1,'g1','c1','shared','u1')");
  await db.query("INSERT INTO global_moderator_requests(id,eso_server,discord_user_id,origin_guild_id,reason,status,reviewed_by) VALUES(1,'pc_na','u1','g1','Experienced','approved','u1')");
  await db.query("INSERT INTO global_moderators(discord_user_id,eso_server,approved_by,request_id) VALUES('u1','pc_na','u1',1)");
  await db.query("INSERT INTO audit_log(id,guild_id,actor_id,action,entity_type,entity_id) VALUES(1,'g1','u1','edit_tour','tour','1')");
  await db.query("INSERT INTO user_house_states(discord_user_id,discord_global_name,discord_display_name,target_kind,target_id,house_name,eso_owner,is_favorite) VALUES('u1','Old Global','Old Display','destination',1,'Old House','Old Owner',1)");
  await db.query("INSERT INTO saved_house_searches(discord_user_id,discord_global_name,discord_display_name,name,normalized_name,filters_json) VALUES('u1','Old Global','Old Display','Villas','villas','{\"name\":\"villa\"}')");
}

test('every interaction captures readable names and propagates later Discord name changes',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-identity-sync-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'sync.sqlite')});
  try{
    await migrate(db); await seedReferences(db);
    const handlers=createHandlers(db);
    await handlers.chat(interaction());

    assert.deepEqual({...await one(db,'SELECT guild_name,bot_channel_name,staff_role_names FROM guild_settings WHERE guild_id=?',['g1'])},{
      guild_name:'Alphabet Mafia',bot_channel_name:'housing',staff_role_names:'["Housing Moderator"]'
    });
    assert.deepEqual({...await one(db,'SELECT global_name,username FROM discord_users WHERE discord_user_id=?',['u1'])},{global_name:'Stephanie',username:'stephanie'});
    assert.deepEqual({...await one(db,'SELECT discord_global_name,discord_display_name,house_name,eso_owner FROM user_house_states WHERE discord_user_id=?',['u1'])},{discord_global_name:'Stephanie',discord_display_name:'Consigliere Stephanie',house_name:'Grand Psijic Villa',eso_owner:'Owner'});
    assert.deepEqual({...await one(db,'SELECT discord_global_name,discord_display_name FROM saved_house_searches WHERE discord_user_id=?',['u1'])},{discord_global_name:'Stephanie',discord_display_name:'Consigliere Stephanie'});
    assert.equal((await one(db,'SELECT display_name FROM discord_guild_members WHERE guild_id=? AND discord_user_id=?',['g1','u1'])).display_name,'Consigliere Stephanie');
    assert.deepEqual({...await one(db,'SELECT guild_name,origin_guild_name,house_name,created_by_global_name,created_by_display_name FROM saved_houses WHERE id=1')},{
      guild_name:'Alphabet Mafia',origin_guild_name:'Alphabet Mafia',house_name:'Grand Psijic Villa',created_by_global_name:'Stephanie',created_by_display_name:'Consigliere Stephanie'
    });
    assert.deepEqual({...await one(db,'SELECT tour_name,guild_name,channel_name,started_by_display_name FROM tour_sessions WHERE id=1')},{
      tour_name:'Mafia Tour',guild_name:'Alphabet Mafia',channel_name:'housing',started_by_display_name:'Consigliere Stephanie'
    });
    assert.equal((await one(db,'SELECT origin_guild_name FROM tours WHERE id=1')).origin_guild_name,'Alphabet Mafia');
    assert.deepEqual({...await one(db,'SELECT guild_name,actor_global_name,actor_display_name,entity_name FROM audit_log WHERE id=1')},{
      guild_name:'Alphabet Mafia',actor_global_name:'Stephanie',actor_display_name:'Consigliere Stephanie',entity_name:'Mafia Tour'
    });

    await db.query("UPDATE tours SET name='Updated Mafia Tour' WHERE id=1");
    await db.query("UPDATE saved_houses SET display_name='Updated Pride Palace' WHERE id=1");
    await db.query("UPDATE houses SET name='Grand Psijic Estate' WHERE house_id=1");
    await db.query("UPDATE housing_destinations SET eso_owner='RenamedOwner' WHERE id=1");
    await db.query("INSERT INTO discord_users(discord_user_id,global_name,username) VALUES('approver-2','Second Approver','approver2')");
    await db.query("INSERT INTO global_moderators(discord_user_id,eso_server,approved_by) VALUES('u1','pc_eu','approver-2')");
    await handlers.chat(interaction({guildName:'Alphabet Mafia Family',globalName:'Stephanie Perdue',displayName:'Underboss Stephanie',channelName:'housing-directory',roleName:'Housing Boss'}));
    assert.deepEqual({...await one(db,'SELECT guild_name,actor_global_name,actor_display_name,entity_name FROM audit_log WHERE id=1')},{
      guild_name:'Alphabet Mafia Family',actor_global_name:'Stephanie Perdue',actor_display_name:'Underboss Stephanie',entity_name:'Updated Mafia Tour'
    });
    assert.deepEqual({...await one(db,'SELECT tour_name,saved_house_name FROM tour_stops WHERE id=1')},{tour_name:'Updated Mafia Tour',saved_house_name:'Updated Pride Palace'});
    assert.equal((await one(db,'SELECT saved_house_name FROM house_comments WHERE id=1')).saved_house_name,'Updated Pride Palace');
    assert.equal((await one(db,'SELECT discord_global_name FROM global_moderators WHERE discord_user_id=?',['u1'])).discord_global_name,'Stephanie Perdue');
    assert.deepEqual({...await one(db,'SELECT discord_global_name,discord_display_name,house_name,eso_owner FROM user_house_states WHERE discord_user_id=?',['u1'])},{discord_global_name:'Stephanie Perdue',discord_display_name:'Underboss Stephanie',house_name:'Grand Psijic Estate',eso_owner:'RenamedOwner'});
    assert.deepEqual({...await one(db,'SELECT discord_global_name,discord_display_name FROM saved_house_searches WHERE discord_user_id=?',['u1'])},{discord_global_name:'Stephanie Perdue',discord_display_name:'Underboss Stephanie'});
    assert.deepEqual((await db.query("SELECT eso_server,approved_by_global_name FROM global_moderators WHERE discord_user_id='u1' ORDER BY eso_server")).map(row=>({...row})),[
      {eso_server:'pc_eu',approved_by_global_name:'Second Approver'},
      {eso_server:'pc_na',approved_by_global_name:'Stephanie Perdue'}
    ]);
    assert.deepEqual({...await one(db,'SELECT guild_id,actor_id,guild_name,actor_global_name FROM audit_log WHERE id=1')},{guild_id:'g1',actor_id:'u1',guild_name:'Alphabet Mafia Family',actor_global_name:'Stephanie Perdue'});
    assert.equal((await one(db,'SELECT staff_role_names FROM guild_settings WHERE guild_id=?',['g1'])).staff_role_names,'["Housing Boss"]');
  }finally{await closeDatabase(db);}
});

test('missing optional Discord names retain the last known values',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-identity-retain-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'retain.sqlite')});
  try{
    await migrate(db);
    const handlers=createHandlers(db);
    await handlers.chat(interaction());
    await handlers.chat({commandName:'not-housing',guildId:'g1',channelId:'c1',guild:{id:'g1'},channel:{id:'c1'},user:{id:'u1'},member:{roles:{cache:new Map()}}});
    assert.equal((await one(db,'SELECT guild_name FROM discord_guilds WHERE guild_id=?',['g1'])).guild_name,'Alphabet Mafia');
    assert.equal((await one(db,'SELECT global_name FROM discord_users WHERE discord_user_id=?',['u1'])).global_name,'Stephanie');
    assert.equal((await one(db,'SELECT display_name FROM discord_guild_members WHERE guild_id=? AND discord_user_id=?',['g1','u1'])).display_name,'Consigliere Stephanie');
  }finally{await closeDatabase(db);}
});

test('deleting a saved house preserves its readable name in the audit row',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-deleted-name-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'deleted.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'Grand Psijic Villa','grand psijic villa')");
    await db.query("INSERT INTO saved_houses(id,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,display_name,status,created_by,updated_by) VALUES(1,'public','g1','g1',NULL,1,'Owner','owner','Pride Palace','active','u1','u1')");
    await new SavedHouseService(db).delete(1,'u1');
    assert.equal((await one(db,"SELECT entity_name FROM audit_log WHERE action='delete_house'")).entity_name,'Pride Palace');
  }finally{await closeDatabase(db);}
});

test('ready synchronization refreshes accessible guild channel and role names without waiting for a user interaction',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-ready-identities-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'ready.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO guild_settings(guild_id,staff_role_ids,bot_channel_id) VALUES('g1','[\"r1\"]','c1')");
    const guild={id:'g1',name:'Alphabet Mafia',roles:{cache:new Map([['r1',{id:'r1',name:'Housing Moderator'}]])},channels:{cache:new Map([['c1',{id:'c1',name:'housing'}]])}};
    await createHandlers(db).ready({guilds:{cache:new Map([['g1',guild]])}});
    assert.deepEqual({...await one(db,'SELECT guild_name,bot_channel_name,staff_role_names FROM guild_settings WHERE guild_id=?',['g1'])},{guild_name:'Alphabet Mafia',bot_channel_name:'housing',staff_role_names:'["Housing Moderator"]'});
  }finally{await closeDatabase(db);}
});
