import { one } from '../db/database.js';

// Server-side record of web sign-ins that must stop working before their cookie expires.
//
// Login cookies are signed and stateless, so on their own they cannot be cancelled: a
// copied cookie keeps working until it expires. Two small tables fix that:
//   web_revoked_sessions  one row per login that was signed out (by its session id)
//   web_session_floors    "sign out everywhere": every login issued at or before this time is void
// A cookie is checked against both on each request.
//
// The tables are created here with portable DDL rather than through the numbered schema
// migrations, so adding them does not change the schema version or the SQLite/MariaDB copy
// tool. They hold only short-lived security records, never member content.
export class SessionRevocationService {
  constructor(db, { now = () => Date.now() } = {}) {
    this.db = db;
    this.now = now;
  }

  async ensureSchema() {
    await this.db.query('CREATE TABLE IF NOT EXISTS web_revoked_sessions (session_id VARCHAR(64) NOT NULL PRIMARY KEY, expires_at BIGINT NOT NULL)');
    await this.db.query('CREATE TABLE IF NOT EXISTS web_session_floors (discord_user_id VARCHAR(32) NOT NULL PRIMARY KEY, valid_after BIGINT NOT NULL)');
  }

  // Signs out one login. `expiresAt` is the latest moment a cookie for it could still be valid.
  async revokeSession(sessionId, expiresAt) {
    if (!sessionId) return;
    const insert = this.db.type === 'sqlite' ? 'INSERT OR IGNORE' : 'INSERT IGNORE';
    await this.db.query(`${insert} INTO web_revoked_sessions(session_id,expires_at) VALUES(?,?)`, [String(sessionId), Number(expiresAt)]);
  }

  // Signs the member out of every browser: logins issued up to now stop working.
  async revokeAllForUser(userId, at = this.now()) {
    if (!userId) return;
    const upsert = this.db.type === 'sqlite'
      ? 'ON CONFLICT(discord_user_id) DO UPDATE SET valid_after=MAX(valid_after,excluded.valid_after)'
      : 'ON DUPLICATE KEY UPDATE valid_after=GREATEST(valid_after,VALUES(valid_after))';
    await this.db.query(`INSERT INTO web_session_floors(discord_user_id,valid_after) VALUES(?,?) ${upsert}`, [String(userId), Number(at)]);
  }

  async isRevoked({ sessionId = null, userId = null, issuedAt = 0 } = {}) {
    const row = await one(this.db,
      'SELECT (SELECT valid_after FROM web_session_floors WHERE discord_user_id=?) floor_at, (SELECT 1 FROM web_revoked_sessions WHERE session_id=? AND expires_at>?) revoked',
      [String(userId ?? ''), String(sessionId ?? ''), this.now()]);
    if (row?.revoked) return true;
    const floor = row?.floor_at;
    return floor !== null && floor !== undefined && Number(issuedAt) <= Number(floor);
  }

  // Removes records that can no longer matter. A login lasts at most 365 days, so a
  // sign-out-everywhere time older than that has nothing left to void.
  async purgeExpired() {
    const now = this.now();
    await this.db.query('DELETE FROM web_revoked_sessions WHERE expires_at<=?', [now]);
    await this.db.query('DELETE FROM web_session_floors WHERE valid_after<?', [now - 366 * 86_400_000]);
  }
}
