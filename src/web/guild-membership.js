// Web sessions must not inherit Discord.js's cached guild membership or roles.
export async function resolveCurrentGuildMembership({client,guilds,userId,guildId}){
 const guild=client.guilds.cache.get(String(guildId));if(!guild)return null;
 try{
  const member=await guild.members.fetch({user:String(userId),force:true});if(!member)return null;
  guilds.invalidate?.(guild.id);
  const settings=await guilds.ensureSettings(guild.id);
  return {id:guild.id,name:guild.name,roleIds:[...member.roles.cache.keys()],esoServer:settings.eso_server};
 }catch{return null;}
}
