import {houseCapacity} from './house-capacity.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { buildJumpScript, buildHousingLink, buildHousePreviewScript } from './eso.js';
import { destinationActionButtonSpecs, tourButtonSpecs } from './jump-ui.js';
import { destinationLabel } from './labels.js';
import { discordDescription, discordTitle } from './text-limits.js';

const n=v=>Number.isFinite(v)?v.toLocaleString('en-US'):null;
const parseTags=v=>{try{return Array.isArray(v)?v:JSON.parse(v||'[]')}catch{return []}};
export function titleWithPlayerCap(label,h={}){ const cap=houseCapacity(h); return cap!=null?`${label} • 👥 ${cap} Player${Number(cap)===1?'':'s'}`:label; }
const limitSummary=(base,plus)=>plus!=null?`${n(base)} • ${n(plus)} with ESO+`:n(base);
function priceSummary(h){ const parts=[]; if(h.gold_price!=null)parts.push(`${n(h.gold_price)} gold`); if(h.crown_price_unfurnished!=null)parts.push(`${n(h.crown_price_unfurnished)} crowns`); if(h.crown_price_furnished!=null)parts.push(`${n(h.crown_price_furnished)} furnished`); return parts.join(' • '); }
export function addHouseMetadata(e,h){
  if(h.zone)e.addFields({name:'Zone',value:h.zone,inline:true}); if(h.house_type)e.addFields({name:'House Type',value:h.house_type,inline:true}); if(h.classification||h.category)e.addFields({name:'House Classification',value:h.classification||h.category,inline:true}); if(h.style)e.addFields({name:'Style',value:h.style,inline:true});
  if(h.furnishing_limit!=null)e.addFields({name:'Traditional Furnishings',value:`${n(h.furnishing_limit)} • ${n(h.furnishing_limit_plus)} with ESO+`,inline:true});
  if(h.special_furnishing_limit!=null)e.addFields({name:'Special Furnishings',value:`${n(h.special_furnishing_limit)} • ${n(h.special_furnishing_limit_plus)} with ESO+`,inline:true});
  if(h.collectible_limit!=null)e.addFields({name:'Collectibles',value:`${n(h.collectible_limit)} • ${n(h.collectible_limit_plus)} with ESO+`,inline:true});
  if(h.special_collectible_limit!=null)e.addFields({name:'Special Collectibles',value:`${n(h.special_collectible_limit)} • ${n(h.special_collectible_limit_plus)} with ESO+`,inline:true});
  const price=priceSummary(h); if(price)e.addFields({name:'Cost',value:price});
  if(h.requirements)e.addFields({name:'Requirement / Acquisition',value:String(h.requirements).slice(0,1024)}); if(h.availability)e.addFields({name:'Availability',value:h.availability,inline:true}); return e;
}

function cleanPriceSummary(h){
  const parts=[];
  if(h.gold_price!=null)parts.push(`${Number(h.gold_price).toLocaleString('en-US')} gold`);
  if(h.crown_price_unfurnished!=null)parts.push(`${Number(h.crown_price_unfurnished).toLocaleString('en-US')} crowns`);
  if(h.crown_price_furnished!=null)parts.push(`${Number(h.crown_price_furnished).toLocaleString('en-US')} furnished`);
  return parts.join(' • ');
}
export function addCleanHouseMetadata(e,h,{showDetails=false}={}){
  if(h.zone)e.addFields({name:'📍 Zone',value:String(h.zone),inline:true});
  if(h.house_type)e.addFields({name:'🏠 House Type',value:String(h.house_type),inline:true});
  if(h.classification||h.category)e.addFields({name:'👑 House Classification',value:String(h.classification||h.category),inline:true});
  if(h.style)e.addFields({name:'🏛️ Style',value:String(h.style),inline:true});
  const price=cleanPriceSummary(h); if(price)e.addFields({name:'💰 Cost',value:price});
  if(h.requirements)e.addFields({name:'📜 Requirement / Acquisition',value:String(h.requirements).slice(0,1024)});
  if(showDetails){
    if(h.house_id!=null)e.addFields({name:'🆔 House ID',value:String(h.house_id),inline:true});
    if(h.subzone)e.addFields({name:'📌 Subzone / Location',value:String(h.subzone),inline:true});
    if(h.furnishing_limit!=null)e.addFields({name:'🪑 Traditional Furnishings*',value:limitSummary(h.furnishing_limit,h.furnishing_limit_plus),inline:true});
    if(h.special_furnishing_limit!=null)e.addFields({name:'✨ Special Furnishings*',value:limitSummary(h.special_furnishing_limit,h.special_furnishing_limit_plus),inline:true});
    if(h.collectible_limit!=null)e.addFields({name:'🏺 Collectibles*',value:limitSummary(h.collectible_limit,h.collectible_limit_plus),inline:true});
    if(h.special_collectible_limit!=null)e.addFields({name:'💎 Special Collectibles*',value:limitSummary(h.special_collectible_limit,h.special_collectible_limit_plus),inline:true});
    if(h.purchase_type)e.addFields({name:'🛒 Purchase Type',value:String(h.purchase_type),inline:true});
    if(h.availability)e.addFields({name:'📅 Availability',value:String(h.availability),inline:true});
    if(h.uesp_url)e.addFields({name:'🌐 UESP Source',value:`[View house on UESP](${String(h.uesp_url)})`});
    if(h.last_verified)e.addFields({name:'🕒 Last Verified',value:String(h.last_verified),inline:true});
    e.setFooter({text:'* Furnishing and collectible limits are doubled with ESO+.'});
  }
  return e;
}

