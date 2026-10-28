import {FEEDBACK_COLUMNS} from './feedback-schema.js';
import {CATALOG_TABLE_COLUMNS,catalogRowsFromHouses} from './catalog-schema.js';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, ensureMariaDatabase, migrate, openDatabase, withTransaction } from './database.js';

export const MIGRATION_CONFIRMATION = 'ERASE_TARGET_DATABASE';

const OPTIONAL_V11 = new Set(['house_images','app_feedback',...Object.keys(CATALOG_TABLE_COLUMNS),'server_moderator_requests', 'server_moderators', 'featured_house_cycles', 'owner_catalog_houses', 'usage_events']);
const TABLES = [
  ['app_feedback',FEEDBACK_COLUMNS],
  ['server_moderator_requests',['id', 'guild_id', 'discord_user_id', 'reason', 'status', 'revision', 'requested_at', 'reviewed_at', 'reviewed_by', 'discord_global_name', 'discord_display_name', 'guild_name']],
  ['server_moderators',['guild_id', 'discord_user_id', 'approved_by', 'request_id', 'request_revision', 'approved_at']],
  ['featured_house_cycles',['guild_id', 'eso_server', 'last_rotated_at', 'previous_destination_ids']],

  ['houses',['house_id','name','normalized_name','zone','subzone','category','classification','house_type','style','furnishing_limit','furnishing_limit_plus','special_furnishing_limit','special_furnishing_limit_plus','collectible_limit','collectible_limit_plus','special_collectible_limit','special_collectible_limit_plus','population_limit','population_limit_plus','purchase_type','gold_price','crown_price','crown_price_unfurnished','crown_price_furnished','requirements','availability','uesp_url','last_verified']],
  ...Object.entries(CATALOG_TABLE_COLUMNS),
  ['owner_catalog_houses',['house_id','added_by','added_at']],
  ['usage_events',['id','event_key','occurred_at','actor_id','actor_name','origin_guild_id','origin_guild_name','eso_server','source','kind','target_kind','target_id']],
  ['discord_guilds',['guild_id','guild_name','last_seen_at','updated_at']],
  ['discord_users',['discord_user_id','global_name','username','last_seen_at','updated_at']],
  ['discord_guild_members',['guild_id','discord_user_id','display_name','last_seen_at','updated_at']],
  ['discord_channels',['channel_id','guild_id','channel_name','last_seen_at','updated_at']],
  ['discord_roles',['role_id','guild_id','role_name','last_seen_at','updated_at']],
  ['guild_settings',['guild_id','eso_server','eso_server_selected_by','eso_server_selected_at','timezone','registration_policy','staff_role_ids','registration_role_ids','tour_role_ids','bot_channel_id','created_at','updated_at','guild_name','bot_channel_name','staff_role_names','registration_role_names','tour_role_names']],
  ['housing_destinations',['id','eso_server','eso_owner','normalized_owner','house_id','created_at','updated_at']],
  ['user_house_states',['id','discord_user_id','discord_global_name','discord_display_name','target_kind','target_id','house_name','eso_owner','is_favorite','visit_state','last_visited_at','created_at','updated_at']],
  ['saved_house_searches',['id','discord_user_id','discord_global_name','discord_display_name','name','normalized_name','filter_version','filters_json','created_at','updated_at']],
  ['saved_houses',['id','eso_server','scope','guild_id','origin_guild_id','owner_user_id','house_id','eso_owner','normalized_owner','destination_id','display_name','description','tags','status','created_by','updated_by','created_at','updated_at','guild_name','origin_guild_name','owner_global_name','owner_display_name','house_name','created_by_global_name','created_by_display_name','updated_by_global_name','updated_by_display_name']],
  ['house_images',['id','saved_house_id','storage_key','caption','position','created_by','created_at']],
  ['house_comments',['id','destination_id','saved_house_id','legacy_saved_house_id','saved_house_name','discord_user_id','discord_global_name','discord_display_name','comment_text','status','created_at','edited_at']],
  ['tours',['id','eso_server','visibility','guild_id','origin_guild_id','source_guild_id','creator_id','name','description','tags','house_source','created_at','updated_at','guild_name','origin_guild_name','source_guild_name','creator_global_name','creator_display_name']],
  ['tour_stops',['id','tour_id','position','saved_house_id','custom_title','notes','tour_name','saved_house_name']],
  ['house_share_passes',['id','token_hash','saved_house_id','created_by','created_by_global_name','created_by_display_name','origin_guild_id','origin_guild_name','channel_id','channel_name','message_id','status','usage_count','created_at','last_used_at','revoked_at','revoked_by','revoked_by_global_name','revoked_by_display_name','revocation_reason']],
  ['tour_share_passes',['id','token_hash','tour_id','created_by','created_by_global_name','created_by_display_name','origin_guild_id','origin_guild_name','channel_id','channel_name','message_id','status','usage_count','created_at','last_used_at','revoked_at','revoked_by','revoked_by_global_name','revoked_by_display_name','revocation_reason']],
  ['housing_reports',['id','destination_id','saved_house_id','tour_id','stop_id','house_share_pass_id','tour_share_pass_id','reporter_id','reporter_global_name','reporter_display_name','guild_id','guild_name','problem_type','explanation','status','reviewer_id','reviewer_global_name','reviewer_display_name','created_at','updated_at','resolved_at']],
  ['user_onboarding',['discord_user_id','discord_global_name','discord_display_name','status','started_at','completed_at','skipped_at','updated_at','last_seen_tour_version','acknowledged_features']],
  ['recent_house_views',['discord_user_id','saved_house_id','viewed_at']],
  ['global_moderator_requests',['id','eso_server','discord_user_id','origin_guild_id','reason','status','reviewed_by','requested_at','reviewed_at','discord_global_name','discord_display_name','origin_guild_name','reviewed_by_global_name','reviewed_by_display_name']],
  ['global_moderators',['discord_user_id','eso_server','approved_by','request_id','approved_at','discord_global_name','approved_by_global_name']],
  ['audit_log',['id','guild_id','actor_id','action','entity_type','entity_id','details','created_at','guild_name','actor_global_name','actor_display_name','entity_name']]
  ,['tour_events',['id','guild_id','guild_name','channel_id','channel_name','message_id','tour_id','tour_name','eso_server','host_id','host_global_name','host_display_name','title','description','start_at','status','schedule_revision','started_at','completed_at','cancelled_at','created_by','created_by_global_name','created_by_display_name','updated_by','created_at','updated_at']]
  ,['tour_event_rsvps',['event_id','discord_user_id','discord_global_name','discord_display_name','status','dm_reminders','created_at','updated_at']]
  ,['tour_event_deliveries',['id','event_id','schedule_revision','reminder_key','delivery_target','status','failure_code','failure_message','attempted_at','completed_at']]
  ,['featured_items',['id','guild_id','guild_name','target_kind','target_id','target_name','position','expires_at','selected_by','selected_by_global_name','selected_by_display_name','created_at','updated_at']]
  ,['tour_progress',['id','discord_user_id','discord_global_name','discord_display_name','tour_id','tour_name','eso_server','status','current_stop_id','share_pass_id','run_started_at','last_activity_at','completion_count','last_completed_at','created_at','updated_at']]
  ,['tour_progress_stops',['progress_id','stop_id','completed_at']]
];

