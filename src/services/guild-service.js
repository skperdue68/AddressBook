import { ServerModeratorService } from './server-moderator-service.js';
import { one } from '../db/database.js';
const defaults=guildId=>({guild_id:guildId,eso_server:null,eso_server_selected_by:null,eso_server_selected_at:null,registration_policy:'open',staff_role_ids:[],registration_role_ids:[],tour_role_ids:[],bot_channel_id:null,timezone:null});
export class GuildService{
  constructor(db,{serverModerators=new ServerModeratorService(db)}={}){this.db=db;this.cache=new Map();this.serverModerators=serverModerators;this.moderatorAccess=new Map();}
  async ensureModeratorAccess(i){const access=await this.serverModerators.access({guildId:i.guildId,userId:i.user?.id,roleIds:[...(i.member?.roles?.cache?.keys?.()||[])]});this.moderatorAccess.set(`${i.guildId}:${i.user?.id}`,access);return access;}
  accessFor(i){return this.moderatorAccess.get(`${i.guildId}:${i.user?.id}`);}
  async ensureSettings(guildId){if(!guildId)return defaults(null);if(this.cache.has(guildId))return this.cache.get(guildId);await this.db.query('INSERT IGNORE INTO guild_settings(guild_id) VALUES(?)',[guildId]);const r=await one(this.db,'SELECT * FROM guild_settings WHERE guild_id=?',[guildId]);const parsed={...r,staff_role_ids:JSON.parse(r.staff_role_ids||'[]'),registration_role_ids:JSON.parse(r.registration_role_ids||'[]'),tour_role_ids:JSON.parse(r.tour_role_ids||'[]')};this.cache.set(guildId,parsed);return parsed;}
  getSettings(guildId){return this.cache.get(guildId)||defaults(guildId);}
  getEsoServer(guildId){return this.getSettings(guildId).eso_server||null;}
  invalidate(guildId){this.cache.delete(guildId);}
  async #refresh(guildId){this.cache.delete(guildId);return this.ensureSettings(guildId);}
  async setPolicy(guildId,policy){if(!['open','approval','roles'].includes(policy))throw new Error('Invalid policy.');await this.ensureSettings(guildId);await this.db.query('UPDATE guild_settings SET registration_policy=? WHERE guild_id=?',[policy,guildId]);return this.#refresh(guildId);}
  async setRoles(guildId,type,ids){await this.ensureSettings(guildId);const columns={moderator:'staff_role_ids',trusted:'registration_role_ids',tours:'tour_role_ids'},col=columns[type];if(!col)throw new Error('Invalid housing role type.');await this.db.query(`UPDATE guild_settings SET ${col}=? WHERE guild_id=?`,[JSON.stringify(ids),guildId]);return this.#refresh(guildId);}
  async setChannel(guildId,channelId){await this.ensureSettings(guildId);await this.db.query('UPDATE guild_settings SET bot_channel_id=? WHERE guild_id=?',[channelId||null,guildId]);return this.#refresh(guildId);}
  async setTimezone(guildId,timezone){if(!timezone||!/^\w+\/[^\s]+$/.test(String(timezone)))throw new Error('Invalid timezone.');await this.ensureSettings(guildId);await this.db.query('UPDATE guild_settings SET timezone=? WHERE guild_id=?',[String(timezone),guildId]);return this.#refresh(guildId);}
  isHousingChannelAllowed(interaction){if(!interaction.guildId)return true;const s=this.getSettings(interaction.guildId);return !s.bot_channel_id||s.bot_channel_id===interaction.channelId;}
  hasTrustedSubmitterRole(interaction){const s=this.getSettings(interaction.guildId),roles=interaction.member?.roles?.cache;return s.registration_role_ids.some(id=>roles?.has(id));}
  canAdmin(interaction){const fresh=this.accessFor(interaction);if(fresh)return fresh.isModerator||fresh.bootstrap;const s=this.getSettings(interaction.guildId);if(this.accessFor(interaction)?.hasGrant)return true;if(s.staff_role_ids.length===0)return !(this.accessFor(interaction)?.activeGrantCount);const roles=interaction.member?.roles?.cache;return s.staff_role_ids.some(id=>roles?.has(id));}
  isModerator(interaction){const fresh=this.accessFor(interaction);if(fresh)return fresh.isModerator;const s=this.getSettings(interaction.guildId),roles=interaction.member?.roles?.cache;return s.staff_role_ids.some(id=>roles?.has(id));}
  hasHousingToursRole(interaction){if(!interaction.guildId)return false;const s=this.getSettings(interaction.guildId),roles=interaction.member?.roles?.cache;return s.tour_role_ids.some(id=>roles?.has(id));}
  canRunSharedPublicTour(interaction){if(!interaction.guildId)return false;const s=this.getSettings(interaction.guildId);if(s.tour_role_ids.length===0)return true;return this.isModerator(interaction)||this.hasHousingToursRole(interaction);}
  canBypassHousingChannel(interaction){if(!interaction.guildId)return false;const s=this.getSettings(interaction.guildId);return this.isModerator(interaction);}
  canReviewPending(interaction){return this.canAdmin(interaction);}
  canManagePublicHouse(interaction,record){return record?.created_by===interaction.user?.id||this.isModerator(interaction);}
  canRegister(interaction){const s=this.getSettings(interaction.guildId);if(this.isModerator(interaction))return{allowed:true,status:'active'};if(s.registration_policy==='open')return{allowed:true,status:'active'};const trusted=this.hasTrustedSubmitterRole(interaction);if(s.registration_policy==='approval')return{allowed:true,status:trusted?'active':'pending'};return{allowed:trusted,status:'active'};}
}
