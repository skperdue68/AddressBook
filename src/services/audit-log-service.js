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

// Historical names and free-form details can contain Private source records, even
// when the target is now public. Only expose a current, provably public target.
// Compare textual IDs exactly: SQL numeric coercion could match "1secret" to 1.
const visibleAudit = `(
  SELECT a.id,a.guild_id,a.guild_name,a.actor_id,a.actor_global_name,a.actor_display_name,
    a.action,a.entity_type,a.entity_id,
    CASE WHEN a.entity_type='saved_house' THEN h.display_name
         WHEN a.entity_type='tour' THEN t.name ELSE NULL END AS entity_name,
    NULL AS details,a.created_at
  FROM audit_log a
  LEFT JOIN saved_houses h ON a.entity_type='saved_house' AND a.entity_id=CAST(h.id AS CHAR)
  LEFT JOIN tours t ON a.entity_type='tour' AND a.entity_id=CAST(t.id AS CHAR)
  WHERE (a.entity_type='saved_house' AND (h.scope='global' OR (h.scope='public' AND h.guild_id=a.guild_id)))
     OR (a.entity_type='tour' AND (t.visibility='global' OR (t.visibility='public' AND t.guild_id=a.guild_id)))
     OR (a.entity_type='guild' AND a.entity_id=a.guild_id)
) visible_audit`;

export class AuditLogService {
  constructor(db) { this.db = db; }

  async list({ guildId = null, page = 1, action = null, entityType = null, target = null, pageSize: requested = 10 } = {}) {
    const size = pageSize(requested); const currentPage = auditPage(page);
    const { clause, params } = filters({ guildId, action, entityType, target });
    const total = await one(this.db, `SELECT count(*) c FROM ${visibleAudit} ${clause}`, params);
    const rows = await this.db.query(`SELECT id,guild_id,guild_name,actor_id,actor_global_name,actor_display_name,action,entity_type,entity_id,entity_name,details,created_at
      FROM ${visibleAudit} ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, size, (currentPage - 1) * size]);
    return { rows, page: currentPage, pageSize: size, total: Number(total?.c || 0), hasNext: currentPage * size < Number(total?.c || 0) };
  }

  async exportCsv({ guildId, action = null, entityType = null, target = null } = {}) {
    if (!guildId) throw new Error('A guild is required to export the audit log.');
    const { clause, params } = filters({ guildId, action, entityType, target });
    const rows = await this.db.query(`SELECT ${csvColumns.join(',')} FROM ${visibleAudit} ${clause} ORDER BY id DESC`, params);
    return `${csvColumns.join(',')}\r\n${rows.map(row => csvColumns.map(column => csvCell(row[column], column)).join(',')).join('\r\n')}${rows.length ? '\r\n' : ''}`;
  }
}
