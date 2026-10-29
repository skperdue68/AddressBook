import { one, withTransaction } from '../db/database.js';
import { requireEsoServer } from '../utils/eso-server.js';
import { TourReadinessService } from './tour-readiness-service.js';

const same = (a, b) => a != null && b != null && String(a) === String(b);
const asDate = (db, date) => db.type === 'mariadb' ? date : date.toISOString();

export class TourProgressService {
  constructor(db, { now = () => new Date() } = {}) { this.db = db; this.now = now; this.readiness = new TourReadinessService(db); }

  async #tour(tourId, { userId, guildId, esoServer }, conn = this.db) {
    const server = requireEsoServer(esoServer); const tour = await one(conn, 'SELECT * FROM tours WHERE id=?', [Number(tourId)]);
    if (!tour) throw new Error('Tour not found.');
    if (tour.eso_server !== server) throw new Error('This tour belongs to a different ESO environment.');
    const allowed = tour.visibility === 'global' || (tour.visibility === 'public' && same(tour.guild_id, guildId)) || (tour.visibility === 'private' && same(tour.creator_id, userId));
    if (!allowed) throw new Error('You cannot access this tour.');
    return tour;
  }

  async #row(progressId, userId, conn = this.db) {
    const row = await one(conn, 'SELECT * FROM tour_progress WHERE id=? AND discord_user_id=? FOR UPDATE', [Number(progressId), String(userId)]);
    if (!row) throw new Error('Tour progress was not found for this user.');
    return row;
  }

  async #ready(progress,{userId,guildId,esoServer},conn=this.db,{allowMissing=false}={}){
    if(guildId==null||esoServer==null)return;
    const result=await this.readiness.check(progress.tour_id,{viewerId:userId,guildId,esoServer,passId:progress.share_pass_id,conn});
    const blocker=result.blocking.find(issue=>!allowMissing||!['no_stops','missing_stop'].includes(issue.code));
    if(blocker)throw new Error(blocker.message);
  }

  async startOrResume({ userId, guildId, esoServer, tourId, sharePassId = null, globalName = null, displayName = null } = {}) {
    const tour = await this.#tour(tourId, { userId, guildId, esoServer });
    if (sharePassId != null) {
      const pass = await one(this.db, "SELECT id FROM tour_share_passes WHERE id=? AND tour_id=? AND status='active'", [Number(sharePassId), Number(tourId)]);
      if (!pass) throw new Error('That tour share pass is invalid or has been revoked.');
    }
    const readiness=await this.readiness.check(tourId,{viewerId:userId,guildId,esoServer,passId:sharePassId});
    if(readiness.blocking.length)throw new Error(readiness.blocking[0].message);
    const first = await one(this.db, 'SELECT id FROM tour_stops WHERE tour_id=? ORDER BY position,id LIMIT 1', [Number(tourId)]);
    if (!first) throw new Error('This tour has no stops.');
    const current = await one(this.db, 'SELECT * FROM tour_progress WHERE discord_user_id=? AND tour_id=? AND eso_server=?', [String(userId), Number(tourId), tour.eso_server]);
    if (current) return {...current,_startedNew:false};
    const now = asDate(this.db, this.now());
    const conflict = this.db.type === 'sqlite' ? 'ON CONFLICT(discord_user_id,tour_id,eso_server) DO NOTHING' : 'ON DUPLICATE KEY UPDATE id=id';
    const inserted=await this.db.query(`INSERT INTO tour_progress(discord_user_id,discord_global_name,discord_display_name,tour_id,tour_name,eso_server,status,current_stop_id,share_pass_id,run_started_at,last_activity_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ${conflict}`, [String(userId), globalName, displayName, Number(tourId), tour.name, tour.eso_server, 'active', Number(first.id), sharePassId == null ? null : Number(sharePassId), now, now]);
    const result=await one(this.db, 'SELECT * FROM tour_progress WHERE discord_user_id=? AND tour_id=? AND eso_server=?', [String(userId), Number(tourId), tour.eso_server]);
    return {...result,_startedNew:Number(inserted.affectedRows)>0&&(this.db.type==='sqlite'||Number(inserted.insertId)>0)};
  }

  async advance({ progressId, userId, guildId = null, esoServer = null, expectedStopId = undefined } = {}) {
    return withTransaction(this.db, async conn => {
      const progress = await this.#row(progressId, userId, conn);
      if (expectedStopId !== undefined && Number(progress.current_stop_id) !== Number(expectedStopId)) throw new Error('This tour progress changed. Reload the player.');
      if (guildId != null || esoServer != null) await this.#tour(progress.tour_id, { userId, guildId, esoServer }, conn);
      await this.#ready(progress,{userId,guildId,esoServer},conn);
      if (progress.status === 'completed') return progress;
      const current = await one(conn, 'SELECT * FROM tour_stops WHERE id=? AND tour_id=?', [Number(progress.current_stop_id), Number(progress.tour_id)]);
      if (!current) {
        const replacement = await one(conn, 'SELECT id FROM tour_stops WHERE tour_id=? AND id NOT IN (SELECT stop_id FROM tour_progress_stops WHERE progress_id=?) ORDER BY position,id LIMIT 1', [Number(progress.tour_id), Number(progress.id)]);
        if (replacement) {
          await conn.query("UPDATE tour_progress SET current_stop_id=?,last_activity_at=? WHERE id=?", [Number(replacement.id), asDate(this.db, this.now()), Number(progress.id)]);
          return one(conn, 'SELECT * FROM tour_progress WHERE id=?', [Number(progress.id)]);
        }
        await conn.query("UPDATE tour_progress SET status='completed',current_stop_id=NULL,last_activity_at=?,completion_count=completion_count+1,last_completed_at=? WHERE id=?", [asDate(this.db, this.now()), asDate(this.db, this.now()), Number(progress.id)]);
        return one(conn, 'SELECT * FROM tour_progress WHERE id=?', [Number(progress.id)]);
      }
      const insert = this.db.type === 'sqlite' ? 'INSERT OR IGNORE' : 'INSERT IGNORE';
      await conn.query(`${insert} INTO tour_progress_stops(progress_id,stop_id,completed_at) VALUES(?,?,?)`, [Number(progress.id), Number(current.id), asDate(this.db, this.now())]);
      const next = await one(conn, 'SELECT id FROM tour_stops WHERE tour_id=? AND position>? ORDER BY position,id LIMIT 1', [Number(progress.tour_id), Number(current.position)]);
      const now = asDate(this.db, this.now());
      if (next) await conn.query("UPDATE tour_progress SET current_stop_id=?,last_activity_at=? WHERE id=?", [Number(next.id), now, Number(progress.id)]);
      else await conn.query("UPDATE tour_progress SET status='completed',current_stop_id=NULL,last_activity_at=?,completion_count=completion_count+1,last_completed_at=? WHERE id=?", [now, now, Number(progress.id)]);
      return one(conn, 'SELECT * FROM tour_progress WHERE id=?', [Number(progress.id)]);
    });
  }

  async back({ progressId, userId, guildId = null, esoServer = null, expectedStopId = undefined } = {}) {
    return withTransaction(this.db,async conn=>{
    const progress = await this.#row(progressId, userId,conn);
    if (expectedStopId !== undefined && Number(progress.current_stop_id) !== Number(expectedStopId)) throw new Error('This tour progress changed. Reload the player.');
    if (guildId != null || esoServer != null) await this.#tour(progress.tour_id, { userId, guildId, esoServer },conn);
    await this.#ready(progress,{userId,guildId,esoServer},conn);
    const current = await one(conn, 'SELECT position FROM tour_stops WHERE id=? AND tour_id=?', [Number(progress.current_stop_id), Number(progress.tour_id)]);
    if (!current || current.position <= 1) return progress;
    const previous = await one(conn, 'SELECT id FROM tour_stops WHERE tour_id=? AND position<? ORDER BY position DESC LIMIT 1', [Number(progress.tour_id), Number(current.position)]);
    await conn.query("UPDATE tour_progress SET status='active',current_stop_id=?,last_activity_at=? WHERE id=?", [Number(previous.id), asDate(this.db, this.now()), Number(progress.id)]);
    return one(conn, 'SELECT * FROM tour_progress WHERE id=?', [Number(progress.id)]);
    });
  }

  async restart({ progressId, userId, guildId = null, esoServer = null } = {}) {
    return withTransaction(this.db, async conn => {
      const progress = await this.#row(progressId, userId, conn);
      if (guildId != null || esoServer != null) await this.#tour(progress.tour_id, { userId, guildId, esoServer }, conn);
      await this.#ready(progress,{userId,guildId,esoServer},conn);
      const first = await one(conn, 'SELECT id FROM tour_stops WHERE tour_id=? ORDER BY position,id LIMIT 1', [Number(progress.tour_id)]);
      if (!first) throw new Error('This tour no longer has any stops.');
      await conn.query('DELETE FROM tour_progress_stops WHERE progress_id=?', [Number(progress.id)]);
      await conn.query("UPDATE tour_progress SET status='active',current_stop_id=?,run_started_at=?,last_activity_at=? WHERE id=?", [Number(first.id), asDate(this.db, this.now()), asDate(this.db, this.now()), Number(progress.id)]);
      return one(conn, 'SELECT * FROM tour_progress WHERE id=?', [Number(progress.id)]);
    });
  }

  async reconcile({ progressId, userId, guildId = null, esoServer = null } = {}) {
    return withTransaction(this.db, async conn => {
      const progress = await this.#row(progressId, userId, conn);
      if (guildId != null || esoServer != null) await this.#tour(progress.tour_id, { userId, guildId, esoServer }, conn);
      await this.#ready(progress,{userId,guildId,esoServer},conn,{allowMissing:true});
      if (progress.status === 'completed') return progress;
      const current = progress.current_stop_id == null ? null : await one(conn, 'SELECT id FROM tour_stops WHERE id=? AND tour_id=?', [Number(progress.current_stop_id), Number(progress.tour_id)]);
      if (current) return progress;
      const replacement = await one(conn, `SELECT ts.id FROM tour_stops ts
        WHERE ts.tour_id=? AND NOT EXISTS (SELECT 1 FROM tour_progress_stops ps WHERE ps.progress_id=? AND ps.stop_id=ts.id)
        ORDER BY ts.position,ts.id LIMIT 1`, [Number(progress.tour_id), Number(progress.id)]);
      const now = asDate(this.db, this.now());
      if (replacement) {
        await conn.query("UPDATE tour_progress SET current_stop_id=?,status='active',last_activity_at=? WHERE id=?", [Number(replacement.id), now, Number(progress.id)]);
      } else {
        await conn.query("UPDATE tour_progress SET current_stop_id=NULL,status='completed',last_activity_at=?,completion_count=completion_count+1,last_completed_at=? WHERE id=?", [now, now, Number(progress.id)]);
      }
      return one(conn, 'SELECT * FROM tour_progress WHERE id=?', [Number(progress.id)]);
    });
  }

  async #visibleRows(rows, { userId, guildId, esoServer } = {}) {
    if (guildId == null) return rows;
    const visible=[];
    for (const row of rows) { try { await this.#tour(row.tour_id, { userId, guildId, esoServer }); visible.push(row); } catch { /* access may have changed; hide the stale run */ } }
    return visible;
  }

  async listInProgress({ userId, guildId = null, esoServer } = {}) { const rows=await this.db.query("SELECT * FROM tour_progress WHERE discord_user_id=? AND eso_server=? AND status='active' ORDER BY last_activity_at DESC", [String(userId), requireEsoServer(esoServer)]); return this.#visibleRows(rows,{userId,guildId,esoServer}); }
  async listCompleted({ userId, guildId = null, esoServer } = {}) { const rows=await this.db.query("SELECT * FROM tour_progress WHERE discord_user_id=? AND eso_server=? AND status='completed' ORDER BY last_completed_at DESC", [String(userId), requireEsoServer(esoServer)]); return this.#visibleRows(rows,{userId,guildId,esoServer}); }
  async completedStops({ progressId, userId, guildId = null, esoServer = null } = {}) {
    const progress = await this.#row(progressId, userId);
    if (guildId != null || esoServer != null) await this.#tour(progress.tour_id, { userId, guildId, esoServer });
    const ready = await this.readiness.check(progress.tour_id, { viewerId: userId, guildId, esoServer: esoServer || progress.eso_server, passId: progress.share_pass_id });
    const eligible = new Set(ready.eligibleStops.map(stop => Number(stop.id)));
    const rows = await this.db.query(`SELECT ps.completed_at,ts.id stop_id,ts.position,sh.id saved_house_id,COALESCE(h.name,sh.display_name) house_name,sh.display_name nickname,sh.eso_owner,h.population_limit,h.population_limit_plus
      FROM tour_progress_stops ps JOIN tour_stops ts ON ts.id=ps.stop_id
      LEFT JOIN saved_houses sh ON sh.id=ts.saved_house_id LEFT JOIN houses h ON h.house_id=sh.house_id
      WHERE ps.progress_id=? ORDER BY ts.position,ts.id`, [Number(progressId)]);
    return rows.filter(row => eligible.has(Number(row.stop_id))).map(({ stop_id, ...row }) => row);
  }
}
