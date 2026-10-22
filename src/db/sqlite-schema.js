export const SQLITE_SCHEMA_VERSION = 11;

export const SQLITE_SCHEMA_V8 = [
  ['last_seen_tour_version', "TEXT"],
  ['acknowledged_features', "TEXT NOT NULL DEFAULT '[]'"]
];

export const SQLITE_SCHEMA_V1 = [
`CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER NOT NULL PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS houses (
  house_id INTEGER NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  zone TEXT, subzone TEXT, category TEXT, classification TEXT, house_type TEXT, style TEXT,
  furnishing_limit INTEGER, furnishing_limit_plus INTEGER,
  special_furnishing_limit INTEGER, special_furnishing_limit_plus INTEGER,
  collectible_limit INTEGER, collectible_limit_plus INTEGER,
  special_collectible_limit INTEGER, special_collectible_limit_plus INTEGER,
  population_limit INTEGER, population_limit_plus INTEGER,
  purchase_type TEXT, gold_price INTEGER, crown_price INTEGER,
  crown_price_unfurnished INTEGER, crown_price_furnished INTEGER,
  requirements TEXT, availability TEXT, uesp_url TEXT, last_verified TEXT
)`,
`CREATE INDEX IF NOT EXISTS idx_houses_normalized_name ON houses(normalized_name)`,
`CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT NOT NULL PRIMARY KEY,
  eso_server TEXT CHECK(eso_server IS NULL OR eso_server IN ('pc_na','pc_eu','xbox_na','xbox_eu','playstation_na','playstation_eu','pts')),
  eso_server_selected_by TEXT,
  eso_server_selected_at TEXT,
  registration_policy TEXT NOT NULL DEFAULT 'open' CHECK(registration_policy IN ('open','approval','roles')),
  staff_role_ids TEXT NOT NULL DEFAULT '[]',
  registration_role_ids TEXT NOT NULL DEFAULT '[]',
  tour_role_ids TEXT NOT NULL DEFAULT '[]',
  bot_channel_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS saved_houses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eso_server TEXT CHECK(eso_server IS NULL OR eso_server IN ('pc_na','pc_eu','xbox_na','xbox_eu','playstation_na','playstation_eu','pts')),
  scope TEXT NOT NULL CHECK(scope IN ('private','public','global')),
  guild_id TEXT, origin_guild_id TEXT, owner_user_id TEXT,
  house_id INTEGER NOT NULL,
  eso_owner TEXT NOT NULL, normalized_owner TEXT NOT NULL,
  display_name TEXT, description TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived','pending')),
  created_by TEXT NOT NULL, updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(house_id) REFERENCES houses(house_id),
  CHECK ((scope='private' AND owner_user_id IS NOT NULL AND guild_id IS NULL) OR
         (scope='public' AND owner_user_id IS NULL AND guild_id IS NOT NULL) OR
         (scope='global' AND owner_user_id IS NULL AND guild_id IS NULL))
)`,
`CREATE INDEX IF NOT EXISTS idx_saved_private ON saved_houses(owner_user_id,scope,status)`,
`CREATE INDEX IF NOT EXISTS idx_saved_public ON saved_houses(guild_id,scope,status)`,
`CREATE INDEX IF NOT EXISTS idx_saved_global ON saved_houses(scope,status)`,
`CREATE INDEX IF NOT EXISTS idx_saved_environment ON saved_houses(eso_server,scope,status)`,
`CREATE INDEX IF NOT EXISTS idx_saved_destination ON saved_houses(normalized_owner,house_id)`,
`CREATE TABLE IF NOT EXISTS house_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  saved_house_id INTEGER NOT NULL,
  discord_user_id TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(saved_house_id) REFERENCES saved_houses(id) ON DELETE CASCADE
)`,
`CREATE INDEX IF NOT EXISTS idx_house_comments_target ON house_comments(saved_house_id,created_at)`,
`CREATE TABLE IF NOT EXISTS tours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eso_server TEXT CHECK(eso_server IS NULL OR eso_server IN ('pc_na','pc_eu','xbox_na','xbox_eu','playstation_na','playstation_eu','pts')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public','global')),
  guild_id TEXT, source_guild_id TEXT, origin_guild_id TEXT,
  creator_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
  tags TEXT NOT NULL DEFAULT '[]', house_source TEXT NOT NULL DEFAULT 'private',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((visibility='private' AND guild_id IS NULL) OR
         (visibility='public' AND guild_id IS NOT NULL) OR
         (visibility='global' AND guild_id IS NULL))
)`,
`CREATE INDEX IF NOT EXISTS idx_tours_creator ON tours(creator_id,visibility)`,
`CREATE INDEX IF NOT EXISTS idx_tours_public ON tours(guild_id,visibility)`,
`CREATE INDEX IF NOT EXISTS idx_tours_global ON tours(visibility)`,
`CREATE INDEX IF NOT EXISTS idx_tours_environment ON tours(eso_server,visibility)`,
`CREATE TABLE IF NOT EXISTS tour_stops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tour_id INTEGER NOT NULL, position INTEGER NOT NULL, saved_house_id INTEGER NOT NULL,
  custom_title TEXT, notes TEXT,
  FOREIGN KEY(tour_id) REFERENCES tours(id) ON DELETE CASCADE,
  FOREIGN KEY(saved_house_id) REFERENCES saved_houses(id) ON DELETE CASCADE,
  UNIQUE(tour_id,position), UNIQUE(tour_id,saved_house_id)
)`,
`CREATE TABLE IF NOT EXISTS tour_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tour_id INTEGER NOT NULL, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('self_paced','shared')),
  started_by TEXT NOT NULL, message_id TEXT, current_position INTEGER NOT NULL DEFAULT 1,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tour_id) REFERENCES tours(id) ON DELETE CASCADE
)`,
`CREATE UNIQUE INDEX IF NOT EXISTS uq_self_paced_session ON tour_sessions(guild_id,channel_id,started_by) WHERE mode='self_paced'`,
`CREATE UNIQUE INDEX IF NOT EXISTS uq_shared_session ON tour_sessions(guild_id,channel_id) WHERE mode='shared'`,
`CREATE TABLE IF NOT EXISTS global_moderators (
  discord_user_id TEXT NOT NULL,
  eso_server TEXT NOT NULL CHECK(eso_server IN ('pc_na','pc_eu','xbox_na','xbox_eu','playstation_na','playstation_eu','pts')),
  approved_by TEXT NOT NULL,
  request_id INTEGER,
  approved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(discord_user_id,eso_server)
)`,
`CREATE TABLE IF NOT EXISTS global_moderator_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eso_server TEXT CHECK(eso_server IS NULL OR eso_server IN ('pc_na','pc_eu','xbox_na','xbox_eu','playstation_na','playstation_eu','pts')),
  discord_user_id TEXT NOT NULL, origin_guild_id TEXT NOT NULL, reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','denied')),
  reviewed_by TEXT, requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT
)`,
`CREATE UNIQUE INDEX IF NOT EXISTS uq_global_mod_pending_user ON global_moderator_requests(discord_user_id,eso_server) WHERE status='pending'`,
`CREATE INDEX IF NOT EXISTS idx_global_mod_requests ON global_moderator_requests(eso_server,status,requested_at)`,
`CREATE INDEX IF NOT EXISTS idx_global_mod_request_user ON global_moderator_requests(discord_user_id,eso_server,status)`,
`CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT, actor_id TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL,
  entity_id TEXT, details TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at)`,
`CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type,entity_id)`,
`CREATE TRIGGER IF NOT EXISTS trg_guild_settings_updated AFTER UPDATE ON guild_settings
 BEGIN UPDATE guild_settings SET updated_at=CURRENT_TIMESTAMP WHERE guild_id=NEW.guild_id; END`,
`CREATE TRIGGER IF NOT EXISTS trg_saved_houses_updated AFTER UPDATE ON saved_houses
 BEGIN UPDATE saved_houses SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END`,
`CREATE TRIGGER IF NOT EXISTS trg_tours_updated AFTER UPDATE ON tours
 BEGIN UPDATE tours SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END`,
`CREATE TRIGGER IF NOT EXISTS trg_tour_sessions_updated AFTER UPDATE ON tour_sessions
 BEGIN UPDATE tour_sessions SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END`
];

