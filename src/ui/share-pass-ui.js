import {houseCapacityText} from '../utils/house-capacity.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import {portalPublicUrl} from '../web/portal-url.js';
import { cleanDestinationEmbed, buttonRows, houseStateSpecs } from './housing-ui.js';
import { destinationLabel } from '../utils/labels.js';
import { discordDescription, discordTitle } from '../utils/text-limits.js';

export function sharedPrivateHousePayload(house,{token,passId,canCopy=false,backToTourId=null,showDetails=false}={}){
  const componentToken=token??passId;
  const embed=cleanDestinationEmbed(house,{showDetails});
  const current=embed.toJSON().description||'';
  embed.setDescription(`🔒 **Shared Private access** — this house remains excluded from normal search and browsing.\n\n${current}`.slice(0,4096));
  const actions=[];
  if(canCopy)actions.push({customId:`hu:pass:house:copy:${componentToken}`,label:'Copy to My Address Book',style:'success'});
  actions.push(
    {customId:`hu:pass:house:comments:${componentToken}`,label:'Comments',style:'primary'},
    {customId:`hu:pass:house:details:${showDetails?'hide':'show'}:${componentToken}`,label:showDetails?'Hide Details':'More Details',style:'primary'},
    {customId:`hu:pass:house:report:${componentToken}`,label:'Report a Problem',style:'secondary'},
    ...houseStateSpecs(house,'pass')
  );
  if(backToTourId!=null)actions.push({customId:`hu:pass:tour:back:${backToTourId}`,label:'Back to Tour',style:'secondary'});
  return {embeds:[embed],components:buttonRows(actions)};
}


function destinationPage(rows,page){
  const pages=Math.max(1,Math.ceil(rows.length/25));
  page=Math.max(0,Math.min(pages-1,Math.floor(Number(page)||0)));
  return {page,pages,items:rows.slice(page*25,page*25+25)};
}
function destinationSelect(customId,placeholder,items){
  if(!items.length)return [];
  const select=new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).setMinValues(1).setMaxValues(1).addOptions(items.map(c=>({label:String(c.name||c.id).slice(0,100),value:String(c.id),description:String(c.parent?.name||'No category').slice(0,100)})));
  return [new ActionRowBuilder().addComponents(select)];
}
export function tourShareChannelPayload(tourId,{channels=[],page=0,kind='tour',remembered=null}={}){
  const view=destinationPage(channels,page),actions=[];
  if(remembered)actions.push({customId:`hu:pass:${kind}:confirm:${tourId}:${remembered.id}`,label:`Last shared: ${remembered.name}`.slice(0,80),style:'success'});
  if(view.page>0)actions.push({customId:`hu:pass:${kind}:share:${tourId}:${view.page-1}`,label:'Previous Channels',style:'secondary'});
  if(view.page<view.pages-1)actions.push({customId:`hu:pass:${kind}:share:${tourId}:${view.page+1}`,label:'Next Channels',style:'secondary'});
  actions.push({customId:`hu:pass:${kind}:link:${tourId}`,label:'Use Channel / Thread Link',style:'primary'},{customId:kind==='tour'?'hu:tours':'hu:home',label:'Cancel',style:'secondary'});
  return {content:`**Share ${kind==='tour'?'Tour':'House'} Pass — Choose a channel**\nPage ${view.page+1} of ${view.pages} • ${channels.length} visible channels.\nChoose a channel, then post there or select an existing thread / forum post. Only channels visible to both you and HearthBound are listed. Posting permissions are checked before sending.${channels.length?'':'\nNo channels are available. Check HearthBound’s channel permissions.'}`,embeds:[],components:[...destinationSelect(`hu:pass:${kind}:channel:${tourId}`,'Choose a channel',view.items),...buttonRows(actions)]};
}
export function tourShareThreadPayload(tourId,channel,{threads=[],page=0,canPost=false,warning='',kind='tour'}={}){
  const view=destinationPage(threads,page),actions=[];
  if(canPost)actions.push({customId:`hu:pass:${kind}:confirm:${tourId}:${channel.id}`,label:'Post in This Channel',style:'success'});
  if(view.page>0)actions.push({customId:`hu:pass:${kind}:threads:${tourId}:${channel.id}:${view.page-1}`,label:'Previous Threads',style:'secondary'});
  if(view.page<view.pages-1)actions.push({customId:`hu:pass:${kind}:threads:${tourId}:${channel.id}:${view.page+1}`,label:'Next Threads',style:'secondary'});
  actions.push({customId:`hu:pass:${kind}:link:${tourId}`,label:'Use Channel / Thread Link',style:'primary'},{customId:`hu:pass:${kind}:share:${tourId}`,label:'Back to Channels',style:'secondary'},{customId:kind==='tour'?'hu:tours':'hu:home',label:'Cancel',style:'secondary'});
  return {content:`**Share ${kind==='tour'?'Tour':'House'} Pass — <#${channel.id}>**\n${canPost?'Post here, or select a thread below.':'Select an existing thread or forum post below.'}\nActive threads: ${threads.length} • Page ${view.page+1} of ${view.pages}. Selecting a thread opens a confirmation.\nFor an older thread, use its link or ID. Private threads require access for both you and HearthBound.${warning?'\n'+warning:''}`,embeds:[],components:[...destinationSelect(`hu:pass:${kind}:thread:${tourId}:${channel.id}`,'Choose an active thread / forum post',view.items),...buttonRows(actions)]};
}
export function tourShareDestinationPayload(tourId,channel,kind='tour'){
  return {content:`Post this ${kind==='tour'?'reusable Tour':'revocable House'} Pass in <#${channel.id}>?${channel.archived?' This archived thread will reopen when the message is sent.':''}`,embeds:[],components:buttonRows([{customId:`hu:pass:${kind}:post:${tourId}:${channel.id}`,label:kind==='tour'?'Post Tour Pass':'Post House Pass',style:'success'},{customId:`hu:pass:${kind}:share:${tourId}`,label:'Back to Channels',style:'secondary'},{customId:kind==='tour'?'hu:tours':'hu:home',label:'Cancel',style:'secondary'}])};
}
export function tourShareLinkModal(tourId,kind='tour'){
  return new ModalBuilder().setCustomId(`hu:modal:${kind}destination:${tourId}`).setTitle('Choose Channel or Thread').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('destination').setLabel('Channel / thread link, mention, or ID').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(250)));
}

