import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { tourEmbed } from '../utils/render.js';
import { buildHousingLink, buildJumpScript } from '../utils/eso.js';
import { destinationLabel } from '../utils/labels.js';
import { discordDescription, discordTitle } from '../utils/text-limits.js';

const button = (customId, label, style = ButtonStyle.Secondary, disabled = false, emoji = null) => { const control=new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style).setDisabled(disabled); if(emoji)control.setEmoji(emoji); return control; };
const row = buttons => new ActionRowBuilder().addComponents(...buttons.slice(0, 5));
const unix = value => Math.floor(new Date(value).getTime() / 1000);
const onPage = (customId, page) => Number(page) > 1 ? `${customId}:${Math.floor(Number(page))}` : customId;
const displayText = (value, fallback, max) => String(value || fallback).slice(0, max);

export function eventCardPayload({ id, title, description = null, tourName, hostName, startAt, timezone, environmentLabel, goingCount = 0, interestedCount = 0, status = 'scheduled', startedAt = null, canStart = false, canComplete = false, isLeader = false, canEdit = false, viewerRsvp = null, dmReminders = false, returnPage = 1 } = {}) {
  const state= status==='completed'?'Completed':status==='cancelled'?'Cancelled':startedAt?'In progress':'Scheduled';
  const details=description?`\n\n**Event details**\n${displayText(description,'',2000)}`:'';
  const embed = new EmbedBuilder().setColor(0x2b7ddd).setTitle(discordTitle(`📅 ${displayText(title,'Tour Event',200)} · ${state}`)).setDescription(discordDescription(`**Tour:** ${displayText(tourName,'Unknown',200)}\n**Host:** ${displayText(hostName,'Unknown',255)}\n**Environment:** ${displayText(environmentLabel,'Configured server',64)}\n**When:** <t:${unix(startAt)}:F> (<t:${unix(startAt)}:R>)\n**Timezone used:** ${displayText(timezone,'Configured guild timezone',64)}${details}\n\n**RSVP:** Going ${goingCount}  •  Interested ${interestedCount}`));
  const active=!['completed','cancelled'].includes(status);
  const actions = [button(onPage(`hu:event:rsvp:going:${id}`,returnPage), viewerRsvp === 'going' ? 'Going ✓' : 'Going', ButtonStyle.Success,!active), button(onPage(`hu:event:rsvp:interested:${id}`,returnPage), viewerRsvp === 'interested' ? 'Interested ✓' : 'Interested',ButtonStyle.Secondary,!active), button(onPage(`hu:event:reminder:${id}`,returnPage), dmReminders ? 'DM Reminders ✓' : 'DM Reminders',ButtonStyle.Secondary,!active)];
  if (canStart && !startedAt && status === 'scheduled') actions.push(button(onPage(`hu:event:start:${id}`,returnPage), isLeader ? 'Start Tour' : 'Start', ButtonStyle.Primary));
  if (active && canEdit) actions.push(button(onPage(`hu:event:edit:${id}`,returnPage), 'Edit Event'));
  if (active && canComplete) actions.push(button(onPage(`hu:event:complete:${id}`,returnPage), 'Complete Event', ButtonStyle.Success));
  if (active && isLeader) actions.push(button(onPage(`hu:event:cancel:${id}`,returnPage), 'Cancel Event', ButtonStyle.Danger));
  const baseActions=actions.slice(0,3), managementActions=actions.slice(3);
  managementActions.push(button(Number(returnPage)>1?`hu:events:page:${Math.floor(Number(returnPage))}`:'hu:tours:events', 'Back to Upcoming Events', ButtonStyle.Secondary, false, '↩️'));
  return { embeds: [embed], components: [row(baseActions), row(managementActions)] };
}

