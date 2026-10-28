import {ChannelType,PermissionFlagsBits as P} from 'discord.js';
import {validateTourDestination,parseTourDestination} from '../ui/tour-share-destination.js';
import {houseShareCardPayload,tourShareCardPayload} from '../ui/share-pass-ui.js';

const types=new Set([ChannelType.GuildText,ChannelType.GuildAnnouncement,ChannelType.GuildForum,ChannelType.GuildMedia,ChannelType.GuildVoice,ChannelType.GuildStageVoice]);
export class DiscordWorkspace {
 constructor(client){this.client=client;this.pending=new Map();}
 async actors(c){const guild=this.client.guilds.cache.get(c.guildId);if(!guild)throw new Error('This Discord server is unavailable.');const [user,bot]=await Promise.all([guild.members.fetch({user:c.userId,force:true}),guild.members.fetchMe({force:true})]);return {guild,user,bot,i:{guild,guildId:guild.id,user:{id:c.userId}}};}
 visible(channel,c,actors){return channel?.guildId===c.guildId&&channel.permissionsFor(actors.user)?.has(P.ViewChannel)&&channel.permissionsFor(actors.bot)?.has(P.ViewChannel);}
 async checkChannel(c,channelId){const actors=await this.actors(c),channel=await actors.guild.channels.fetch(parseTourDestination(channelId,c.guildId),{force:true});if(!this.visible(channel,c,actors))throw new Error('Choose a channel visible to you and HearthBound.');return channel;}
 async roles(c){const {guild}=await this.actors(c);const roles=await guild.roles.fetch();return [...roles.values()].filter(Boolean).map(r=>({id:r.id,name:r.name})).sort((a,b)=>a.name.localeCompare(b.name));}
 async roleMembers(c,roleIds){
  if(!c.isServerAdmin&&!c.isOwner)throw new Error('Current Server administrator access is required.');
  const wanted=new Set(roleIds.map(String));if(!wanted.size)return {complete:true,members:[]};
  const {guild}=await this.actors(c),members=[];let after;
  try{
   for(;;){
    const page=await guild.members.list({limit:1000,after,cache:false});
    for(const m of page.values()){const ids=[...m.roles.cache.keys()].map(String);if(ids.some(id=>wanted.has(id)))members.push({id:String(m.id),displayName:m.displayName,username:m.user?.username,roleIds:ids});}
    if(page.size<1000)return {complete:true,members};
    const next=[...page.keys()].reduce((a,b)=>BigInt(a)>BigInt(b)?a:b);if(next===after)throw new Error('Member pagination did not advance.');after=next;
   }
  }catch{return {complete:false,members:[],notice:'Role-holder names require Discord Server Members Intent to be enabled for HearthBound. Individual grants and configured roles remain listed.'};}
 }
 async searchMembers(c,{guildId=c.guildId,query=''}={}){
  if(!c.isServerAdmin&&!c.isGlobalAdmin&&!c.isOwner)throw new Error('Administrative access is required.');
  if(guildId!==c.guildId&&!c.isGlobalAdmin&&!c.isOwner)throw new Error('Select your administrated server.');
  const guild=this.client.guilds.cache.get(guildId);if(!guild)throw new Error('This Discord server is unavailable.');
  await guild.members.fetch({user:c.userId,force:true});
  query=String(query).trim().slice(0,80);
  const members=query?await guild.members.search({query,limit:25,cache:false}):await guild.members.list({limit:25,cache:false});
  return [...members.values()].map(m=>({id:String(m.id),displayName:m.displayName||m.user?.globalName||m.user?.username||String(m.id),username:m.user?.username||''})).sort((a,b)=>a.displayName.localeCompare(b.displayName));
 }
 async destinations(c,parentId=null){
  const actors=await this.actors(c),channels=await actors.guild.channels.fetch();
  const parents=[...channels.values()].filter(h=>h&&types.has(h.type)&&this.visible(h,c,actors)).map(h=>({id:h.id,name:h.name})).sort((a,b)=>a.name.localeCompare(b.name));
  if(!parentId)return {parents,threads:[],canPost:false};
  const parent=await actors.guild.channels.fetch(parentId,{force:true});if(!this.visible(parent,c,actors)||!types.has(parent.type))throw new Error('Selected channel is unavailable.');
  let canPost=false;try{await validateTourDestination(parent,actors.i,actors);canPost=true;}catch{/* forums require a thread */}
  const threads=[];let warning='';if(parent.threads){try{const active=await parent.threads.fetchActive();for(const thread of active.threads.values()){if(thread.parentId!==parent.id||thread.archived)continue;try{await validateTourDestination(thread,actors.i,actors);threads.push({id:thread.id,name:thread.name});}catch{/* inaccessible */}}}catch{warning='Active threads could not be loaded. Retry, or use a channel/thread link.';}}
  return {parents,parent:{id:parent.id,name:parent.name},threads:threads.sort((a,b)=>a.name.localeCompare(b.name)),canPost,warning};
 }
 async target(c,channelId){const actors=await this.actors(c),channel=await actors.guild.channels.fetch(parseTourDestination(channelId,c.guildId),{force:true});await validateTourDestination(channel,actors.i,actors);return {channel,actors};}
 async post(c,{channelId,eventKey,kind,record,stops,passes}){
  if(!eventKey||String(eventKey).length>200)throw new Error('Posting form expired. Reopen the share screen.');
  const key=`${c.userId}:${c.guildId}:${eventKey}`;
  for(const [k,value] of this.pending)if(Date.now()-value.time>1800000)this.pending.delete(k);
  if(this.pending.has(key))throw new Error('This posting request was already submitted. Check the destination before sharing again.');
  const entry={time:Date.now()};this.pending.set(key,entry);
  const {channel,actors}=await this.target(c,channelId),tour=kind==='tour';
  const issued=await passes[tour?'createTourPass':'createHousePass']({[tour?'tourId':'savedHouseId']:record.id,createdBy:c.userId,originGuildId:c.guildId,esoServer:c.esoServer,channelId:channel.id,names:{createdByDisplayName:actors.user.displayName,originGuildName:actors.guild.name,channelName:channel.name}});
  let message;try{const options={token:issued.token,sharerName:actors.user.displayName||c.userId,stopCount:stops?.length||0};message=await channel.send({...(tour?tourShareCardPayload(record,options):houseShareCardPayload(record,options)),allowedMentions:{parse:[]}});}catch(error){await passes[tour?'revokeTourPass':'revokeHousePass'](issued.pass.id,{actorId:c.userId,reason:'Discord posting failed'}).catch(()=>{});throw error;}
  try{await passes[tour?'markTourPassPosted':'markHousePassPosted'](issued.pass.id,{guildId:c.guildId,channelId:channel.id,messageId:message.id,channelName:channel.name});}catch{return {posted:true,warning:'Posted, but message details could not be saved. Do not repost; the pass can still be revoked.'};}
  return {posted:true,url:`https://discord.com/channels/${c.guildId}/${channel.id}/${message.id}`};
 }
}
