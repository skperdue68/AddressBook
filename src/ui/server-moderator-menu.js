import {MessageFlags} from 'discord.js';
import {moderatorAccessPayload,serverAccessPayload,serverRequestModal,serverRequestsPayload,serverGrantsPayload} from './moderator-access-ui.js';
export const isServerModeratorAction=id=>id==='hu:help:moderators'||id==='hu:servermod'||id.startsWith('hu:servermod:')||id==='hu:modal:servermod:request';
export async function handleServerModeratorAction(i,{serverModerators,guilds,actionId}){
 const id=actionId||i.customId;
 const respond=p=>id.startsWith('hu:modal:')?i.reply({...p,flags:MessageFlags.Ephemeral}):i.update(p);
 try{
  if(id==='hu:help:moderators')return respond(moderatorAccessPayload());
  if(!i.guildId)throw new Error('Server Moderator access is available inside a Discord server.');
  // Fetch current membership for privileged reviews when Discord is available.
  let member=i.member;
  if(i.guild?.members?.fetch){member=await i.guild.members.fetch({user:i.user.id,force:true});if(!member)throw new Error('Current server membership is required.');}
  const roleIds=[...(member?.roles?.cache?.keys?.()||[])],reviewer={userId:i.user.id,roleIds};
  const access=await serverModerators.access({guildId:i.guildId,...reviewer});
  if(id==='hu:servermod:request')return i.showModal(serverRequestModal());
  if(id==='hu:modal:servermod:request'){
   if(access.isModerator)throw new Error('You already have Server Moderator access.');
   await serverModerators.request({guildId:i.guildId,userId:i.user.id,reason:i.fields.getTextInputValue('reason'),names:{globalName:i.user.globalName||i.user.username,displayName:i.member?.displayName,guildName:i.guild?.name}});
  }else if(id.startsWith('hu:servermod:approve:')||id.startsWith('hu:servermod:deny:')){
   const parts=id.split(':');await serverModerators.review({guildId:i.guildId,requestId:Number(parts[3]),revision:Number(parts[4]),reviewer,decision:parts[2]});
   return respond(serverRequestsPayload(await serverModerators.listRequests({guildId:i.guildId})));
  }else if(id.startsWith('hu:servermod:revoke:')){
   await serverModerators.revoke({guildId:i.guildId,userId:id.split(':')[3],reviewer});return respond(serverGrantsPayload(await serverModerators.listGrants({guildId:i.guildId})));
  }else if(id.startsWith('hu:servermod:requests')||id.startsWith('hu:servermod:grants')){
   if(!access.canReviewRequests)throw new Error('Current AddressBook Server Moderator access is required.');
   const grants=id.startsWith('hu:servermod:grants');return respond((grants?serverGrantsPayload:serverRequestsPayload)(await serverModerators[grants?'listGrants':'listRequests']({guildId:i.guildId}),Number(id.split(':')[3])||1));
  }
  const status=await serverModerators.status({guildId:i.guildId,userId:i.user.id});
  const settings=await guilds.ensureSettings(i.guildId);
  return respond(serverAccessPayload({access,request:status.request,hasReviewers:settings.staff_role_ids.length>0||access.activeGrantCount>0}));
 }catch(err){return i.reply({content:err.message,flags:MessageFlags.Ephemeral});}
}