export function eventListPayload({ items = [], page = 1, hasNext = false } = {}) {
  const embed = new EmbedBuilder().setColor(0x2b7ddd).setTitle('📅 Upcoming Tour Events').setDescription(discordDescription(items.length
    ? items.map((event, index) => `**${index + 1}. ${displayText(event.title,'Tour Event',200)}** — ${displayText(event.tour_name,'Tour',200)}\n<t:${unix(event.start_at)}:F> · ${event.going_count || 0} going · ${event.interested_count || 0} interested`).join('\n\n')
    : 'There are no upcoming tour events for this ESO environment.'));
  const actions = items.slice(0, 5).map((event, index) => button(onPage(`hu:event:open:${event.id}`,page), `Open ${index + 1}`));
  return { embeds: [embed], components: [...(actions.length ? [row(actions)] : []), row([button(`hu:events:prev:${Math.max(1, Number(page) - 1)}`, 'Previous', ButtonStyle.Secondary, Number(page) <= 1), button(`hu:events:next:${Number(page) + 1}`, 'Next', ButtonStyle.Secondary, !hasNext), button('hu:tours', 'Back', ButtonStyle.Secondary, false, '↩️')])] };
}

export function eventStartPreflightPayload({event,tour,readiness,environmentLabel,returnPage=1}={}){
  const blocking=readiness?.blocking||[],advisories=readiness?.advisories||[],stops=Number(readiness?.stopCount||0);
  const state=blocking.length?'⛔ Blocked':advisories.length?'⚠️ Warning':'✅ Ready to start';
  const visibility=tour?.visibility==='global'?'Global':tour?.visibility==='public'?'Server':'Private';
  const description=[
    `**Event:** ${displayText(event?.title,'Tour Event',200)}`,
    `**Tour:** ${displayText(tour?.name,'Tour',200)}`,
    `**Preflight:** ${state}`,
    `**Tour visibility:** ${visibility}`,
    environmentLabel?`**ESO environment:** ${environmentLabel}`:null,
    `**Route:** ${stops} stop${stops===1?'':'s'}`,
    blocking.length?`**Problems that must be fixed**\n${blocking.map(issue=>`• ${displayText(issue.message,'Unknown problem',500)}`).join('\n')}`:null,
    advisories.length?`**Warnings**\n${advisories.map(issue=>`• ${displayText(issue.message,'Warning',500)}`).join('\n')}`:null,
    blocking.length?'Starting is unavailable until the blocking problems are corrected.':'Starting posts the Shared route in the event channel. Only the event host controls navigation.'
  ].filter(Boolean).join('\n\n');
  const actions=[];
  if(!blocking.length)actions.push(button(onPage(`hu:event:startconfirm:${event.id}`,returnPage),'Start Event Tour',ButtonStyle.Primary));
  actions.push(button(onPage(`hu:event:open:${event.id}`,returnPage),'Back to Event',ButtonStyle.Secondary,false,'↩️'));
  return {embeds:[new EmbedBuilder().setColor(blocking.length?0xd9534f:advisories.length?0xe6a817:0x2f9e44).setTitle('▶️ Tour Preflight').setDescription(discordDescription(description))],components:[row(actions)]};
}