function webPassLink(payload,kind,token,portalUrl){
  if(!portalUrl)return payload;
  const url=new URL(`/app/shared/${kind}/${encodeURIComponent(token)}`,portalUrl).href;
  const button=new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(kind==='tour'?'Open Web Tour':'Open Web House').setURL(url);
  const last=payload.components.at(-1);if(last&&last.components.length<5)last.addComponents(button);else payload.components.push(new ActionRowBuilder().addComponents(button));return payload;
}
export function houseShareCardPayload(house,{token,sharerName='A housing visitor',portalUrl=portalPublicUrl()}={}){
  const embed=cleanDestinationEmbed(house).setDescription(`${house.scope==='private'?'🔒 This Private entry remains excluded from normal search and browsing.\n\n':''}Shared by **${sharerName}** through a revocable HearthBound Share Pass.`);
  return webPassLink({embeds:[embed],components:buttonRows([{customId:`hu:pass:house:view:${token}`,label:'View Shared House',style:'success'},{customId:`hu:pass:house:report:${token}`,label:'Report a Problem',style:'secondary'}])},'house',token,portalUrl);
}

export function housePassManagementPayload(rows,{page=0,pages=1}={}){
  const lines=rows.length?rows.map(row=>`**#${row.id}** • ${row.status==='active'?'Active':'Revoked'} • ${row.channel_name||row.channel_id||'Channel unavailable'} • Used ${row.usage_count||0} time(s)`).join('\n'):'No House Share Passes have been created.';
  const actions=[];
  if(page>0)actions.push({customId:`hu:pass:house:manage:${page-1}`,label:'Previous',style:'secondary'});
  if(page<pages-1)actions.push({customId:`hu:pass:house:manage:${page+1}`,label:'Next',style:'secondary'});
  actions.push({customId:'hu:home',label:'Back',style:'secondary'});
  return {content:`**Manage House Share Passes**\n${lines}`,embeds:[],components:buttonRows(actions)};
}

export function houseCopyVisibilityPayload(preview,{token}={}){
  const explanation=preview.choices.filter(choice=>!choice.enabled).map(choice=>`**${choice.label}:** ${choice.reason}`).join('\n');
  const embed=new EmbedBuilder().setColor(0x2b7ddd).setTitle('Copy House to My Address Book').setDescription([
    `**Official house:** ${preview.destination.houseName}`,
    `**ESO owner:** @${String(preview.destination.esoOwner).replace(/^@/,'')}`,
    '', 'Choose the visibility for your independent saved entry. The ESO destination stays the same; nickname, description, and tags can be edited next.',
    explanation?'':null,explanation||null
  ].filter(value=>value!==null).join('\n'));
  return {embeds:[embed],components:buttonRows([
    ...preview.choices.map(choice=>({customId:`hu:pass:house:copyvisibility:${choice.visibility}:${token}`,label:choice.label,style:choice.visibility==='private'?'success':'primary',disabled:!choice.enabled})),
    {customId:`hu:pass:house:view:${token}`,label:'Cancel',style:'secondary'}
  ])};
}

