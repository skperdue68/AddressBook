import {weightedOrder} from './featured-selection.js';
import { one, withTransaction } from '../db/database.js';
import { requireEsoServer } from '../utils/eso-server.js';

const asDate = (db, value) => db.type === 'mariadb' ? value : value instanceof Date ? value.toISOString() : value;

export class FeaturedContentService {
  constructor(db,{clock=()=>Date.now(),random=Math.random}={}) { this.db = db;this.clock=clock;this.random=random; }

  async #target({ targetKind, targetId, guildId, esoServer }, conn = this.db) {
    const server = requireEsoServer(esoServer);
    if (targetKind === 'house') {
      const row = await one(conn, 'SELECT s.*,h.name target_name FROM saved_houses s JOIN houses h ON h.house_id=s.house_id WHERE s.id=? AND s.status=\'active\'', [Number(targetId)]);
      if (!row) throw new Error('House not found.');
      if (row.eso_server !== server) throw new Error('Featured content must use the guild ESO environment.');
      if (!['public', 'global'].includes(row.scope)) throw new Error('Private houses cannot be Featured.');
      if (!String(row.eso_owner || '').trim() || row.destination_id == null) throw new Error('Only saved player houses can be Featured.');
      if (row.scope === 'public' && String(row.guild_id) !== String(guildId)) throw new Error('The house is not from this Discord server.');
      return { row, name: row.target_name };
    }
    if (targetKind === 'tour') {
      const row = await one(conn, 'SELECT t.*,t.name target_name FROM tours t WHERE t.id=?', [Number(targetId)]);
      if (!row) throw new Error('Tour not found.');
      if (row.eso_server !== server) throw new Error('Featured content must use the guild ESO environment.');
      if (!['public', 'global'].includes(row.visibility)) throw new Error('Private tours cannot be Featured.');
      if (row.visibility === 'public' && String(row.guild_id) !== String(guildId)) throw new Error('The tour is not from this Discord server.');
      return { row, name: row.target_name };
    }
    throw new Error('Featured target must be a house or tour.');
  }

  async set({ guildId, esoServer, targetKind, targetId, position = null, expiresAt = undefined, actorId, isModerator = false, actorGlobalName = null, actorDisplayName = null } = {}) {
    if (!isModerator) throw new Error('Only a Housing Moderator can manage Featured content.');
    const target = await this.#target({ targetKind, targetId, guildId, esoServer });
    return withTransaction(this.db, async conn => {
      const rows = await conn.query('SELECT * FROM featured_items WHERE guild_id=? AND target_kind=? ORDER BY position,id', [String(guildId), targetKind]);
      const current=rows.find(row=>Number(row.target_id)===Number(targetId));
      const without = rows.slice(0,4).filter(row => Number(row.target_id) !== Number(targetId));
      if (without.length >= 4) throw new Error(`A guild may have at most four Featured ${targetKind}s.`);
      const requested = position == null ? Number(current?.position)||without.length+1 : Math.max(1, Math.min(4, Number(position)));
      const effectiveExpiry=expiresAt===undefined?current?.expires_at||null:expiresAt?asDate(this.db,expiresAt instanceof Date?expiresAt:new Date(expiresAt)):null;
      without.splice(Math.min(requested - 1, without.length), 0, { target_id: Number(targetId), target_name: target.name, expires_at: effectiveExpiry, selected_by: actorId, selected_by_global_name: actorGlobalName, selected_by_display_name: actorDisplayName, isNew: true });
      await conn.query('DELETE FROM featured_items WHERE guild_id=? AND target_kind=?', [String(guildId), targetKind]);
      for (let index = 0; index < without.length; index++) {
        const row = without[index];
        if (row.isNew) {
          await conn.query('INSERT INTO featured_items(guild_id,guild_name,target_kind,target_id,target_name,position,expires_at,selected_by,selected_by_global_name,selected_by_display_name) VALUES(?,?,?,?,?,?,?,?,?,?)', [String(guildId), null, targetKind, Number(targetId), target.name, index + 1, effectiveExpiry, String(actorId), actorGlobalName, actorDisplayName]);
        } else await conn.query('INSERT INTO featured_items(guild_id,guild_name,target_kind,target_id,target_name,position,expires_at,selected_by,selected_by_global_name,selected_by_display_name) VALUES(?,?,?,?,?,?,?,?,?,?)', [String(guildId), row.guild_name || null, targetKind, Number(row.target_id), row.target_name || null, index + 1, row.expires_at || null, row.selected_by, row.selected_by_global_name || null, row.selected_by_display_name || null]);
      }
      return one(conn, 'SELECT * FROM featured_items WHERE guild_id=? AND target_kind=? AND target_id=?', [String(guildId), targetKind, Number(targetId)]);
    });
  }

  async list({ guildId, esoServer, targetKind = null } = {}, conn = this.db) {
    const server = requireEsoServer(esoServer); const clauses = ['f.guild_id=?', '(f.expires_at IS NULL OR f.expires_at>?)']; const args = [String(guildId), asDate(this.db, new Date(this.clock()))];
    if (targetKind) { clauses.push('f.target_kind=?'); args.push(targetKind); }
    const rows = await conn.query(`SELECT f.*,h.house_id,h.eso_owner,h.display_name house_display_name,h.scope house_visibility FROM featured_items f LEFT JOIN saved_houses h ON f.target_kind='house' AND h.id=f.target_id LEFT JOIN tours t ON f.target_kind='tour' AND t.id=f.target_id WHERE ${clauses.join(' AND ')} AND ((f.target_kind='house' AND h.status='active' AND h.scope IN ('public','global') AND h.eso_server=? AND h.destination_id IS NOT NULL AND h.eso_owner IS NOT NULL AND trim(h.eso_owner)<>'' AND (h.scope='global' OR h.guild_id=f.guild_id)) OR (f.target_kind='tour' AND t.visibility IN ('public','global') AND t.eso_server=? AND (t.visibility='global' OR t.guild_id=f.guild_id))) ORDER BY f.target_kind,f.position`, [...args, server, server]);
    const counts={};return rows.filter(row=>(counts[row.target_kind]=(counts[row.target_kind]||0)+1)<=4);
  }

  async autoSelectEmpty({ guildId, esoServer, actorId = 'system:auto-featured', random = Math.random } = {}) {
    return withTransaction(this.db, async conn => {
    const existing = await this.list({ guildId, esoServer, targetKind: 'house' }, conn);
    if (existing.length) return [];
    await conn.query("DELETE FROM featured_items WHERE guild_id=? AND target_kind='house'", [String(guildId)]);
    const server = requireEsoServer(esoServer);
    const candidates = await conn.query(`SELECT s.id
      FROM saved_houses s
      WHERE s.status='active' AND s.eso_server=? AND s.scope IN ('public','global')
        AND s.destination_id IS NOT NULL AND s.eso_owner IS NOT NULL AND trim(s.eso_owner)<>''
        AND (s.scope='global' OR s.guild_id=?) ORDER BY s.id`, [server, String(guildId)]);
    for (let index = candidates.length - 1; index > 0; index--) {
      const next = Math.max(0, Math.min(index, Math.floor(Number(random()) * (index + 1))));
      [candidates[index], candidates[next]] = [candidates[next], candidates[index]];
    }
    const selected = [];
    for (const candidate of candidates.slice(0, 4)) {
      const target = await this.#target({ guildId, esoServer: server, targetKind: 'house', targetId: candidate.id }, conn);
      const result = await conn.query('INSERT INTO featured_items(guild_id,target_kind,target_id,target_name,position,selected_by) VALUES(?,?,?,?,?,?)', [String(guildId), 'house', Number(candidate.id), target.name, selected.length + 1, String(actorId)]);
      selected.push(await one(conn, 'SELECT * FROM featured_items WHERE id=?', [result.insertId]));
    }
    return selected;
    });
  }

  async autoSelectEmptyAll({ actorId = 'system:auto-featured', random = Math.random } = {}) {
    const guilds = await this.db.query("SELECT guild_id,eso_server FROM guild_settings WHERE eso_server IS NOT NULL AND eso_server<>'' ORDER BY guild_id");
    const selected = [];
    for (const guild of guilds) {
      const rows = await this.autoSelectEmpty({ guildId: guild.guild_id, esoServer: guild.eso_server, actorId, random });
      selected.push(...rows.map(row => ({ ...row, guild_id: guild.guild_id })));
    }
    return selected;
  }

  async rotateHouses({guildId,esoServer}){
    const server=requireEsoServer(esoServer),guild=String(guildId),now=new Date(this.clock()),week=7*86400000;
    return withTransaction(this.db,async conn=>{
      await conn.query('INSERT IGNORE INTO featured_house_cycles(guild_id,eso_server) VALUES(?,?)',[guild,server]);
      let cycle=await one(conn,'SELECT * FROM featured_house_cycles WHERE guild_id=? FOR UPDATE',[guild]);
      if(cycle.eso_server!==server){
        await conn.query("DELETE FROM featured_items WHERE guild_id=? AND target_kind='house'",[guild]);
        await conn.query("UPDATE featured_house_cycles SET eso_server=?,last_rotated_at=NULL,previous_destination_ids='[]' WHERE guild_id=?",[server,guild]);
        cycle={eso_server:server,last_rotated_at:null,previous_destination_ids:'[]'};
      }
      let items=await this.list({guildId:guild,esoServer:server,targetKind:'house'},conn);
      const timestamp=cycle.last_rotated_at==null?null:new Date(cycle.last_rotated_at instanceof Date?cycle.last_rotated_at:String(cycle.last_rotated_at).replace(' ','T')+(String(cycle.last_rotated_at).includes('Z')?'':'Z')).getTime();
      const due=timestamp!=null&&now.getTime()>=timestamp+week;
      if(timestamp==null&&items.length){
        const ids=await conn.query("SELECT DISTINCT s.destination_id FROM featured_items f JOIN saved_houses s ON s.id=f.target_id WHERE f.guild_id=? AND f.target_kind='house'",[guild]);
        await conn.query('UPDATE featured_house_cycles SET last_rotated_at=?,previous_destination_ids=? WHERE guild_id=?',[asDate(this.db,now),JSON.stringify(ids.map(r=>Number(r.destination_id))),guild]);
        return {rotated:false,items,nextRotationAt:new Date(now.getTime()+week)};
      }
      if(!due&&items.length)return {rotated:false,items,nextRotationAt:new Date(timestamp+week)};
      const candidates=await conn.query(`SELECT s.id,s.destination_id FROM saved_houses s JOIN houses h ON h.house_id=s.house_id
        WHERE s.status='active' AND s.eso_server=? AND s.scope IN ('public','global')
          AND s.destination_id IS NOT NULL AND s.eso_owner IS NOT NULL AND trim(s.eso_owner)<>''
          AND (s.scope='global' OR s.guild_id=?) ORDER BY s.id`,[server,guild]);
      const distinct=[...new Map(candidates.map(r=>[Number(r.destination_id),r])).values()];
      if(!distinct.length)return {rotated:false,items,nextRotationAt:timestamp==null?null:new Date(timestamp+week)};
      const previous=new Set(JSON.parse(cycle.previous_destination_ids||'[]').map(Number));
      const signals=await conn.query(`SELECT target_id,
        SUM(CASE WHEN is_favorite=1 THEN 1 ELSE 0 END) favorites,
        SUM(CASE WHEN visit_state='visited' THEN 1 ELSE 0 END) visitors,
        SUM(CASE WHEN visit_state='want_to_visit' THEN 1 ELSE 0 END) interested
        FROM user_house_states WHERE target_kind='destination' AND target_id IN
          (SELECT s.destination_id FROM saved_houses s WHERE s.eso_server=? AND s.status='active' AND (s.scope='global' OR (s.scope='public' AND s.guild_id=?)))
        GROUP BY target_id`,[server,guild]);
      const engagement=new Map(signals.map(row=>[Number(row.target_id),row]));
      const enriched=distinct.map(row=>({...row,...engagement.get(Number(row.destination_id))}));
      const chosen=[...weightedOrder(enriched.filter(r=>!previous.has(Number(r.destination_id))),this.random),...weightedOrder(enriched.filter(r=>previous.has(Number(r.destination_id))),this.random)].slice(0,4);
      await conn.query("DELETE FROM featured_items WHERE guild_id=? AND target_kind='house'",[guild]);
      for(const [index,candidate] of chosen.entries()){
        const target=await this.#target({guildId:guild,esoServer:server,targetKind:'house',targetId:candidate.id},conn);
        await conn.query('INSERT INTO featured_items(guild_id,target_kind,target_id,target_name,position,selected_by) VALUES(?,?,?,?,?,?)',[guild,'house',candidate.id,target.name,index+1,'system:weekly-featured']);
      }
      if(due||timestamp==null)await conn.query('UPDATE featured_house_cycles SET last_rotated_at=?,previous_destination_ids=? WHERE guild_id=?',[asDate(this.db,now),JSON.stringify(chosen.map(r=>Number(r.destination_id))),guild]);
      items=await this.list({guildId:guild,esoServer:server,targetKind:'house'},conn);
      return {rotated:true,items,nextRotationAt:new Date((due||timestamp==null?now.getTime():timestamp)+week)};
    });
  }
  async rotateDueHousesAll(){
    const guilds=await this.db.query("SELECT guild_id,eso_server FROM guild_settings WHERE eso_server IS NOT NULL AND eso_server<>'' ORDER BY guild_id"),results=[];
    for(const guild of guilds)results.push({guildId:guild.guild_id,...await this.rotateHouses({guildId:guild.guild_id,esoServer:guild.eso_server})});
    return results;
  }

  async remove({ guildId, targetKind, targetId, actorId, isModerator = false } = {}) {
    if (!isModerator) throw new Error('Only a Housing Moderator can manage Featured content.');
    await this.db.query('DELETE FROM featured_items WHERE guild_id=? AND target_kind=? AND target_id=?', [String(guildId), targetKind, Number(targetId)]);
    return true;
  }

  async reorder({ guildId, esoServer, targetKind, targetId, position, actorId, isModerator = false } = {}) {
    return this.set({ guildId, esoServer, targetKind, targetId, position, actorId, isModerator });
  }

  async expireDue({ now = new Date(this.clock()) } = {}) { const result = await this.db.query('DELETE FROM featured_items WHERE expires_at IS NOT NULL AND expires_at<=?', [asDate(this.db, now)]); return Number(result.affectedRows || 0); }
}
