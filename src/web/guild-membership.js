// Always resolve fresh membership; strict lookups distinguish absence from outages.
export async function resolveCurrentGuildMembership({client,guilds,userId,guildId,strict=false}){
 let guild=client.guilds.cache.get(String(guildId));
 if(!guild){if(strict)throw new Error('Discord server membership could not be verified. Try again later.');return null;}
 try{
  if(guild.fetch)guild=await guild.fetch();
  const member=await guild.members.fetch({user:String(userId),force:true});if(!member)return null;
  guilds.invalidate?.(guild.id);
  const settings=await guilds.ensureSettings(guild.id);
  return {id:guild.id,name:guild.name,roleIds:[...member.roles.cache.keys()],setupAuthority:String(guild.ownerId)===String(userId)||member.permissions?.has?.('ManageGuild')===true,esoServer:settings.eso_server,...(strict?{member:{id:String(member.id||userId),username:member.user?.username,globalName:member.user?.globalName,displayName:member.displayName,avatar:member.user?.avatar}}:{})};
 }catch(error){
  if(strict&&![10007,10013].includes(Number(error.code)))throw new Error('Discord server membership could not be verified. Try again later.');
  return null;
 }
}