export function houseEmbed(house){ return addHouseMetadata(new EmbedBuilder().setTitle(titleWithPlayerCap(house.name,house)).setDescription(`Official ESO House ID: **${house.house_id}**`),house); }
export function destinationButtons(r){ const styles={primary:ButtonStyle.Primary,secondary:ButtonStyle.Secondary,success:ButtonStyle.Success,danger:ButtonStyle.Danger}; return new ActionRowBuilder().addComponents(...destinationActionButtonSpecs(r).map(spec=>new ButtonBuilder().setCustomId(spec.customId).setLabel(spec.label).setStyle(styles[spec.style]))); }
export function destinationEmbed(r,comments=[]){
  const e=new EmbedBuilder().setTitle(titleWithPlayerCap(destinationLabel(r),r)).addFields({name:'Owner',value:r.eso_owner,inline:true},{name:'House',value:r.house_name,inline:true},{name:'Jump Script',value:`\`\`\`text\n${buildJumpScript(r.eso_owner,r.house_id)}\n\`\`\``},{name:'Housing Link',value:`\`\`\`text\n${buildHousingLink(r.eso_owner,r.house_id)}\n\`\`\``});
  addHouseMetadata(e,r); e.addFields({name:'Comment Count',value:String(Number(r.comment_count||0)),inline:true}); if(r.description)e.setDescription(r.description); const tags=parseTags(r.tags); if(tags.length)e.addFields({name:'Tags',value:tags.join(' • ').slice(0,1024)});
  if(comments.length)e.addFields({name:'Recent Comments',value:comments.map(c=>`**${c.author_name}** — <t:${Math.floor(new Date(c.created_at+'Z').getTime()/1000)}:f>\n${c.comment_text}`).join('\n\n').slice(0,1024)});
  return e;
}
export function tourEmbed(tour,stops,current=null,commentCount=0,showDetails=false,{shared=false,leaderId=null}={}){
  if(!current){
    return new EmbedBuilder().setTitle(discordTitle(tour.name,'Housing tour')).setDescription(discordDescription(tour.description,'Housing tour')).addFields({name:'Stops',value:stops.length?stops.map(s=>`${s.position}. **${destinationLabel(s)}** — @${String(s.eso_owner||'').replace(/^@/,'')}${s.notes?` — ${s.notes}`:''}`).join('\n').slice(0,1024):'No stops yet.'});
  }
  const stop=stops[current-1];
  const tourDescription=String(tour.description||'No tour description provided.').slice(0,900);
  const houseDescription=String(stop.registration_description||'Saved ESO housing destination.').slice(0,900);
  const e=new EmbedBuilder()
    .setTitle(discordTitle(titleWithPlayerCap(`Stop ${current} of ${stops.length} — ${destinationLabel(stop)}`,stop)))
    .setDescription(discordDescription(`${shared?`**● LIVE SHARED TOUR${leaderId?` • <@${leaderId}> IS LEADING`:''}**\nEveryone in this channel can follow along. Only the leader can change stops or end the tour.\n\n`:''}**Tour Description:** ${tourDescription}\n\n${houseDescription}`));
  e.addFields({name:'👤 Owner',value:`@${String(stop.eso_owner||'').replace(/^@/,'')}`,inline:true});
  addCleanHouseMetadata(e,stop,{showDetails});
  const tags=parseTags(stop.registration_tags);
  if(tags.length)e.addFields({name:'🏷️ Tags',value:tags.map(t=>`\`${t}\``).join(' ').slice(0,1024)});
  e.addFields({name:'💬 Comments',value:`${Number(commentCount||0)} comment${Number(commentCount||0)===1?'':'s'}`,inline:true});
  if(stop.notes)e.addFields({name:'📌 TOUR STOP NOTES',value:`**${String(stop.notes).slice(0,1000)}**`,inline:false});
  e.addFields(
    {name:'🔗 Jump in ESO',value:`\`\`\`text\n${buildJumpScript(stop.eso_owner,stop.house_id)}\n\`\`\``},
    {name:'🏚️ Unfurnished Preview',value:`\`\`\`text\n${buildHousePreviewScript(stop.house_id)}\n\`\`\``},
    {name:'🔗 Housing Link',value:`\`\`\`text\n${buildHousingLink(stop.eso_owner,stop.house_id)}\n\`\`\``}
  );
  return e;
}
export function tourButtons(tourId,commentCount=0,showDetails=false,options={}){
  const styles={primary:ButtonStyle.Primary,secondary:ButtonStyle.Secondary,success:ButtonStyle.Success,danger:ButtonStyle.Danger};
  const specs=tourButtonSpecs(tourId,commentCount,showDetails,options);
  const make=spec=>{const control=new ButtonBuilder().setCustomId(spec.customId).setLabel(spec.label).setStyle(styles[spec.style]);if(spec.emoji)control.setEmoji(spec.emoji);return control;};
  return [
    new ActionRowBuilder().addComponents(...specs.slice(0,2).map(make)),
    new ActionRowBuilder().addComponents(...specs.slice(2,4).map(make)),
    new ActionRowBuilder().addComponents(...specs.slice(4).map(make))
  ].filter(r=>r.components.length);
}
