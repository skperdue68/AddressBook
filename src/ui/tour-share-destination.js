import { ChannelType, PermissionFlagsBits as P } from 'discord.js';
import { buttonRows } from './housing-ui.js';
import { tourShareChannelPayload, tourShareThreadPayload, tourShareDestinationPayload, tourShareLinkModal, tourShareCardPayload, houseShareCardPayload } from './share-pass-ui.js';

const parentTypes=new Set([ChannelType.GuildText,ChannelType.GuildAnnouncement,ChannelType.GuildForum,ChannelType.GuildMedia,ChannelType.GuildVoice,ChannelType.GuildStageVoice]);
const directTypes=new Set([ChannelType.GuildText,ChannelType.GuildAnnouncement,ChannelType.GuildVoice,ChannelType.GuildStageVoice]);
const has=(channel,member,permissions)=>!!member&&!!channel.permissionsFor?.(member)?.has(permissions);
export function isTourShareDestination(id){return /^hu:pass:(tour|house):(share|channel|threads|thread|confirm|post|link):/.test(id)||/^hu:modal:(tour|house)destination:/.test(id);}
export function parseTourDestination(value,guildId){
  const text=String(value||'').trim();
  const link=text.match(/^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)(?:\/\d+)?\/?(?:\?[^\s]*)?$/i);
  if(link){if(link[1]!==String(guildId))throw new Error('Choose a destination in this Discord server.');return link[2];}
  const id=text.match(/^(?:<#(\d+)>|(\d+))$/);
  if(!id)throw new Error('Paste a Discord channel / thread link, channel mention, or channel ID.');
  return id[1]||id[2];
}
async function members(i){
  if(!i.guild)throw new Error('Open HearthBound in a Discord server.');
  const [user,bot]=await Promise.all([i.guild.members.fetch({user:i.user.id,force:true}),i.guild.members.fetchMe({force:true})]);
  return {user,bot};
}
function visible(channel,i,actors){return channel?.guildId===i.guildId&&has(channel,actors.user,[P.ViewChannel])&&has(channel,actors.bot,[P.ViewChannel]);}
async function privateAccess(channel,member){
  if(channel.type!==ChannelType.PrivateThread||has(channel,member,[P.ManageThreads]))return true;
  try{return !!await channel.members.fetch({member:member.id,force:true});}catch{return false;}
}
export async function validateTourDestination(channel,i,actors){
  if(!visible(channel,i,actors))throw new Error('You and HearthBound both need View Channel access to that destination.');
  const thread=!!channel.isThread?.();
  if(!thread&&!directTypes.has(channel.type))throw new Error('Select an existing thread / post within this forum or media channel.');
  if(typeof channel.send!=='function')throw new Error('That destination cannot receive messages.');
  if(thread&&channel.locked)throw new Error('That thread is locked. Choose an unlocked thread.');
  const send=thread?P.SendMessagesInThreads:P.SendMessages;
  if(!has(channel,actors.user,[P.ViewChannel,send]))throw new Error(`You need ${thread?'Send Messages in Threads':'Send Messages'} permission in that destination.`);
  if(!has(channel,actors.bot,[P.ViewChannel,send,P.EmbedLinks,P.ReadMessageHistory]))throw new Error(`HearthBound needs View Channel, ${thread?'Send Messages in Threads':'Send Messages'}, Embed Links, and Read Message History in that destination.`);
  if(thread&&(!await privateAccess(channel,actors.user)||!await privateAccess(channel,actors.bot)))throw new Error('Both you and HearthBound must have access to this private thread. Invite HearthBound to it first.');
  return channel;
}
async function fetchDestination(i,id){
  const channel=await i.guild.channels.fetch(id,{force:true});
  if(!channel||channel.guildId!==i.guildId)throw new Error('That destination is unavailable in this server.');
  return channel;
}
const sortChannels=rows=>rows.sort((a,b)=>(a.parent?.position??a.position??0)-(b.parent?.position??b.position??0)||(a.position??0)-(b.position??0)||String(a.name).localeCompare(String(b.name))||String(a.id).localeCompare(String(b.id)));

export async function handleTourShareDestination(i,{sharePasses,tours,guilds,loadHouse}){
  const modal=i.customId.startsWith('hu:modal:');
  const kind=modal?(i.customId.includes(':housedestination:')?'house':'tour'):i.customId.split(':')[2];
  const title=kind==='house'?'House Share Pass':'Tour Pass',back=kind==='house'?'hu:home':'hu:tours';
  const parts=i.customId.split(':'),action=modal?'resolve':parts[3],tourId=Number(parts[modal?3:4]);
  if(action==='link')return i.showModal(tourShareLinkModal(tourId,kind));
  // Acknowledge before channel/member requests or database work.
  await i.deferUpdate();
  try{
    const actors=await members(i);
    if(action==='share'){
      const fetched=await i.guild.channels.fetch();
      const channels=sortChannels([...fetched.values()].filter(c=>c&&parentTypes.has(c.type)&&visible(c,i,actors)));
      return i.editReply(tourShareChannelPayload(tourId,{channels,page:parts[5],kind}));
    }
    const resolved=action==='resolve'?await fetchDestination(i,parseTourDestination(i.fields.getTextInputValue('destination'),i.guildId)):null;
    if(action==='channel'||action==='threads'||(resolved&&parentTypes.has(resolved.type))){
      const channel=resolved||await fetchDestination(i,action==='channel'?i.values?.[0]:parts[5]);
      if(!visible(channel,i,actors)||!parentTypes.has(channel.type))throw new Error('Choose an accessible server channel.');
      let canPost=false,warning='';
      try{await validateTourDestination(channel,i,actors);canPost=true;}catch(error){if(directTypes.has(channel.type))warning=error.message;}
      let threads=[];
      if(channel.threads){
        try{
          const active=await channel.threads.fetchActive();
          for(const thread of active.threads.values()){
            if(thread.parentId!==channel.id||thread.archived)continue;
            try{await validateTourDestination(thread,i,actors);threads.push(thread);}catch{}
          }
          threads=sortChannels(threads);
        }catch{warning=[warning,'Could not load active threads. Try again or use a thread link.'].filter(Boolean).join(' ');}
      }
      return i.editReply(tourShareThreadPayload(tourId,channel,{threads,page:action==='threads'?parts[6]:0,canPost,warning,kind}));
    }
    const channelId=action==='thread'?String(i.values?.[0]||''):parts[5];
    const channel=resolved||await fetchDestination(i,channelId);
    if(action==='thread'&&(!channel.isThread?.()||channel.parentId!==parts[5]))throw new Error('Choose a thread within the selected channel.');
    if(!visible(channel,i,actors))throw new Error('You and HearthBound both need View Channel access to that destination.');
    await validateTourDestination(channel,i,actors);
    if(action!=='post')return i.editReply(tourShareDestinationPayload(tourId,channel,kind));
    // Load the current record before issuing a token; the service rechecks sharing access.
    const record=kind==='tour'?await tours.get(tourId):await loadHouse(i,tourId);
    const stops=kind==='tour'?await tours.getStops(tourId):[];
    const create=kind==='tour'?'createTourPass':'createHousePass';
    const revoke=kind==='tour'?'revokeTourPass':'revokeHousePass';
    const mark=kind==='tour'?'markTourPassPosted':'markHousePassPosted';
    const created=await sharePasses[create]({[kind==='tour'?'tourId':'savedHouseId']:tourId,createdBy:i.user.id,originGuildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),channelId:channel.id,names:{createdByGlobalName:i.user.globalName||i.user.username,createdByDisplayName:actors.user.displayName,originGuildName:i.guild.name,channelName:channel.name}});
    let message;
    try{
      const options={token:created.token,sharerName:actors.user.displayName||i.user.username,stopCount:stops.length};
      message=await channel.send(kind==='tour'?tourShareCardPayload(record,options):houseShareCardPayload(record,options));
    }catch(error){await sharePasses[revoke](created.pass.id,{actorId:i.user.id,reason:'Discord posting failed'}).catch(()=>{});throw error;}
    const components=buttonRows([{customId:back,label:kind==='tour'?'Back to Tours':'Back to HearthBound',style:'secondary'}]);
    try{await sharePasses[mark](created.pass.id,{guildId:i.guildId,channelId:channel.id,messageId:message.id,channelName:channel.name});}
    catch{return i.editReply({content:`${title} posted in <#${channel.id}>, but its message details could not be saved. Please do not repost it. You can still revoke the pass in Administration.`,embeds:[],components});}
    return i.editReply({content:`${title} posted in <#${channel.id}>. ${kind==='tour'?'Each visitor starts an independent private self-paced tour.':'It remains active until you revoke it.'}`,embeds:[],components});
  }catch(error){return i.editReply({content:`Could not complete that ${title} action: ${error.message}`,embeds:[],components:buttonRows([{customId:`hu:pass:${kind}:share:${tourId}`,label:'Back to Channels',style:'secondary'},{customId:back,label:'Cancel',style:'secondary'}])});}
}
