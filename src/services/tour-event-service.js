import { one, withTransaction } from '../db/database.js';
import { parseLocalDateTime } from '../utils/timezone.js';
import { requireEsoServer } from '../utils/eso-server.js';
import { boundedOptional, boundedRequired, EVENT_DESCRIPTION_MAX, EVENT_TITLE_MAX } from '../utils/text-limits.js';

const same = (a, b) => a != null && b != null && String(a) === String(b);
const asDate = (db, date) => db.type === 'mariadb' ? date : date.toISOString();

function canSeeTour(tour, { viewerId, guildId }) {
  if (!tour) return false;
  if (tour.visibility === 'global') return true;
  if (tour.visibility === 'public') return same(tour.guild_id, guildId);
  return same(tour.creator_id, viewerId);
}

function redacted(event) {
  return { id: event.id, guild_id: event.guild_id, channel_id: event.channel_id, tour_id: event.tour_id, status: event.status, start_at: event.start_at, canView: false, title: 'Private event', description: null };
}

export class TourEventService {
  constructor(db, { now = () => new Date() } = {}) { this.db = db; this.now = now; }

  async #tour(tourId, conn = this.db) { return one(conn, 'SELECT * FROM tours WHERE id=?', [Number(tourId)]); }

  async #timezone(guildId, conn = this.db) {
    const row = await one(conn, 'SELECT timezone FROM guild_settings WHERE guild_id=?', [String(guildId)]);
    if (!row?.timezone) throw new Error('Configure the guild timezone in Administration before scheduling an event.');
    return row.timezone;
  }

  async create(input) {
    const guildId = String(input.guildId ?? '');
    if (!guildId) throw new Error('Events require a Discord server.');
    const tour = await this.#tour(input.tourId);
    if (!tour) throw new Error('Tour not found.');
    const server = requireEsoServer(input.esoServer || tour.eso_server);
    if (tour.eso_server !== server) throw new Error('The event and tour use different ESO environments.');
    if (tour.visibility === 'public' && !same(tour.guild_id, guildId)) throw new Error('A Server tour event must be scheduled from the tour\'s Discord server.');
    const isCreator = same(tour.creator_id, input.hostId);
    const authorized = tour.visibility === 'private' ? isCreator : Boolean(input.isTourHost || input.isModerator);
    if (!authorized) throw new Error('Only the tour creator or an authorized Housing Tours/Housing Moderator member can schedule this event.');
    const timezone = input.timezone || await this.#timezone(guildId);
    const parsed = parseLocalDateTime({ date: input.date, time: input.time, timezone });
    const title = boundedRequired(input.title, EVENT_TITLE_MAX, 'Event title');
    const description = boundedOptional(input.description, EVENT_DESCRIPTION_MAX, 'Event description');
    const now = this.now();
    const values = [guildId, input.guildName || null, String(input.channelId), input.channelName || null, null, Number(input.tourId), tour.name || null, server, String(input.hostId), input.hostGlobalName || null, input.hostDisplayName || null, title, description, asDate(this.db, parsed.utc), 'scheduled', 1, String(input.hostId), input.hostGlobalName || null, input.hostDisplayName || null, String(input.hostId), asDate(this.db, now), asDate(this.db, now)];
    const result = await this.db.query(`INSERT INTO tour_events(guild_id,guild_name,channel_id,channel_name,message_id,tour_id,tour_name,eso_server,host_id,host_global_name,host_display_name,title,description,start_at,status,schedule_revision,created_by,created_by_global_name,created_by_display_name,updated_by,created_at,updated_at) VALUES(${values.map(() => '?').join(',')})`, values);
    return this.get(result.insertId, { viewerId: input.hostId, guildId, esoServer: server });
  }

  async get(eventId, { viewerId = null, guildId = null, esoServer = null } = {}, conn = this.db) {
    const event = await one(conn, `SELECT e.*,t.visibility,t.creator_id,t.guild_id tour_guild_id,
      (SELECT count(*) FROM tour_event_rsvps r WHERE r.event_id=e.id AND r.status='going') going_count,
      (SELECT count(*) FROM tour_event_rsvps r WHERE r.event_id=e.id AND r.status='interested') interested_count
      FROM tour_events e JOIN tours t ON t.id=e.tour_id WHERE e.id=?`, [Number(eventId)]);
    if (!event) return null;
    if (esoServer && event.eso_server !== requireEsoServer(esoServer)) return { ...redacted(event), reason: 'environment_mismatch' };
    const canView = canSeeTour({ visibility: event.visibility, creator_id: event.creator_id, guild_id: event.tour_guild_id }, { viewerId, guildId });
    return canView ? { ...event, canView: true } : redacted(event);
  }

  async listUpcoming({ guildId, esoServer, viewerId = null, page = 1, limit = 10, pageSize = limit } = {}, conn = this.db) {
    const server = requireEsoServer(esoServer); const size = Math.max(1, Math.min(25, Number(limit) || 10)); const offset = Math.max(0, (Number(page) - 1) * Math.max(1, Math.min(25, Number(pageSize) || size)));
    const rows = await conn.query(`SELECT e.*,t.visibility,t.creator_id,t.guild_id tour_guild_id,
      (SELECT count(*) FROM tour_event_rsvps r WHERE r.event_id=e.id AND r.status='going') going_count,
      (SELECT count(*) FROM tour_event_rsvps r WHERE r.event_id=e.id AND r.status='interested') interested_count
      FROM tour_events e JOIN tours t ON t.id=e.tour_id
      WHERE e.eso_server=? AND e.status='scheduled' AND e.started_at IS NULL AND e.start_at>=? AND (t.visibility='global' OR e.guild_id=?) ORDER BY e.start_at,e.id LIMIT ? OFFSET ?`, [server, asDate(this.db, this.now()), String(guildId), size, offset]);
    return rows.map(event => canSeeTour({ visibility: event.visibility, creator_id: event.creator_id, guild_id: event.tour_guild_id }, { viewerId, guildId }) ? { ...event, canView: true } : redacted(event));
  }

  async getRsvp(eventId, userId, conn = this.db) { const row = await one(conn, 'SELECT status,dm_reminders FROM tour_event_rsvps WHERE event_id=? AND discord_user_id=?', [Number(eventId), String(userId)]); return row ? { status: row.status, dm_reminders: Number(row.dm_reminders) } : null; }

  async setReminderPreference({ eventId, userId, enabled, guildId, esoServer } = {}) {
    const event = await this.get(eventId, { viewerId: userId, guildId, esoServer });
    if (!event?.canView) throw new Error('You cannot change reminders for this event.');
    if (['completed', 'cancelled'].includes(event.status)) throw new Error('This event is closed and no longer accepts reminder changes.');
    const current = await this.getRsvp(eventId, userId);
    if (!current) throw new Error('Choose Going or Interested before enabling event reminders.');
    await this.db.query('UPDATE tour_event_rsvps SET dm_reminders=?,updated_at=CURRENT_TIMESTAMP WHERE event_id=? AND discord_user_id=?', [enabled ? 1 : 0, Number(eventId), String(userId)]);
    return this.getRsvp(eventId, userId);
  }

  async setRsvp({ eventId, userId, status, dmReminders = false, guildId, esoServer, globalName = null, displayName = null } = {}) {
    if (!['going', 'interested'].includes(status)) throw new Error('RSVP status must be Going or Interested.');
    const event = await this.get(eventId, { viewerId: userId, guildId, esoServer });
    if (!event?.canView) throw new Error('You cannot RSVP to this event.');
    if (['completed', 'cancelled'].includes(event.status)) throw new Error('This event is closed and no longer accepts RSVPs.');
    const upsert = this.db.type === 'sqlite'
      ? 'ON CONFLICT(event_id,discord_user_id) DO UPDATE SET discord_global_name=excluded.discord_global_name,discord_display_name=excluded.discord_display_name,status=excluded.status,dm_reminders=excluded.dm_reminders,updated_at=CURRENT_TIMESTAMP'
      : 'ON DUPLICATE KEY UPDATE discord_global_name=VALUES(discord_global_name),discord_display_name=VALUES(discord_display_name),status=VALUES(status),dm_reminders=VALUES(dm_reminders),updated_at=CURRENT_TIMESTAMP';
    await this.db.query(`INSERT INTO tour_event_rsvps(event_id,discord_user_id,discord_global_name,discord_display_name,status,dm_reminders) VALUES(?,?,?,?,?,?) ${upsert}`, [Number(eventId), String(userId), globalName, displayName, status, dmReminders ? 1 : 0]);
    return this.getRsvp(eventId, userId);
  }

  async removeRsvp({ eventId, userId } = {}) { await this.db.query('DELETE FROM tour_event_rsvps WHERE event_id=? AND discord_user_id=?', [Number(eventId), String(userId)]); return true; }

  async update({ eventId, actorId, guildId = null, esoServer = null, isModerator = false, date, time, title, description, timezone } = {}) {
    return withTransaction(this.db, async conn => {
    const current = await one(conn, 'SELECT e.*,t.creator_id,t.name tour_catalog_name FROM tour_events e JOIN tours t ON t.id=e.tour_id WHERE e.id=?', [Number(eventId)]);
    if (!current) throw new Error('Event not found.');
    if (guildId != null && !same(current.guild_id, guildId)) throw new Error('This event belongs to a different Discord server.');
    if (esoServer != null && current.eso_server !== requireEsoServer(esoServer)) throw new Error('This event belongs to a different ESO environment.');
    if (!isModerator && !same(current.host_id, actorId)) throw new Error('Only the event host or a moderator can edit this event.');
    if (current.status !== 'scheduled') throw new Error('This event is closed and cannot be edited.');
    if (current.started_at && (date || time)) throw new Error('An event in progress cannot be rescheduled.');
    if ((date && !time) || (time && !date)) throw new Error('Provide both a date and time to reschedule an event.');
    const nextTitle = title === undefined ? current.title : boundedRequired(title, EVENT_TITLE_MAX, 'Event title');
    const nextDescription = description === undefined ? current.description : boundedOptional(description, EVENT_DESCRIPTION_MAX, 'Event description');
    const zone = timezone || await this.#timezone(current.guild_id, conn);
    const parsed = date && time ? parseLocalDateTime({ date, time, timezone: zone }) : null;
    const nextRevision = parsed ? Number(current.schedule_revision) + 1 : Number(current.schedule_revision);
    await conn.query('UPDATE tour_events SET title=?,description=?,start_at=?,schedule_revision=?,updated_by=? WHERE id=?', [nextTitle, nextDescription, parsed ? asDate(this.db, parsed.utc) : current.start_at, nextRevision, String(actorId), Number(eventId)]);
    return this.get(eventId, { viewerId: actorId, guildId: current.guild_id, esoServer: current.eso_server }, conn);
    });
  }

  async cancel({ eventId, actorId, guildId = null, esoServer = null, isModerator = false } = {}) {
    return withTransaction(this.db, async conn => {
    const current = await one(conn, 'SELECT * FROM tour_events WHERE id=?', [Number(eventId)]);
    if (!current) throw new Error('Event not found.');
    if (guildId != null && !same(current.guild_id, guildId)) throw new Error('This event belongs to a different Discord server.');
    if (esoServer != null && current.eso_server !== requireEsoServer(esoServer)) throw new Error('This event belongs to a different ESO environment.');
    if (!isModerator && !same(current.host_id, actorId)) throw new Error('Only the event host or a moderator can cancel this event.');
    if (current.status !== 'scheduled') throw new Error('This event is closed and cannot be cancelled.');
    const openSession = await one(conn, "SELECT id FROM tour_sessions WHERE tour_id=? AND guild_id=? AND channel_id=? AND mode='shared' ORDER BY id DESC LIMIT 1", [Number(current.tour_id), String(current.guild_id), String(current.channel_id)]);
    if (current.started_at && openSession) await conn.query('DELETE FROM tour_sessions WHERE id=?', [openSession.id]);
    await conn.query("UPDATE tour_events SET status='cancelled',cancelled_at=?,updated_by=? WHERE id=?", [asDate(this.db, this.now()), String(actorId), Number(eventId)]);
    return this.get(eventId, { viewerId: actorId, guildId: current.guild_id, esoServer: current.eso_server }, conn);
    });
  }

  async start({ eventId, actorId, guildId, esoServer, isModerator = false } = {}) {
    return withTransaction(this.db, async conn => {
    const event = await one(conn, 'SELECT * FROM tour_events WHERE id=?', [Number(eventId)]);
    if (!event || event.status !== 'scheduled' || event.started_at) throw new Error('This event is no longer scheduled.');
    if (!same(event.guild_id, guildId)) throw new Error('This event belongs to a different Discord server.');
    if (!same(event.host_id, actorId) && !isModerator) throw new Error('Only the event host or a moderator can start this event.');
    const visible = await this.get(eventId, { viewerId: actorId, guildId, esoServer }, conn);
    if (!visible?.canView) throw new Error('You cannot access this event in the current ESO environment.');
    const { TourSessionService } = await import('./tour-session-service.js');
    const session = await new TourSessionService(this.db).startShared({ tourId: event.tour_id, guildId: event.guild_id, channelId: event.channel_id, userId: event.host_id, esoServer: event.eso_server }, conn);
    await conn.query("UPDATE tour_events SET started_at=coalesce(started_at,?),updated_by=? WHERE id=?", [asDate(this.db, this.now()), String(actorId), Number(eventId)]);
    return { ...visible, status: 'started', leaderId: event.host_id, session };
    });
  }

  async complete({ eventId, actorId, guildId = null, esoServer = null, isModerator = false } = {}) {
    return withTransaction(this.db, async conn => {
    const event = await one(conn, 'SELECT * FROM tour_events WHERE id=?', [Number(eventId)]);
    if (!event) throw new Error('Event not found.');
    if (event.status !== 'scheduled' || !event.started_at) throw new Error('Only a started event can be completed.');
    if (guildId != null && !same(event.guild_id, guildId)) throw new Error('This event belongs to a different Discord server.');
    if (esoServer != null && event.eso_server !== requireEsoServer(esoServer)) throw new Error('This event belongs to a different ESO environment.');
    if (!same(event.host_id, actorId) && !isModerator) throw new Error('Only the event host or a moderator can complete this event.');
    const openSession = await one(conn, "SELECT id FROM tour_sessions WHERE tour_id=? AND guild_id=? AND channel_id=? AND mode='shared' ORDER BY id DESC LIMIT 1", [Number(event.tour_id), String(event.guild_id), String(event.channel_id)]);
    if (openSession) await conn.query('DELETE FROM tour_sessions WHERE id=?', [openSession.id]);
    await conn.query("UPDATE tour_events SET status='completed',completed_at=?,updated_by=? WHERE id=?", [asDate(this.db, this.now()), String(actorId), Number(eventId)]);
    return this.get(eventId, { viewerId: actorId, guildId: event.guild_id, esoServer: event.eso_server }, conn);
    });
  }
}