export function featuredPayload({ items = [], canManage = false, selectedItem = null } = {}) {
  const embed = new EmbedBuilder().setColor(0x2b7ddd).setTitle('⭐ Featured Housing').setDescription(discordDescription(items.length ? items.map(item => `**${item.position}.** ${displayText(item.target_name,'Untitled',200)} — ${item.target_kind === 'tour' ? 'Tour' : 'House'}${item.expires_at ? ` · expires <t:${Math.floor(new Date(item.expires_at).getTime()/1000)}:R>` : ' · never expires'}`).join('\n') : 'No Featured housing has been selected yet.'));
  for(const item of items.filter(item=>item.target_kind==='house'&&item.house_id!=null&&item.eso_owner).slice(0,5)){
    const label=displayText(item.house_display_name||item.target_name,'Featured House',120),owner=displayText(String(item.eso_owner).replace(/^@/,''),'Unknown',100);
    embed.addFields({name:discordTitle(`🏠 ${item.position}. ${label} — @${owner}`),value:`**Jump in ESO**\n\`\`\`text\n${buildJumpScript(owner,item.house_id)}\n\`\`\`\n**Housing Link**\n\`\`\`text\n${buildHousingLink(owner,item.house_id)}\n\`\`\``});
  }
  const selector = canManage && items.length ? new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('hu:featured:select').setPlaceholder('Choose a Featured entry to manage').addOptions(items.slice(0, 25).map(item => ({ label: `${item.position}. ${String(item.target_name || 'Untitled').slice(0, 80)}`, value: `${item.target_kind}:${item.target_id}`, description: item.target_kind === 'tour' ? 'Tour' : 'House' })))) : null;
  const houses=items.filter(item=>item.target_kind==='house').slice(0,5);
  const houseOpens=houses.length?row(houses.map(item=>button(`hu:featured:house:${item.target_id}:${canManage?'admin':'viewer'}`,`Open House ${item.position}`,ButtonStyle.Primary))):null;
  const tours=items.filter(item=>item.target_kind==='tour').slice(0,5);
  const tourOpens=tours.length?row(tours.map(item=>button(`hu:featured:tour:${item.target_id}:${canManage?'admin':'viewer'}`,`Open Tour ${item.position}`,ButtonStyle.Primary))):null;
  const categoryCount=selectedItem?items.filter(item=>item.target_kind===selectedItem.target_kind).length:0;
  const managementRows = selectedItem ? [row([button(`hu:featured:move:${selectedItem.target_kind}:${selectedItem.target_id}:${Math.max(1, Number(selectedItem.position) - 1)}`, '↑', ButtonStyle.Secondary, Number(selectedItem.position) <= 1), button(`hu:featured:move:${selectedItem.target_kind}:${selectedItem.target_id}:${Math.min(categoryCount, Number(selectedItem.position) + 1)}`, '↓', ButtonStyle.Secondary, Number(selectedItem.position) >= categoryCount), button(`hu:featured:remove:${selectedItem.target_kind}:${selectedItem.target_id}`, `Remove ${selectedItem.position}`, ButtonStyle.Danger), button(`hu:featured:expire:${selectedItem.target_kind}:${selectedItem.target_id}`, 'Expiration')])] : [];
  const controls=canManage?[button('hu:featured:add:house','Add House'),button('hu:featured:add:tour','Add Tour'),button('hu:admin','Administration')]:[button('hu:tours','Back')];
  return { embeds: [embed], components: [...(selector ? [selector] : []), ...(houseOpens?[houseOpens]:[]), ...(tourOpens?[tourOpens]:[]), ...managementRows, row(controls)] };
}

export function progressPayload({ item = null, items = null, page = 1 } = {}) {
  if(items?.length>1){
    const currentPage=Math.min(Math.max(1,Number(page)||1),Math.ceil(items.length/5)),start=(currentPage-1)*5,visible=items.slice(start,start+5);
    const embed=new EmbedBuilder().setColor(0x2b7ddd).setTitle('🧭 Tour Progress').setDescription(discordDescription(visible.map((run,index)=>`**${start+index+1}. ${displayText(run.tour_name,'Untitled',200)}**`).join('\n')));
    const opens=visible.map((run,index)=>button(`hu:progress:resume:${run.id}${currentPage>1?`:${currentPage}`:''}`,`Resume ${start+index+1}`,ButtonStyle.Success));
    const navigation=[button(`hu:my:progress:prev:${currentPage-1}`,'Previous',ButtonStyle.Secondary,currentPage<=1),button(`hu:my:progress:next:${currentPage+1}`,'Next',ButtonStyle.Secondary,currentPage*5>=items.length),button(currentPage>1?`hu:progress:completed:from:${currentPage}`:'hu:progress:completed','Completion History'),button('hu:my','Back')];
    return {embeds:[embed],components:[row(opens),row(navigation)]};
  }
  const embed = new EmbedBuilder().setColor(0x2b7ddd).setTitle('🧭 Tour Progress').setDescription(discordDescription(item ? `**Tour:** ${displayText(item.tour_name,'Untitled',200)}\n**Current stop:** ${item.current_stop_id || 'Complete'}\n**Completions:** ${item.completion_count || 0}` : 'You have no active tour progress.'));
  const id=item?.id;
  return { embeds: [embed], components: [row([button(id?`hu:progress:resume:${id}`:'hu:progress:resume', 'Resume', ButtonStyle.Success, !item), button(id?`hu:progress:restart:${id}`:'hu:progress:restart', 'Restart', ButtonStyle.Secondary, !item), button('hu:progress:completed', 'Completion History'), button('hu:my', 'Back')])] };
}

