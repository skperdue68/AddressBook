import { one } from '../db/database.js';

const ids = rows => rows.map(row => Number(row.id));
const placeholders = values => values.map(() => '?').join(',');

export class DataExportService {
  constructor(db) { this.db = db; }

  async exportGuild({ guildId, esoServer, userId = null, includePrivate = false } = {}) {
    const guild = String(guildId); const server = String(esoServer || '');
    const privateForUser = includePrivate === true && userId != null;
    const settings = await one(this.db, 'SELECT * FROM guild_settings WHERE guild_id=?', [guild]);
    const privateHouses = privateForUser ? " OR (scope='private' AND owner_user_id=?)" : '';
    const houses = await this.db.query(`SELECT * FROM saved_houses WHERE eso_server=? AND ((scope='public' AND guild_id=?) OR scope='global'${privateHouses}) ORDER BY id`, [server, guild, ...(privateForUser ? [String(userId)] : [])]);
    const houseIds = ids(houses); const houseClause = houseIds.length ? `saved_house_id IN (${placeholders(houseIds)})` : '1=0';
    const privateTours = privateForUser ? " OR (visibility='private' AND creator_id=?)" : '';
    const tours = await this.db.query(`SELECT * FROM tours WHERE eso_server=? AND ((visibility='public' AND guild_id=?) OR visibility='global'${privateTours}) ORDER BY id`, [server, guild, ...(privateForUser ? [String(userId)] : [])]);
    const tourIds = ids(tours); const tourClause = tourIds.length ? `tour_id IN (${placeholders(tourIds)})` : '1=0';
    const stops = await this.db.query(`SELECT * FROM tour_stops WHERE ${tourClause} AND ${houseClause} ORDER BY tour_id,position`, [...tourIds,...houseIds]);
    const events = await this.db.query(`SELECT * FROM tour_events WHERE eso_server=? AND guild_id=? AND ${tourIds.length ? `tour_id IN (${placeholders(tourIds)})` : '1=0'} ORDER BY id`, [server, guild, ...tourIds]);
    const featured = await this.db.query(`SELECT f.* FROM featured_items f
      LEFT JOIN saved_houses sh ON f.target_kind='house' AND sh.id=f.target_id
      LEFT JOIN tours t ON f.target_kind='tour' AND t.id=f.target_id
      WHERE f.guild_id=? AND (f.expires_at IS NULL OR f.expires_at>?) AND ((f.target_kind='house' AND sh.eso_server=? AND sh.status='active' AND (sh.scope='global' OR (sh.scope='public' AND sh.guild_id=?)))
        OR (f.target_kind='tour' AND t.eso_server=? AND (t.visibility='global' OR (t.visibility='public' AND t.guild_id=?))))
      ORDER BY f.position,f.id`, [guild,this.db.type==='mariadb'?new Date():new Date().toISOString(),server,guild,server,guild]);
    const comments = await this.db.query(`SELECT * FROM house_comments WHERE ${houseClause} ORDER BY saved_house_id,id`, houseIds);
    // Audit metadata can reference hidden or deleted Private content.
    // Use the separately privacy-filtered audit UI/CSV instead of embedding it.
    const audit = [];
    return { format: 'addressbook-export', version: '1.0.60', exportedAt: new Date().toISOString(), guildId: guild, esoServer: server, includePrivate: privateForUser, settings, houses, tours, stops, events, featured, comments, audit };
  }

  async toJson(options = {}) { return JSON.stringify(await this.exportGuild(options), null, 2); }
}
