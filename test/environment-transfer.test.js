import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { transferUnifiedData } from '../src/db/database-migration.js';

const environments=['pc_na','pc_eu','xbox_na','xbox_eu','playstation_na','playstation_eu','pts'];

test('unified transfer preserves all environment identities and composite moderator grants',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-environment-transfer-'));
  const source=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'source.sqlite')}),target=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'target.sqlite')});
  try{
    await migrate(source);await migrate(target);
    await source.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Villa','villa')");
    for(let n=0;n<environments.length;n++){
      const environment=environments[n],id=n+1,guild=`g${id}`,user=id<3?'u1':`u${id}`;
      await source.query('INSERT INTO guild_settings(guild_id,eso_server,eso_server_selected_by,eso_server_selected_at) VALUES(?,?,?,?)',[guild,environment,'admin','2026-09-20T12:34:56.000Z']);
      await source.query('INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(?,?,?,?,62)',[id,environment,'SameOwner','sameowner']);
      await source.query("INSERT INTO saved_houses(id,eso_server,scope,origin_guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(?,?,'global',?,62,'SameOwner','sameowner',?,'active',?,?)",[id,environment,guild,id,user,user]);
      await source.query("INSERT INTO tours(id,eso_server,visibility,origin_guild_id,creator_id,name,house_source) VALUES(?,?,'global',?,?,?,'global')",[id,environment,guild,user,`Route ${id}`]);
      await source.query('INSERT INTO tour_stops(id,tour_id,position,saved_house_id) VALUES(?,?,1,?)',[id,id,id]);
      await source.query("INSERT INTO global_moderator_requests(id,eso_server,discord_user_id,origin_guild_id,reason,status,reviewed_by) VALUES(?,?,?,?,?,'approved','admin')",[id,environment,user,guild,'Experienced']);
      await source.query('INSERT INTO global_moderators(discord_user_id,eso_server,approved_by,request_id) VALUES(?,?,?,?)',[user,environment,'admin',id]);
    }
    await source.query("INSERT INTO saved_houses(id,eso_server,scope,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(20,'pc_na','private','g1','secret1',62,'SameOwner','sameowner',1,'active','secret1','secret1'),(21,'pc_eu','private','g2','secret2',62,'SameOwner','sameowner',2,'active','secret2','secret2')");
    await source.query("INSERT INTO tours(id,eso_server,visibility,origin_guild_id,creator_id,name,house_source) VALUES(20,'pc_na','private','g1','secret1','Private NA','private'),(21,'pc_eu','private','g2','secret2','Private EU','private')");
    await source.query('INSERT INTO tour_stops(id,tour_id,position,saved_house_id) VALUES(20,20,1,20),(21,21,1,21)');
    await source.query("INSERT INTO house_comments(id,destination_id,saved_house_id,discord_user_id,comment_text) VALUES(1,1,1,'reader','NA comment'),(2,2,2,'reader','EU comment')");
    await source.query("INSERT INTO user_house_states(id,discord_user_id,target_kind,target_id,house_name,eso_owner,is_favorite,visit_state,last_visited_at) VALUES(1,'reader','destination',1,'Villa','SameOwner',1,'visited','2026-09-20 12:00:00')");
    await source.query("INSERT INTO saved_house_searches(id,discord_user_id,name,normalized_name,filter_version,filters_json) VALUES(1,'reader','NA Villas','na villas',1,?)",[JSON.stringify({zones:['Auridon'],visibilities:['global']})]);
    await source.query("INSERT INTO tour_share_passes(id,token_hash,tour_id,created_by,status) VALUES(1,'transfer-token',1,'u1','active')");
    await source.query("UPDATE guild_settings SET timezone='America/Chicago' WHERE guild_id='g1'");
    await source.query("INSERT INTO tour_events(id,guild_id,channel_id,tour_id,eso_server,host_id,title,start_at,created_by,updated_by) VALUES(1,'g1','c1',1,'pc_na','u1','Guild Night','2026-10-01 01:30:00','u1','u1')");
    await source.query("INSERT INTO tour_event_rsvps(event_id,discord_user_id,status,dm_reminders) VALUES(1,'reader','going',1)");
    await source.query("INSERT INTO tour_event_deliveries(id,event_id,schedule_revision,reminder_key,delivery_target,status,attempted_at) VALUES(1,1,1,'24h','channel:c1','sent','2026-09-30 01:30:00')");
    await source.query("INSERT INTO featured_items(id,guild_id,target_kind,target_id,position,selected_by) VALUES(1,'g1','house',1,1,'u1')");
    await source.query("INSERT INTO tour_progress(id,discord_user_id,tour_id,eso_server,status,current_stop_id,last_activity_at) VALUES(1,'reader',1,'pc_na','active',1,'2026-09-20 12:00:00')");
    await source.query("INSERT INTO tour_progress_stops(progress_id,stop_id,completed_at) VALUES(1,1,'2026-09-20 12:00:00')");
    await source.query("INSERT INTO tour_sessions(id,tour_id,guild_id,channel_id,mode,started_by) VALUES(1,1,'g1','c1','self_paced','viewer')");
    await source.query('INSERT INTO share_pass_sessions(tour_share_pass_id,tour_session_id) VALUES(1,1)');

    const summary=await transferUnifiedData(source,target);
    assert.deepEqual((await target.query("SELECT discord_user_id,eso_server FROM global_moderators WHERE discord_user_id='u1' ORDER BY eso_server")).map(row=>({...row})),[
      {discord_user_id:'u1',eso_server:'pc_eu'},{discord_user_id:'u1',eso_server:'pc_na'}
    ]);
    assert.equal(Number((await target.query('SELECT count(*) c FROM housing_destinations'))[0].c),7);
    assert.deepEqual((await target.query("SELECT sh.id,sh.eso_server,sh.origin_guild_id,sh.owner_user_id FROM saved_houses sh WHERE sh.scope='private' ORDER BY sh.id")).map(row=>({...row})),[
      {id:20,eso_server:'pc_na',origin_guild_id:'g1',owner_user_id:'secret1'},
      {id:21,eso_server:'pc_eu',origin_guild_id:'g2',owner_user_id:'secret2'}
    ]);
    assert.deepEqual((await target.query("SELECT id,eso_server,origin_guild_id,creator_id FROM tours WHERE visibility='private' ORDER BY id")).map(row=>({...row})),[
      {id:20,eso_server:'pc_na',origin_guild_id:'g1',creator_id:'secret1'},
      {id:21,eso_server:'pc_eu',origin_guild_id:'g2',creator_id:'secret2'}
    ]);
    assert.deepEqual((await target.query('SELECT tour_id,saved_house_id FROM tour_stops WHERE id IN (20,21) ORDER BY id')).map(row=>({...row})),[{tour_id:20,saved_house_id:20},{tour_id:21,saved_house_id:21}]);
    assert.equal(Number((await target.query('SELECT count(*) c FROM house_comments'))[0].c),2);
    assert.equal(Number((await target.query('SELECT count(*) c FROM tour_sessions'))[0].c),0);
    assert.equal(Number((await target.query('SELECT count(*) c FROM share_pass_sessions'))[0].c),0);
    assert.equal((await target.query("SELECT timezone FROM guild_settings WHERE guild_id='g1'"))[0].timezone,'America/Chicago');
    assert.equal(Number((await target.query('SELECT count(*) c FROM tour_events'))[0].c),1);
    assert.equal(Number((await target.query('SELECT count(*) c FROM tour_event_rsvps'))[0].c),1);
    assert.equal(Number((await target.query('SELECT count(*) c FROM tour_event_deliveries'))[0].c),1);
    assert.equal(Number((await target.query('SELECT count(*) c FROM featured_items'))[0].c),1);
    assert.equal(Number((await target.query('SELECT count(*) c FROM tour_progress'))[0].c),1);
    assert.equal(Number((await target.query('SELECT count(*) c FROM tour_progress_stops'))[0].c),1);
    assert.deepEqual({...((await target.query('SELECT target_kind,target_id,is_favorite,visit_state,last_visited_at FROM user_house_states WHERE id=1'))[0])},{target_kind:'destination',target_id:1,is_favorite:1,visit_state:'visited',last_visited_at:'2026-09-20 12:00:00'});
    assert.deepEqual({...((await target.query('SELECT filter_version,filters_json FROM saved_house_searches WHERE id=1'))[0])},{filter_version:1,filters_json:JSON.stringify({zones:['Auridon'],visibilities:['global']})});
    assert.deepEqual(Object.keys(summary.saved_housesByEnvironment).sort(),[...environments].sort());
    assert.equal((await target.query("SELECT eso_server_selected_at FROM guild_settings WHERE guild_id='g1'"))[0].eso_server_selected_at,'2026-09-20 12:34:56.000');
  }finally{await closeDatabase(source);await closeDatabase(target);}
});
