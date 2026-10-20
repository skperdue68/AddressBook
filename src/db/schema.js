export const SCHEMA_VERSION = 10;

export const SCHEMA_V8 = [
  ['last_seen_tour_version', 'VARCHAR(32) NULL'],
  ['acknowledged_features', "TEXT NOT NULL DEFAULT '[]'"]
];

export const SCHEMA_V1 = [
`CREATE TABLE IF NOT EXISTS schema_migrations (
  version INT NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS houses (
  house_id INT NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  normalized_name VARCHAR(255) NOT NULL,
  zone VARCHAR(255) NULL,
  subzone VARCHAR(255) NULL,
  category VARCHAR(100) NULL,
  classification VARCHAR(100) NULL,
  house_type VARCHAR(100) NULL,
  style VARCHAR(255) NULL,
  furnishing_limit INT NULL,
  furnishing_limit_plus INT NULL,
  special_furnishing_limit INT NULL,
  special_furnishing_limit_plus INT NULL,
  collectible_limit INT NULL,
  collectible_limit_plus INT NULL,
  special_collectible_limit INT NULL,
  special_collectible_limit_plus INT NULL,
  population_limit INT NULL,
  population_limit_plus INT NULL,
  purchase_type VARCHAR(100) NULL,
  gold_price BIGINT NULL,
  crown_price BIGINT NULL,
  crown_price_unfurnished BIGINT NULL,
  crown_price_furnished BIGINT NULL,
  requirements TEXT NULL,
  availability TEXT NULL,
  uesp_url TEXT NULL,
  last_verified VARCHAR(32) NULL,
  INDEX idx_houses_normalized_name(normalized_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
  eso_server VARCHAR(32) NULL,
  eso_server_selected_by VARCHAR(32) NULL,
  eso_server_selected_at DATETIME NULL,
  registration_policy ENUM('open','approval','roles') NOT NULL DEFAULT 'open',
  staff_role_ids LONGTEXT NOT NULL DEFAULT '[]',
  registration_role_ids LONGTEXT NOT NULL DEFAULT '[]',
  tour_role_ids LONGTEXT NOT NULL DEFAULT '[]',
  bot_channel_id VARCHAR(32) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS saved_houses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  eso_server VARCHAR(32) NULL,
  scope ENUM('private','public','global') NOT NULL,
  guild_id VARCHAR(32) NULL,
  origin_guild_id VARCHAR(32) NULL,
  owner_user_id VARCHAR(32) NULL,
  house_id INT NOT NULL,
  eso_owner VARCHAR(255) NOT NULL,
  normalized_owner VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NULL,
  description TEXT NULL,
  tags LONGTEXT NOT NULL DEFAULT '[]',
  status ENUM('active','archived','pending') NOT NULL DEFAULT 'active',
  created_by VARCHAR(32) NOT NULL,
  updated_by VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_saved_houses_catalog FOREIGN KEY(house_id) REFERENCES houses(house_id),
  CONSTRAINT chk_saved_house_scope CHECK (
    (scope='private' AND owner_user_id IS NOT NULL AND guild_id IS NULL) OR
    (scope='public' AND owner_user_id IS NULL AND guild_id IS NOT NULL) OR
    (scope='global' AND owner_user_id IS NULL AND guild_id IS NULL)
  ),
  INDEX idx_saved_private(owner_user_id,scope,status),
  INDEX idx_saved_public(guild_id,scope,status),
  INDEX idx_saved_global(scope,status),
  INDEX idx_saved_environment(eso_server,scope,status),
  INDEX idx_saved_destination(normalized_owner,house_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS house_comments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  saved_house_id BIGINT UNSIGNED NOT NULL,
  discord_user_id VARCHAR(32) NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comments_saved_house FOREIGN KEY(saved_house_id) REFERENCES saved_houses(id) ON DELETE CASCADE,
  INDEX idx_house_comments_target(saved_house_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS tours (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  eso_server VARCHAR(32) NULL,
  visibility ENUM('private','public','global') NOT NULL DEFAULT 'private',
  guild_id VARCHAR(32) NULL,
  source_guild_id VARCHAR(32) NULL,
  origin_guild_id VARCHAR(32) NULL,
  creator_id VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  tags LONGTEXT NOT NULL DEFAULT '[]',
  house_source VARCHAR(64) NOT NULL DEFAULT 'private',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_tour_visibility CHECK (
    (visibility='private' AND guild_id IS NULL) OR
    (visibility='public' AND guild_id IS NOT NULL) OR
    (visibility='global' AND guild_id IS NULL)
  ),
  INDEX idx_tours_creator(creator_id,visibility),
  INDEX idx_tours_public(guild_id,visibility),
  INDEX idx_tours_global(visibility),
  INDEX idx_tours_environment(eso_server,visibility)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS tour_stops (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tour_id BIGINT UNSIGNED NOT NULL,
  position INT NOT NULL,
  saved_house_id BIGINT UNSIGNED NOT NULL,
  custom_title VARCHAR(255) NULL,
  notes TEXT NULL,
  CONSTRAINT fk_tour_stops_tour FOREIGN KEY(tour_id) REFERENCES tours(id) ON DELETE CASCADE,
  CONSTRAINT fk_tour_stops_house FOREIGN KEY(saved_house_id) REFERENCES saved_houses(id) ON DELETE CASCADE,
  UNIQUE KEY uq_tour_position(tour_id,position),
  UNIQUE KEY uq_tour_house(tour_id,saved_house_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS tour_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tour_id BIGINT UNSIGNED NOT NULL,
  guild_id VARCHAR(32) NOT NULL,
  channel_id VARCHAR(32) NOT NULL,
  mode ENUM('self_paced','shared') NOT NULL,
  started_by VARCHAR(32) NOT NULL,
  message_id VARCHAR(32) NULL,
  current_position INT NOT NULL DEFAULT 1,
  self_paced_owner_key VARCHAR(32) GENERATED ALWAYS AS (CASE WHEN mode='self_paced' THEN started_by ELSE NULL END) STORED,
  shared_key TINYINT GENERATED ALWAYS AS (CASE WHEN mode='shared' THEN 1 ELSE NULL END) STORED,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tour_sessions_tour FOREIGN KEY(tour_id) REFERENCES tours(id) ON DELETE CASCADE,
  UNIQUE KEY uq_self_paced_session(guild_id,channel_id,self_paced_owner_key),
  UNIQUE KEY uq_shared_session(guild_id,channel_id,shared_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS global_moderators (
  discord_user_id VARCHAR(32) NOT NULL,
  eso_server VARCHAR(32) NOT NULL,
  approved_by VARCHAR(32) NOT NULL,
  request_id BIGINT UNSIGNED NULL,
  approved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(discord_user_id,eso_server)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS global_moderator_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  eso_server VARCHAR(32) NULL,
  discord_user_id VARCHAR(32) NOT NULL,
  origin_guild_id VARCHAR(32) NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('pending','approved','denied') NOT NULL DEFAULT 'pending',
  reviewed_by VARCHAR(32) NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  pending_user_key VARCHAR(80) GENERATED ALWAYS AS (CASE WHEN status='pending' THEN CONCAT(discord_user_id,':',COALESCE(eso_server,'')) ELSE NULL END) STORED,
  UNIQUE KEY uq_global_mod_pending_user(pending_user_key),
  INDEX idx_global_mod_requests(eso_server,status,requested_at),
  INDEX idx_global_mod_request_user(discord_user_id,eso_server,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  guild_id VARCHAR(32) NULL,
  actor_id VARCHAR(32) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(64) NULL,
  details LONGTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created(created_at),
  INDEX idx_audit_entity(entity_type,entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

export const SCHEMA_V2 = [
`CREATE TABLE IF NOT EXISTS discord_guilds (
  guild_id VARCHAR(32) NOT NULL PRIMARY KEY, guild_name VARCHAR(255) NOT NULL,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS discord_users (
  discord_user_id VARCHAR(32) NOT NULL PRIMARY KEY, global_name VARCHAR(255) NULL, username VARCHAR(255) NULL,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS discord_guild_members (
  guild_id VARCHAR(32) NOT NULL, discord_user_id VARCHAR(32) NOT NULL, display_name VARCHAR(255) NOT NULL,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(guild_id,discord_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS discord_channels (
  channel_id VARCHAR(32) NOT NULL PRIMARY KEY, guild_id VARCHAR(32) NULL, channel_name VARCHAR(255) NOT NULL,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS discord_roles (
  role_id VARCHAR(32) NOT NULL PRIMARY KEY, guild_id VARCHAR(32) NOT NULL, role_name VARCHAR(255) NOT NULL,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

export const SCHEMA_V3 = [
`CREATE TABLE IF NOT EXISTS recent_house_views (
  discord_user_id VARCHAR(32) NOT NULL,
  saved_house_id BIGINT UNSIGNED NOT NULL,
  viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(discord_user_id,saved_house_id),
  CONSTRAINT fk_recent_house FOREIGN KEY(saved_house_id) REFERENCES saved_houses(id) ON DELETE CASCADE,
  INDEX idx_recent_house_views_user(discord_user_id,viewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

export const SCHEMA_V4 = [
`CREATE TABLE IF NOT EXISTS housing_destinations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  eso_server VARCHAR(32) NULL,
  eso_owner VARCHAR(255) NOT NULL,
  normalized_owner VARCHAR(255) NOT NULL,
  house_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_destination_house FOREIGN KEY(house_id) REFERENCES houses(house_id),
  UNIQUE KEY uq_housing_destination(eso_server,normalized_owner,house_id),
  INDEX idx_housing_destinations_house(eso_server,house_id,normalized_owner)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS house_share_passes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  token_hash CHAR(64) NOT NULL,
  saved_house_id BIGINT UNSIGNED NULL,
  created_by VARCHAR(32) NOT NULL,
  created_by_global_name VARCHAR(255) NULL,
  created_by_display_name VARCHAR(255) NULL,
  origin_guild_id VARCHAR(32) NULL,
  origin_guild_name VARCHAR(255) NULL,
  channel_id VARCHAR(32) NULL,
  channel_name VARCHAR(255) NULL,
  message_id VARCHAR(32) NULL,
  status ENUM('active','revoked') NOT NULL DEFAULT 'active',
  usage_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP NULL,
  revoked_at TIMESTAMP NULL,
  revoked_by VARCHAR(32) NULL,
  revoked_by_global_name VARCHAR(255) NULL,
  revoked_by_display_name VARCHAR(255) NULL,
  revocation_reason TEXT NULL,
  CONSTRAINT fk_house_pass_source FOREIGN KEY(saved_house_id) REFERENCES saved_houses(id) ON DELETE SET NULL,
  UNIQUE KEY uq_house_share_token(token_hash),
  INDEX idx_house_share_passes_source(saved_house_id,status),
  INDEX idx_house_share_passes_creator(created_by,status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS tour_share_passes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  token_hash CHAR(64) NOT NULL,
  tour_id BIGINT UNSIGNED NULL,
  created_by VARCHAR(32) NOT NULL,
  created_by_global_name VARCHAR(255) NULL,
  created_by_display_name VARCHAR(255) NULL,
  origin_guild_id VARCHAR(32) NULL,
  origin_guild_name VARCHAR(255) NULL,
  channel_id VARCHAR(32) NULL,
  channel_name VARCHAR(255) NULL,
  message_id VARCHAR(32) NULL,
  status ENUM('active','revoked') NOT NULL DEFAULT 'active',
  usage_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP NULL,
  revoked_at TIMESTAMP NULL,
  revoked_by VARCHAR(32) NULL,
  revoked_by_global_name VARCHAR(255) NULL,
  revoked_by_display_name VARCHAR(255) NULL,
  revocation_reason TEXT NULL,
  CONSTRAINT fk_tour_pass_source FOREIGN KEY(tour_id) REFERENCES tours(id) ON DELETE SET NULL,
  UNIQUE KEY uq_tour_share_token(token_hash),
  INDEX idx_tour_share_passes_source(tour_id,status),
  INDEX idx_tour_share_passes_creator(created_by,status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS share_pass_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tour_share_pass_id BIGINT UNSIGNED NOT NULL,
  tour_session_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  close_reason VARCHAR(255) NULL,
  CONSTRAINT fk_pass_session_pass FOREIGN KEY(tour_share_pass_id) REFERENCES tour_share_passes(id),
  CONSTRAINT fk_pass_session_session FOREIGN KEY(tour_session_id) REFERENCES tour_sessions(id) ON DELETE SET NULL,
  INDEX idx_share_pass_sessions_pass(tour_share_pass_id,closed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS housing_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  destination_id BIGINT UNSIGNED NOT NULL,
  saved_house_id BIGINT UNSIGNED NULL,
  tour_id BIGINT UNSIGNED NULL,
  stop_id BIGINT UNSIGNED NULL,
  house_share_pass_id BIGINT UNSIGNED NULL,
  tour_share_pass_id BIGINT UNSIGNED NULL,
  reporter_id VARCHAR(32) NOT NULL,
  reporter_global_name VARCHAR(255) NULL,
  reporter_display_name VARCHAR(255) NULL,
  guild_id VARCHAR(32) NULL,
  guild_name VARCHAR(255) NULL,
  problem_type VARCHAR(64) NOT NULL,
  explanation TEXT NULL,
  status ENUM('open','reviewing','resolved','dismissed') NOT NULL DEFAULT 'open',
  reviewer_id VARCHAR(32) NULL,
  reviewer_global_name VARCHAR(255) NULL,
  reviewer_display_name VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  CONSTRAINT fk_report_destination FOREIGN KEY(destination_id) REFERENCES housing_destinations(id),
  CONSTRAINT fk_report_saved_house FOREIGN KEY(saved_house_id) REFERENCES saved_houses(id) ON DELETE SET NULL,
  CONSTRAINT fk_report_tour FOREIGN KEY(tour_id) REFERENCES tours(id) ON DELETE SET NULL,
  CONSTRAINT fk_report_stop FOREIGN KEY(stop_id) REFERENCES tour_stops(id) ON DELETE SET NULL,
  CONSTRAINT fk_report_house_pass FOREIGN KEY(house_share_pass_id) REFERENCES house_share_passes(id) ON DELETE SET NULL,
  CONSTRAINT fk_report_tour_pass FOREIGN KEY(tour_share_pass_id) REFERENCES tour_share_passes(id) ON DELETE SET NULL,
  INDEX idx_housing_reports_queue(status,guild_id,created_at),
  INDEX idx_housing_reports_equivalent(reporter_id,destination_id,problem_type,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS user_onboarding (
  discord_user_id VARCHAR(32) NOT NULL PRIMARY KEY,
  discord_global_name VARCHAR(255) NULL,
  discord_display_name VARCHAR(255) NULL,
  status ENUM('completed','skipped') NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  skipped_at TIMESTAMP NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

export const SCHEMA_V6 = [
`CREATE TABLE IF NOT EXISTS user_house_states (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  discord_user_id VARCHAR(32) NOT NULL,
  discord_global_name VARCHAR(255) NULL,
  discord_display_name VARCHAR(255) NULL,
  target_kind ENUM('destination','official') NOT NULL,
  target_id BIGINT UNSIGNED NOT NULL,
  house_name VARCHAR(255) NULL,
  eso_owner VARCHAR(255) NULL,
  is_favorite TINYINT(1) NOT NULL DEFAULT 0,
  visit_state ENUM('none','want_to_visit','visited') NOT NULL DEFAULT 'none',
  last_visited_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_house_target(discord_user_id,target_kind,target_id),
  INDEX idx_user_house_favorite(discord_user_id,is_favorite,updated_at),
  INDEX idx_user_house_visit(discord_user_id,visit_state,last_visited_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS saved_house_searches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  discord_user_id VARCHAR(32) NOT NULL,
  discord_global_name VARCHAR(255) NULL,
  discord_display_name VARCHAR(255) NULL,
  name VARCHAR(80) NOT NULL,
  normalized_name VARCHAR(80) NOT NULL,
  filter_version INT NOT NULL DEFAULT 1,
  filters_json LONGTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_saved_search_name(discord_user_id,normalized_name),
  INDEX idx_saved_search_user(discord_user_id,updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

export const SCHEMA_V7 = [
`ALTER TABLE guild_settings ADD COLUMN timezone VARCHAR(64) NULL`,
`CREATE TABLE IF NOT EXISTS tour_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  guild_id VARCHAR(32) NOT NULL, guild_name VARCHAR(255) NULL,
  channel_id VARCHAR(32) NOT NULL, channel_name VARCHAR(255) NULL,
  message_id VARCHAR(32) NULL, tour_id BIGINT UNSIGNED NOT NULL,
  tour_name VARCHAR(255) NULL, eso_server VARCHAR(32) NOT NULL,
  host_id VARCHAR(32) NOT NULL, host_global_name VARCHAR(255) NULL,
  host_display_name VARCHAR(255) NULL, title VARCHAR(255) NOT NULL,
  description TEXT NULL, start_at DATETIME NOT NULL,
  status ENUM('scheduled','cancelled','completed') NOT NULL DEFAULT 'scheduled',
  schedule_revision INT NOT NULL DEFAULT 1,
  started_at DATETIME NULL, completed_at DATETIME NULL, cancelled_at DATETIME NULL,
  created_by VARCHAR(32) NOT NULL, created_by_global_name VARCHAR(255) NULL,
  created_by_display_name VARCHAR(255) NULL, updated_by VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tour_events_tour FOREIGN KEY(tour_id) REFERENCES tours(id) ON DELETE CASCADE,
  INDEX idx_tour_events_upcoming(guild_id,eso_server,status,start_at),
  INDEX idx_tour_events_host(host_id,status,start_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS tour_event_rsvps (
  event_id BIGINT UNSIGNED NOT NULL, discord_user_id VARCHAR(32) NOT NULL,
  discord_global_name VARCHAR(255) NULL, discord_display_name VARCHAR(255) NULL,
  status ENUM('going','interested') NOT NULL, dm_reminders TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(event_id,discord_user_id),
  CONSTRAINT fk_event_rsvps_event FOREIGN KEY(event_id) REFERENCES tour_events(id) ON DELETE CASCADE,
  INDEX idx_event_rsvps_status(event_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS tour_event_deliveries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL, schedule_revision INT NOT NULL,
  reminder_key ENUM('24h','1h') NOT NULL, delivery_target VARCHAR(96) NOT NULL,
  status ENUM('claimed','sent','failed') NOT NULL DEFAULT 'claimed',
  failure_code VARCHAR(64) NULL, failure_message VARCHAR(500) NULL,
  attempted_at DATETIME NOT NULL, completed_at DATETIME NULL,
  CONSTRAINT fk_event_deliveries_event FOREIGN KEY(event_id) REFERENCES tour_events(id) ON DELETE CASCADE,
  UNIQUE KEY uq_event_delivery(event_id,schedule_revision,reminder_key,delivery_target),
  INDEX idx_event_delivery_claim(status,attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS featured_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  guild_id VARCHAR(32) NOT NULL, guild_name VARCHAR(255) NULL,
  target_kind ENUM('house','tour') NOT NULL, target_id BIGINT UNSIGNED NOT NULL,
  target_name VARCHAR(255) NULL, position INT NOT NULL, expires_at DATETIME NULL,
  selected_by VARCHAR(32) NOT NULL, selected_by_global_name VARCHAR(255) NULL,
  selected_by_display_name VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_featured_target(guild_id,target_kind,target_id),
  UNIQUE KEY uq_featured_position(guild_id,target_kind,position),
  INDEX idx_featured_expiry(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS tour_progress (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  discord_user_id VARCHAR(32) NOT NULL, discord_global_name VARCHAR(255) NULL,
  discord_display_name VARCHAR(255) NULL, tour_id BIGINT UNSIGNED NOT NULL,
  tour_name VARCHAR(255) NULL, eso_server VARCHAR(32) NOT NULL,
  status ENUM('active','completed') NOT NULL DEFAULT 'active', current_stop_id BIGINT UNSIGNED NULL,
  share_pass_id BIGINT UNSIGNED NULL, run_started_at DATETIME NULL,
  last_activity_at DATETIME NOT NULL, completion_count INT NOT NULL DEFAULT 0,
  last_completed_at DATETIME NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_progress_tour FOREIGN KEY(tour_id) REFERENCES tours(id) ON DELETE CASCADE,
  UNIQUE KEY uq_tour_progress(discord_user_id,tour_id,eso_server),
  INDEX idx_progress_user(discord_user_id,status,last_activity_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS tour_progress_stops (
  progress_id BIGINT UNSIGNED NOT NULL, stop_id BIGINT UNSIGNED NOT NULL,
  completed_at DATETIME NOT NULL,
  PRIMARY KEY(progress_id,stop_id),
  CONSTRAINT fk_progress_stops_progress FOREIGN KEY(progress_id) REFERENCES tour_progress(id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_stops_stop FOREIGN KEY(stop_id) REFERENCES tour_stops(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

export const SCHEMA_V2_COLUMNS = {
  guild_settings:{guild_name:'VARCHAR(255) NULL',bot_channel_name:'VARCHAR(255) NULL',staff_role_names:"LONGTEXT NOT NULL DEFAULT '[]'",registration_role_names:"LONGTEXT NOT NULL DEFAULT '[]'",tour_role_names:"LONGTEXT NOT NULL DEFAULT '[]'"},
  saved_houses:{guild_name:'VARCHAR(255) NULL',origin_guild_name:'VARCHAR(255) NULL',owner_global_name:'VARCHAR(255) NULL',owner_display_name:'VARCHAR(255) NULL',house_name:'VARCHAR(255) NULL',created_by_global_name:'VARCHAR(255) NULL',created_by_display_name:'VARCHAR(255) NULL',updated_by_global_name:'VARCHAR(255) NULL',updated_by_display_name:'VARCHAR(255) NULL'},
  house_comments:{saved_house_name:'VARCHAR(255) NULL',discord_global_name:'VARCHAR(255) NULL',discord_display_name:'VARCHAR(255) NULL'},
  tours:{guild_name:'VARCHAR(255) NULL',origin_guild_name:'VARCHAR(255) NULL',source_guild_name:'VARCHAR(255) NULL',creator_global_name:'VARCHAR(255) NULL',creator_display_name:'VARCHAR(255) NULL'},
  tour_stops:{tour_name:'VARCHAR(255) NULL',saved_house_name:'VARCHAR(255) NULL'},
  tour_sessions:{tour_name:'VARCHAR(255) NULL',guild_name:'VARCHAR(255) NULL',channel_name:'VARCHAR(255) NULL',started_by_global_name:'VARCHAR(255) NULL',started_by_display_name:'VARCHAR(255) NULL'},
  global_moderators:{discord_global_name:'VARCHAR(255) NULL',approved_by_global_name:'VARCHAR(255) NULL'},
  global_moderator_requests:{discord_global_name:'VARCHAR(255) NULL',discord_display_name:'VARCHAR(255) NULL',origin_guild_name:'VARCHAR(255) NULL',reviewed_by_global_name:'VARCHAR(255) NULL',reviewed_by_display_name:'VARCHAR(255) NULL'},
  audit_log:{guild_name:'VARCHAR(255) NULL',actor_global_name:'VARCHAR(255) NULL',actor_display_name:'VARCHAR(255) NULL',entity_name:'VARCHAR(255) NULL'}
};

// Migration 2 originally introduced readable identity fields. Migration 9
// reconciles installations that recorded v2 before every field was defined.
export const SCHEMA_V9_COLUMNS = SCHEMA_V2_COLUMNS;
