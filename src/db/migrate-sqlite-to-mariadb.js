import {FEEDBACK_COLUMNS} from './feedback-schema.js';
import {CATALOG_TABLE_COLUMNS,catalogRowsFromHouses} from './catalog-schema.js';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { closeDatabase, migrate, openDatabase, one, withTransaction } from './database.js';

const LEGACY_SOURCE_TABLES=['houses','guild_settings','registered_houses','personal_bookmarks','house_comments','tours','tour_stops','audit_log'];
const V11_COLUMNS={'app_feedback':FEEDBACK_COLUMNS,'owner_catalog_houses':['house_id','added_by','added_at'],'usage_events':['id','event_key','occurred_at','actor_id','actor_name','origin_guild_id','origin_guild_name','eso_server','source','kind','target_kind','target_id'],'server_moderator_requests': ['id', 'guild_id', 'discord_user_id', 'reason', 'status', 'revision', 'requested_at', 'reviewed_at', 'reviewed_by', 'discord_global_name', 'discord_display_name', 'guild_name'], 'server_moderators': ['guild_id', 'discord_user_id', 'approved_by', 'request_id', 'request_revision', 'approved_at'], 'featured_house_cycles': ['guild_id', 'eso_server', 'last_rotated_at', 'previous_destination_ids']};
const UNIFIED_SOURCE_TABLES=[...Object.keys(CATALOG_TABLE_COLUMNS),...Object.keys(V11_COLUMNS),'houses','discord_guilds','discord_users','discord_guild_members','discord_channels','discord_roles','guild_settings','housing_destinations','saved_houses','house_comments','tours','tour_stops','recent_house_views','global_moderators','global_moderator_requests','audit_log','tour_events','tour_event_rsvps','tour_event_deliveries','featured_items','tour_progress','tour_progress_stops'];
const TARGET_DATA_TABLES=[...Object.keys(V11_COLUMNS),'discord_guilds','discord_users','discord_guild_members','discord_channels','discord_roles','guild_settings','housing_destinations','saved_houses','house_comments','tours','tour_stops','recent_house_views','tour_sessions','global_moderators','global_moderator_requests','audit_log','tour_events','tour_event_rsvps','tour_event_deliveries','featured_items','tour_progress','tour_progress_stops'];