function copyField(id,label,value,{paragraph=false,maxLength=paragraph?4000:4000}={}){
  const field=new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(paragraph?TextInputStyle.Paragraph:TextInputStyle.Short).setRequired(false).setMaxLength(maxLength);
  if(String(value??''))field.setValue(String(value).slice(0,maxLength));
  return new ActionRowBuilder().addComponents(field);
}

export function houseCopyMetadataModal(preview,{token,visibility}={}){
  return new ModalBuilder().setCustomId(`hu:modal:pass:house:copy:${visibility}:${token}`).setTitle('Copy House Details').addComponents(
    copyField('nickname','Nickname',preview.metadata.nickname,{maxLength:255}),
    copyField('description','Description',preview.metadata.description,{paragraph:true}),
    copyField('tags','Tags (comma separated)',preview.metadata.tags.join(', '))
  );
}

export function tourShareCardPayload(tour,{token,sharerName='A housing visitor',stopCount=0,portalUrl=portalPublicUrl()}={}){
  const visibility=tour.visibility==='global'?'Global':tour.visibility==='public'?'Server':'Private';
  const embed=new EmbedBuilder().setColor(0x2b7ddd).setTitle(discordTitle(`🗺️ ${tour.name}`)).setDescription(discordDescription([
    tour.description||'A shared HearthBound housing tour.',
    '',`**Tour visibility:** ${visibility}`,`**Stops:** ${stopCount}`,`**Shared by:** ${sharerName}`,
    '',tour.visibility==='private'?'Private destinations are available only while using this Tour Pass and remain excluded from normal search.':'Private destinations, if any, are available only during the tour.'
  ].join('\n')));
  return webPassLink({embeds:[embed],components:buttonRows([
    {customId:`hu:pass:tour:start:${token}`,label:'Start Self-Paced Tour',style:'success'},
    {customId:`hu:pass:tour:info:${token}`,label:'Tour Information',style:'primary'},
    {customId:`hu:pass:tour:copy:${token}`,label:'Copy Tour to My Address Book',style:'secondary'},
    {customId:`hu:pass:tour:report:${token}`,label:'Report a Problem',style:'secondary'}
  ])},'tour',token,portalUrl);
}

export function tourCopyPreviewPayload(preview,{token}={}){
  const advisories=preview.advisories?.length?`\n\n⚠️ ${preview.advisories.map(item=>item.message).join(' ')}`:'';
  const embed=new EmbedBuilder().setColor(0x2b7ddd).setTitle('Copy Tour to My Address Book').setDescription(discordDescription([
    `**${preview.name}** will become an independent Private tour owned by you.`,
    '',`**Total stops:** ${preview.totalStops}`,`**Existing saved entries reused:** ${preview.reusedStops}`,`**Private copies created:** ${preview.copiedStops}`,
    '', 'Later changes or revocation of the Share Pass will not alter your copied tour.',advisories
  ].join('\n')));
  return {embeds:[embed],components:buttonRows([
    {customId:`hu:pass:tour:copyconfirm:${token}`,label:'Copy Private Tour',style:'success'},
    {customId:`hu:pass:tour:info:${token}`,label:'Cancel',style:'secondary'}
  ])};
}

export function tourPassInformationPayload({tour,stops},{token}={}){
  const route=stops.length?stops.slice(0,20).map((stop,index)=>`${index+1}. ${destinationLabel({...stop,display_name:stop.custom_title||stop.display_name})}${stop.eso_owner?` — @${String(stop.eso_owner).replace(/^@/,'')}`:''}${houseCapacityText(stop)?' • '+houseCapacityText(stop):''}`).join('\n'):'No stops available.';
  const embed=new EmbedBuilder().setColor(0x2b7ddd).setTitle(discordTitle(`Tour Information — ${tour.name}`)).setDescription(discordDescription([tour.description||'A shared HearthBound housing tour.',`**Stops:** ${stops.length}`,'**Route**',route].join('\n\n')));
  return {embeds:[embed],components:buttonRows([{customId:`hu:pass:tour:start:${token}`,label:'Start Self-Paced Tour',style:'success'},{customId:`hu:pass:tour:copy:${token}`,label:'Copy Tour to My Address Book',style:'secondary'}])};
}
