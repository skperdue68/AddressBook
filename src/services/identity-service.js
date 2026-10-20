import { one, withTransaction } from '../db/database.js';

const clean=value=>{
  const text=String(value??'').trim();
  return text||null;
};
const jsonIds=value=>{try{return Array.isArray(value)?value:JSON.parse(value||'[]');}catch{return[];}};
const collectionValues=cache=>{
  if(!cache)return[];
  if(typeof cache.values==='function')return [...cache.values()];
  return Array.isArray(cache)?cache:[];
};

async function upsert(conn,table,key,values){
  const entries=Object.entries(values).filter(([,value])=>value!==null&&value!==undefined);
  if(!entries.length)return;
  const where=Object.keys(key).map(column=>`${column}=?`).join(' AND '),keyValues=Object.values(key);
  const current=await one(conn,`SELECT * FROM ${table} WHERE ${where}`,keyValues);
  if(current){
    const changed=entries.filter(([column,value])=>String(current[column]??'')!==String(value));
    const touch=changed.length?changed:[];
    await conn.query(`UPDATE ${table} SET ${[...touch.map(([column])=>`${column}=?`),'last_seen_at=CURRENT_TIMESTAMP'].join(',')} WHERE ${where}`,[...touch.map(([,value])=>value),...keyValues]);
    return;
  }
  const all=[...Object.entries(key),...entries],columns=all.map(([column])=>column);
  await conn.query(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`,all.map(([,value])=>value));
}

function changedValues(row,values){
  return Object.fromEntries(Object.entries(values).filter(([column,value])=>value!==undefined&&String(row[column]??'')!==String(value??'')));
}

async function patchRow(conn,table,keyColumn,row,values){
  const changes=changedValues(row,values),entries=Object.entries(changes);
  if(!entries.length)return;
  await conn.query(`UPDATE ${table} SET ${entries.map(([column])=>`${column}=?`).join(',')} WHERE ${keyColumn}=?`,[...entries.map(([,value])=>value),row[keyColumn]]);
}

async function patchRowByKey(conn,table,key,row,values){
  const changes=changedValues(row,values),entries=Object.entries(changes);if(!entries.length)return;
  const where=Object.keys(key).map(column=>`${column}=?`).join(' AND ');
  await conn.query(`UPDATE ${table} SET ${entries.map(([column])=>`${column}=?`).join(',')} WHERE ${where}`,[...entries.map(([,value])=>value),...Object.values(key)]);
}

export class IdentityService{
  constructor(db){this.db=db;}

  async syncInteraction(interaction){
    const guildId=clean(interaction.guildId||interaction.guild?.id);
    const userId=clean(interaction.user?.id);
    const channelId=clean(interaction.channelId||interaction.channel?.id);
    const guildName=clean(interaction.guild?.name);
    const username=clean(interaction.user?.username);
    const globalName=clean(interaction.user?.globalName||interaction.user?.displayName)||username;
    const displayName=clean(interaction.member?.displayName||interaction.member?.nickname);
    const channelName=clean(interaction.channel?.name);
    const roles=[...collectionValues(interaction.guild?.roles?.cache),...collectionValues(interaction.roles),...collectionValues(interaction.member?.roles?.cache)]
      .filter(role=>clean(role?.id)&&clean(role?.name)&&role.id!==guildId);
    const channels=[...collectionValues(interaction.guild?.channels?.cache),...collectionValues(interaction.channels)]
      .filter(channel=>clean(channel?.id)&&clean(channel?.name));
    await withTransaction(this.db,async conn=>{
      if(guildId&&guildName)await upsert(conn,'discord_guilds',{guild_id:guildId},{guild_name:guildName});
      if(userId&&(globalName||username))await upsert(conn,'discord_users',{discord_user_id:userId},{global_name:globalName,username});
      if(guildId&&userId&&displayName)await upsert(conn,'discord_guild_members',{guild_id:guildId,discord_user_id:userId},{display_name:displayName});
      if(channelId&&channelName)await upsert(conn,'discord_channels',{channel_id:channelId},{guild_id:guildId,channel_name:channelName});
      for(const channel of channels)await upsert(conn,'discord_channels',{channel_id:String(channel.id)},{guild_id:guildId,channel_name:String(channel.name)});
      for(const role of roles)await upsert(conn,'discord_roles',{role_id:String(role.id)},{guild_id:guildId,role_name:String(role.name)});
      if(userId&&(globalName||displayName)){
        const params=[globalName,displayName,userId];
        await conn.query('UPDATE user_house_states SET discord_global_name=coalesce(?,discord_global_name),discord_display_name=coalesce(?,discord_display_name) WHERE discord_user_id=?',params);
        await conn.query('UPDATE saved_house_searches SET discord_global_name=coalesce(?,discord_global_name),discord_display_name=coalesce(?,discord_display_name) WHERE discord_user_id=?',params);
      }
      await this.refreshCompanionNames(conn);
    });
  }

  async syncClient(client){
    for(const guild of collectionValues(client?.guilds?.cache))await this.syncInteraction({guildId:guild.id,guild});
  }

  async refreshInternalNames(){return withTransaction(this.db,conn=>this.refreshCompanionNames(conn));}

  async refreshCompanionNames(conn=this.db){
    const guilds=new Map((await conn.query('SELECT guild_id,guild_name FROM discord_guilds')).map(r=>[String(r.guild_id),r.guild_name]));
    const users=new Map((await conn.query('SELECT discord_user_id,global_name,username FROM discord_users')).map(r=>[String(r.discord_user_id),r.global_name||r.username]));
    const members=new Map((await conn.query('SELECT guild_id,discord_user_id,display_name FROM discord_guild_members')).map(r=>[`${r.guild_id}:${r.discord_user_id}`,r.display_name]));
    const channels=new Map((await conn.query('SELECT channel_id,channel_name FROM discord_channels')).map(r=>[String(r.channel_id),r.channel_name]));
    const roles=new Map((await conn.query('SELECT role_id,role_name FROM discord_roles')).map(r=>[String(r.role_id),r.role_name]));
    const memberName=(guildId,userId)=>guildId&&userId?members.get(`${guildId}:${userId}`):undefined;

    for(const row of await conn.query('SELECT * FROM guild_settings'))await patchRow(conn,'guild_settings','guild_id',row,{
      guild_name:guilds.get(String(row.guild_id)),bot_channel_name:channels.get(String(row.bot_channel_id)),
      staff_role_names:JSON.stringify(jsonIds(row.staff_role_ids).map(id=>roles.get(String(id))).filter(Boolean)),
      registration_role_names:JSON.stringify(jsonIds(row.registration_role_ids).map(id=>roles.get(String(id))).filter(Boolean)),
      tour_role_names:JSON.stringify(jsonIds(row.tour_role_ids).map(id=>roles.get(String(id))).filter(Boolean))
    });

    const catalog=new Map((await conn.query('SELECT house_id,name FROM houses')).map(r=>[Number(r.house_id),r.name]));
    const destinations=new Map((await conn.query('SELECT d.id,h.name house_name,d.eso_owner FROM housing_destinations d JOIN houses h ON h.house_id=d.house_id')).map(r=>[Number(r.id),r]));
    for(const row of await conn.query('SELECT * FROM user_house_states')){
      const target=row.target_kind==='destination'?destinations.get(Number(row.target_id)):{house_name:catalog.get(Number(row.target_id)),eso_owner:null};
      await patchRow(conn,'user_house_states','id',row,{discord_global_name:users.get(String(row.discord_user_id)),house_name:target?.house_name,eso_owner:target?.eso_owner});
    }
    for(const row of await conn.query('SELECT * FROM saved_house_searches'))await patchRow(conn,'saved_house_searches','id',row,{discord_global_name:users.get(String(row.discord_user_id))});
    const savedRows=await conn.query('SELECT * FROM saved_houses');
    const savedNames=new Map();
    for(const row of savedRows){
      const context=row.guild_id||row.origin_guild_id||null,officialHouseName=catalog.get(Number(row.house_id)),savedHouseName=row.display_name||officialHouseName;
      savedNames.set(Number(row.id),savedHouseName);
      await patchRow(conn,'saved_houses','id',row,{
        guild_name:guilds.get(String(row.guild_id)),origin_guild_name:guilds.get(String(row.origin_guild_id)),
        owner_global_name:users.get(String(row.owner_user_id)),owner_display_name:memberName(context,row.owner_user_id),house_name:officialHouseName,
        created_by_global_name:users.get(String(row.created_by)),created_by_display_name:memberName(context,row.created_by),
        updated_by_global_name:users.get(String(row.updated_by)),updated_by_display_name:memberName(context,row.updated_by)
      });
    }

    const tourRows=await conn.query('SELECT * FROM tours'),tourNames=new Map();
    for(const row of tourRows){
      tourNames.set(Number(row.id),row.name);const context=row.guild_id||row.origin_guild_id||row.source_guild_id||null;
      await patchRow(conn,'tours','id',row,{guild_name:guilds.get(String(row.guild_id)),origin_guild_name:guilds.get(String(row.origin_guild_id)),source_guild_name:guilds.get(String(row.source_guild_id)),creator_global_name:users.get(String(row.creator_id)),creator_display_name:memberName(context,row.creator_id)});
    }
    for(const row of await conn.query('SELECT * FROM house_comments')){
      const saved=savedRows.find(h=>Number(h.id)===Number(row.saved_house_id)),context=saved?.guild_id||saved?.origin_guild_id||null;
      await patchRow(conn,'house_comments','id',row,{saved_house_name:savedNames.get(Number(row.saved_house_id)),discord_global_name:users.get(String(row.discord_user_id)),discord_display_name:memberName(context,row.discord_user_id)});
    }
    for(const row of await conn.query('SELECT * FROM tour_stops'))await patchRow(conn,'tour_stops','id',row,{tour_name:tourNames.get(Number(row.tour_id)),saved_house_name:savedNames.get(Number(row.saved_house_id))});
    for(const row of await conn.query('SELECT * FROM tour_sessions'))await patchRow(conn,'tour_sessions','id',row,{tour_name:tourNames.get(Number(row.tour_id)),guild_name:guilds.get(String(row.guild_id)),channel_name:channels.get(String(row.channel_id)),started_by_global_name:users.get(String(row.started_by)),started_by_display_name:memberName(row.guild_id,row.started_by)});
    for(const row of await conn.query('SELECT * FROM global_moderators'))await patchRowByKey(conn,'global_moderators',{discord_user_id:row.discord_user_id,eso_server:row.eso_server},row,{discord_global_name:users.get(String(row.discord_user_id)),approved_by_global_name:users.get(String(row.approved_by))});
    for(const row of await conn.query('SELECT * FROM global_moderator_requests'))await patchRow(conn,'global_moderator_requests','id',row,{discord_global_name:users.get(String(row.discord_user_id)),discord_display_name:memberName(row.origin_guild_id,row.discord_user_id),origin_guild_name:guilds.get(String(row.origin_guild_id)),reviewed_by_global_name:users.get(String(row.reviewed_by)),reviewed_by_display_name:memberName(row.origin_guild_id,row.reviewed_by)});
    for(const row of await conn.query('SELECT * FROM audit_log')){
      let entityName;
      if(row.entity_type==='tour')entityName=tourNames.get(Number(row.entity_id));
      else if(row.entity_type==='saved_house')entityName=savedNames.get(Number(row.entity_id));
      else if(row.entity_type==='discord_user')entityName=users.get(String(row.entity_id));
      await patchRow(conn,'audit_log','id',row,{guild_name:guilds.get(String(row.guild_id)),actor_global_name:users.get(String(row.actor_id)),actor_display_name:memberName(row.guild_id,row.actor_id),entity_name:entityName});
    }
  }
}