function sourceRows(db,table){
  const exists=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
  return exists?db.prepare(`SELECT * FROM ${table}`).all():[];
}
function sourceIsUnified(db){return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='saved_houses'").get();}
function cleanOwner(v){return String(v??'').trim().replace(/^@+/,'');}
function normOwner(v){return cleanOwner(v).toLowerCase();}
function timestamp(v){const value=v instanceof Date?v.toISOString():v||new Date().toISOString();return String(value).replace('T',' ').replace(/Z$/,'');}
function asJson(v,fallback='[]'){try{if(v==null||v==='')return fallback;JSON.parse(String(v));return String(v);}catch{return fallback;}}
function sourceUsesPublicForMigration(s){return ['public','both','private_public','public_global','all'].includes(String(s||''));}

export async function assertEmptyTarget(db){
  for(const table of TARGET_DATA_TABLES){
    const row=await one(db,`SELECT COUNT(*) c FROM ${table}`);
    if(Number(row?.c||0)!==0)throw new Error(`MariaDB target is not empty: ${table} contains ${row.c} row(s). Migration made no changes.`);
  }
}

export function buildSavedHouseIdMaps(registered=[],bookmarks=[]){
  const publicMap=new Map(),privateMap=new Map(),used=new Set();
  let next=Math.max(0,...registered.map(r=>Number(r.id)||0),...bookmarks.map(r=>Number(r.id)||0))+1;
  for(const r of registered){const old=Number(r.id);let id=old;if(used.has(id)){id=next++;}used.add(id);publicMap.set(old,id);}
  for(const r of bookmarks){const old=Number(r.id);let id=old;if(used.has(id)){while(used.has(next))next++;id=next++;}used.add(id);privateMap.set(old,id);}
  return {publicMap,privateMap};
}

async function copyHouses(conn,rows){
  const cols=['house_id','name','normalized_name','zone','subzone','category','classification','house_type','style','furnishing_limit','furnishing_limit_plus','special_furnishing_limit','special_furnishing_limit_plus','collectible_limit','collectible_limit_plus','special_collectible_limit','special_collectible_limit_plus','population_limit','population_limit_plus','purchase_type','gold_price','crown_price','crown_price_unfurnished','crown_price_furnished','requirements','availability','uesp_url','last_verified'];
  for(const r of rows){
    const values=cols.map(c=>r[c]??null);
    await conn.query(`INSERT INTO houses(${cols.join(',')}) VALUES(${cols.map(()=>'?').join(',')}) ON DUPLICATE KEY UPDATE ${cols.slice(1).map(c=>`${c}=VALUES(${c})`).join(',')}`,values);
  }
}

async function copyGuildSettings(conn,rows){
  for(const r of rows)await conn.query(`INSERT INTO guild_settings(guild_id,eso_server,eso_server_selected_by,eso_server_selected_at,timezone,registration_policy,staff_role_ids,registration_role_ids,tour_role_ids,bot_channel_id,created_at,updated_at,guild_name,bot_channel_name,staff_role_names,registration_role_names,tour_role_names) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
    String(r.guild_id),r.eso_server||null,r.eso_server_selected_by||null,r.eso_server_selected_at?timestamp(r.eso_server_selected_at):null,r.timezone||null,r.registration_policy||'open',asJson(r.staff_role_ids),asJson(r.registration_role_ids),asJson(r.tour_role_ids),r.bot_channel_id||null,timestamp(r.created_at),timestamp(r.updated_at),r.guild_name||null,r.bot_channel_name||null,asJson(r.staff_role_names),asJson(r.registration_role_names),asJson(r.tour_role_names)
  ]);
}

async function copyHousingDestinations(conn,rows=[]){for(const r of rows)await conn.query('INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',[Number(r.id),r.eso_server||null,String(r.eso_owner),String(r.normalized_owner),Number(r.house_id),timestamp(r.created_at),timestamp(r.updated_at)]);}

async function copyIdentityCaches(conn,src){
  for(const r of src.discord_guilds||[])await conn.query('INSERT INTO discord_guilds(guild_id,guild_name,last_seen_at,updated_at) VALUES(?,?,?,?)',[String(r.guild_id),String(r.guild_name),timestamp(r.last_seen_at),timestamp(r.updated_at)]);
  for(const r of src.discord_users||[])await conn.query('INSERT INTO discord_users(discord_user_id,global_name,username,last_seen_at,updated_at) VALUES(?,?,?,?,?)',[String(r.discord_user_id),r.global_name||null,r.username||null,timestamp(r.last_seen_at),timestamp(r.updated_at)]);
  for(const r of src.discord_guild_members||[])await conn.query('INSERT INTO discord_guild_members(guild_id,discord_user_id,display_name,last_seen_at,updated_at) VALUES(?,?,?,?,?)',[String(r.guild_id),String(r.discord_user_id),String(r.display_name),timestamp(r.last_seen_at),timestamp(r.updated_at)]);
  for(const r of src.discord_channels||[])await conn.query('INSERT INTO discord_channels(channel_id,guild_id,channel_name,last_seen_at,updated_at) VALUES(?,?,?,?,?)',[String(r.channel_id),r.guild_id==null?null:String(r.guild_id),String(r.channel_name),timestamp(r.last_seen_at),timestamp(r.updated_at)]);
  for(const r of src.discord_roles||[])await conn.query('INSERT INTO discord_roles(role_id,guild_id,role_name,last_seen_at,updated_at) VALUES(?,?,?,?,?)',[String(r.role_id),String(r.guild_id),String(r.role_name),timestamp(r.last_seen_at),timestamp(r.updated_at)]);
}

async function copySavedHouses(conn,registered,bookmarks,maps){
  for(const r of registered){
    await conn.query(`INSERT INTO saved_houses(id,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,display_name,description,tags,status,created_by,updated_by,created_at,updated_at) VALUES(?,'public',?,?,NULL,?,?,?,?,?,?,?,?,?,?,?)`,[
      maps.publicMap.get(Number(r.id)),String(r.guild_id),String(r.guild_id),Number(r.house_id),cleanOwner(r.eso_owner),normOwner(r.eso_owner),r.display_name||null,r.description||null,asJson(r.tags),r.status||'active',String(r.created_by),String(r.updated_by||r.created_by),timestamp(r.created_at),timestamp(r.updated_at)
    ]);
  }
  for(const r of bookmarks){
    const user=String(r.discord_user_id);
    await conn.query(`INSERT INTO saved_houses(id,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,display_name,description,tags,status,created_by,updated_by,created_at,updated_at) VALUES(?,'private',NULL,NULL,?,?,?,?,?,?,?,'active',?,?,?,?)`,[
      maps.privateMap.get(Number(r.id)),user,Number(r.house_id),cleanOwner(r.eso_owner),normOwner(r.eso_owner),r.nickname||null,r.notes||null,asJson(r.tags),user,user,timestamp(r.created_at),timestamp(r.updated_at)
    ]);
  }
}

async function copyUnifiedSavedHouses(conn,rows){
  for(const r of rows)await conn.query(`INSERT INTO saved_houses(id,eso_server,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,destination_id,display_name,description,tags,status,created_by,updated_by,created_at,updated_at,guild_name,origin_guild_name,owner_global_name,owner_display_name,house_name,created_by_global_name,created_by_display_name,updated_by_global_name,updated_by_display_name) VALUES(${Array(27).fill('?').join(',')})`,[
    Number(r.id),r.eso_server||null,String(r.scope),r.guild_id==null?null:String(r.guild_id),r.origin_guild_id==null?null:String(r.origin_guild_id),r.owner_user_id==null?null:String(r.owner_user_id),Number(r.house_id),cleanOwner(r.eso_owner),String(r.normalized_owner||normOwner(r.eso_owner)),r.destination_id==null?null:Number(r.destination_id),r.display_name||null,r.description||null,asJson(r.tags),r.status||'active',String(r.created_by),String(r.updated_by||r.created_by),timestamp(r.created_at),timestamp(r.updated_at),r.guild_name||null,r.origin_guild_name||null,r.owner_global_name||null,r.owner_display_name||null,r.house_name||null,r.created_by_global_name||null,r.created_by_display_name||null,r.updated_by_global_name||null,r.updated_by_display_name||null
  ]);
}

async function copyComments(conn,rows,maps){
  for(const r of rows){
    const savedId=r.scope==='personal'?maps.privateMap.get(Number(r.target_id)):r.scope==='server'?maps.publicMap.get(Number(r.target_id)):null;
    if(!savedId)throw new Error(`Cannot migrate comment #${r.id}: ${r.scope} house ${r.target_id} no longer exists.`);
    await conn.query('INSERT INTO house_comments(id,saved_house_id,discord_user_id,comment_text,created_at) VALUES(?,?,?,?,?)',[Number(r.id),savedId,String(r.discord_user_id),String(r.comment_text),timestamp(r.created_at)]);
  }
}
async function copyUnifiedComments(conn,rows){
  for(const r of rows)await conn.query('INSERT INTO house_comments(id,destination_id,saved_house_id,legacy_saved_house_id,discord_user_id,comment_text,status,created_at,edited_at,saved_house_name,discord_global_name,discord_display_name) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',[Number(r.id),Number(r.destination_id),r.saved_house_id==null?null:Number(r.saved_house_id),r.legacy_saved_house_id==null?null:Number(r.legacy_saved_house_id),String(r.discord_user_id),String(r.comment_text),r.status||'active',timestamp(r.created_at),r.edited_at?timestamp(r.edited_at):null,r.saved_house_name||null,r.discord_global_name||null,r.discord_display_name||null]);
}

async function copyTours(conn,rows){
  for(const r of rows){
    const visibility=r.scope==='server'?'public':'private';
    const source=['private','public','both'].includes(r.house_source)?r.house_source:(visibility==='private'?'private':'public');
    const sourceGuild=sourceUsesPublicForMigration(source)?(r.source_guild_id||r.guild_id||null):null;
    if(sourceUsesPublicForMigration(source)&&!sourceGuild)throw new Error(`Cannot migrate tour #${r.id}: a Public house source has no source Discord server.`);
    await conn.query(`INSERT INTO tours(id,visibility,guild_id,source_guild_id,creator_id,name,description,tags,house_source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,[
      Number(r.id),visibility,visibility==='public'?String(r.guild_id):null,sourceGuild?String(sourceGuild):null,String(r.creator_id),String(r.name),r.description||null,asJson(r.tags),source,timestamp(r.created_at),timestamp(r.updated_at)
    ]);
  }
}
async function copyUnifiedTours(conn,rows){
  for(const r of rows)await conn.query('INSERT INTO tours(id,eso_server,visibility,guild_id,origin_guild_id,source_guild_id,creator_id,name,description,tags,house_source,created_at,updated_at,guild_name,origin_guild_name,source_guild_name,creator_global_name,creator_display_name) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[
    Number(r.id),r.eso_server||null,String(r.visibility),r.guild_id==null?null:String(r.guild_id),r.origin_guild_id==null?null:String(r.origin_guild_id),r.source_guild_id==null?null:String(r.source_guild_id),String(r.creator_id),String(r.name),r.description||null,asJson(r.tags),String(r.house_source||'private'),timestamp(r.created_at),timestamp(r.updated_at),r.guild_name||null,r.origin_guild_name||null,r.source_guild_name||null,r.creator_global_name||null,r.creator_display_name||null
  ]);
}

function mappedStopHouse(stop,maps){
  if(stop.personal_bookmark_id!=null){const id=maps.privateMap.get(Number(stop.personal_bookmark_id));if(id)return id;}
  if(stop.registered_house_id!=null){const id=maps.publicMap.get(Number(stop.registered_house_id));if(id)return id;}
  return null;
}
async function copyTourStops(conn,rows,maps){
  const seen=new Set(),positionByTour=new Map();
  for(const r of [...rows].sort((a,b)=>Number(a.tour_id)-Number(b.tour_id)||Number(a.position)-Number(b.position)||Number(a.id)-Number(b.id))){
    const savedId=mappedStopHouse(r,maps);
    if(!savedId)throw new Error(`Cannot migrate tour stop #${r.id} (tour ${r.tour_id}, position ${r.position}): its saved-house source no longer exists.`);
    const tourId=Number(r.tour_id),key=`${tourId}:${savedId}`;
    if(seen.has(key))continue;
    seen.add(key);
    const position=(positionByTour.get(tourId)||0)+1;positionByTour.set(tourId,position);
    await conn.query('INSERT INTO tour_stops(id,tour_id,position,saved_house_id,custom_title,notes) VALUES(?,?,?,?,?,?)',[Number(r.id),tourId,position,savedId,r.custom_title??r.title??null,r.notes||null]);
  }
}
async function copyUnifiedTourStops(conn,rows){
  for(const r of rows)await conn.query('INSERT INTO tour_stops(id,tour_id,position,saved_house_id,custom_title,notes,tour_name,saved_house_name) VALUES(?,?,?,?,?,?,?,?)',[Number(r.id),Number(r.tour_id),Number(r.position),Number(r.saved_house_id),r.custom_title||null,r.notes||null,r.tour_name||null,r.saved_house_name||null]);
}
async function copyRecentViews(conn,rows=[]){
  for(const r of rows)await conn.query('INSERT INTO recent_house_views(discord_user_id,saved_house_id,viewed_at) VALUES(?,?,?)',[String(r.discord_user_id),Number(r.saved_house_id),timestamp(r.viewed_at)]);
}
async function copyGlobalModeration(conn,moderators,requests){
  for(const r of requests)await conn.query('INSERT INTO global_moderator_requests(id,eso_server,discord_user_id,origin_guild_id,reason,status,reviewed_by,requested_at,reviewed_at,discord_global_name,discord_display_name,origin_guild_name,reviewed_by_global_name,reviewed_by_display_name) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[Number(r.id),r.eso_server||null,String(r.discord_user_id),String(r.origin_guild_id),String(r.reason),String(r.status||'pending'),r.reviewed_by==null?null:String(r.reviewed_by),timestamp(r.requested_at),r.reviewed_at?timestamp(r.reviewed_at):null,r.discord_global_name||null,r.discord_display_name||null,r.origin_guild_name||null,r.reviewed_by_global_name||null,r.reviewed_by_display_name||null]);
  for(const r of moderators)await conn.query('INSERT INTO global_moderators(discord_user_id,eso_server,approved_by,request_id,approved_at,discord_global_name,approved_by_global_name) VALUES(?,?,?,?,?,?,?)',[String(r.discord_user_id),String(r.eso_server),String(r.approved_by),r.request_id==null?null:Number(r.request_id),timestamp(r.approved_at),r.discord_global_name||null,r.approved_by_global_name||null]);
}
async function copyAudit(conn,rows){
  for(const r of rows)await conn.query('INSERT INTO audit_log(id,guild_id,actor_id,action,entity_type,entity_id,details,created_at,guild_name,actor_global_name,actor_display_name,entity_name) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',[Number(r.id),r.guild_id||null,String(r.actor_id),String(r.action),String(r.entity_type),r.entity_id==null?null:String(r.entity_id),r.details||null,timestamp(r.created_at),r.guild_name||null,r.actor_global_name||null,r.actor_display_name||null,r.entity_name||null]);
}

async function copyEngagement(conn,src){
  const definitions={
    tour_events:['id','guild_id','guild_name','channel_id','channel_name','message_id','tour_id','tour_name','eso_server','host_id','host_global_name','host_display_name','title','description','start_at','status','schedule_revision','started_at','completed_at','cancelled_at','created_by','created_by_global_name','created_by_display_name','updated_by','created_at','updated_at'],
    tour_event_rsvps:['event_id','discord_user_id','discord_global_name','discord_display_name','status','dm_reminders','created_at','updated_at'],
    tour_event_deliveries:['id','event_id','schedule_revision','reminder_key','delivery_target','status','failure_code','failure_message','attempted_at','completed_at'],
    featured_items:['id','guild_id','guild_name','target_kind','target_id','target_name','position','expires_at','selected_by','selected_by_global_name','selected_by_display_name','created_at','updated_at'],
    tour_progress:['id','discord_user_id','discord_global_name','discord_display_name','tour_id','tour_name','eso_server','status','current_stop_id','share_pass_id','run_started_at','last_activity_at','completion_count','last_completed_at','created_at','updated_at'],
    tour_progress_stops:['progress_id','stop_id','completed_at']
  };
  for(const [table,columns] of Object.entries(definitions)) for(const row of src[table]||[]){
    const values=columns.map(column => row[column] instanceof Date ? timestamp(row[column]) : row[column] ?? null);
    await conn.query(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`,values);
  }
}

async function verifyCounts(conn,src,maps,{unified=false,legacyTourStopCount=null}={}){
  const checks=[
    ['discord_guilds',unified?src.discord_guilds.length:0],
    ['discord_users',unified?src.discord_users.length:0],
    ['discord_guild_members',unified?src.discord_guild_members.length:0],
    ['discord_channels',unified?src.discord_channels.length:0],
    ['discord_roles',unified?src.discord_roles.length:0],
    ['guild_settings',src.guild_settings.length],
    ['housing_destinations',unified?(src.housing_destinations||[]).length:0],
    ['saved_houses',unified?src.saved_houses.length:src.registered_houses.length+src.personal_bookmarks.length],
    ['house_comments',src.house_comments.length],
    ['tours',src.tours.length],
    ['tour_stops',unified?src.tour_stops.length:legacyTourStopCount],
    ['recent_house_views',unified?(src.recent_house_views||[]).length:0],
    ['global_moderators',unified?src.global_moderators.length:0],
    ['global_moderator_requests',unified?src.global_moderator_requests.length:0],
    ['audit_log',src.audit_log.length],
    ['tour_sessions',0]
  ];
  for(const [table,expected] of checks){const r=await one(conn,`SELECT COUNT(*) c FROM ${table}`);if(Number(r.c)!==expected)throw new Error(`Verification failed for ${table}: expected ${expected}, found ${r.c}.`);}
  const orphanComments=await one(conn,'SELECT COUNT(*) c FROM house_comments c LEFT JOIN housing_destinations d ON d.id=c.destination_id WHERE d.id IS NULL');
  const orphanStops=await one(conn,'SELECT COUNT(*) c FROM tour_stops ts LEFT JOIN saved_houses s ON s.id=ts.saved_house_id LEFT JOIN tours t ON t.id=ts.tour_id WHERE s.id IS NULL OR t.id IS NULL');
  if(Number(orphanComments.c)||Number(orphanStops.c))throw new Error('Foreign-key verification found orphaned comments or tour stops.');
  if(unified){
    const badHouse=await one(conn,'SELECT s.id FROM saved_houses s LEFT JOIN housing_destinations d ON d.id=s.destination_id WHERE s.eso_server IS NOT NULL AND (d.id IS NULL OR d.eso_server<>s.eso_server) LIMIT 1');
    const badStop=await one(conn,'SELECT ts.id FROM tour_stops ts JOIN tours t ON t.id=ts.tour_id JOIN saved_houses s ON s.id=ts.saved_house_id WHERE t.eso_server IS NOT NULL AND (s.eso_server IS NULL OR s.eso_server<>t.eso_server) LIMIT 1');
    if(badHouse||badStop)throw new Error('Environment verification found a mismatched saved-house destination or tour stop.');
  }
  if(maps){
    for(const [oldId,newId] of maps.publicMap){if(!newId)throw new Error(`Missing Public house ID mapping for ${oldId}.`);}
    for(const [oldId,newId] of maps.privateMap){if(!newId)throw new Error(`Missing Private house ID mapping for ${oldId}.`);}
  }
}

export async function migrateSqliteToMariaDb(sourcePath,{pool=null}={}){
  const resolved=path.resolve(String(sourcePath||''));
  if(!sourcePath||!fs.existsSync(resolved))throw new Error(`SQLite source file not found: ${sourcePath||'(none)'}`);
  const sqlite=new DatabaseSync(resolved,{readOnly:true});
  const db=pool||openDatabase({...process.env,DB_TYPE:'mariadb'});
  try{
    await migrate(db);
    await assertEmptyTarget(db);
    const unified=sourceIsUnified(sqlite);
    const tables=unified?UNIFIED_SOURCE_TABLES:LEGACY_SOURCE_TABLES;
    const src=Object.fromEntries(tables.map(t=>[t,sourceRows(sqlite,t)]));
    const metadata=src.house_classifications?.length?Object.fromEntries(Object.keys(CATALOG_TABLE_COLUMNS).map(k=>[k,src[k]||[]])):catalogRowsFromHouses(src.houses);
    const maps=unified?null:buildSavedHouseIdMaps(src.registered_houses,src.personal_bookmarks);
    let importedTourStops=src.tour_stops.length;
    await withTransaction(db,async conn=>{
      for(const table of ['house_capacity_overrides','house_catalog_values','house_classifications'])await conn.query(`DELETE FROM ${table}`);
      await copyHouses(conn,src.houses);
      for(const [table,columns] of Object.entries(CATALOG_TABLE_COLUMNS))for(const row of metadata[table])await conn.query(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`,columns.map(k=>row[k]??null));
      if(unified)await copyIdentityCaches(conn,src);
      await copyGuildSettings(conn,src.guild_settings);
      if(unified){
        await copyHousingDestinations(conn,src.housing_destinations);
        await copyUnifiedSavedHouses(conn,src.saved_houses);
        await copyUnifiedComments(conn,src.house_comments);
        await copyUnifiedTours(conn,src.tours);
        await copyUnifiedTourStops(conn,src.tour_stops);
        await copyRecentViews(conn,src.recent_house_views);
        await copyGlobalModeration(conn,src.global_moderators,src.global_moderator_requests);
        await copyEngagement(conn,src);
        for(const [table,columns] of Object.entries(V11_COLUMNS))for(const row of src[table]||[])await conn.query(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`,columns.map(c=>row[c] instanceof Date?timestamp(row[c]):row[c]??null));
        for(const table of Object.keys(V11_COLUMNS)){const count=await one(conn,`SELECT COUNT(*) c FROM ${table}`);if(Number(count.c)!==(src[table]||[]).length)throw new Error(`Verification failed for ${table}`);}
      }else{
        await copySavedHouses(conn,src.registered_houses,src.personal_bookmarks,maps);
        await copyComments(conn,src.house_comments,maps);
        await copyTours(conn,src.tours);
        const unique=new Set();for(const r of src.tour_stops){const id=mappedStopHouse(r,maps);if(id)unique.add(`${Number(r.tour_id)}:${id}`);}importedTourStops=unique.size;
        await copyTourStops(conn,src.tour_stops,maps);
      }
      await copyAudit(conn,src.audit_log);
      await verifyCounts(conn,src,maps,{unified,legacyTourStopCount:importedTourStops});
    });
    return {
      sourceSchema:unified?'unified':'legacy',
      houses:src.houses.length,
      guildSettings:src.guild_settings.length,
      savedHouses:unified?src.saved_houses.length:src.registered_houses.length+src.personal_bookmarks.length,
      publicHouses:unified?src.saved_houses.filter(r=>r.scope==='public').length:src.registered_houses.length,
      privateHouses:unified?src.saved_houses.filter(r=>r.scope==='private').length:src.personal_bookmarks.length,
      globalHouses:unified?src.saved_houses.filter(r=>r.scope==='global').length:0,
      comments:src.house_comments.length,
      tours:src.tours.length,
      tourStops:importedTourStops,
      tourSessionsImported:0,
      globalModerators:unified?src.global_moderators.length:0,
      globalModeratorRequests:unified?src.global_moderator_requests.length:0,
      auditRows:src.audit_log.length
    };
  }finally{
    sqlite.close();
    if(!pool)await closeDatabase(db);
  }
}

async function main(){
  const source=process.argv[2];
  if(!source){console.error('Usage: npm run db:migrate-sqlite-to-mariadb -- ./data/eso-housing.sqlite');process.exitCode=2;return;}
  try{
    const summary=await migrateSqliteToMariaDb(source);
    console.log('SQLite -> MariaDB migration completed successfully.');
    console.table(summary);
    console.log('Legacy tour_sessions were intentionally not imported. MariaDB starts with no active tour sessions.');
  }catch(err){
    console.error(`Migration failed: ${err.message}`);
    process.exitCode=1;
  }
}

if(import.meta.url===new URL(`file://${process.argv[1]}`).href)await main();
