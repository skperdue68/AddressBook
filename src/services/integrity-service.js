import { one, withTransaction } from '../db/database.js';

const placeholders = values => values.map(() => '?').join(',');

export class IntegrityService {
  constructor(db) { this.db = db; }

  async scan({ guildId = null, esoServer = null } = {}) {
    const params = []; const scope = [];
    if (esoServer != null) { scope.push('t.eso_server=?'); params.push(String(esoServer)); }
    if (guildId != null) { scope.push('(t.guild_id=? OR t.visibility=\'global\')'); params.push(String(guildId)); }
    const tourScope = scope.length ? `AND ${scope.join(' AND ')}` : '';
    const orphanStops = await this.db.query(`SELECT ts.id,ts.tour_id,ts.position FROM tour_stops ts LEFT JOIN saved_houses sh ON sh.id=ts.saved_house_id JOIN tours t ON t.id=ts.tour_id WHERE sh.id IS NULL ${tourScope} ORDER BY ts.tour_id,ts.position`, params);
    const duplicateDestinations = await this.db.query(`SELECT ts.tour_id,sh.destination_id,count(*) c FROM tour_stops ts JOIN saved_houses sh ON sh.id=ts.saved_house_id JOIN tours t ON t.id=ts.tour_id WHERE sh.destination_id IS NOT NULL ${tourScope} GROUP BY ts.tour_id,sh.destination_id HAVING count(*)>1`, params);
    const mismatchedHouses = await this.db.query(`SELECT sh.id,sh.eso_server,d.eso_server destination_eso_server FROM saved_houses sh JOIN housing_destinations d ON d.id=sh.destination_id WHERE sh.eso_server IS NOT NULL AND d.eso_server IS NOT NULL AND sh.eso_server<>d.eso_server${esoServer != null ? ' AND sh.eso_server=?' : ''}`, esoServer != null ? [String(esoServer)] : []);
    const staleProgress = await this.db.query(`SELECT p.id,p.tour_id,p.current_stop_id FROM tour_progress p LEFT JOIN tour_stops ts ON ts.id=p.current_stop_id WHERE p.status='active' AND p.current_stop_id IS NOT NULL AND ts.id IS NULL${esoServer != null ? ' AND p.eso_server=?' : ''}`, esoServer != null ? [String(esoServer)] : []);
    return { orphanStops, duplicateDestinations, mismatchedHouses, staleProgress, counts: { orphanStops: orphanStops.length, duplicateDestinations: duplicateDestinations.length, mismatchedHouses: mismatchedHouses.length, staleProgress: staleProgress.length } };
  }

  async repair({ guildId = null, esoServer = null, removeOrphanStops = false, reconcileProgress = false } = {}) {
    return withTransaction(this.db, async conn => {
      const before = await this.scan({ guildId, esoServer });
      if (removeOrphanStops && before.orphanStops.length) {
        const ids = before.orphanStops.map(row => Number(row.id));
        await conn.query(`DELETE FROM tour_stops WHERE id IN (${placeholders(ids)})`, ids);
        for (const tourId of new Set(before.orphanStops.map(row => Number(row.tour_id)))) {
          const rows = await conn.query('SELECT id FROM tour_stops WHERE tour_id=? ORDER BY position,id', [tourId]);
          for (let index = 0; index < rows.length; index++) await conn.query('UPDATE tour_stops SET position=? WHERE id=?', [index + 1, rows[index].id]);
        }
      }
      if (reconcileProgress && before.staleProgress.length) {
        for (const row of before.staleProgress) {
          const next = await one(conn, `SELECT ts.id FROM tour_stops ts WHERE ts.tour_id=? AND NOT EXISTS (SELECT 1 FROM tour_progress_stops ps WHERE ps.progress_id=? AND ps.stop_id=ts.id) ORDER BY ts.position,ts.id LIMIT 1`, [Number(row.tour_id), Number(row.id)]);
          if (next) await conn.query("UPDATE tour_progress SET current_stop_id=?,last_activity_at=CURRENT_TIMESTAMP WHERE id=?", [Number(next.id), Number(row.id)]);
          else await conn.query("UPDATE tour_progress SET current_stop_id=NULL,status='completed',completion_count=completion_count+1,last_completed_at=CURRENT_TIMESTAMP,last_activity_at=CURRENT_TIMESTAMP WHERE id=?", [Number(row.id)]);
        }
      }
      const after = await this.scan({ guildId, esoServer });
      return { before: before.counts, after: after.counts, removedOrphanStops: removeOrphanStops ? before.orphanStops.length : 0, reconciledProgress: reconcileProgress ? before.staleProgress.length : 0 };
    });
  }
}
