import { one, withTransaction } from '../db/database.js';

const asDate = (db, date) => db.type === 'mariadb' ? date : date.toISOString();
const insertPrefix = db => db.type === 'sqlite' ? 'INSERT OR IGNORE' : 'INSERT IGNORE';

export class EventReminderService {
  constructor(db, { now = () => new Date(), gateway = {} } = {}) { this.db = db; this.now = now; this.gateway = gateway; }

  async #claim(event, reminderKey, deliveryTarget) {
    const result = await this.db.query(`${insertPrefix(this.db)} INTO tour_event_deliveries(event_id,schedule_revision,reminder_key,delivery_target,status,attempted_at) VALUES(?,?,?,?,?,?)`, [event.id, event.schedule_revision, reminderKey, deliveryTarget, 'claimed', asDate(this.db, this.now())]);
    return Number(result.affectedRows || 0) === 1;
  }

  async #mark(id, status, error = null) {
    await this.db.query('UPDATE tour_event_deliveries SET status=?,failure_code=?,failure_message=?,completed_at=? WHERE id=?', [status, error ? 'DELIVERY_FAILED' : null, error ? String(error.message || error).slice(0, 500) : null, asDate(this.db, this.now()), Number(id)]);
  }

  async #deliver(event, reminderKey, target, send) {
    const claimed = await this.#claim(event, reminderKey, target);
    if (!claimed) return { attempted: false, sent: 0, failed: 0 };
    const row = await one(this.db, 'SELECT id FROM tour_event_deliveries WHERE event_id=? AND schedule_revision=? AND reminder_key=? AND delivery_target=?', [event.id, event.schedule_revision, reminderKey, target]);
    try { await send(); await this.#mark(row.id, 'sent'); return { attempted: true, sent: 1, failed: 0 }; }
    catch (error) { await this.#mark(row.id, 'failed', error); return { attempted: true, sent: 0, failed: 1 }; }
  }

  async runOnce() {
    const now = this.now(); const events = await this.db.query("SELECT * FROM tour_events WHERE status='scheduled' AND start_at>? ORDER BY start_at", [asDate(this.db, now)]);
    let attempted = 0, sent = 0, failed = 0;
    for (const event of events) {
      const start = new Date(event.start_at); const hours = (start.getTime() - now.getTime()) / 3600000;
      const reminderKey = hours > 0 && hours <= 1 ? '1h' : hours > 23 && hours <= 24 ? '24h' : null;
      if (!reminderKey) continue;
      const channel = await this.#deliver(event, reminderKey, `channel:${event.channel_id}`, () => this.gateway.sendChannel?.({ event, reminderKey, channelId: event.channel_id }));
      attempted += channel.attempted ? 1 : 0; sent += channel.sent; failed += channel.failed;
      const attendees = await this.db.query("SELECT discord_user_id FROM tour_event_rsvps WHERE event_id=? AND dm_reminders=1", [event.id]);
      for (const attendee of attendees) {
        const dm = await this.#deliver(event, reminderKey, `user:${attendee.discord_user_id}`, () => this.gateway.sendDm?.({ event, reminderKey, userId: attendee.discord_user_id }));
        attempted += dm.attempted ? 1 : 0; sent += dm.sent; failed += dm.failed;
      }
    }
    return { attempted, sent, failed };
  }

  async listStaleClaims({ olderThanMs = 15 * 60 * 1000 } = {}) {
    const cutoff = new Date(this.now().getTime() - Math.max(0, Number(olderThanMs))); 
    return this.db.query("SELECT * FROM tour_event_deliveries WHERE status IN ('claimed','failed') AND attempted_at<=? ORDER BY attempted_at", [asDate(this.db, cutoff)]);
  }
}
