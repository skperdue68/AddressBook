import { one, withTransaction } from '../db/database.js';
import { AccessContextService } from './access-context-service.js';
import { SavedHouseService } from './saved-house-service.js';
import { esoServerLabel, requireEsoServer } from '../utils/eso-server.js';

const queues=new WeakMap();
const displayVisibility=value=>value==='public'?'Server':value[0].toUpperCase()+value.slice(1);
const parseTags=value=>{try{return Array.isArray(value)?value:JSON.parse(value||'[]');}catch{return[];}};
const assertMatchingEnvironment=(source,targetEsoServer)=>{
  const target=requireEsoServer(targetEsoServer);
  if(source?.eso_server!==target)throw new Error(`This destination belongs to ${esoServerLabel(source?.eso_server)}, but this Discord server uses ${esoServerLabel(target)}.`);
  return target;
};

async function serialized(db,key,work){
  let map=queues.get(db); if(!map){map=new Map();queues.set(db,map);}
  const previous=map.get(key)||Promise.resolve();
  let release; const current=new Promise(resolve=>{release=resolve;});
  const queued=previous.then(()=>current); map.set(key,queued);
  await previous;
  try{return await work();}finally{release();if(map.get(key)===queued)map.delete(key);}
}

export class HouseCopyService{
  constructor(db,{policy={registrationOutcome:async({visibility})=>({allowed:true,status:visibility==='private'?'active':'active'})}}={}){
    this.db=db;this.policy=policy;this.access=new AccessContextService(db);this.saved=new SavedHouseService(db);
  }

  async #outcome(visibility,userId,guildId){
    if(visibility==='private')return {allowed:true,status:'active'};
    const outcome=await this.policy.registrationOutcome({visibility,userId,guildId});
    return {allowed:!!outcome?.allowed,status:outcome?.status||null,reason:outcome?.reason||(!outcome?.allowed?`You do not have permission to create a ${displayVisibility(visibility)} entry.`:null)};
  }

  async preview({sourceSavedHouseId,userId,guildId,passId,targetEsoServer,conn=this.db}){
    const access=await this.access.forHouse({userId,guildId,esoServer:targetEsoServer,savedHouseId:sourceSavedHouseId,passId,conn});
    if(!access.environmentMatch)throw new Error(access.message);
    if(!access.passOnly||!access.canCopy)throw new Error('This shared Private house is no longer available to copy.');
    const source=await this.saved.get(sourceSavedHouseId,conn);
    assertMatchingEnvironment(source,targetEsoServer);
    const choices=[];
    for(const visibility of ['global','public','private']){
      const outcome=await this.#outcome(visibility,userId,guildId);
      choices.push({visibility,label:displayVisibility(visibility),enabled:outcome.allowed,status:outcome.status,reason:outcome.reason});
    }
    return {
      source,pass:access.pass,choices,
      destination:{id:source.destination_id,esoOwner:source.eso_owner,houseId:source.house_id,houseName:source.house_name},
      metadata:{nickname:source.display_name||'',description:source.description||'',tags:parseTags(source.tags)}
    };
  }

  async copy({sourceSavedHouseId,userId,guildId,passId,targetEsoServer,visibility,nickname,description,tags}){
    const scope=visibility==='server'?'public':visibility;
    const server=requireEsoServer(targetEsoServer);
    const key=`${server}:${Number(sourceSavedHouseId)}:${scope}:${scope==='private'?userId:scope==='public'?guildId:'global'}`;
    return serialized(this.db,key,async()=>{
      try{
        return await withTransaction(this.db,async conn=>{
          const access=await this.access.forHouse({userId,guildId,esoServer:server,savedHouseId:sourceSavedHouseId,passId,conn});
          if(!access.environmentMatch)throw new Error(access.message);
          if(!access.passOnly||!access.canCopy)throw new Error('This shared Private house is no longer available to copy.');
          const source=await this.saved.get(sourceSavedHouseId,conn);
          assertMatchingEnvironment(source,server);
          await conn.query('SELECT id FROM housing_destinations WHERE id=? FOR UPDATE',[source.destination_id]);
          const existing=await this.saved.findByDestinationContext({destinationId:source.destination_id,visibility:scope,userId,guildId},conn);
          if(existing)return {existing:true,house:existing};
          const outcome=await this.#outcome(scope,userId,guildId);
          if(!outcome.allowed)throw new Error(outcome.reason||`You do not have permission to create a ${displayVisibility(scope)} entry.`);
          const house=await this.saved.createInConnection(conn,{destinationId:source.destination_id,visibility:scope,userId,guildId,esoServer:server,nickname,description,tags,status:outcome.status||'active',createdBy:userId});
          const actor=await one(conn,'SELECT global_name,username FROM discord_users WHERE discord_user_id=?',[String(userId)]);
          const member=guildId?await one(conn,'SELECT display_name FROM discord_guild_members WHERE guild_id=? AND discord_user_id=?',[String(guildId),String(userId)]):null;
          const guild=guildId?await one(conn,'SELECT guild_name FROM discord_guilds WHERE guild_id=?',[String(guildId)]):null;
          const details={sourceSavedHouseId:Number(source.id),destinationId:Number(source.destination_id),passId:Number(passId),esoServer:server,requestedVisibility:scope,resultStatus:house.status};
          await conn.query(`INSERT INTO audit_log(guild_id,guild_name,actor_id,actor_global_name,actor_display_name,action,entity_type,entity_id,entity_name,details)
            VALUES(?,?,?,?,?,?,?,?,?,?)`,[guildId||null,guild?.guild_name||null,String(userId),actor?.global_name||actor?.username||null,member?.display_name||null,'house_copied','saved_house',String(house.id),house.display_name||house.house_name||null,JSON.stringify(details)]);
          return {existing:false,house};
        });
      }catch(error){
        if(/no longer available to copy|do not have permission/i.test(error.message))throw error;
        throw new Error(`Nothing was copied and the original house was unchanged. ${error.message}`,{cause:error});
      }
    });
  }

  async copyPrivateInConnection(conn,{sourceSavedHouseId,userId,targetEsoServer}){
    const source=await this.saved.get(sourceSavedHouseId,conn);
    if(!source)throw new Error('The source house is no longer available.');
    const server=assertMatchingEnvironment(source,targetEsoServer??source.eso_server);
    const existing=await this.saved.findByDestinationContext({destinationId:source.destination_id,visibility:'private',userId,guildId:null},conn);
    if(existing)return existing;
    return this.saved.createInConnection(conn,{destinationId:source.destination_id,visibility:'private',userId,guildId:null,esoServer:server,nickname:source.display_name,description:source.description,tags:parseTags(source.tags),status:'active',createdBy:userId});
  }
}