export const SQLITE_SCHEMA_V2 = [
`CREATE TABLE IF NOT EXISTS discord_guilds (
  guild_id TEXT NOT NULL PRIMARY KEY, guild_name TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS discord_users (
  discord_user_id TEXT NOT NULL PRIMARY KEY, global_name TEXT, username TEXT,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS discord_guild_members (
  guild_id TEXT NOT NULL, discord_user_id TEXT NOT NULL, display_name TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(guild_id,discord_user_id)
)`,
`CREATE TABLE IF NOT EXISTS discord_channels (
  channel_id TEXT NOT NULL PRIMARY KEY, guild_id TEXT, channel_name TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS discord_roles (
  role_id TEXT NOT NULL PRIMARY KEY, guild_id TEXT NOT NULL, role_name TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`
];

export const SQLITE_SCHEMA_V3 = [
`CREATE TABLE IF NOT EXISTS recent_house_views (
  discord_user_id TEXT NOT NULL, saved_house_id INTEGER NOT NULL,
  viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(discord_user_id,saved_house_id),
  FOREIGN KEY(saved_house_id) REFERENCES saved_houses(id) ON DELETE CASCADE
)`,
`CREATE INDEX IF NOT EXISTS idx_recent_house_views_user ON recent_house_views(discord_user_id,viewed_at)`
];

