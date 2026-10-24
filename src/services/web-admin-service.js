import { AdminHealthService } from './admin-health-service.js';
import { AuditLogService } from './audit-log-service.js';
import { DataExportService } from './data-export-service.js';
import { HouseMaintenanceService } from './house-maintenance-service.js';
import { HousingReportService } from './housing-report-service.js';
import { RegistrationService } from './registration-service.js';
import { GuildService } from './guild-service.js';
import { one, withTransaction } from '../db/database.js';

export class WebAdminService {
  constructor(db, services = {}) {
    this.db = db;
    this.guilds = services.guilds || new GuildService(db);
    this.health = services.health || new AdminHealthService(db, { version: '1.0.62' });
    this.audit = services.audit || new AuditLogService(db);
    this.maintenance = services.maintenance || new HouseMaintenanceService(db);
    this.reports = services.reports || new HousingReportService(db);
    this.registration = services.registration || new RegistrationService(db);
    this.dataExport = services.dataExport || new DataExportService(db);
  }

  async authorizeGuild({ guildId, requestedGuildId, esoServer, requestedEsoServer, userId, memberRoleIds = [] } = {}) {
    if (!guildId || String(guildId) !== String(requestedGuildId)) return { allowed: false, reason: 'guild' };
    if (!esoServer || String(esoServer) !== String(requestedEsoServer)) return { allowed: false, reason: 'environment' };
    this.guilds.invalidate(guildId);const current=await this.guilds.ensureSettings(guildId);
    if(current.eso_server!==esoServer)return {allowed:false,reason:'environment'};
    const access=await this.guilds.serverModerators.access({guildId,userId,roleIds:memberRoleIds.map(String)});
    return access.isModerator||access.bootstrap ? {allowed:true,reason:null} : {allowed:false,reason:'permission'};
  }

  overview({ guildId, esoServer, availableChannelIds = [] } = {}) {
    return this.health.snapshot({ guildId, esoServer, availableChannelIds });
  }

  listAudit({ guildId, page = 1, pageSize = 25, action = null, entityType = null, target = null } = {}) {
    return this.audit.list({ guildId, page, pageSize, action, entityType, target });
  }

  exportAudit({ guildId, action = null, entityType = null, target = null } = {}) {
    return this.audit.exportCsv({ guildId, action, entityType, target });
  }

  listMaintenance({ guildId, esoServer } = {}) {
    return Promise.all([
      this.maintenance.stale({ guildId, esoServer, limit: 100 }),
      this.maintenance.duplicates({ guildId, esoServer })
    ]).then(([stale, duplicates]) => ({ stale, duplicates }));
  }

  async verifyHouse({ houseId, guildId, esoServer, actor = {} } = {}) {
    if (!houseId || !guildId || !esoServer || !actor.id) throw new Error('House is not available.');
    const row = await one(this.db, `SELECT h.house_id
      FROM houses h JOIN saved_houses sh ON sh.house_id=h.house_id
      WHERE h.house_id=? AND sh.status='active' AND sh.eso_server=?
        AND (sh.scope='global' OR (sh.scope='public' AND sh.guild_id=?))
      LIMIT 1`, [Number(houseId), String(esoServer), String(guildId)]);
    if (!row) throw new Error('House is not available for this guild and environment.');
    const updated = await this.maintenance.markVerified({ houseId: Number(houseId), actorId: actor.id, guildId: String(guildId), esoServer });
    if (!updated) throw new Error('House is not available.');
    return { houseId: Number(houseId), verified: true };
  }

  async mergeDuplicate({ keepId, removeId, guildId, esoServer, actor = {} } = {}) {
    if (!keepId || !removeId || !guildId || !esoServer || !actor.id || Number(keepId) === Number(removeId)) throw new Error('Duplicate entries are not available.');
    return this.maintenance.mergeDuplicate({
      keepId: Number(keepId), removeId: Number(removeId), actorId: actor.id, guildId: String(guildId), esoServer: String(esoServer),
      allowPrivate: false, actorGlobalName: actor.globalName || null, actorDisplayName: actor.displayName || null, auditAction: 'web_merge_duplicate_house'
    });
  }

  listPending({ guildId, esoServer, limit = 100, offset = 0 } = {}) {
    return this.registration.searchPending(guildId, { esoServer, limit, offset });
  }

