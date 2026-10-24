import { normalizeEsoOwner, normalizeAccount, parseTags } from '../utils/eso.js';
import { one, withTransaction } from '../db/database.js';
import { DestinationService } from './destination-service.js';
import { withCatalogHouseName, withCatalogHouseNames } from '../utils/query-results.js';
import { esoServerLabel, requireEsoServer } from '../utils/eso-server.js';
import { boundedOptional, HOUSE_DESCRIPTION_MAX, HOUSE_NICKNAME_MAX } from '../utils/text-limits.js';

const META=`h.name catalog_house_name,h.zone,h.subzone,h.category,h.classification,h.house_type,h.style,
 h.furnishing_limit,h.furnishing_limit_plus,h.special_furnishing_limit,h.special_furnishing_limit_plus,
 h.collectible_limit,h.collectible_limit_plus,h.special_collectible_limit,h.special_collectible_limit_plus,
 h.population_limit,h.population_limit_plus,h.purchase_type,h.gold_price,h.crown_price,h.crown_price_unfurnished,
 h.crown_price_furnished,h.requirements,h.availability,h.uesp_url,h.last_verified`;

export function tourAllowsHouseScope(tour,scope){
  if(tour.visibility==='global') return scope==='global';
  if(tour.visibility==='public') return scope==='public'||scope==='global';
  return ['private','public','global'].includes(scope);
}