export const SQLITE_SCHEMA_V4 = [
`CREATE TABLE IF NOT EXISTS housing_destinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eso_server TEXT CHECK(eso_server IS NULL OR eso_server IN ('pc_na','pc_eu','xbox_na','xbox_eu','playstation_na','playstation_eu','pts')),
  eso_owner TEXT NOT NULL,
  normalized_owner TEXT NOT NULL,
  house_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(eso_server,normalized_owner,house_id),
  FOREIGN KEY(house_id) REFERENCES houses(house_id)
)`,
`CREATE INDEX IF NOT EXISTS idx_housing_destinations_house ON housing_destinations(eso_server,house_id,normalized_owner)`,
`CREATE TABLE IF NOT EXISTS house_share_passes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  saved_house_id INTEGER,
  created_by TEXT NOT NULL,
  created_by_global_name TEXT,
  created_by_display_name TEXT,
  origin_guild_id TEXT,
  origin_guild_name TEXT,
  channel_id TEXT,
  channel_name TEXT,
  message_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  revoked_at TEXT,
  revoked_by TEXT,
  revoked_by_global_name TEXT,
  revoked_by_display_name TEXT,
  revocation_reason TEXT,
  FOREIGN KEY(saved_house_id) REFERENCES saved_houses(id) ON DELETE SET NULL
)`,
`CREATE INDEX IF NOT EXISTS idx_house_share_passes_source ON house_share_passes(saved_house_id,status)`,
`CREATE INDEX IF NOT EXISTS idx_house_share_passes_creator ON house_share_passes(created_by,status,created_at)`,
`CREATE TABLE IF NOT EXISTS tour_share_passes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  tour_id INTEGER,
  created_by TEXT NOT NULL,
  created_by_global_name TEXT,
  created_by_display_name TEXT,
  origin_guild_id TEXT,
  origin_guild_name TEXT,
  channel_id TEXT,
  channel_name TEXT,
  message_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  revoked_at TEXT,
  revoked_by TEXT,
  revoked_by_global_name TEXT,
  revoked_by_display_name TEXT,
  revocation_reason TEXT,
  FOREIGN KEY(tour_id) REFERENCES tours(id) ON DELETE SET NULL
)`,
`CREATE INDEX IF NOT EXISTS idx_tour_share_passes_source ON tour_share_passes(tour_id,status)`,
`CREATE INDEX IF NOT EXISTS idx_tour_share_passes_creator ON tour_share_passes(created_by,status,created_at)`,
`CREATE TABLE IF NOT EXISTS share_pass_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tour_share_pass_id INTEGER NOT NULL,
  tour_session_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT,
  close_reason TEXT,
  FOREIGN KEY(tour_share_pass_id) REFERENCES tour_share_passes(id),
  FOREIGN KEY(tour_session_id) REFERENCES tour_sessions(id) ON DELETE SET NULL
)`,
`CREATE INDEX IF NOT EXISTS idx_share_pass_sessions_pass ON share_pass_sessions(tour_share_pass_id,closed_at)`,
`CREATE TABLE IF NOT EXISTS housing_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  destination_id INTEGER NOT NULL,
  saved_house_id INTEGER,
  tour_id INTEGER,
  stop_id INTEGER,
  house_share_pass_id INTEGER,
  tour_share_pass_id INTEGER,
  reporter_id TEXT NOT NULL,
  reporter_global_name TEXT,
  reporter_display_name TEXT,
  guild_id TEXT,
  guild_name TEXT,
  problem_type TEXT NOT NULL,
  explanation TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','resolved','dismissed')),
  reviewer_id TEXT,
  reviewer_global_name TEXT,
  reviewer_display_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  FOREIGN KEY(destination_id) REFERENCES housing_destinations(id),
  FOREIGN KEY(saved_house_id) REFERENCES saved_houses(id) ON DELETE SET NULL,
  FOREIGN KEY(tour_id) REFERENCES tours(id) ON DELETE SET NULL,
  FOREIGN KEY(stop_id) REFERENCES tour_stops(id) ON DELETE SET NULL,
  FOREIGN KEY(house_share_pass_id) REFERENCES house_share_passes(id) ON DELETE SET NULL,
  FOREIGN KEY(tour_share_pass_id) REFERENCES tour_share_passes(id) ON DELETE SET NULL
)`,
`CREATE INDEX IF NOT EXISTS idx_housing_reports_queue ON housing_reports(status,guild_id,created_at)`,
`CREATE INDEX IF NOT EXISTS idx_housing_reports_equivalent ON housing_reports(reporter_id,destination_id,problem_type,status)`,
`CREATE TABLE IF NOT EXISTS user_onboarding (
  discord_user_id TEXT PRIMARY KEY,
  discord_global_name TEXT,
  discord_display_name TEXT,
  status TEXT NOT NULL CHECK(status IN ('completed','skipped')),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  skipped_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`
];