export function progressRunPayload({ item = null, tour = null, stops = [], currentPosition = null, commentCount = 0, showDetails = false, canEdit = false, listPage = 1 } = {}) {
  const complete=item?.status==='completed';
  const suffix=Number(listPage)>1?`:${Math.floor(Number(listPage))}`:'';
  const backId=suffix?`hu:my:progress:page${suffix}`:'hu:my:progress';
  if(item&&!complete&&tour&&stops.length){
    const position=Number(currentPosition)||Math.max(1,stops.findIndex(stop=>Number(stop.id)===Number(item.current_stop_id))+1);
    const stop=stops[position-1],detailState=showDetails?'expanded':'compact';
    const primary=[
      button(`hu:progress:back:${item.id}:${detailState}${suffix}`,'Previous',ButtonStyle.Secondary,position<=1,'⬅️'),
      button(`hu:progress:next:${item.id}:${detailState}${suffix}`,'Next',ButtonStyle.Primary,false,'➡️'),
      button(`hu:progress:${showDetails?'hide':'details'}:${item.id}${suffix}`,showDetails?'Hide Details':'More Details',ButtonStyle.Primary),
      button(`hu:progress:comments:${item.id}:${detailState}${suffix}`,'Comments',ButtonStyle.Primary)
    ];
    const secondary=[];
    if(canEdit&&stop?.source_id!=null)secondary.push(button(`hu:progress:edit:${item.id}:${Number(stop.source_id)}:${detailState}${suffix}`,'Edit House',ButtonStyle.Secondary,false,'✏️'));
    secondary.push(button(`hu:progress:list:${item.id}:${detailState}${suffix}`,'Show Tour List'),button(`hu:progress:restart:${item.id}:${detailState}${suffix}`,'Restart'),button(backId,'Back',ButtonStyle.Secondary,false,'↩️'));
    return {embeds:[tourEmbed(tour,stops,position,commentCount,showDetails,{shared:false,leaderId:item.discord_user_id})],components:[row(primary),row(secondary)]};
  }
  const stop=item?.stop_position?`Stop **${item.stop_position}**${item.current_house_name?` — **${destinationLabel({house_name:item.current_house_name,display_name:item.current_house_nickname})}**`:''}${item.current_house_owner?`\nOwner: @${String(item.current_house_owner).replace(/^@/,'')}`:''}${item.stop_notes?`\n\n${item.stop_notes}`:''}`:'Complete';
  const embed = new EmbedBuilder().setColor(0x2b7ddd).setTitle('🧭 Self-Paced Tour').setDescription(discordDescription(item ? `**Tour:** ${item.tour_name || 'Untitled'}\n**Current stop:** ${stop}\n**Completions:** ${item.completion_count || 0}` : 'That tour progress is no longer available.'));
  if (!item) return { embeds: [embed], components: [row([button(backId, 'Back',ButtonStyle.Secondary,false,'↩️')])] };
  const actions=complete ? [button(`hu:progress:restart:${item.id}${suffix}`, 'Restart', ButtonStyle.Secondary)] : [button(`hu:progress:back:${item.id}${suffix}`, 'Previous'), button(`hu:progress:next:${item.id}${suffix}`, 'Next', ButtonStyle.Primary), button(`hu:progress:restart:${item.id}${suffix}`, 'Restart')];
  if(!complete && item.current_saved_house_id)actions.push(button(`hu:progress:house:${item.current_saved_house_id}${suffix}`, 'Open House', ButtonStyle.Success));
  actions.push(button(backId, 'Back',ButtonStyle.Secondary,false,'↩️'));
  return { embeds: [embed], components: [row(actions)] };
}