export function migrationSettings(env=process.env){
  const enabled=String(env.MIGRATE||'').trim().toLowerCase()==='true';
  if(!enabled)return {enabled:false,direction:null};
  if(String(env.MIGRATE_CONFIRM||'').trim()!==MIGRATION_CONFIRMATION)
    throw new Error(`Migration erases the target database. Set MIGRATE_CONFIRM=${MIGRATION_CONFIRMATION} to continue.`);
  const type=String(env.DB_TYPE||'sqlite').trim().toLowerCase();
  if(!['sqlite','mariadb'].includes(type))throw new Error("DB_TYPE must be 'sqlite' or 'mariadb'.");
  return {enabled:true,direction:type==='mariadb'?'sqlite-to-mariadb':'mariadb-to-sqlite'};
}

const valueForSql=v=>{if(v instanceof Date)v=v.toISOString();if(typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(v))return v.replace('T',' ').replace(/Z$/,'');return v;};

export async function transferUnifiedData(source,target){
  const sourceRows=new Map();
  for(const [table,columns] of TABLES){
    try{await source.query(`SELECT ${columns.join(',')} FROM ${table} LIMIT 0`);sourceRows.set(table,await source.query(`SELECT * FROM ${table}`));}
    catch(err){
      if(!OPTIONAL_V11.has(table)||!(/no such table/i.test(err.message)||err.code==='ER_NO_SUCH_TABLE'))throw err;
      const versions=await source.query('SELECT MAX(version) version FROM schema_migrations');
      if(Number(versions[0]?.version||0)>=(table==='house_images'?15:table==='app_feedback'?14:Object.hasOwn(CATALOG_TABLE_COLUMNS,table)?13:['owner_catalog_houses','usage_events'].includes(table)?12:11))throw err;
      sourceRows.set(table,[]);
    }
  }
  if(!sourceRows.get('house_classifications')?.length){const derived=catalogRowsFromHouses(sourceRows.get('houses')||[]);for(const [table,rows] of Object.entries(derived))sourceRows.set(table,rows);}
  const summary={};
  await withTransaction(target,async conn=>{
    // Delete children before parents. Active tour sessions are intentionally not migrated.
  for(const table of ['house_images','app_feedback','house_capacity_overrides','house_catalog_values','house_classifications','usage_events','owner_catalog_houses','server_moderators','server_moderator_requests','featured_house_cycles','share_pass_sessions','tour_sessions','tour_event_deliveries','tour_event_rsvps','tour_progress_stops','housing_reports','house_share_passes','tour_share_passes','recent_house_views','house_comments','tour_stops','featured_items','tour_progress','tour_events','global_moderators','global_moderator_requests','user_onboarding','user_house_states','saved_house_searches','tours','saved_houses','housing_destinations','guild_settings','audit_log','discord_guild_members','discord_channels','discord_roles','discord_users','discord_guilds','houses'])
      await conn.query(`DELETE FROM ${table}`);
    for(const [table,columns] of TABLES){
      const rows=sourceRows.get(table);
      for(const row of rows){
        const values=columns.map(c=>table==='app_feedback'?row[c]:valueForSql(row[c]));
        await conn.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`,values);
      }
      const count=Number((await conn.query(`SELECT COUNT(*) c FROM ${table}`))[0].c);
      if(count!==rows.length)throw new Error(`Migration verification failed for ${table}: expected ${rows.length}, copied ${count}.`);
      summary[table]=count;
    }
    const badHouse=await conn.query(`SELECT s.id FROM saved_houses s LEFT JOIN housing_destinations d ON d.id=s.destination_id WHERE s.eso_server IS NOT NULL AND (d.id IS NULL OR d.eso_server<>s.eso_server) LIMIT 1`);
    if(badHouse.length)throw new Error(`Migration verification failed: saved house ${badHouse[0].id} does not match its destination environment.`);
    const badStop=await conn.query(`SELECT ts.id FROM tour_stops ts JOIN tours t ON t.id=ts.tour_id JOIN saved_houses s ON s.id=ts.saved_house_id WHERE t.eso_server IS NOT NULL AND (s.eso_server IS NULL OR s.eso_server<>t.eso_server) LIMIT 1`);
    if(badStop.length)throw new Error(`Migration verification failed: tour stop ${badStop[0].id} crosses ESO environments.`);
    for(const [table,column] of [['housing_destinations','eso_server'],['saved_houses','eso_server'],['tours','eso_server'],['global_moderators','eso_server']]){
      const rows=await conn.query(`SELECT ${column} environment,count(*) c FROM ${table} GROUP BY ${column} ORDER BY ${column}`);
      summary[`${table}ByEnvironment`]=Object.fromEntries(rows.map(row=>[row.environment??'unassigned',Number(row.c)]));
    }
  });
  return summary;
}

function markerPath(env){
  return path.resolve(String(env.MIGRATION_MARKER_PATH||`${env.DATABASE_PATH||'./data/eso-housing.sqlite'}.migration-complete`));
}

export async function runConfiguredMigration(env=process.env){
  const settings=migrationSettings(env),marker=markerPath(env);
  if(!settings.enabled){
    if(fs.existsSync(marker))fs.unlinkSync(marker);
    return null;
  }
  if(fs.existsSync(marker))throw new Error(`Migration already completed (${marker}). Set MIGRATE=false and start HearthBound once before requesting another migration.`);
  const sqlitePath=path.resolve(String(env.SQLITE_MIGRATION_PATH||env.DATABASE_PATH||'./data/eso-housing.sqlite'));
  if(settings.direction==='sqlite-to-mariadb'&&!fs.existsSync(sqlitePath))throw new Error(`SQLite migration source not found: ${sqlitePath}`);
  let source,target;
  try{
    if(settings.direction==='sqlite-to-mariadb'){
      source=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:sqlitePath});
      await migrate(source);
      await ensureMariaDatabase(env);
      target=openDatabase({...env,DB_TYPE:'mariadb'});
      await migrate(target);
    }else{
      source=openDatabase({...env,DB_TYPE:'mariadb'});
      // This query validates that the configured source is an existing HearthBound database.
      await source.query('SELECT version FROM schema_migrations ORDER BY version');
      await migrate(source);
      target=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:sqlitePath});
      await migrate(target);
    }
    const summary=await transferUnifiedData(source,target);
    fs.mkdirSync(path.dirname(marker),{recursive:true});
    fs.writeFileSync(marker,JSON.stringify({completedAt:new Date().toISOString(),direction:settings.direction,summary},null,2));
    return {direction:settings.direction,summary,marker};
  }finally{
    await closeDatabase(source).catch(()=>{});
    await closeDatabase(target).catch(()=>{});
  }
}
