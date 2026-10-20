import { SavedHouseService } from './saved-house-service.js';
import { stripLeadingAt, normalizeAccount } from '../utils/eso.js';
import { withCatalogHouseName } from '../utils/query-results.js';
import { requireEsoServer } from '../utils/eso-server.js';
export class RegistrationService{
  constructor(db){this.db=db;this.saved=new SavedHouseService(db);}
  adapt(r){r=withCatalogHouseName(r);return r?{...r,scope:r.scope==='public'?'server':r.scope,discord_manager_id:null}:null;}
  async create({guildId,esoServer,houseId,esoOwner,displayName=null,description=null,tags=[],createdBy,status='active',scope='public'}){
    const server=requireEsoServer(esoServer);
    const r=scope==='global'?await this.saved.createGlobal({originGuildId:guildId,esoServer:server,houseId,esoOwner,displayName,description,tags,createdBy,status}):await this.saved.createPublic({guildId,esoServer:server,houseId,esoOwner,displayName,description,tags,createdBy,status});return this.adapt(r);
  }
  async get(id){return this.adapt(await this.saved.get(id));}
  async findCanonical(guildId,owner,houseId,esoServer){const server=requireEsoServer(esoServer);const rows=await this.db.query(`SELECT * FROM saved_houses WHERE eso_server=? AND scope='public' AND guild_id=? AND normalized_owner=? AND house_id=? AND status<>'archived' LIMIT 1`,[server,guildId,normalizeAccount(owner),Number(houseId)]);return rows[0]||null;}
  async search(guildId,{esoServer,search='',owner='',house='',zone='',houseType='',classification='',category='',style='',tag='',limit=100,scope='public'}={}){
    const server=requireEsoServer(esoServer);const clauses=['s.eso_server=?','s.scope=?',"s.status='active'"];const args=[server,scope];if(scope==='public'){clauses.push('s.guild_id=?');args.push(guildId);} owner=stripLeadingAt(owner);
    const add=(sql,v)=>{if(v){clauses.push(sql);args.push(`%${String(v).toLowerCase()}%`);}};
    if(search){const q=`%${stripLeadingAt(String(search)).toLowerCase()}%`;clauses.push(`(lower(coalesce(s.display_name,'')) LIKE ? OR lower(s.eso_owner) LIKE ? OR lower(h.name) LIKE ? OR lower(coalesce(s.description,'')) LIKE ? OR lower(coalesce(s.tags,'')) LIKE ?)`);args.push(q,q,q,q,q);}
    add('lower(s.eso_owner) LIKE ?',owner);add('lower(h.name) LIKE ?',house);add("lower(coalesce(h.zone,'')) LIKE ?",zone);add("lower(coalesce(h.house_type,'')) LIKE ?",houseType);add("lower(coalesce(h.classification,h.category,'')) LIKE ?",classification||category);add("lower(coalesce(h.style,'')) LIKE ?",style);add("lower(coalesce(s.tags,'')) LIKE ?",tag);
    const rows=await this.db.query(`SELECT s.*,h.name catalog_house_name,h.zone,h.subzone,h.category,h.classification,h.house_type,h.style,h.furnishing_limit,h.furnishing_limit_plus,h.special_furnishing_limit,h.special_furnishing_limit_plus,h.collectible_limit,h.collectible_limit_plus,h.special_collectible_limit,h.special_collectible_limit_plus,h.population_limit,h.population_limit_plus,h.purchase_type,h.gold_price,h.crown_price,h.crown_price_unfurnished,h.crown_price_furnished,h.requirements,h.availability,h.uesp_url,h.last_verified FROM saved_houses s JOIN houses h ON h.house_id=s.house_id WHERE ${clauses.join(' AND ')} ORDER BY coalesce(s.display_name,h.name),s.eso_owner LIMIT ?`,[...args,Number(limit)]);return rows.map(r=>this.adapt(r));
  }
  list(guildId,query='',esoServer){return this.search(guildId,{esoServer,search:query,limit:50});}
  async searchPending(guildId,{esoServer,search='',limit=100,offset=0}={}){const server=requireEsoServer(esoServer);const clauses=['s.eso_server=?',"((s.scope='public' AND s.guild_id=?) OR (s.scope='global' AND s.origin_guild_id=?))","s.status='pending'"];const args=[server,guildId,guildId];if(search){const q=`%${stripLeadingAt(String(search)).toLowerCase()}%`;clauses.push(`(lower(coalesce(s.display_name,'')) LIKE ? OR lower(s.eso_owner) LIKE ? OR lower(h.name) LIKE ? OR lower(coalesce(s.description,'')) LIKE ? OR lower(coalesce(s.tags,'')) LIKE ?)`);args.push(q,q,q,q,q);}const rows=await this.db.query(`SELECT s.*,h.name catalog_house_name,h.zone,h.subzone,h.classification,h.house_type,h.style FROM saved_houses s JOIN houses h ON h.house_id=s.house_id WHERE ${clauses.join(' AND ')} ORDER BY coalesce(s.display_name,h.name),s.eso_owner,s.id LIMIT ? OFFSET ?`,[...args,Number(limit),Math.max(0,Number(offset)||0)]);return rows.map(r=>this.adapt(r));}
  async approve(id,actorId){const current=await this.get(id);if(!current||current.status!=='pending')throw new Error('Pending registration not found.');return this.adapt(await this.saved.setStatus(id,'active',actorId));}
  async deny(id,actorId){const current=await this.get(id);if(!current||current.status!=='pending')throw new Error('Pending registration not found.');return this.adapt(await this.saved.setStatus(id,'archived',actorId));}
  update(id,fields,actorId){return this.updateFull(id,fields,actorId);}
  async updateFull(id,fields,actorId){return this.adapt(await this.saved.update(id,fields,actorId));}
  archive(id,actorId){return this.saved.delete(id,actorId);}
}