export class SavedHouseService{
  constructor(db){ this.db=db; this.destinations=new DestinationService(db); }
  async get(id,conn=this.db){ return withCatalogHouseName(await one(conn,`SELECT s.*,${META} FROM saved_houses s JOIN houses h ON h.house_id=s.house_id WHERE s.id=?`,[Number(id)])); }
  async getVisible(id,{userId,guildId,esoServer},conn=this.db){
    const server=requireEsoServer(esoServer);
    return withCatalogHouseName(await one(conn,`SELECT s.*,${META} FROM saved_houses s JOIN houses h ON h.house_id=s.house_id
      WHERE s.id=? AND s.eso_server=? AND s.status='active' AND ((s.scope='private' AND s.owner_user_id=?) OR (s.scope='public' AND s.guild_id=?) OR s.scope='global')`,[Number(id),server,String(userId||''),String(guildId||'')]));
  }
  async findByDestinationContext({destinationId,visibility,userId,guildId},conn=this.db){
    const scope=visibility==='server'?'public':visibility;
    if(!['global','public','private'].includes(scope))throw new Error('Invalid house visibility.');
    const clauses=['destination_id=?','scope=?',"status<>'archived'"]; const args=[Number(destinationId),scope];
    if(scope==='private'){clauses.push('owner_user_id=?');args.push(String(userId));}
    if(scope==='public'){clauses.push('guild_id=?');args.push(String(guildId));}
    return withCatalogHouseName(await one(conn,`SELECT s.*,${META} FROM saved_houses s JOIN houses h ON h.house_id=s.house_id WHERE ${clauses.join(' AND ')} ORDER BY s.id LIMIT 1`,args));
  }
  async createInConnection(conn,{destinationId,visibility,userId,guildId,esoServer,nickname=null,description=null,tags=[],status='active',createdBy}){
    const server=requireEsoServer(esoServer);
    const scope=visibility==='server'?'public':visibility;
    if(!['global','public','private'].includes(scope))throw new Error('Invalid house visibility.');
    if(scope==='public'&&!guildId)throw new Error('Server houses require a Discord server.');
    const destination=await one(conn,'SELECT * FROM housing_destinations WHERE id=? FOR UPDATE',[Number(destinationId)]);
    if(!destination)throw new Error('The ESO destination is no longer available.');
    if(destination.eso_server!==server)throw new Error('The ESO destination belongs to a different environment.');
    const existing=await this.findByDestinationContext({destinationId,visibility:scope,userId,guildId},conn);
    if(existing)return existing;
    const cleanName=boundedOptional(nickname,HOUSE_NICKNAME_MAX,'House nickname'),cleanDescription=boundedOptional(description,HOUSE_DESCRIPTION_MAX,'House description');
    const result=await conn.query(`INSERT INTO saved_houses(eso_server,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,destination_id,display_name,description,tags,status,created_by,updated_by)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
      server,scope,scope==='public'?String(guildId):null,guildId?String(guildId):null,
      scope==='private'?String(userId):null,Number(destination.house_id),destination.eso_owner,destination.normalized_owner,Number(destination.id),
      cleanName,cleanDescription,JSON.stringify(parseTags(tags)),status,String(createdBy),String(createdBy)
    ]);
    return this.get(result.insertId,conn);
  }
  async #ensureNoDuplicate({esoServer,scope,guildId=null,ownerUserId=null,houseId,esoOwner,excludeId=null},conn=this.db){
    const server=requireEsoServer(esoServer);
    const norm=normalizeAccount(esoOwner);
    const clauses=['eso_server=?','scope=?','normalized_owner=?','house_id=?','status<>\'archived\'']; const args=[server,scope,norm,Number(houseId)];
    if(scope==='private'){clauses.push('owner_user_id=?');args.push(ownerUserId);} else if(scope==='public'){clauses.push('guild_id=?');args.push(guildId);}
    if(excludeId){clauses.push('id<>?');args.push(Number(excludeId));}
    const dupe=await one(conn,`SELECT id FROM saved_houses WHERE ${clauses.join(' AND ')} LIMIT 1`,args);
    if(dupe) throw new Error(`That owner + house already exists in this ${scope} scope as house #${dupe.id}.`);
  }
  async #create({esoServer,scope,guildId=null,originGuildId=null,ownerUserId=null,houseId,esoOwner,displayName=null,description=null,tags=[],createdBy,status='active'}){
    const server=requireEsoServer(esoServer);
    const owner=normalizeEsoOwner(esoOwner);
    const cleanName=boundedOptional(displayName,HOUSE_NICKNAME_MAX,'House nickname'),cleanDescription=boundedOptional(description,HOUSE_DESCRIPTION_MAX,'House description');
    return withTransaction(this.db,async conn=>{
      await this.#ensureNoDuplicate({esoServer:server,scope,guildId,ownerUserId,houseId,esoOwner:owner},conn);
      const destination=await this.destinations.resolve({esoServer:server,esoOwner:owner,houseId},conn);
      const result=await conn.query(`INSERT INTO saved_houses(eso_server,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,destination_id,display_name,description,tags,status,created_by,updated_by)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[server,scope,guildId,originGuildId,ownerUserId,Number(houseId),owner,normalizeAccount(owner),destination.id,cleanName,cleanDescription,JSON.stringify(parseTags(tags)),status,createdBy,createdBy]);
      return this.get(result.insertId,conn);
    });
  }
  createPrivate({userId,originGuildId=null,...data}){ return this.#create({...data,scope:'private',ownerUserId:userId,guildId:null,originGuildId,createdBy:data.createdBy||userId,status:'active'}); }
  createPublic({guildId,...data}){ if(!guildId)throw new Error('Public houses require a Discord server.'); return this.#create({...data,scope:'public',guildId,originGuildId:guildId,ownerUserId:null}); }
  createGlobal({originGuildId=null,...data}){ return this.#create({...data,scope:'global',guildId:null,originGuildId,ownerUserId:null}); }
  async listPrivate(userId,{esoServer,status='active',limit=200}={}){ const server=requireEsoServer(esoServer);return withCatalogHouseNames(await this.db.query(`SELECT s.*,${META} FROM saved_houses s JOIN houses h ON h.house_id=s.house_id WHERE s.eso_server=? AND s.scope='private' AND s.owner_user_id=? AND s.status=? ORDER BY coalesce(s.display_name,h.name),s.id LIMIT ?`,[server,userId,status,Number(limit)])); }
  async listPublic(guildId,{esoServer,status='active',limit=200}={}){ const server=requireEsoServer(esoServer);return withCatalogHouseNames(await this.db.query(`SELECT s.*,${META} FROM saved_houses s JOIN houses h ON h.house_id=s.house_id WHERE s.eso_server=? AND s.scope='public' AND s.guild_id=? AND s.status=? ORDER BY coalesce(s.display_name,h.name),s.id LIMIT ?`,[server,guildId,status,Number(limit)])); }
  async listGlobal({esoServer,status='active',limit=200}={}){ const server=requireEsoServer(esoServer);return withCatalogHouseNames(await this.db.query(`SELECT s.*,${META} FROM saved_houses s JOIN houses h ON h.house_id=s.house_id WHERE s.eso_server=? AND s.scope='global' AND s.status=? ORDER BY coalesce(s.display_name,h.name),s.id LIMIT ?`,[server,status,Number(limit)])); }
  async update(id,fields,actorId){
    const current=await this.get(id); if(!current)throw new Error('Saved house not found.');
    const houseId=fields.houseId===undefined?current.house_id:Number(fields.houseId);
    const owner=fields.esoOwner===undefined?current.eso_owner:normalizeEsoOwner(fields.esoOwner);
    await this.#ensureNoDuplicate({esoServer:current.eso_server,scope:current.scope,guildId:current.guild_id,ownerUserId:current.owner_user_id,houseId,esoOwner:owner,excludeId:id});
    const name=fields.displayName===undefined?current.display_name:boundedOptional(fields.displayName,HOUSE_NICKNAME_MAX,'House nickname');
    const description=fields.description===undefined?current.description:boundedOptional(fields.description,HOUSE_DESCRIPTION_MAX,'House description');
    const tags=fields.tags===undefined?current.tags:JSON.stringify(parseTags(fields.tags));
    const destination=await this.destinations.resolve({esoServer:current.eso_server,esoOwner:owner,houseId});
    await this.db.query(`UPDATE saved_houses SET house_id=?,eso_owner=?,normalized_owner=?,destination_id=?,display_name=?,description=?,tags=?,updated_by=? WHERE id=?`,[houseId,owner,normalizeAccount(owner),destination.id,name||null,description||null,tags,actorId,Number(id)]);
    return this.get(id);
  }
  async setStatus(id,status,actorId){ await this.db.query('UPDATE saved_houses SET status=?,updated_by=? WHERE id=?',[status,actorId,Number(id)]); return this.get(id); }
  async delete(id,actorId=null,connection=null){
    const remove=async conn=>{
      const current=await this.get(id,conn); if(!current)return false;
      const linked=await conn.query('SELECT DISTINCT tour_id FROM tour_stops WHERE saved_house_id=?',[Number(id)]);
      const tourIds=linked.map(r=>Number(r.tour_id));
      const r=await conn.query('DELETE FROM saved_houses WHERE id=?',[Number(id)]);
      for(const tourId of tourIds){ const rows=await conn.query('SELECT id FROM tour_stops WHERE tour_id=? ORDER BY position,id',[tourId]); for(let n=0;n<rows.length;n++)await conn.query('UPDATE tour_stops SET position=? WHERE id=?',[n+1,rows[n].id]); }
      if(actorId)await conn.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,entity_name,details) VALUES(?,?,?,?,?,?,?)',[current.guild_id||current.origin_guild_id||null,String(actorId),'delete_house','saved_house',String(id),current.display_name||current.house_name||`Saved House #${id}`,JSON.stringify({scope:current.scope,affectedTourIds:tourIds})]);
      return Number(r.affectedRows||0)>0;
    };
    return connection?remove(connection):withTransaction(this.db,remove);
  }
  async previewScopeChange(id,newScope,{targetStatus='active',targetGuildId=null,targetOwnerUserId=null,connection=this.db}={}){
    if(!['private','public','global'].includes(newScope))throw new Error('Invalid house scope.');
    const current=await this.get(id,connection); if(!current)throw new Error('Saved house not found.');
    const rows=await connection.query(`SELECT t.id tour_id,t.name tour_name,t.visibility,t.house_source,t.guild_id,t.source_guild_id,t.creator_id,ts.id stop_id,ts.position
      FROM tour_stops ts JOIN tours t ON t.id=ts.tour_id WHERE ts.saved_house_id=? ORDER BY t.name,ts.position`,[Number(id)]);
    const guildId=targetGuildId||current.guild_id,ownerId=targetOwnerUserId||current.owner_user_id||current.created_by;
    const affected=rows.filter(r=>targetStatus!=='active'||!tourAllowsHouseScope(r,newScope)||(newScope==='public'&&(r.source_guild_id||r.guild_id)!==guildId)||(newScope==='private'&&r.creator_id!==ownerId));
    return {house:current,newScope,affectedTours:[...new Map(affected.map(r=>[Number(r.tour_id),{id:Number(r.tour_id),name:r.tour_name,visibility:r.visibility,houseSource:r.house_source}])).values()],affectedStops:affected};
  }
  async changeScope(id,newScope,{actorId,targetGuildId=null,targetEsoServer=null,targetOwnerUserId=null,status='active',validate=null}={}){
    return withTransaction(this.db,async conn=>{
      await one(conn,'SELECT id FROM saved_houses WHERE id=? FOR UPDATE',[Number(id)]);
      const preview=await this.previewScopeChange(id,newScope,{targetStatus:status,targetGuildId,targetOwnerUserId:targetOwnerUserId||actorId,connection:conn});
      const current=preview.house;
      if(validate)await validate(preview,conn);
      if(newScope==='public'||newScope==='global'){
        const target=requireEsoServer(targetEsoServer);
        if(target!==current.eso_server)throw new Error(`This destination belongs to ${esoServerLabel(current.eso_server)}, but this Discord server uses ${esoServerLabel(target)}.`);
      }
      const guildId=newScope==='public'?targetGuildId:null;
      const originGuildId=newScope==='global'?(targetGuildId||current.origin_guild_id||null):(newScope==='public'?targetGuildId:current.origin_guild_id||null);
      const ownerUserId=newScope==='private'?(targetOwnerUserId||actorId):null;
      if(newScope==='public'&&!guildId)throw new Error('Public scope requires a Discord server.');
      if(newScope==='private'&&!ownerUserId)throw new Error('Private scope requires an owning Discord user.');
      await this.#ensureNoDuplicate({esoServer:current.eso_server,scope:newScope,guildId,ownerUserId,houseId:current.house_id,esoOwner:current.eso_owner,excludeId:id},conn);
      await conn.query(`UPDATE saved_houses SET scope=?,guild_id=?,origin_guild_id=?,owner_user_id=?,status=?,updated_by=? WHERE id=?`,[newScope,guildId,originGuildId,ownerUserId,status,actorId,Number(id)]);
      const affectedIds=[...new Set(preview.affectedStops.map(s=>Number(s.tour_id)))];
      if(preview.affectedStops.length) await conn.query(`DELETE FROM tour_stops WHERE saved_house_id=? AND tour_id IN (${affectedIds.map(()=>'?').join(',')})`,[Number(id),...affectedIds]);
      for(const tourId of affectedIds){ const rows=await conn.query('SELECT id FROM tour_stops WHERE tour_id=? ORDER BY position,id',[tourId]); for(let n=0;n<rows.length;n++) await conn.query('UPDATE tour_stops SET position=? WHERE id=?',[n+1,rows[n].id]); }
      const updated=await this.get(id,conn);
      await conn.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)',[targetGuildId||current.guild_id||current.origin_guild_id||null,String(actorId),'change_house_scope','saved_house',String(id),JSON.stringify({from:current.scope,to:newScope,status,affectedTourIds:affectedIds,removedStops:preview.affectedStops.length})]);
      return {house:updated,affectedTours:preview.affectedTours,removedStops:preview.affectedStops.length};
    });
  }
}
