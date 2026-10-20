import { one } from '../db/database.js';

const pageSize = value => Math.min(25, Math.max(1, Number(value) || 10));
const auditPage = value => { const parsed=Number(value); return Number.isFinite(parsed)&&parsed>=1?Math.floor(parsed):1; };
const csvColumns = ['id', 'guild_id', 'guild_name', 'actor_id', 'actor_global_name', 'actor_display_name', 'action', 'entity_type', 'entity_id', 'entity_name', 'details', 'created_at'];
const idColumns = new Set(['guild_id', 'actor_id', 'entity_id']);
const csvCell = (value, column) => {
  let text = value == null ? '' : value instanceof Date ? value.toISOString() : String(value);
  if (/^\s*[=+\-@]/.test(text) || (idColumns.has(column) && /^\d{16,}$/.test(text))) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
const literalPattern = value => `%${String(value).toLowerCase().replace(/[!%_]/g, match => `!${match}`)}%`;
const filters = ({ guildId, action, entityType, target }) => {
  const where = []; const params = [];
  if (guildId != null) { where.push('guild_id=?'); params.push(String(guildId)); }
  if (action) { where.push("LOWER(action) LIKE ? ESCAPE '!'"); params.push(literalPattern(action)); }
  if (entityType) { where.push('entity_type=?'); params.push(String(entityType)); }
  if (target) { where.push("(LOWER(COALESCE(entity_name,'')) LIKE ? ESCAPE '!' OR LOWER(COALESCE(entity_id,'')) LIKE ? ESCAPE '!')"); params.push(literalPattern(target), literalPattern(target)); }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

export class AuditLogService {
  constructor(db) { this.db = db; }

  async list({ guildId = null, page = 1, action = null, entityType = null, target = null, pageSize: requested = 10 } = {}) {
    const size = pageSize(requested); const currentPage = auditPage(page);
    const { clause, params } = filters({ guildId, action, entityType, target });
    const total = await one(this.db, `SELECT count(*) c FROM audit_log ${clause}`, params);
    const rows = await this.db.query(`SELECT id,guild_id,guild_name,actor_id,actor_global_name,actor_display_name,action,entity_type,entity_id,entity_name,details,created_at
      FROM audit_log ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, size, (currentPage - 1) * size]);
    return { rows, page: currentPage, pageSize: size, total: Number(total?.c || 0), hasNext: currentPage * size < Number(total?.c || 0) };
  }

  async exportCsv({ guildId, action = null, entityType = null, target = null } = {}) {
    if (!guildId) throw new Error('A guild is required to export the audit log.');
    const { clause, params } = filters({ guildId, action, entityType, target });
    const rows = await this.db.query(`SELECT ${csvColumns.join(',')} FROM audit_log ${clause} ORDER BY id DESC`, params);
    return `${csvColumns.join(',')}\r\n${rows.map(row => csvColumns.map(column => csvCell(row[column], column)).join(',')).join('\r\n')}${rows.length ? '\r\n' : ''}`;
  }
}