  async listReports({ guildId, esoServer, actor = {}, page = 1, pageSize = 25 } = {}) {
    if (!guildId || !esoServer || !actor.id) throw new Error('Housing reports are not available.');
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safePageSize = Math.min(100, Math.max(1, Math.floor(Number(pageSize) || 25)));
    const all = await this.reports.listForModerator({ viewerId: String(actor.id), guildId: String(guildId), esoServer: String(esoServer), isServerModerator: true });
    const start = (safePage - 1) * safePageSize;
    return { rows: all.slice(start, start + safePageSize), page: safePage, pageSize: safePageSize, total: all.length, hasNext: start + safePageSize < all.length };
  }

  async moderateReport({ id, action, guildId, esoServer, actor = {} } = {}) {
    if (!['review', 'resolve', 'dismiss'].includes(action)) throw new Error('Invalid report action.');
    if (!id || !guildId || !esoServer || !actor.id) throw new Error('Housing report is no longer available.');
    const context = { viewerId: String(actor.id), guildId: String(guildId), esoServer: String(esoServer), isServerModerator: true };
    const current = await this.reports.getForModerator(Number(id), context);
    if (!['open', 'reviewing'].includes(current.status) || (action === 'review' && current.status !== 'open')) throw new Error('Housing report is no longer available.');
    const names = { reviewerGlobalName: actor.globalName || null, reviewerDisplayName: actor.displayName || null };
    if (action === 'review') return this.reports.review(Number(id), { reviewerId: String(actor.id), guildId: String(guildId), esoServer: String(esoServer), isServerModerator: true, names });
    return this.reports.resolve(Number(id), { reviewerId: String(actor.id), guildId: String(guildId), esoServer: String(esoServer), isServerModerator: true, resolution: action === 'dismiss' ? 'dismissed' : 'resolved', names });
  }

  async reviewPending({ id, action, guildId, esoServer, actor = {} } = {}) {
    if (!['approve', 'deny'].includes(action)) throw new Error('Invalid review action.');
    if (!id || !guildId || !esoServer || !actor.id) throw new Error('Pending house is not available.');
    const nextStatus = action === 'approve' ? 'active' : 'archived';
    return withTransaction(this.db, async conn => {
      const row = await one(conn, `SELECT s.*, h.name catalog_house_name
        FROM saved_houses s JOIN houses h ON h.house_id=s.house_id
        WHERE s.id=? FOR UPDATE`, [Number(id)]);
      if (!row || row.status !== 'pending') throw new Error('Pending house was already reviewed or is not available.');
      const sameEnvironment = String(row.eso_server) === String(esoServer);
      const belongsToQueue = (row.scope === 'public' && String(row.guild_id) === String(guildId))
        || (row.scope === 'global' && String(row.origin_guild_id) === String(guildId));
      if (!sameEnvironment || !belongsToQueue || row.scope === 'private') throw new Error('Pending house is not available for this guild and environment.');
      await conn.query('UPDATE saved_houses SET status=?,updated_by=? WHERE id=? AND status=?', [nextStatus, String(actor.id), Number(id), 'pending']);
      const actionName = action === 'approve' ? 'web_approve_house' : 'web_deny_house';
      const entityName = row.display_name || row.catalog_house_name || `Saved House #${id}`;
      const details = JSON.stringify({ esoServer: String(esoServer), scope: row.scope, guildId: String(guildId), actorGlobalName: actor.globalName || null, actorDisplayName: actor.displayName || null });
      await conn.query(`INSERT INTO audit_log
        (guild_id,actor_id,actor_global_name,actor_display_name,action,entity_type,entity_id,entity_name,details)
        VALUES(?,?,?,?,?,?,?,?,?)`, [String(guildId), String(actor.id), actor.globalName || null, actor.displayName || null, actionName, 'saved_house', String(id), entityName, details]);
      const updated = await one(conn, `SELECT s.*, h.name catalog_house_name
        FROM saved_houses s JOIN houses h ON h.house_id=s.house_id WHERE s.id=?`, [Number(id)]);
      return { action, record: this.registration.adapt(updated) };
    });
  }

  exportGuild({ guildId, esoServer } = {}) {
    return this.dataExport.toJson({ guildId, esoServer, includePrivate: false });
  }
}