export const SQLITE_SCHEMA_V6 = [
`CREATE TABLE IF NOT EXISTS user_house_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_user_id TEXT NOT NULL,
  discord_global_name TEXT,
  discord_display_name TEXT,
  target_kind TEXT NOT NULL CHECK(target_kind IN ('destination','official')),
  target_id INTEGER NOT NULL,
  house_name TEXT,
  eso_owner TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK(is_favorite IN (0,1)),
  visit_state TEXT NOT NULL DEFAULT 'none' CHECK(visit_state IN ('none','want_to_visit','visited')),
  last_visited_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(discord_user_id,target_kind,target_id)
)`,
`CREATE INDEX IF NOT EXISTS idx_user_house_favorite ON user_house_states(discord_user_id,is_favorite,updated_at)`,
`CREATE INDEX IF NOT EXISTS idx_user_house_visit ON user_house_states(discord_user_id,visit_state,last_visited_at)`,
`CREATE TABLE IF NOT EXISTS saved_house_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_user_id TEXT NOT NULL,
  discord_global_name TEXT,
  discord_display_name TEXT,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  filter_version INTEGER NOT NULL DEFAULT 1,
  filters_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(discord_user_id,normalized_name)
)`,
`CREATE INDEX IF NOT EXISTS idx_saved_search_user ON saved_house_searches(discord_user_id,updated_at)`
];

export const SQLITE_SCHEMA_V7 = [
`ALTER TABLE guild_settings ADD COLUMN timezone TEXT`,
`CREATE TABLE IF NOT EXISTS tour_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, guild_name TEXT,
  channel_id TEXT NOT NULL, channel_name TEXT, message_id TEXT, tour_id INTEGER NOT NULL,
  tour_name TEXT, eso_server TEXT NOT NULL, host_id TEXT NOT NULL,
  host_global_name TEXT, host_display_name TEXT, title TEXT NOT NULL, description TEXT,
  start_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','cancelled','completed')),
  schedule_revision INTEGER NOT NULL DEFAULT 1, started_at TEXT, completed_at TEXT, cancelled_at TEXT,
  created_by TEXT NOT NULL, created_by_global_name TEXT, created_by_display_name TEXT,
  updated_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tour_id) REFERENCES tours(id) ON DELETE CASCADE
)`,
`CREATE INDEX IF NOT EXISTS idx_tour_events_upcoming ON tour_events(guild_id,eso_server,status,start_at)`,
`CREATE INDEX IF NOT EXISTS idx_tour_events_host ON tour_events(host_id,status,start_at)`,
`CREATE TABLE IF NOT EXISTS tour_event_rsvps (
  event_id INTEGER NOT NULL, discord_user_id TEXT NOT NULL, discord_global_name TEXT, discord_display_name TEXT,
  status TEXT NOT NULL CHECK(status IN ('going','interested')), dm_reminders INTEGER NOT NULL DEFAULT 0 CHECK(dm_reminders IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(event_id,discord_user_id), FOREIGN KEY(event_id) REFERENCES tour_events(id) ON DELETE CASCADE
)`,
`CREATE INDEX IF NOT EXISTS idx_event_rsvps_status ON tour_event_rsvps(event_id,status)`,
`CREATE TABLE IF NOT EXISTS tour_event_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL, schedule_revision INTEGER NOT NULL,
  reminder_key TEXT NOT NULL CHECK(reminder_key IN ('24h','1h')), delivery_target TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'claimed' CHECK(status IN ('claimed','sent','failed')), failure_code TEXT,
  failure_message TEXT, attempted_at TEXT NOT NULL, completed_at TEXT,
  FOREIGN KEY(event_id) REFERENCES tour_events(id) ON DELETE CASCADE,
  UNIQUE(event_id,schedule_revision,reminder_key,delivery_target)
)`,
`CREATE INDEX IF NOT EXISTS idx_event_delivery_claim ON tour_event_deliveries(status,attempted_at)`,
`CREATE TABLE IF NOT EXISTS featured_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, guild_name TEXT,
  target_kind TEXT NOT NULL CHECK(target_kind IN ('house','tour')), target_id INTEGER NOT NULL,
  target_name TEXT, position INTEGER NOT NULL CHECK(position BETWEEN 1 AND 5), expires_at TEXT,
  selected_by TEXT NOT NULL, selected_by_global_name TEXT, selected_by_display_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guild_id,target_kind,target_id), UNIQUE(guild_id,target_kind,position)
)`,
`CREATE INDEX IF NOT EXISTS idx_featured_expiry ON featured_items(expires_at)`,
`CREATE TABLE IF NOT EXISTS tour_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT, discord_user_id TEXT NOT NULL, discord_global_name TEXT,
  discord_display_name TEXT, tour_id INTEGER NOT NULL, tour_name TEXT, eso_server TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed')), current_stop_id INTEGER,
  share_pass_id INTEGER, run_started_at TEXT, last_activity_at TEXT NOT NULL,
  completion_count INTEGER NOT NULL DEFAULT 0, last_completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tour_id) REFERENCES tours(id) ON DELETE CASCADE,
  UNIQUE(discord_user_id,tour_id,eso_server)
)`,
`CREATE INDEX IF NOT EXISTS idx_progress_user ON tour_progress(discord_user_id,status,last_activity_at)`,
`CREATE TABLE IF NOT EXISTS tour_progress_stops (
  progress_id INTEGER NOT NULL, stop_id INTEGER NOT NULL, completed_at TEXT NOT NULL,
  PRIMARY KEY(progress_id,stop_id), FOREIGN KEY(progress_id) REFERENCES tour_progress(id) ON DELETE CASCADE,
  FOREIGN KEY(stop_id) REFERENCES tour_stops(id) ON DELETE CASCADE
)`
];

