import { one, withTransaction } from '../db/database.js';

export class HouseMaintenanceService {
  constructor(db, { now = () => new Date() } = {}) { this.db = db; this.now = now; }

  async stale({ guildId = null, esoServer = null, olderThanDays = 180, limit = 25 } = {}) {
    const cutoff = new Date(this.now().getTime() - Math.max(1, Number(olderThanDays)) * 86400000).toISOString();
    const params = [cutoff]; const clauses = ["sh.status='active'", '(h.last_verified IS NULL OR h.last_verified<?)'];
    if (esoServer != null) { clauses.push('sh.eso_server=?'); params.push(String(esoServer)); }
    if (guildId != null) { clauses.push("(sh.scope='global' OR sh.guild_id=? OR (sh.scope='private' AND sh.origin_guild_id=?))"); params.push(String(guildId), String(guildId)); }
    params.push(Math.min(100, Math.max(1, Number(limit) || 25)));
    return this.db.query(`SELECT h.house_id,h.name,h.last_verified,sh.id saved_house_id,sh.scope,sh.guild_id,sh.eso_server,sh.eso_owner
      FROM houses h JOIN saved_houses sh ON sh.house_id=h.house_id WHERE ${clauses.join(' AND ')}
      ORDER BY CASE WHEN h.last_verified IS NULL THEN 0 ELSE 1 END,h.last_verified,h.house_id LIMIT ?`, params);
  }

  async duplicates({ guildId = null, esoServer = null } = {}) {
    const params = []; const clauses = ["sh.status='active'"];
    if (esoServer != null) { clauses.push('sh.eso_server=?'); params.push(String(esoServer)); }
    if (guildId != null) { clauses.push("(sh.scope='global' OR sh.guild_id=? OR (sh.scope='private' AND sh.origin_guild_id=?))"); params.push(String(guildId), String(guildId)); }
    return this.db.query(`SELECT sh.destination_id,sh.scope,sh.guild_id,sh.owner_user_id,count(*) duplicate_count,GROUP_CONCAT(sh.id) saved_house_ids
      FROM saved_houses sh WHERE ${clauses.join(' AND ')} GROUP BY sh.destination_id,sh.scope,sh.guild_id,sh.owner_user_id HAVING count(*)>1 ORDER BY sh.destination_id`, params);
  }

  async markVerified({ houseId, actorId, guildId = null } = {}) {
    const result = await this.db.query('UPDATE houses SET last_verified=? WHERE house_id=?', [this.now().toISOString(), Number(houseId)]);
    if (Number(result.affectedRows || 0) && actorId) await this.db.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)', [guildId || null, String(actorId), 'house_verified', 'house', String(houseId), JSON.stringify({ houseId: Number(houseId) })]);
    return Number(result.affectedRows || 0) === 1;
  }

  async mergeDuplicate({ keepId, removeId, actorId, guildId = null, esoServer = null, allowPrivate = true, actorGlobalName = null, actorDisplayName = null, auditAction = 'merge_duplicate_house' } = {}) {
    return withTransaction(this.db, async conn => {
      const clauses = ["s.status='active'"]; const params = [];
      if (esoServer != null) { clauses.push('s.eso_server=?'); params.push(String(esoServer)); }
      if (guildId != null) { clauses.push("(s.scope='global' OR s.guild_id=? OR (s.scope='private' AND s.origin_guild_id=?))"); params.push(String(guildId), String(guildId)); }
      const load = async id => one(conn, `SELECT s.*,h.name catalog_house_name FROM saved_houses s JOIN houses h ON h.house_id=s.house_id WHERE s.id=? AND ${clauses.join(' AND ')} FOR UPDATE`, [Number(id), ...params]);
      const keep = await load(keepId);
      const remove = await load(removeId);
      if (!keep || !remove) throw new Error('Both duplicate entries must be active and available.');
      if (!allowPrivate && (keep.scope === 'private' || remove.scope === 'private')) throw new Error('Private duplicate entries are not available in web administration.');
      if (Number(keep.destination_id) !== Number(remove.destination_id) || keep.scope !== remove.scope || String(keep.guild_id || '') !== String(remove.guild_id || '') || String(keep.owner_user_id || '') !== String(remove.owner_user_id || '')) throw new Error('Only duplicate entries with the same destination, visibility, and owner context can be merged.');
      const stops = await conn.query('SELECT id,tour_id FROM tour_stops WHERE saved_house_id=?', [Number(removeId)]);
      for (const stop of stops) {
        const existing = await one(conn, 'SELECT id FROM tour_stops WHERE tour_id=? AND saved_house_id=?', [Number(stop.tour_id), Number(keepId)]);
        if (existing) await conn.query('DELETE FROM tour_stops WHERE id=?', [Number(stop.id)]);
        else await conn.query('UPDATE tour_stops SET saved_house_id=? WHERE id=?', [Number(keepId), Number(stop.id)]);
      }
      await conn.query('UPDATE house_comments SET saved_house_id=? WHERE saved_house_id=?', [Number(keepId), Number(removeId)]);
      await conn.query("UPDATE saved_houses SET status='archived',updated_by=? WHERE id=?", [String(actorId), Number(removeId)]);
      await conn.query(`INSERT INTO audit_log
        (guild_id,actor_id,actor_global_name,actor_display_name,action,entity_type,entity_id,entity_name,details)
        VALUES(?,?,?,?,?,?,?,?,?)`, [guildId || keep.guild_id || keep.origin_guild_id || null, String(actorId), actorGlobalName, actorDisplayName, auditAction, 'saved_house', String(keepId), keep.display_name || keep.catalog_house_name || `Saved House #${keepId}`, JSON.stringify({ keepId: Number(keepId), removeId: Number(removeId), destinationId: Number(keep.destination_id), movedStops: stops.length, esoServer: esoServer || keep.eso_server })]);
      return { keepId: Number(keepId), removeId: Number(removeId), movedStops: stops.length };
    });
  }
}