export function progressCompletedPayload({ items = [], page = 1, activePage = 1 } = {}) {
  const currentPage=Math.min(Math.max(1,Number(page)||1),Math.max(1,Math.ceil(items.length/5))),start=(currentPage-1)*5,visible=items.slice(start,start+5);
  const activeSuffix=Number(activePage)>1?`:from:${Math.floor(Number(activePage))}`:'';
  const embed = new EmbedBuilder().setColor(0x2b7ddd).setTitle('✅ Tour Completion History').setDescription(discordDescription(items.length
    ? visible.map(item => `**${displayText(item.tour_name,'Untitled',200)}** — ${item.completion_count || 0} completion${Number(item.completion_count) === 1 ? '' : 's'}`).join('\n')
    : 'You have not completed a self-paced tour in this ESO environment yet.'));
  const actions=visible.map((item,index)=>button(`hu:progress:history:${item.id}${currentPage>1||activeSuffix?`:${currentPage}`:''}${activeSuffix}`,`View Route ${start+index+1}`));
  const navigation=[button(`hu:progress:completed:prev:${currentPage-1}${activeSuffix}`,'Previous',ButtonStyle.Secondary,currentPage<=1),button(`hu:progress:completed:next:${currentPage+1}${activeSuffix}`,'Next',ButtonStyle.Secondary,currentPage*5>=items.length),button(activeSuffix?`hu:my:progress:page:${Math.floor(Number(activePage))}`:'hu:my:progress', 'Back')];
  return { embeds: [embed], components: [...(actions.length?[row(actions)]:[]), row(navigation)] };
}

export function progressHistoryPayload({ progress = null, stops = [], page = 1, listPage = 1, activePage = 1 } = {}) {
  const currentPage=Math.max(1,Number(page)||1),pageSize=25,start=(currentPage-1)*pageSize,pageStops=stops.slice(start,start+pageSize),hasNext=start+pageSize<stops.length;
  const embed = new EmbedBuilder().setColor(0x2b7ddd).setTitle(discordTitle(`✅ ${progress?.tour_name || 'Tour'} — Completed Stops`)).setDescription(discordDescription(stops.length
    ? pageStops.map(stop => `**${stop.position}.** ${destinationLabel(stop)}${stop.eso_owner ? ` — @${String(stop.eso_owner).replace(/^@/,'')}` : ''}`).join('\n')
    : 'No completed stops were recorded for this run.'));
  const houses = pageStops.filter(stop => stop.saved_house_id != null);
  const listSuffix=Number(listPage)>1?`:${Math.floor(Number(listPage))}`:'';
  const activeSuffix=Number(activePage)>1?`:from:${Math.floor(Number(activePage))}`:'';
  const picker = houses.length ? new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`hu:progress:history:house:${progress?.id || ''}${listSuffix||activeSuffix?`:${Math.max(1,Number(listPage)||1)}:${currentPage}`:''}${activeSuffix}`).setPlaceholder('Open a completed house').addOptions(houses.map(stop => ({ label: `${stop.position}. ${destinationLabel(stop)}`.slice(0, 100), value: String(stop.saved_house_id), description: 'Open house details' })))) : null;
  const navigation=[button(`hu:progress:history:prev:${progress?.id || ''}:${Math.max(1,currentPage-1)}${listSuffix||activeSuffix?`:${Math.max(1,Number(listPage)||1)}`:''}${activeSuffix}`,'Previous',ButtonStyle.Secondary,currentPage<=1),button(`hu:progress:history:next:${progress?.id || ''}:${currentPage+1}${listSuffix||activeSuffix?`:${Math.max(1,Number(listPage)||1)}`:''}${activeSuffix}`,'Next',ButtonStyle.Secondary,!hasNext),button(activeSuffix?`hu:progress:completed:page:${Math.max(1,Number(listPage)||1)}${activeSuffix}`:listSuffix?`hu:progress:completed:page:${Math.floor(Number(listPage))}`:'hu:progress:completed', 'Back')];
  return { embeds: [embed], components: [...(picker ? [picker] : []), row(navigation)] };
}