export const SQLITE_V2_COLUMNS = {
  guild_settings:{guild_name:'TEXT',bot_channel_name:'TEXT',staff_role_names:"TEXT NOT NULL DEFAULT '[]'",registration_role_names:"TEXT NOT NULL DEFAULT '[]'",tour_role_names:"TEXT NOT NULL DEFAULT '[]'"},
  saved_houses:{guild_name:'TEXT',origin_guild_name:'TEXT',owner_global_name:'TEXT',owner_display_name:'TEXT',house_name:'TEXT',created_by_global_name:'TEXT',created_by_display_name:'TEXT',updated_by_global_name:'TEXT',updated_by_display_name:'TEXT'},
  house_comments:{saved_house_name:'TEXT',discord_global_name:'TEXT',discord_display_name:'TEXT'},
  tours:{guild_name:'TEXT',origin_guild_name:'TEXT',source_guild_name:'TEXT',creator_global_name:'TEXT',creator_display_name:'TEXT'},
  tour_stops:{tour_name:'TEXT',saved_house_name:'TEXT'},
  tour_sessions:{tour_name:'TEXT',guild_name:'TEXT',channel_name:'TEXT',started_by_global_name:'TEXT',started_by_display_name:'TEXT'},
  global_moderators:{discord_global_name:'TEXT',approved_by_global_name:'TEXT'},
  global_moderator_requests:{discord_global_name:'TEXT',discord_display_name:'TEXT',origin_guild_name:'TEXT',reviewed_by_global_name:'TEXT',reviewed_by_display_name:'TEXT'},
  audit_log:{guild_name:'TEXT',actor_global_name:'TEXT',actor_display_name:'TEXT',entity_name:'TEXT'}
};

export const SQLITE_V9_COLUMNS = SQLITE_V2_COLUMNS;

export const SQLITE_SCHEMA_V11 = [
`CREATE TABLE IF NOT EXISTS server_moderator_requests (
 id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, discord_user_id TEXT NOT NULL,
 reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', revision INTEGER NOT NULL DEFAULT 1,
 requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT, reviewed_by TEXT,
 discord_global_name TEXT, discord_display_name TEXT, guild_name TEXT, UNIQUE(guild_id,discord_user_id))`,
`CREATE TABLE IF NOT EXISTS server_moderators (
 guild_id TEXT NOT NULL, discord_user_id TEXT NOT NULL, approved_by TEXT NOT NULL,
 request_id INTEGER NOT NULL, request_revision INTEGER NOT NULL, approved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(guild_id,discord_user_id))`,
`CREATE TABLE IF NOT EXISTS featured_house_cycles (
 guild_id TEXT PRIMARY KEY, eso_server TEXT NOT NULL, last_rotated_at TEXT,
 previous_destination_ids TEXT NOT NULL DEFAULT '[]')`
];
