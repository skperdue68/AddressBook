import {tourRouteLines,tourRouteSummary} from '../utils/tour-route-summary.js';
import {houseCapacityText} from '../utils/house-capacity.js';
import {unifiedCard} from './message-layout.js';
import {portalPublicUrl} from '../web/portal-url.js';
import {registrationTourActions} from './registration-tour-ui.js';
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType,
  EmbedBuilder, LabelBuilder, ModalBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder,
  TextInputBuilder, TextInputStyle
} from 'discord.js';
import { addHouseMetadata, addCleanHouseMetadata, titleWithPlayerCap } from '../utils/render.js';
import { buildJumpScript, buildHousingLink, buildHousePreviewScript } from '../utils/eso.js';
import { destinationLabel } from '../utils/labels.js';
import { esoServerLabel, esoServerOptions } from '../utils/eso-server.js';
import { normalizeTimezone } from '../utils/timezone.js';
import {
  homeButtonSpecs, toursButtonSpecs, tourDetailButtonSpecs, tourManageButtonSpecs
} from '../utils/menu-specs.js';
import { adminInterfaceMode } from '../config/admin-interface.js';
import { EVENT_DESCRIPTION_MAX, EVENT_TITLE_MAX } from '../utils/text-limits.js';

const styles={primary:ButtonStyle.Primary,secondary:ButtonStyle.Secondary,success:ButtonStyle.Success,danger:ButtonStyle.Danger};
const color=0x2b7ddd;
const safe=(v,max=100)=>String(v??'').slice(0,max);
const parseTags=v=>{try{return Array.isArray(v)?v:JSON.parse(v||'[]')}catch{return []}};
const unixTime=v=>{const d=v instanceof Date?v:new Date(/(?:Z|[+-]\d\d:?\d\d)$/.test(String(v))?String(v):`${v}Z`);const ms=d.getTime();return Number.isFinite(ms)?Math.floor(ms/1000):Math.floor(Date.now()/1000);};

function button(spec){ const b=new ButtonBuilder().setCustomId(spec.customId).setLabel(spec.label).setStyle(styles[spec.style]??ButtonStyle.Secondary); if(spec.emoji)b.setEmoji(spec.emoji); if(spec.disabled)b.setDisabled(true); return b; }
export function buttonRows(specs,size=5){ const width=Math.max(1,Math.min(5,Number(size)||5)); const rows=[]; for(let n=0;n<specs.length;n+=width)rows.push(new ActionRowBuilder().addComponents(...specs.slice(n,n+width).map(button))); return rows; }
function embed(title,description){ return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description); }

function appendPortalLink(payload,url){if(!url)return payload;const link=new ButtonBuilder().setLabel('Open Web Portal').setStyle(ButtonStyle.Link).setURL(url);const last=payload.components.at(-1);if(last&&last.components.length<5)last.addComponents(link);else if(payload.components.length<5)payload.components.push(new ActionRowBuilder().addComponents(link));return payload;}
function homeButtonRows(isAdmin){return buttonRows(homeButtonSpecs(isAdmin),2);}
export function homePayload({isAdmin=false,version='1.0.62',esoServer=null,adminInterface=adminInterfaceMode(),portalUrl=portalPublicUrl()}={}){ const environment=esoServer?`\n\n**ESO environment:** ${esoServerLabel(esoServer)}`:''; const adminNote=adminInterface==='web'?'\n\n**Administration:** Use the companion web console.':''; return appendPortalLink({embeds:[embed('🏠 HearthBound',`Share a home. Build a tour. Explore ESO housing.\n\nRegister and share your houses, build housing tours, explore or try Random House, and save places in your address book.${environment}${adminNote}`).setFooter({text:`HearthBound • Version ${version} • Start anytime with /hearth`})],components:homeButtonRows(isAdmin)},portalUrl); }

export function environmentSetupPayload({message=null}={}){
  const select=new StringSelectMenuBuilder().setCustomId('hu:environment:setup').setPlaceholder('Choose this Discord server’s ESO environment…').addOptions(esoServerOptions().map(option=>({label:option.label,value:option.value,description:`Use ${option.label} houses, tours, and Global results`})));
  const description=[message,'HearthBound needs this Discord server’s ESO environment before anyone can use housing features. Global content is shared only with other Discord servers using the exact same environment.','Any member may complete this one-time setup. Housing Moderators can preview a later change in Administration.'].filter(Boolean).join('\n\n');
  return {embeds:[embed('🌍 HearthBound Setup Required',description)],components:[new ActionRowBuilder().addComponents(select)]};
}
export function onboardingPayload({page=0}={}){
  if(page===0)return {embeds:[embed('🏠 Welcome to HearthBound','Find and share ESO player housing destinations, save your own Private list, and follow housing tours. Choose a starting point or take the guided introduction.')],components:buttonRows([
    {customId:'hu:find',label:'Find a House',style:'primary'},
    {customId:'hu:register',label:'Register a House',style:'success'},
    {customId:'hu:tours:start',label:'Start a Tour',style:'primary'},
    {customId:'hu:onboarding:1',label:'Show Me Around',style:'secondary'},
    {customId:'hu:onboarding:skip',label:'Skip',style:'secondary'}
  ])};
  const screens={
    1:{title:'Introduction 1 of 7 — Find the Right House',description:'Search begins with all homes you can access. Open Filters when you want to narrow the list.',fields:[['What you can search','House or nickname, owner, tags, themes, zone, architectural style, ESO classification, size/type, and visibility.'],['Useful switches','Include Non-Player Homes or find houses not already included in a Server or Global tour.']]},
    2:{title:'Introduction 2 of 7 — Register in Seconds',description:'Save a destination without memorizing a complicated format.',fields:[['Flexible destination input','Paste an ESO Housing Link, a jump command, `("@Owner", 62)`, or enter an owner and part of the official house name.'],['Choose visibility','Global shares within the exact ESO environment, Server stays in this Discord server, and Private belongs only to you.']]},
    3:{title:'Introduction 3 of 7 — Visit and Explore',description:'House cards keep the useful ESO actions together and easy to copy.',fields:[['Copy-ready commands','Jump in ESO, Unfurnished Preview, and Housing Link each appear in a separate code block.'],['Helpful context','See house details, who submitted it, its visibility, comments, and every visible tour that includes it.']]},
    4:{title:'Introduction 4 of 7 — Your HearthBound',description:'My Address Book is your private dashboard for work you created or recently used.',fields:[['Keep moving','Open My Houses, My Tours, Pending submissions, Recently Viewed, or resume an active tour.'],['Older data','If an older house or tour has no ESO environment, preview and assign your eligible legacy records here.']]},
    5:{title:'Introduction 5 of 7 — Build and Follow Tours',description:'Create a tour manually or build one from filtered search results, then arrange its route and stop notes.',fields:[['Self-Paced','Each visitor advances privately at their own speed and can resume progress later.'],['Shared','The route appears in a channel for the group, while only the tour leader controls navigation.']]},
    6:{title:'Introduction 6 of 7 — Share Without Going Public',description:'A Share Pass can post a house or tour to a channel without changing its normal visibility.',fields:[['Stay in control','Revoke passes when they are no longer needed. Tour Pass visitors receive independent Self-Paced sessions.'],['Make your own copy','When a pass is the only reason you can see someone else’s Private house, Copy House lets you review and save an editable entry of your own.']]},
    7:{title:'Introduction 7 of 7 — Visibility and Safety',description:'HearthBound keeps discovery boundaries predictable: Global, then Server, then Private.',fields:[['Environment boundary','Global content is shared only between Discord servers configured for the exact same ESO environment.'],['Community tools','Report misleading, inappropriate, or inaccessible listings. Housing and Global Moderators receive the applicable review queues.']]}
  };
  const onboardingActions={
    1:{customId:'hu:onboarding:go:search:1',label:'Try Search'},
    2:{customId:'hu:onboarding:go:register:2',label:'Register a House'},
    3:{customId:'hu:onboarding:go:search:3',label:'Try Search'},
    4:{customId:'hu:onboarding:go:addressbook:4',label:'Open My Address Book'},
    5:{customId:'hu:onboarding:go:tours:5',label:'Browse Tours'},
    6:{customId:'hu:onboarding:go:tours:6',label:'Browse Tours'},
    7:{customId:'hu:onboarding:go:help:7',label:'Open Help'}
  };
  const screen=screens[page]||screens[1],contextual=onboardingActions[page]||onboardingActions[1],navigation=[];
  if(page>1)navigation.push({customId:`hu:onboarding:${page-1}`,label:'Back',style:'secondary'});
  navigation.push(page<7?{customId:`hu:onboarding:${page+1}`,label:'Next',style:'primary'}:{customId:'hu:onboarding:finish',label:'Finish',style:'success'});
  navigation.push({customId:'hu:onboarding:skip',label:'Skip',style:'secondary'});
  const e=embed(screen.title,screen.description).addFields(...screen.fields.map(([name,value])=>({name,value})));
  return {embeds:[e],components:[...buttonRows(navigation),...buttonRows([{...contextual,style:'primary'}])]};
}
export function myAddressBookPayload({houses=0,tours=0,pending=0,recent=0,favorites=0,wantToVisit=0,visited=0,savedSearches=0,continueItems=null,legacy=null,esoServer=null,backId='hu:home'}={}){
  const e=embed('📖 My Address Book','Keep places that stand out to you: favorites and houses you submit. Your saved lists are personal.')
    .addFields(
      {name:'🏠 My Houses',value:`**${Number(houses)}**`,inline:true},
      {name:'🗺️ My Tours',value:`**${Number(tours)}**`,inline:true},
      {name:'⏳ Access requests',value:`**${Number(pending)}**`,inline:true},
      {name:'🕘 Recently Viewed',value:`**${Number(recent)}**`,inline:true},
      {name:'⭐ Favorites',value:`**${Number(favorites)}**`,inline:true},
      {name:'🔎 Saved Searches',value:`**${Number(savedSearches)}**`,inline:true}
    );
  const continueActions=[];
  if(continueItems?.activeTour)continueActions.push({customId:`hu:my:resume:${continueItems.activeTour.id}`,label:'Resume Tour',style:'success'},{customId:`hu:my:restart:${continueItems.activeTour.id}`,label:'Start Over',style:'secondary'},{customId:`hu:my:end:${continueItems.activeTour.id}`,label:'End Tour',style:'secondary'});
  if(continueItems?.editedTour)continueActions.push({customId:`hu:tour:view:${continueItems.editedTour.id}`,label:'Open Recent Tour',style:'secondary'});
  if(continueActions.length)e.addFields({name:'▶️ Continue',value:'Resume where you left off or reopen recent work.'});
  const legacyCount=Number(legacy?.houses||0)+Number(legacy?.tours||0);
  if(legacyCount)e.addFields({name:'⚠️ Unassigned Legacy Data',value:`**${legacy.houses||0}** house${Number(legacy.houses)===1?'':'s'} and **${legacy.tours||0}** tour${Number(legacy.tours)===1?'':'s'} need an ESO environment. Review them before assigning them to ${esoServerLabel(esoServer)}.`});
  return {embeds:[e],components:[...buttonRows(continueActions),...buttonRows([
    {customId:'hu:my:library',label:'All Saved Places',style:'primary',emoji:'📖'},
    {customId:'hu:my:favorites',label:'Favorites',style:'secondary',emoji:'⭐'},
    {customId:'hu:my:houses',label:'Submitted Houses',style:'secondary',emoji:'🏠'},
    {customId:'hu:my:tours',label:'My Tours',style:'secondary',emoji:'🗺️'},
    {customId:'hu:my:progress',label:'Tour Progress',style:'secondary',emoji:'🧭'},
    {customId:'hu:my:recent',label:'Recently Viewed',style:'secondary',emoji:'🕘'},
    {customId:'hu:my:searches',label:'Saved Searches',style:'secondary',emoji:'🔎'},
    {customId:'hu:my:pending',label:'Access requests',style:'secondary',emoji:'⏳'},
    ...(legacyCount?[{customId:'hu:legacy:preview',label:`Assign to ${esoServerLabel(esoServer)}`,style:'success'}]:[]),
    {customId:backId,label:backId==='hu:home'?'Main Menu':'Back',style:'secondary',emoji:'↩️'}
  ],4)]};
}

export function legacyAssignmentPayload(preview,{confirm=false}={}){
  const c=preview.counts||{};
  const description=`Assign **${c.houses||0} house${c.houses===1?'':'s'}** and **${c.tours||0} tour${c.tours===1?'':'s'}** to **${esoServerLabel(preview.esoServer)}**.\n\n**Tour stops removed:** ${c.removedStops||0}\nTour stops that do not belong in the selected environment will be removed and the remaining route will be renumbered. Nothing changes until you confirm.`;
  const actions=confirm?[{customId:`hu:legacy:confirm:${preview.esoServer}:${preview.fingerprint}`,label:'Confirm Assignment',style:'danger'}]:[{customId:'hu:legacy:preview',label:'Refresh Preview',style:'primary'}];
  actions.push({customId:'hu:my',label:'Not Now',style:'secondary'});
  return {embeds:[embed('⚠️ Assign Unassigned Legacy Data',description)],components:buttonRows(actions)};
}

export function environmentChangeChoicePayload(currentEsoServer){
  const options=esoServerOptions().filter(option=>option.value!==currentEsoServer).map(option=>({label:option.label,value:option.value,description:`Preview moving this server from ${esoServerLabel(currentEsoServer)} to ${option.label}`}));
  const select=new StringSelectMenuBuilder().setCustomId('hu:environment:change').setPlaceholder('Choose a proposed ESO environment…').addOptions(options);
  return {embeds:[embed('🌍 Change ESO Environment',`Current environment: **${esoServerLabel(currentEsoServer)}**\n\nChoose a different environment to calculate the full impact. No data changes during preview.`)],components:[new ActionRowBuilder().addComponents(select),...buttonRows([{customId:'hu:admin',label:'Back',style:'secondary',emoji:'↩️'}])]};
}

export function environmentChangePreviewPayload(preview){
  const c=preview.counts||{};
  const description=`**Current:** ${esoServerLabel(preview.fromEsoServer)}\n**Proposed:** ${esoServerLabel(preview.toEsoServer)}\n\nThis is a destructive administrative change. HearthBound will recalculate the impact at confirmation and refuse stale previews.`;
  const e=embed('🌍 ESO Environment Change Preview',description).addFields(
    {name:'Houses',value:`Server: **${c.serverHouses||0}**\nOrigin-linked Global: **${c.globalHouses||0}**\nOrigin-linked Private: **${c.privateHouses||0}**`,inline:true},
    {name:'Tours',value:`Server: **${c.serverTours||0}**\nOrigin-linked Global: **${c.globalTours||0}**\nOrigin-linked Private: **${c.privateTours||0}**`,inline:true},
    {name:'Destinations',value:`Claimed: **${c.destinationsClaimed||0}**\nReused: **${c.destinationsReused||0}**\nCreated: **${c.destinationsCreated||0}**`,inline:true},
    {name:'Route Changes',value:`Stops removed: **${c.removedStops||0}**`,inline:true},
    {name:'Share Passes',value:`House: **${c.housePasses||0}**\nTour: **${c.tourPasses||0}**\nSessions closed: **${c.sessions||0}**`,inline:true},
    {name:'Remain Unassigned',value:`**${c.unresolvedRecords||0}** record${c.unresolvedRecords===1?'':'s'}`,inline:true}
  );
  return {embeds:[e],components:buttonRows([{customId:`hu:environment:confirm:${preview.toEsoServer}:${preview.fingerprint}`,label:`Confirm Change to ${esoServerLabel(preview.toEsoServer)}`,style:'danger'},{customId:'hu:admin',label:'Cancel',style:'secondary'}])};
}
export function myPendingPayload({houses=[],requests=[],serverRequests=[]}={}){
  const lines=[];
  for(const house of houses.slice(0,15))lines.push(`• **${destinationLabel(house)}** — ${house.scope==='global'?'Global':'Server'} house`);
  for(const request of requests.slice(0,5))lines.push(`• **Global Moderator Access** — requested <t:${unixTime(request.requested_at)}:R>`);
  for(const request of serverRequests.slice(0,5))lines.push(`• **Server Moderator Access** — requested <t:${unixTime(request.requested_at)}:R>`);
  const total=houses.length+requests.length+serverRequests.length;
  const description=total?`${lines.join('\n')}${total>lines.length?`\n…and ${total-lines.length} more`:''}\n\nThese requests remain here until an authorized moderator approves or denies them.`:'You have no pending house submissions or moderator access requests.';
  const actions=[];if(!total)actions.push({customId:'hu:register',label:'Register a House',style:'success'});actions.push({customId:'hu:my',label:'Back to My Address Book',style:'secondary',emoji:'↩️'});
  return {embeds:[embed('⏳ My Pending Requests',description)],components:buttonRows(actions)};
}
export function toursPayload(count=0,{backId='hu:home'}={}){ return {embeds:[embed('🗺️ Housing Tours',`There ${count===1?'is':'are'} **${count}** tour${count===1?'':'s'} available to you.\n\nStart one, browse the route, or build and manage tours without remembering tour commands.`)],components:buttonRows([...toursButtonSpecs().map(spec=>spec.customId==='hu:home'?{...spec,customId:backId,label:backId==='hu:home'?'Main Menu':'Back to Introduction'}:spec),{customId:'hu:help',label:'Support & Access',style:'secondary'}])}; }
export function helpPayload({backId='hu:home',portalUrl=portalPublicUrl()}={}){
  const e=embed('❓ Support & Access','Request moderator access, send feedback, or open HearthBound in your browser. Use /hearth anytime to return to the main menu.').addFields({name:'Moderator access',value:'Server and Global access requests are reviewed by authorized administrators. Private content remains visible only to its owner.'});
  if(portalUrl)e.addFields({name:'🌐 Web Portal',value:'Search and register houses, build tours, reorder stops and explore community activity in your browser. Sign in with Discord; the same access rules apply.'});
  const feedback=portalUrl?new ButtonBuilder().setLabel('Send Feedback').setStyle(ButtonStyle.Link).setURL(new URL('/app/feedback',portalUrl).href):null;
  const payload=appendPortalLink({embeds:[e],components:buttonRows([{customId:'hu:servermod',label:'Server Access',style:'primary'},{customId:'hu:globalmod',label:'Global Access',style:'primary'},{customId:'hu:help:moderators',label:'Moderator Access',style:'secondary'},{customId:backId,label:'Back',style:'secondary',emoji:'↩️'}])},portalUrl);
  if(feedback){const last=payload.components.at(-1);if(last.components.length<5)last.addComponents(feedback);else payload.components.push(new ActionRowBuilder().addComponents(feedback));}
  return payload;
}

export function helpLearningPayload({latestVersion='1.0.62',seenVersion=null,acknowledgedFeatures=[]}={}){
  const current=seenVersion===latestVersion?'You have seen the current walkthrough.':'There is a current walkthrough and release guide available.';
  const e=embed('📚 Help & Learning',`${current}\n\nReplay the full **Show Me Around** walkthrough, review the latest changes, or jump directly to one topic.\n\n**Current release:** ${latestVersion}`);
  return {embeds:[e],components:buttonRows([
    {customId:'hu:onboarding:1',label:'Show Me Around Again',style:'primary'},
    {customId:'hu:help:whatsnew',label:'What’s New',style:'success',disabled:acknowledgedFeatures.includes(`whats-new-${latestVersion}`)},
    {customId:'hu:help:topic:search',label:'Search Houses',style:'secondary'},
    {customId:'hu:help:topic:houses',label:'Register & Manage Houses',style:'secondary'},
    {customId:'hu:help:topic:tours',label:'Housing Tours',style:'secondary'},
    {customId:'hu:help:topic:sharing',label:'Sharing & Passes',style:'secondary'},
    {customId:'hu:help:topic:administration',label:'Administration',style:'secondary'},
    {customId:'hu:help',label:'Back to Help',style:'secondary',emoji:'↩️'}
  ])};
}

export function whatsNewPayload({latestVersion='1.0.62',acknowledgedFeatures=[]}={}){
  const key=`whats-new-${latestVersion}`,seen=acknowledgedFeatures.includes(key);
  const e=embed(`✨ What’s New in HearthBound ${latestVersion}`,'HearthBound connects your housing collection across Discord and the web. Use /hearth (/housing still works). The Discord Open Web Portal button opens member registration, drag/drop tour editing, statistics, and recent activity. Your Access shows scoped roles. Bot owners can add new official houses on Discord and web. Random House and Featured Housing remain on Home. Configure BOT_OWNER_IDS for automatic HearthBound permissions across all ESO environments and Global administrator approval/revocation. Server roles and existing individual grants remain supported; Private content remains owner-only.');
  return {embeds:[e],components:buttonRows([{customId:`hu:help:whatsnew:ack:${latestVersion}`,label:seen?'Seen ✓':'Acknowledge What’s New',style:'success',disabled:seen},{customId:'hu:help:learning',label:'Back to Help & Learning',style:'secondary',emoji:'↩️'}])};
}

export function learningTopicPayload(topic='search'){
  const topics={
    search:['🔎 Search Houses','Search starts with all homes populated. Use Filters for house name, owner, tags, themes, zone, style, classification, size/type, visibility, Non-Player homes, and houses not currently on a Server or Global tour.','hu:find','Open Search Houses'],
    houses:['🏠 Houses','Register Global, Server, or Private houses. Private records remain yours unless you explicitly share them; house details retain submitter, visibility, comments, and visible tour associations.','hu:register','Register a House'],
    tours:['🗺️ Housing Tours','Create Global, Server, or Private tours with visibility-eligible stops. Shared tours use one leader-controlled route; Self Paced tours advance privately.','hu:tours','Open Housing Tours'],
    sharing:['🔗 Sharing & Passes','Share a house or tour without changing its saved visibility. A private Share Pass gives recipients a restricted, independent view; copy appears only when the viewer would not normally have access.','hu:tours','Open Housing Tours'],
    administration:['⚙️ Administration','Housing Moderators manage server policy, roles, environment settings, pending review, health, audit, exports, maintenance, and Global Moderator workflows.','hu:admin','Open Administration']
  };
  const [title,description,action,label]=topics[topic]||topics.search;
  return {embeds:[embed(title,description)],components:buttonRows([{customId:action,label,style:'primary'},{customId:'hu:help:learning',label:'Back to Help & Learning',style:'secondary',emoji:'↩️'}])};
}

export function pickerPageModal(stateId,{page=1,pages=1}={}){return new ModalBuilder().setCustomId(`hu:modal:pickerpage:${stateId}`).setTitle('Jump to Page').addComponents(textField('page',`Page number (1–${pages})`,{value:String(page),required:true,maxLength:10}));}
export function pickerPayload({title,description,customId,options,page=0,pages=1,backId='hu:home',multiple=false,actions=[],paginationArrows=false}){
  if(!options.length)return {embeds:[embed(title,description||'No options are available. Try again.')],components:buttonRows([...actions,{customId:backId,label:'Back',style:'secondary'}])};
  const select=new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(multiple?'Choose one or more options…':'Choose an option…').addOptions(options.map(o=>({label:safe(o.label),value:safe(o.value,100),description:o.description?safe(o.description,100):undefined,default:!!o.default}))).setMinValues(1).setMaxValues(multiple?Math.min(25,Math.max(1,options.length)):1);
  const nav=[];
  if(pages>1){ nav.push({customId:`hu:picker:prev:${customId.split(':').pop()}`,label:'Previous',style:'secondary',emoji:paginationArrows?'⬅️':undefined,disabled:page<=0},{customId:`hu:picker:next:${customId.split(':').pop()}`,label:'Next',style:'secondary',emoji:paginationArrows?'➡️':undefined,disabled:page>=pages-1},{customId:`hu:picker:jump:${customId.split(':').pop()}`,label:'Jump to Page',style:'secondary'}); }
  nav.push({customId:backId,label:'Back',style:'secondary',emoji:'↩️'});
  return {embeds:[embed(title,description)],components:[new ActionRowBuilder().addComponents(select),...buttonRows(actions,2),...buttonRows(nav)]};
}


export function bulkTourChoicePayload({token,action,count,backId}){
  const creating=action==='create';
  const title=creating?'Create New Tour From Results':'Add Results to Existing Tour';
  const verb=creating?'create a new tour from':'add to an existing tour from';
  return {embeds:[embed(`🗺️ ${title}`,`There are **${count} saved house${count===1?'':'s'}** in these search results that can be used as tour stops. Non-Player Homes are ignored because they do not have a saved player destination.

Choose whether to ${verb} all saved results or select only the houses you want.`)],components:buttonRows([
    {customId:`hu:bulk:all:${token}`,label:'Use All Saved Results',style:'success'},
    {customId:`hu:bulk:select:${token}`,label:'Select Houses',style:'primary'},
    {customId:`hu:bulk:cancel:${token}`,label:'Back',style:'secondary',emoji:'↩️'}
  ])};
}

export function bulkTourSelectionPayload({token,action,options,page=0,pages=1,selectedCount=0,backId}){
  const select=new StringSelectMenuBuilder().setCustomId(`hu:bulkselect:${token}`).setPlaceholder('Select houses from this page…').addOptions(options.map(o=>({label:safe(o.label),value:safe(o.value,100),description:o.description?safe(o.description,100):undefined,default:!!o.default}))).setMinValues(0).setMaxValues(Math.min(25,Math.max(1,options.length)));
  const nav=[];
  if(pages>1){
    nav.push({customId:`hu:bulkselect:prev:${token}`,label:'Previous',style:'secondary',disabled:page<=0});
    nav.push({customId:`hu:bulkselect:next:${token}`,label:'Next',style:'secondary',disabled:page>=pages-1});
  }
  nav.push({customId:`hu:bulkselect:done:${token}`,label:action==='create'?'Create Tour':'Add to Tour',style:'success',disabled:selectedCount<1});
  nav.push({customId:backId,label:'Back',style:'secondary',emoji:'↩️'});
  return {embeds:[embed(action==='create'?'🗺️ Select Houses for New Tour':'🗺️ Select Houses to Add',`Select houses across as many pages as needed. Your selections are preserved while paging.

**${selectedCount} house${selectedCount===1?'':'s'} selected.**`)],components:[new ActionRowBuilder().addComponents(select),...buttonRows(nav)]};
}

export function bulkTourCreateModal(token){ return new ModalBuilder().setCustomId(`hu:modal:bulk:create:${token}`).setTitle('Create New Tour From Results').addComponents(textField('name','Tour name',{required:true,maxLength:200}),textField('description','Description (optional)',{paragraph:true,maxLength:2000,placeholder:'Describe the theme and highlights visitors can expect on this tour.'})); }
export function bulkTourVisibilityPayload(token,{allowPublic=true,allowGlobal=true}={}){ return {embeds:[embed('Create New Tour From Results — Visibility','Choose who should be able to find and reuse the saved tour. Eligible houses are determined automatically by visibility.')],components:buttonRows([
  {customId:`hu:bulk:visibility:global:${token}`,label:'Global Tour',style:'secondary',disabled:!allowGlobal},
  {customId:`hu:bulk:visibility:server:${token}`,label:'Server Tour',style:allowPublic?'primary':'secondary',disabled:!allowPublic},
  {customId:`hu:bulk:visibility:personal:${token}`,label:'Private Tour',style:allowPublic?'secondary':'primary'},
  {customId:`hu:bulk:return:${token}`,label:'Back',style:'secondary',emoji:'↩️'}
])}; }

export function cleanDestinationEmbed(r,{showDetails=false}={}){
  const e=embed(titleWithPlayerCap(destinationLabel(r),r),r.description||'Saved ESO housing destination.')
    .addFields({name:'👤 Owner',value:`@${String(r.eso_owner||'').replace(/^@/,'')}`,inline:true});
  const submitterName=String(r.created_by_display_name||r.created_by_global_name||'').trim();
  const submitterId=String(r.created_by||'').trim();
  const submittedBy=submitterId?(submitterName?`${submitterName} • <@${submitterId}>`:`<@${submitterId}>`):(submitterName||'Unknown');
  const visibility=r.scope==='global'?'Global':['server','public','guild'].includes(r.scope)?'Server':'Private';
  const tourNames=(Array.isArray(r.associated_tours)?r.associated_tours:[]).map(t=>String(t?.name||'').replace(/\s+/g,' ').trim()).filter(Boolean);
  let associatedTours='None';
  if(tourNames.length){
    const lines=[];
    for(let index=0;index<tourNames.length;index++){
      const line=`• ${tourNames[index]}`,remaining=tourNames.length-index-1,suffix=remaining?`\n…and ${remaining} more`:'';
      if([...lines,line].join('\n').length+suffix.length>1024)break;
      lines.push(line);
    }
    const remaining=tourNames.length-lines.length;
    associatedTours=`${lines.join('\n')}${remaining?`\n…and ${remaining} more`:''}`.slice(0,1024);
  }
  e.addFields(
    {name:'📝 Submitted By',value:submittedBy,inline:true},
    {name:'👁️ Visibility',value:visibility,inline:true},
    {name:'🗺️ Associated Tours',value:associatedTours}
  );
  addCleanHouseMetadata(e,r,{showDetails});
  const tags=parseTags(r.tags); if(tags.length)e.addFields({name:'🏷️ Tags',value:tags.map(t=>`\`${t}\``).join(' ').slice(0,1024)});
  e.addFields(
    {name:'💬 Comments',value:`${Number(r.comment_count||0)} comment${Number(r.comment_count||0)===1?'':'s'}`,inline:true},
    {name:'🔗 Jump in ESO',value:`\`\`\`text\n${buildJumpScript(r.eso_owner,r.house_id)}\n\`\`\``},
    {name:'🏚️ Unfurnished Preview',value:`\`\`\`text\n${buildHousePreviewScript(r.house_id)}\n\`\`\``},
    {name:'🔗 Housing Link',value:`\`\`\`text\n${buildHousingLink(r.eso_owner,r.house_id)}\n\`\`\``}
  );
  return e;
}
function houseNavigationSpecs(navigation,showDetails=false){
  if(!navigation||!Number.isInteger(navigation.index)||!Number.isInteger(navigation.total)||navigation.total<2)return [];
  const {stateId,index,total}=navigation;
  const detailState=showDetails?':show':'';
  return [
    {customId:`hu:house-nav:${stateId}:${Math.max(0,index-1)}${detailState}`,label:'Previous House',style:'secondary',emoji:'⬅️',disabled:index<=0},
    {customId:`hu:house-nav:${stateId}:${Math.min(total-1,index+1)}${detailState}`,label:'Next House',style:'secondary',emoji:'➡️',disabled:index>=total-1}
  ];
}
export function houseStateSpecs(r,sourceKind='saved'){
 const state=r.personal_state||{},favorite=Number(state.is_favorite)===1,visit=state.visit_state||'none';
 const context=r.personal_token||`${sourceKind}-${sourceKind==='official'?r.house_id:r.id}`;
 const specs=[{customId:`hu:mark:favorite:${context}`,label:favorite?'Unfavorite':'Favorite',style:favorite?'success':'secondary'}];
 if(sourceKind!=='official')specs.push({customId:`hu:comment:quick:${context}`,label:'Add Comment',style:'primary'});
 return specs;
}

export function destinationMenuPayload(r,{canEdit=false,backId='hu:home',showDetails=false,navigation=null,surpriseToken=null}={}){
  const scope=r.scope==='personal'?'personal':r.scope==='global'?'global':'guild';
  const detailBack=encodeURIComponent(backId);
  const commentsBackId=navigation&&navigation.stateId&&Number.isInteger(navigation.index)
    ?`hu:house-nav:${navigation.stateId}:${navigation.index}${showDetails?':show':''}`
    :showDetails?`hu:details:${scope}:${Number(r.id)}:show:${encodeURIComponent(backId)}`
      :`hu:context:view:${scope}:${Number(r.id)}:${encodeURIComponent(backId)}`;
  const primarySpecs=[
    ...registrationTourActions({savedHouseId:r.id,status:r.status}),
    {customId:`hu:pass:house:share:${Number(r.id)}`,label:'Share House',style:'success'},
    {customId:`hu:details:${scope}:${Number(r.id)}:${showDetails?'hide':'show'}:${detailBack}`,label:showDetails?'Hide Details':'More Details',style:'primary',emoji:showDetails?'🔼':'🔽'},
    {customId:`hu:comments:${r.scope}:${Number(r.id)}:${encodeURIComponent(commentsBackId)}`,label:'Comments',style:'primary',emoji:'💬'},
    {customId:`hu:gallery:${Number(r.id)}:0`,label:'Screenshots',style:'secondary',emoji:'🖼️'},
    {customId:`hu:report:houseid:${Number(r.id)}`,label:'Report a Problem',style:'secondary'},
    ...houseStateSpecs(r).filter(spec=>spec.customId.startsWith('hu:mark:favorite:'))
  ];
  const editSpecs=canEdit?[{customId:`hu:manage:${r.personal_token}`,label:'Manage House',style:'secondary'}]:[];
  const navSpecs=houseNavigationSpecs(navigation,showDetails);
  const backSpecs=[...(surpriseToken?[{customId:`hu:surprise:again:${surpriseToken}`,label:'Another Random House',style:'success',emoji:'🎲'}]:[]),{customId:backId,label:/^hu:(results:|advanced:)/.test(backId)?'Back to Results':backId==='hu:my'?'My Address Book':backId==='hu:home'?'Main Menu':'Back',style:'secondary',emoji:'↩️'}];
  const houseEmbed=cleanDestinationEmbed(r,{showDetails});
  const embeds=r.discordCover?[new EmbedBuilder().setColor(houseEmbed.data.color??0x5865f2).setImage('attachment://house-cover.webp'),houseEmbed]:[houseEmbed];
  if(r.coverNeedsPermission)houseEmbed.setFooter({text:'Screenshots are available. HearthBound needs Attach Files permission to show them in Discord.'});
  const payload={attachments:[],files:r.discordCover?[r.discordCover]:[],embeds,components:buttonRows([...primarySpecs,...editSpecs,...navSpecs,...backSpecs])};
  return r.discordCover?unifiedCard(payload):payload;
}

export function officialHousePayload(house,backId='hu:find',showDetails=false,navigation=null,surpriseToken=null){
  const e=embed(titleWithPlayerCap(`🏠 ${house.name}`,house),'Non-Player Home — official ESO housing information.')
    .addFields(
      {name:'🆔 House ID',value:String(house.house_id),inline:true},
      {name:'📝 Submitted By',value:'ESO Housing Catalog',inline:true},
      {name:'👁️ Visibility',value:'Non-Player Home',inline:true},
      {name:'🗺️ Associated Tours',value:'None'}
    );
  addCleanHouseMetadata(e,house,{showDetails});
  const specs=[
    {customId:`hu:details:official:${Number(house.house_id)}:${showDetails?'hide':'show'}:${encodeURIComponent(backId)}`,label:showDetails?'Hide Details':'More Details',style:'primary',emoji:showDetails?'🔼':'🔽'},
    ...houseStateSpecs(house,'official')
  ];
  const navSpecs=houseNavigationSpecs(navigation,showDetails);
  const backSpecs=[...(surpriseToken?[{customId:`hu:surprise:again:${surpriseToken}`,label:'Another Random House',style:'success',emoji:'🎲'}]:[]),{customId:backId,label:'Back',style:'secondary',emoji:'↩️'}];
  return {embeds:[e],components:[...buttonRows(specs),...buttonRows(navSpecs,2),...buttonRows(backSpecs)]};
}

export function personalActionsPayload({token,target,state,backId='hu:home'}={}){
  const favorite=Number(state?.is_favorite)===1,visit=state?.visit_state||'none',context=String(token||`${target?.kind||'house'}-${target?.id||0}`);
  const returnId=token?`hu:personal:return:${context}`:backId;
  return {embeds:[embed('⭐ Personal Actions','Only you can see these preferences. They do not change the house visibility or grant access to it.')],components:buttonRows([
    {customId:`hu:personal:act:favorite:${context}`,label:favorite?'Remove Favorite':'Add Favorite',style:favorite?'secondary':'success'},
    {customId:returnId,label:'Return to House',style:'primary'}
  ])};
}

export function savedSearchNameModal(token,{name='',mode='create'}={}){
  return new ModalBuilder().setCustomId(`hu:modal:savedsearch:${mode}:${token}`).setTitle(mode==='rename'?'Rename Saved Search':'Save House Search').addComponents(
    textField('name','Search name',{value:name,required:true,maxLength:80})
  );
}

export function savedSearchListPayload({rows=[],page=0,pages=1}={}){
  const safePage=Math.max(0,Number(page)||0),options=rows.map(row=>({label:safe(row.name,100),value:String(row.id),description:'Open saved search'}));
  const components=[];
  if(options.length)components.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`hu:savedsearch:list:${safePage}`).setPlaceholder('Choose a saved search…').addOptions(options)));
  components.push(...buttonRows([
    {customId:`hu:savedsearch:page:${safePage-1}`,label:'Previous',style:'secondary',disabled:safePage<=0},
    {customId:`hu:savedsearch:page:${safePage+1}`,label:'Next',style:'secondary',disabled:safePage>=pages-1},
    {customId:'hu:my',label:'Back',style:'secondary',emoji:'↩️'}
  ]));
  return {embeds:[embed('🔎 Saved Searches',rows.length?`Choose a reusable house search. Page ${safePage+1} of ${Math.max(1,pages)}.`:'You have no saved searches yet. Run a filtered house search and choose **Save Search**.')],components};
}

export function savedSearchDetailPayload({row,filters,summary='',hasCurrentSearch=false}={}){
  const description=[`**${safe(row?.name||'Saved Search',256)}**`,summary||'Review or run this saved search.'].join('\n\n');
  return {embeds:[embed('🔎 Saved Search',description)],components:buttonRows([
    {customId:`hu:savedsearch:run:${Number(row.id)}`,label:'Run Search',style:'success'},
    {customId:`hu:savedsearch:rename:${Number(row.id)}`,label:'Rename',style:'secondary'},
    ...(hasCurrentSearch?[{customId:`hu:savedsearch:replacecurrent:${Number(row.id)}`,label:'Replace Filters with Current Search',style:'primary'}]:[]),
    {customId:`hu:savedsearch:delete:${Number(row.id)}`,label:'Delete',style:'danger'},
    {customId:'hu:my:searches',label:'Back',style:'secondary',emoji:'↩️'}
  ])};
}

export function savedSearchConflictPayload({token,name}={}){
  return {embeds:[embed('Saved Search Already Exists',`A saved search named **${safe(name,80)}** already exists. Replace its filters with the current search?`)],components:buttonRows([
    {customId:`hu:savedsearch:replace:${token}`,label:'Replace Existing',style:'danger'},
    {customId:`hu:savedsearch:cancel:${token}`,label:'Cancel',style:'secondary'}
  ])};
}

export function savedSearchDeleteConfirmPayload({id,name}={}){
  return {embeds:[embed('Delete Saved Search?',`Delete **${safe(name,80)}**? This does not delete any houses.`)],components:buttonRows([
    {customId:`hu:savedsearch:deleteconfirm:${Number(id)}`,label:'Delete',style:'danger'},
    {customId:`hu:savedsearch:detail:${Number(id)}`,label:'Cancel',style:'secondary'}
  ])};
}

function textField(id,label,{value='',required=false,paragraph=false,placeholder=null,maxLength=null}={}){
  const input=new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(paragraph?TextInputStyle.Paragraph:TextInputStyle.Short).setRequired(required);
  if(value!==null&&value!==undefined&&String(value)!=='')input.setValue(safe(value,maxLength||4000));
  if(placeholder)input.setPlaceholder(safe(placeholder,100));
  if(maxLength)input.setMaxLength(maxLength);
  return new ActionRowBuilder().addComponents(input);
}
function advancedOptions(values,page=0,{selected=[],multiple=false,prefix=''}={}){
  const pageSize=23,totalPages=Math.max(1,Math.ceil(values.length/pageSize)),safePage=Math.max(0,Math.min(page,totalPages-1));
  const slice=values.slice(safePage*pageSize,safePage*pageSize+pageSize);
  const options=slice.map(v=>({label:safe(`${prefix} ${v}`.trim()),value:safe(v,100),default:selected.includes(v)}));
  if(safePage>0)options.unshift({label:'← Previous options',value:'__prev__'});
  if(safePage<totalPages-1)options.push({label:'More options →',value:'__next__'});
  if(!options.length)options.push({label:'No values available',value:'__none__'});
  return {options,page:safePage,pages:totalPages,maxValues:multiple?Math.min(25,Math.max(1,options.filter(o=>!o.value.startsWith('__')).length)):1};
}
function advancedDirectRemovalSpecs(token,filters={}){
  const groups=[
    ['tags','Tag'],['zones','Zone'],['styles','Style'],['classifications','Classification'],['houseTypes','Type']
  ];
  const all=[];
  for(const [field,label] of groups){
    const values=Array.isArray(filters[field])?filters[field]:[];
    values.forEach((value,index)=>all.push({customId:`hu:advanced:x:${token}:${field}:${index}`,label:safe(`× ${label}: ${value}`,80),style:'secondary'}));
  }
  if(all.length<=5)return all;
  return [...all.slice(0,4),{customId:`hu:advanced:manage:${token}`,label:'Manage Selected…',style:'secondary'}];
}
export function advancedSearchPayload({token,filters={},title='Search Houses',backId='hu:home',includeNonPlayer=false}){
  const name=String(filters.name||'').trim();
  const owner=String(filters.owner||'').trim().replace(/^@/,'');
  const tags=Array.isArray(filters.tags)?filters.tags:[];
  const zones=Array.isArray(filters.zones)?filters.zones:[];
  const stylesSelected=Array.isArray(filters.styles)?filters.styles:[];
  const classifications=Array.isArray(filters.classifications)?filters.classifications:[];
  const houseTypes=Array.isArray(filters.houseTypes)?filters.houseTypes:[];
  const list=v=>v.length?v.map(x=>`\`${x}\``).join(', '):'Any';
  const summary=[
    `**House / Nickname:** ${name?`\`${name}\``:'Any'}`,
    `**Owner:** ${owner?`@${owner}`:'Any'}`,
    `**Tags / Themes:** ${list(tags)}`,
    `**Zone:** ${list(zones)}`,
    `**Architectural Style:** ${list(stylesSelected)}`,
    `**ESO Classification:** ${list(classifications)}`,
    `**Size / Type:** ${list(houseTypes)}`,
    `**Tour Membership:** ${filters.notOnPublicTours?'Not on a Server or Global Tour':'Any'}`,
    `**Non-Player Homes:** ${includeNonPlayer?'Included':'Excluded'}`
  ].join('\n');
  const e=embed(`🔎 ${title}`,`Choose filters, then press **Search**. House and owner text can match part of a name. Different filter categories narrow the results together; multiple values in one category match any selected value.\n\n${summary}\n\nPress **Search** with no filters to return all eligible houses.`);
  const removals=advancedDirectRemovalSpecs(token,filters);
  const components=[];
  if(removals.length)components.push(new ActionRowBuilder().addComponents(...removals.map(button)));
  components.push(
    new ActionRowBuilder().addComponents(
      button({customId:`hu:advanced:name:${token}`,label:'House / Nickname',style:'primary',emoji:'🔤'}),
      button({customId:`hu:advanced:owner:${token}`,label:'Owner',style:'secondary',emoji:'👤'})
    ),
    new ActionRowBuilder().addComponents(
      button({customId:`hu:advanced:tagsopen:${token}`,label:'Tags / Themes',style:'secondary',emoji:'🏷️'}),
      button({customId:`hu:advanced:zoneopen:${token}`,label:'Zone',style:'secondary',emoji:'📍'}),
      button({customId:`hu:advanced:styleopen:${token}`,label:'Architectural Style',style:'secondary',emoji:'🏛️'}),
      button({customId:`hu:advanced:classificationopen:${token}`,label:'ESO Classification',style:'secondary',emoji:'👑'}),
      button({customId:`hu:advanced:houseTypeopen:${token}`,label:'Size / Type',style:'secondary',emoji:'🏠'})
    ),
    new ActionRowBuilder().addComponents(
      button({customId:`hu:advanced:search:${token}`,label:'Search',style:'success',emoji:'🔎'}),
      button({customId:`hu:advanced:clear:${token}`,label:'Clear Filters',style:'secondary'}),
      button({customId:`hu:advanced:nonplayer:${token}`,label:`Non-Player Homes: ${includeNonPlayer?'Included':'Excluded'}`,style:includeNonPlayer?'success':'secondary',emoji:includeNonPlayer?'✅':'🚫',disabled:!!filters.notOnPublicTours}),
      button({customId:backId,label:'Back',style:'secondary',emoji:'↩️'})
    )
  );
  return {embeds:[e],components};
}

export function advancedAttributePayload({token,field,values=[],selected=[],page=0}){
  const config={
    tags:{title:'Tags / Themes',prefix:'Tag:'},
    zone:{title:'Zone',prefix:'Zone:'},
    style:{title:'Architectural Style',prefix:'Style:'},
    classification:{title:'ESO Classification',prefix:'Classification:'},
    houseType:{title:'Size / Type',prefix:'Type:'}
  }[field];
  if(!config)return advancedSearchPayload({token});
  const pageData=advancedOptions(values,page,{selected,multiple:true,prefix:config.prefix});
  const select=new StringSelectMenuBuilder().setCustomId(`hu:advanced:${field}:${token}`).setPlaceholder(`${config.title} — Select one or more`).addOptions(pageData.options).setMinValues(0).setMaxValues(pageData.maxValues);
  return {embeds:[embed(`🎛️ ${config.title}`,`Choose one or more ${config.title.toLowerCase()} values. Multiple values in this category are OR matches. Your selections are applied to the populated house list.`)],components:[new ActionRowBuilder().addComponents(select),...buttonRows([{customId:`hu:advanced:results:${token}`,label:'Back to Results',style:'secondary',emoji:'↩️'}])]};
}

export function advancedManagePayload(token,filters={}){
  const groups=[['tags','Tag / Theme'],['zones','Zone'],['styles','Architectural Style'],['classifications','ESO Classification'],['houseTypes','Size / Type']];
  const active=groups.filter(([k])=>Array.isArray(filters[k])&&filters[k].length);
  const e=embed('🧹 Manage Search Selections',active.length?'Choose a category to remove one or more selected values.':'There are no selected attribute values to remove.');
  const buttons=active.map(([k,label])=>({customId:`hu:advanced:remove:${token}:${k}:0`,label:`Remove ${label}`,style:'secondary'}));
  buttons.push({customId:`hu:advanced:open:${token}`,label:'Back',style:'secondary',emoji:'↩️'});
  return {embeds:[e],components:buttonRows(buttons,3)};
}

export function advancedRemovePayload({token,field,values=[],page=0}){
  const labels={tags:'Tag / Theme',zones:'Zone',styles:'Architectural Style',classifications:'ESO Classification',houseTypes:'Size / Type'};
  const pageSize=25,pages=Math.max(1,Math.ceil(values.length/pageSize)),safePage=Math.max(0,Math.min(page,pages-1));
  const slice=values.slice(safePage*pageSize,safePage*pageSize+pageSize);
  const e=embed(`🗑️ Remove ${labels[field]||'Selections'}`,slice.length?'Select one or more values to remove.':'There are no selected values in this category.');
  const components=[];
  if(slice.length){
    const select=new StringSelectMenuBuilder().setCustomId(`hu:advanced-remove:${field}:${token}:${safePage}`).setPlaceholder('Select values to remove…').addOptions(slice.map(v=>({label:safe(field==='owners'?`@${String(v).replace(/^@/,'')}`:v),value:safe(v,100)}))).setMinValues(1).setMaxValues(Math.min(25,slice.length));
    components.push(new ActionRowBuilder().addComponents(select));
  }
  const nav=[];
  if(pages>1){
    nav.push({customId:`hu:advanced:remove:${token}:${field}:${Math.max(0,safePage-1)}`,label:'Previous',style:'secondary',disabled:safePage<=0});
    nav.push({customId:`hu:advanced:remove:${token}:${field}:${Math.min(pages-1,safePage+1)}`,label:'Next',style:'secondary',disabled:safePage>=pages-1});
  }
  nav.push({customId:`hu:advanced:manage:${token}`,label:'Back',style:'secondary',emoji:'↩️'});
  components.push(...buttonRows(nav));
  return {embeds:[e],components};
}

export function advancedTextModal(token,kind,value=''){
  const isName=kind==='name';
  return new ModalBuilder().setCustomId(`hu:modal:advanced:${kind}:${token}`).setTitle(isName?'House / Nickname Filter':'Owner Filter').addComponents(
    textField('query',isName?'House name or nickname':'ESO owner',{value,required:false,placeholder:isName?'Type part of a house name or nickname':'e.g. malderyn'})
  );
}
export function searchFiltersModal(token,filters={},includeNonPlayer=false){
  const selectedVisibilities=Array.isArray(filters.visibilities)&&filters.visibilities.length
    ?filters.visibilities:['global','public','private'];
  const labeledText=(id,label,value,placeholder)=>{
    const input=new TextInputBuilder().setCustomId(id).setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder(placeholder);
    if(String(value||''))input.setValue(safe(value,4000));
    return new LabelBuilder().setLabel(label).setDescription('Optional partial match').setTextInputComponent(input);
  };
  const visibility=new StringSelectMenuBuilder().setCustomId('visibilities').setRequired(false).setMinValues(0).setMaxValues(3).addOptions(
    {label:'Global',value:'global',description:'Global houses in the same ESO environment.',default:selectedVisibilities.includes('global')},
    {label:'Server',value:'public',description:'Houses saved by this Discord server.',default:selectedVisibilities.includes('public')},
    {label:'Private',value:'private',description:'Your own Private houses.',default:selectedVisibilities.includes('private')}
  );
  const nonPlayer=new StringSelectMenuBuilder().setCustomId('nonplayer').setRequired(true).setMinValues(1).setMaxValues(1).addOptions(
    {label:'Exclude Non-Player Homes',value:'exclude',default:!includeNonPlayer},
    {label:'Include Non-Player Homes',value:'include',default:includeNonPlayer}
  );
  const attribute=new StringSelectMenuBuilder().setCustomId('attribute').setRequired(false).setMinValues(0).setMaxValues(2).setPlaceholder('Optional — choose tour status and/or a category').addOptions(
    {label:'Not on a Server or Global Tour',value:'notOnPublicTours',description:'Exclude houses already on an applicable shared tour.',default:!!filters.notOnPublicTours},
    {label:'Tags / Themes',value:'tags',description:'Choose one or more tags or themes.'},
    {label:'Zone',value:'zone',description:'Choose one or more ESO zones.'},
    {label:'Architectural Style',value:'style',description:'Choose one or more architectural styles.'},
    {label:'ESO Classification',value:'classification',description:'Choose one or more ESO classifications.'},
    {label:'Size / Type',value:'houseType',description:'Choose one or more house sizes or types.'}
  );
  return new ModalBuilder().setCustomId(`hu:modal:advanced:filters:${token}`).setTitle('Filter Homes').addLabelComponents(
    labeledText('name','House name or nickname',filters.name,'Type part of a house name or nickname'),
    labeledText('owner','ESO owner',String(filters.owner||'').replace(/^@/,''),'e.g. malderyn'),
    new LabelBuilder().setLabel('House Visibility').setDescription('Select any combination, in Global, Server, Private order.').setStringSelectMenuComponent(visibility),
    new LabelBuilder().setLabel('Non-Player Homes').setStringSelectMenuComponent(nonPlayer),
    new LabelBuilder().setLabel('Additional Filters').setDescription('Choose tour status and optionally one attribute category.').setStringSelectMenuComponent(attribute)
  );
}
export function registrationTypePayload({backId='hu:home',defaultVisibility='public'}={}){
  const select=new StringSelectMenuBuilder().setCustomId('hu:register:type').setPlaceholder('Choose Global, Server, or Private').setMinValues(1).setMaxValues(1).addOptions(
    {label:'Global',value:'global',description:'Share with Discord servers in the same ESO environment.'},
    {label:'Server',value:'public',default:defaultVisibility==='public',description:"Register this house in this Discord server's directory."},
    {label:'Private',value:'private',default:defaultVisibility==='private',description:'Save this house privately for your Discord account.'}
  );
  return {embeds:[embed('➕ Register New House','Visibility defaults to **Server** when shared registration is allowed. Continue with the selected default, or choose another visibility below.')],components:[new ActionRowBuilder().addComponents(select),...buttonRows([{customId:`hu:register:continue:${defaultVisibility}`,label:`Continue with ${defaultVisibility==='public'?'Server':'Private'}`,style:'primary'},{customId:backId,label:'Back',style:'secondary',emoji:'↩️'}])]};
}
const visibilityName=value=>value==='global'?'Global':value==='public'||value==='server'?'Server':'Private';
const registrationStatusName=value=>value==='pending'?'Awaiting Housing Moderator approval':'Active';

export function destinationInputModal(scope,{destination='',owner=''}={}){
  return new ModalBuilder().setCustomId(`hu:modal:register-destination:${scope}`).setTitle('Register New House').addComponents(
    textField('destination','House Name, ID, Housing Link, or Jump Command',{required:true,value:destination,placeholder:'Grand Psijic Villa, 62, @owner, 62, or an ESO link'}),
    textField('owner','ESO owner (optional with link or command)',{required:false,value:owner,placeholder:'e.g. HouseOwner'})
  );
}

export function registrationDestinationReviewPayload(draft){
  const house=draft.house||{},conflict=draft.ownerConflict;
  const entries=[...(draft.existingEntries||[])].sort((a,b)=>({global:0,public:1,server:1,private:2,personal:2}[a.scope]-({global:0,public:1,server:1,private:2,personal:2}[b.scope])));
  const ownerLine=conflict?`**Owner in pasted destination:** @${conflict.parsed}\n**Owner entered separately:** @${conflict.entered}`:`**ESO owner:** @${draft.esoOwner}`;
  const matches=entries.length?entries.map(row=>`• **${visibilityName(row.scope)}:** ${row.display_name||row.nickname||house.name||house.house_name}`).join('\n'):'• None';
  const description=[
    `**Official house:** ${house.name||house.house_name||'Unknown'}`,
    `**House ID:** **${house.house_id}**`,ownerLine,
    `**Requested visibility:** ${visibilityName(draft.visibility)}`,
    `**Expected status:** ${registrationStatusName(draft.expectedStatus)}`,
    `**Existing entries — Global, Server, Private**\n${matches}`
  ].join('\n');
  const actions=conflict?[
    {customId:`hu:register-owner:parsed:${draft.id}`,label:`Use @${conflict.parsed}`,style:'primary'},
    {customId:`hu:register-owner:entered:${draft.id}`,label:`Use @${conflict.entered}`,style:'secondary'},
    {customId:`hu:register-cancel:${draft.id}`,label:'Cancel',style:'danger'}
  ]:entries.length?(()=>{
    const first=entries[0],scope=first.scope==='private'||first.scope==='personal'?'personal':first.scope==='global'?'global':'guild';
    const normalized=value=>value==='server'?'public':value==='personal'?'private':value;
    const exact=entries.some(row=>normalized(row.scope)===normalized(draft.visibility));
    const ownPrivate=entries.some(row=>normalized(row.scope)==='private');
    return [
      {customId:`hu:context:view:${scope}:${first.id}:hu%3Aregister`,label:'View Existing',style:'primary'},
      ...(!ownPrivate&&draft.visibility!=='private'?[{customId:`hu:register-privatecopy:${draft.id}`,label:'Save Separate Private Copy',style:'success'}]:[]),
      {customId:`hu:register-report:${draft.id}:${first.id}`,label:'Request an Update',style:'secondary'},
      ...(!exact?[{customId:`hu:register-metadata:${draft.id}`,label:'Continue with New Visibility',style:'primary'}]:[]),
      {customId:`hu:register-cancel:${draft.id}`,label:'Cancel',style:'secondary'}
    ];
  })():[
    {customId:`hu:register-metadata:${draft.id}`,label:'Continue',style:'primary'},
    {customId:`hu:register-cancel:${draft.id}`,label:'Cancel',style:'secondary'}
  ];
  return {embeds:[embed('Review House Destination',description)],components:buttonRows(actions)};
}

export function registrationMetadataModal(draftId,metadata={}){
  return new ModalBuilder().setCustomId(`hu:modal:register-metadata:${draftId}`).setTitle('House Details').addComponents(
    textField('nickname','Nickname (optional)',{value:metadata.nickname||'',maxLength:255}),
    textField('description','Description or notes (optional)',{value:metadata.description||'',paragraph:true,maxLength:4000,placeholder:'What makes this house special? Tell visitors what to look for.'}),
    textField('tags','Tags / themes, comma separated',{placeholder:'Help others find it: garden, cozy, roleplay, puzzle',value:Array.isArray(metadata.tags)?metadata.tags.join(', '):(metadata.tags||''),placeholder:'Help others find it: garden, cozy, roleplay, puzzle'})
  );
}

export function registrationFinalReviewPayload(draft){
  const house=draft.house||{},tags=parseTags(draft.tags);
  const description=[
    `**ESO owner:** @${draft.esoOwner}`,
    `**Official house:** ${house.name||house.house_name||'Unknown'} (#${house.house_id})`,
    `**Visibility:** ${visibilityName(draft.visibility)}`,
    `**Nickname:** ${draft.nickname||'None'}`,
    `**Description:** ${draft.description||'None'}`,
    `**Tags:** ${tags.length?tags.join(', '):'None'}`,
    `**Registration status:** ${registrationStatusName(draft.expectedStatus)}`
  ].join('\n');
  return {embeds:[embed('Confirm House Registration',description)],components:buttonRows([
    {customId:`hu:register-save:${draft.id}`,label:'Save House',style:'success'},
    {customId:`hu:register-metadata:${draft.id}`,label:'Edit Details',style:'primary'},
    {customId:`hu:register-cancel:${draft.id}`,label:'Cancel',style:'secondary'}
  ])};
}
function houseFormFields(scope,r=null){
  const personal=scope==='personal'||scope==='private';
  return [
    textField('house','Official house name, partial name, or ID',{value:r?.house_name||r?.house_id||'',required:true,placeholder:'e.g. Still, Stillwaters Retreat, or 80'}),
    textField('owner','ESO owner',{value:r?.eso_owner||'',required:true,placeholder:'e.g. malderyn'}),
    textField('nickname','Nickname (optional)',{value:personal?r?.nickname:r?.display_name,maxLength:255}),
    textField('description',personal?'Private notes (optional)':'Description (optional)',{value:personal?r?.notes:r?.description,paragraph:true,maxLength:4000,placeholder:'What makes this house special? Add highlights or a note about why you saved it.'}),
    textField('tags','Tags / themes, comma separated',{placeholder:'Help others find it: garden, cozy, roleplay, puzzle',value:(()=>{try{return JSON.parse(r?.tags||'[]').join(', ')}catch{return ''}})()})
  ];
}
export function registerHouseFormModal(scope,fields=null){
  return new ModalBuilder().setCustomId(`hu:modal:register:${scope}`).setTitle('Register New House').addComponents(...houseFormFields(scope,fields));
}
export function houseEditModal(scope,r,backId=''){
  const personal=scope==='personal';
  const context=backId?`:${encodeURIComponent(backId)}`:'';
  return new ModalBuilder().setCustomId(`hu:modal:${scope}:edit:${r.id}${context}`).setTitle(`Edit ${personal?'Private':scope==='global'?'Global':'Server'} House`).addComponents(...houseFormFields(scope,r));
}


export function pendingReviewPayload(r){
  const e=embed('📝 Review Pending House',`**${destinationLabel(r)}**\nOwner: @${String(r.eso_owner||'').replace(/^@/,'')}\nOfficial house: ${r.house_name||'Unknown'}${r.description?`\n\n${r.description}`:''}`);
  const tags=parseTags(r.tags); if(tags.length)e.addFields({name:'Tags',value:tags.map(t=>`\`${t}\``).join(' ').slice(0,1024)});
  return {embeds:[e],components:buttonRows([{customId:`hu:pending:approve:${r.id}`,label:'Approve',style:'success'},{customId:`hu:pending:deny:${r.id}`,label:'Deny',style:'danger'},{customId:'hu:guild:pending',label:'Back',style:'secondary',emoji:'↩️'}])};
}

export function confirmPayload({title,description,confirmId,cancelId}){ return {embeds:[embed(title,description)],components:buttonRows([{customId:confirmId,label:'Confirm',style:'danger'},{customId:cancelId,label:'Cancel',style:'secondary'}])}; }

export function commentsPayload({label,owner,rows,scope,id,backId}){
  const body=rows.length?rows.map(c=>`**${c.author_name}** — <t:${unixTime(c.created_at)}:f>\n${c.comment_text}`).join('\n\n'):'No comments have been added yet.';
  const disclosure='Comments apply to this ESO destination and may also appear through other saved entries for the same house.';
  const e=embed(`💬 Comments — ${label}`,`Owner: @${String(owner||'').replace(/^@/,'')}\n\n${disclosure}\n\n${body}`.slice(0,4096));
  return {embeds:[e],components:buttonRows([{customId:`hu:comment:add:${scope}:${id}:${encodeURIComponent(backId)}`,label:'Add Comment',style:'primary'},{customId:backId,label:'Back',style:'secondary',emoji:'↩️'}])};
}
export function commentModal(scope,id,backId,label){ return new ModalBuilder().setCustomId(`hu:modal:comment:${scope}:${id}:${encodeURIComponent(backId)}`).setTitle(`Comment — ${safe(label,30)}`).addComponents(textField('comment','Comment',{required:true,paragraph:true,maxLength:1000,placeholder:'Share a favorite detail, a thank-you, or what you enjoyed about this house.'})); }

export function tourDetailPayload(tour,stops,canEdit=false,navigation=null,featuredSource=null){
  const visibility=tour.scope==='global'?'Global Tour':tour.scope==='server'?'Server Tour':'Private Tour';
  const e=embed(`🗺️ ${tour.name}`,tour.description||'Housing tour').addFields(
    {name:'Stops',value:String(stops.length),inline:true},
    {name:'Tour Visibility',value:visibility,inline:true}
  );
  if(stops.length)e.addFields({name:'Route',value:tourRouteSummary(stops)});
  let specs=tourDetailButtonSpecs(canEdit).map(spec=>({...spec,customId:spec.customId==='hu:tour:start'?`hu:tour:start:${tour.id}${navigation?`:${navigation.stateId}:${navigation.index}`:featuredSource?`:featured:${featuredSource}`:''}`:spec.customId==='hu:tour:manage'?`hu:tour:manage:${tour.id}`:spec.customId==='hu:tour:add'?`hu:tour:add:${tour.id}`:featuredSource&&spec.customId==='hu:tours'?(featuredSource==='admin'?'hu:admin:featured':featuredSource==='home'?'hu:featured':'hu:tours:featured'):spec.customId,label:featuredSource&&spec.customId==='hu:tours'?'Back to Featured':spec.label}));
  specs.splice(1,0,{customId:`hu:pass:tour:share:${tour.id}`,label:'Share Tour Pass',style:'success'});
  specs.splice(2,0,{customId:`hu:report:tourid:${tour.id}`,label:'Report a Problem',style:'secondary'});
  if(navigation){
    specs=specs.filter(spec=>spec.customId!=='hu:tours');
    specs.push(
      {customId:`hu:tourbrowse:prev:${navigation.stateId}:${Math.max(0,navigation.index-1)}`,label:'Previous Tour',style:'secondary',emoji:'⬅️',disabled:navigation.index<=0},
      {customId:`hu:tourbrowse:next:${navigation.stateId}:${Math.min(navigation.total-1,navigation.index+1)}`,label:'Next Tour',style:'primary',emoji:'➡️',disabled:navigation.index>=navigation.total-1},
      {customId:`hu:picker:return:${navigation.stateId}`,label:'Back to Tours',style:'secondary',emoji:'↩️'}
    );
  }
  return {embeds:[e],components:buttonRows(specs)};
}
export function tourManagePayload(tour,stops){
  const lines=tourRouteLines(stops);
  const kept=[]; let used=0;
  for(const line of lines){
    const next=used+line.length+(kept.length?1:0);
    if(next>980)break;
    kept.push(line); used=next;
  }
  const omitted=Math.max(0,lines.length-kept.length);
  const route=kept.length?`${kept.join('\n')}${omitted?`\n… plus ${omitted} more stop${omitted===1?'':'s'}`:''}`:'No stops yet.';
  const e=embed(`✏️ Edit Tour — ${tour.name}`,`${stops.length} stop${stops.length===1?'':'s'}\n\nAdd houses, arrange stops, then update the tour details. Changes are applied when you confirm each action.`)
    .addFields({name:'Current Tour Route',value:route});
  const specs=tourManageButtonSpecs().map(spec=>({...spec,customId:spec.customId==='hu:tours'?`hu:tour:view:${tour.id}`:`${spec.customId}:${tour.id}`}));
  return {embeds:[e],components:[...buttonRows(specs.slice(0,3)),...buttonRows(specs.slice(3,5)),...buttonRows(specs.slice(5))]};
}
export function tourStartChoicePayload(tour,canRunSharedPublicTour,readiness=null,{canManage=false,backId=null}={}){
  const canShared=tour.scope==='personal'||canRunSharedPublicTour;
  const blocking=readiness?.blocking||[],advisories=readiness?.advisories||[],stops=readiness?.stopCount??readiness?.eligibleStops?.length;
  const state=blocking.length?'⛔ Blocked':advisories.length?'⚠️ Warning':'✅ Ready to start';
  const description=[
    `**Preflight:** ${state}`,
    `**Tour visibility:** ${tour.scope==='global'?'Global':tour.scope==='server'?'Server':'Private'}`,
    tour.eso_server?`**ESO environment:** ${esoServerLabel(tour.eso_server)}`:null,
    stops!=null?`**Route:** ${stops} stop${stops===1?'':'s'}`:null,
    blocking.length?`**Problems that must be fixed**\n${blocking.map(issue=>`• ${issue.message}`).join('\n')}`:null,
    advisories.length?`**Warnings**\n${advisories.map(issue=>`• ${issue.message}`).join('\n')}`:null,
    !blocking.length?'Choose how you want to follow this tour.\n\n**Self Paced** is visible only to you and never changes the shared tour.\n**Shared** posts the tour in this channel for the group.':'Starting is unavailable until the blocking problems are corrected.'
  ].filter(Boolean).join('\n\n');
  const actions=blocking.length?[]:[
    {customId:`hu:tour:startprivate:${tour.id}`,label:'Self Paced',style:'primary'},
    {customId:`hu:tour:startpublic:${tour.id}`,label:'Shared',style:'success',disabled:!canShared}
  ];
  if(blocking.length&&canManage)actions.push({customId:`hu:tour:manage:${tour.id}`,label:'Manage Tour',style:'primary'});
  actions.push({customId:backId||`hu:tour:view:${tour.id}`,label:'Back',style:'secondary',emoji:'↩️'});
  return {embeds:[embed(`▶️ Tour Preflight — ${tour.name}`,description)],components:buttonRows(actions)};
}
export function tourCreateModal(){ return new ModalBuilder().setCustomId('hu:modal:tour:create').setTitle('Create Housing Tour').addComponents(textField('name','Tour name',{required:true,maxLength:200}),textField('description','Description (optional)',{paragraph:true,maxLength:2000,placeholder:'Describe the theme and highlights visitors can expect on this tour.'})); }
export function tourEventCreateModal(tour){ return new ModalBuilder().setCustomId(`hu:modal:tour:event:${tour.id}`).setTitle('Schedule Tour Event').addComponents(textField('title','Event title',{required:true,maxLength:EVENT_TITLE_MAX}),textField('date','Date (YYYY-MM-DD)',{required:true}),textField('time','Local time (e.g. 7:30 PM)',{required:true}),textField('description','Description (optional)',{paragraph:true,maxLength:EVENT_DESCRIPTION_MAX})); }
export function tourEventEditModal(event, timezone = null, returnPage = 1){
  let date='',time='';
  if(timezone&&event?.start_at){
    try{
      const zone=normalizeTimezone(timezone),parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'numeric',minute:'2-digit',hour12:true}).formatToParts(new Date(event.start_at));
      const values=Object.fromEntries(parts.filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
      date=`${values.year}-${values.month}-${values.day}`; time=`${values.hour}:${values.minute} ${values.dayPeriod}`;
    }catch{/* keep fields blank if a stale event timestamp/timezone cannot be formatted */}
  }
  return new ModalBuilder().setCustomId(`hu:modal:event:edit:${event.id}${Number(returnPage)>1?`:${Math.floor(Number(returnPage))}`:''}`).setTitle('Edit Tour Event').addComponents(textField('title','Event title',{value:event.title,required:true,maxLength:EVENT_TITLE_MAX}),textField('date','Date (YYYY-MM-DD)',{value:date,required:true}),textField('time','Local time (e.g. 7:30 PM)',{value:time,required:true}),textField('description','Description (optional)',{value:event.description||'',paragraph:true,maxLength:EVENT_DESCRIPTION_MAX}));
}
export function featuredExpiryModal(targetKind,targetId){ return new ModalBuilder().setCustomId(`hu:modal:featured:expiry:${targetKind}:${targetId}`).setTitle('Featured Expiration').addComponents(textField('days','Days until expiration (0 = never)',{required:true})); }
export function tourVisibilityPayload(token){ return {embeds:[embed('Create Tour — Tour Visibility','Who should be able to find and start this saved tour? Server is the default choice.\n\n**Global Tour:** Discord servers using the same ESO environment; Global Tours can contain Global Houses only.\n**Server Tour:** this Discord server; it can contain Global and Server Houses.\n**Private Tour:** only you; it can contain any house visible to you in this ESO environment.')],components:buttonRows([
  {customId:`hu:tour:createvis:global:${token}`,label:'Global Tour',style:'secondary'},
  {customId:`hu:tour:createvis:server:${token}`,label:'Server Tour',style:'primary'},
  {customId:`hu:tour:createvis:personal:${token}`,label:'Private Tour',style:'secondary'},
  {customId:'hu:tours',label:'Cancel',style:'secondary'}
])}; }
export function tourEditDetailsPayload(tour){
  const visibility=tour.scope==='global'?'Global Tour':tour.scope==='server'?'Server Tour':'Private Tour';
  const e=embed(`✏️ Edit Tour Details — ${tour.name}`,`**Tour Visibility:** ${visibility}\n\nChange the name, description, or visibility below. Eligible houses are selected automatically from the tour visibility.`);
  return {embeds:[e],components:buttonRows([
    {customId:`hu:tour:edittext:${tour.id}`,label:'Edit Name / Description',style:'primary'},
    {customId:`hu:tour:editvisibility:${tour.id}`,label:'Change Tour Visibility',style:'secondary'},
    {customId:`hu:tour:manage:${tour.id}`,label:'Back',style:'secondary',emoji:'↩️'}
  ],2)};
}
export function tourEditVisibilityPayload(tour){ return {embeds:[embed(`Tour Visibility — ${tour.name}`,'Choose who can find/start/edit the saved tour. Private tours remain creator-only even if launched in Shared mode.')],components:buttonRows([
  {customId:`hu:tour:setvisibility:global:${tour.id}`,label:'Global Tour',style:'secondary'},
  {customId:`hu:tour:setvisibility:server:${tour.id}`,label:'Server Tour',style:'success'},
  {customId:`hu:tour:setvisibility:personal:${tour.id}`,label:'Private Tour',style:'primary'},
  {customId:`hu:tour:edit:${tour.id}`,label:'Back',style:'secondary',emoji:'↩️'}
])}; }
export function tourEditModal(tour){ return new ModalBuilder().setCustomId(`hu:modal:tour:edit:${tour.id}`).setTitle('Edit Tour Details').addComponents(textField('name','Tour name',{value:tour.name,required:true,maxLength:200}),textField('description','Description',{value:tour.description||'',paragraph:true,maxLength:2000})); }
export function stopEditModal(tourId,stop){ const defaultTitle=stop.custom_title||stop.registration_nickname||stop.house_name||stop.title||''; return new ModalBuilder().setCustomId(`hu:modal:stop:edit:${tourId}:${stop.id}`).setTitle(`Edit Stop ${stop.position}`).addComponents(textField('title','Tour-specific stop title',{value:defaultTitle,maxLength:180}),textField('description','Tour notes / description',{value:stop.notes||'',paragraph:true,maxLength:1000})); }
export function reorderPayload(tour,stop,total){ return {embeds:[embed(`↕️ Reorder — ${tour.name}`,`Selected stop **${stop.position} of ${total}**: ${destinationLabel(stop)} ${houseCapacityText(stop)}\n\nMove it with the buttons below.`)],components:buttonRows([{customId:`hu:reorder:up:${tour.id}:${stop.id}`,label:'Move Up',style:'secondary',disabled:stop.position<=1},{customId:`hu:reorder:down:${tour.id}:${stop.id}`,label:'Move Down',style:'secondary',disabled:stop.position>=total},{customId:`hu:reorder:first:${tour.id}:${stop.id}`,label:'Move to Beginning',style:'primary',disabled:stop.position<=1},{customId:`hu:reorder:last:${tour.id}:${stop.id}`,label:'Move to End',style:'primary',disabled:stop.position>=total},{customId:`hu:tour:manage:${tour.id}`,label:'Done',style:'success'}])}; }

export function adminPayload(settings,{adminInterface=adminInterfaceMode(),isOwner=false}={}){
  const roles=ids=>ids.length?ids.map(id=>`<@&${id}>`).join(', '):'Not configured';
  const policyLabels={open:'Open',approval:'Approval',roles:'Roles'};
  const policyHelp={
    open:'Anyone may submit a Server Directory house and it becomes active immediately.',
    approval:'Anyone may submit. Housing Trusted Submitter members and Housing Moderators are trusted submitters; other submissions wait for Housing Moderator review.',
    roles:'Only Housing Trusted Submitters and Housing Moderators may submit Server Directory houses.'
  };
  const e=embed('⚙️ Housing Administration',`These settings apply only to this Discord server. Each selector explains what it controls.\n\n**ESO environment:** ${esoServerLabel(settings.eso_server)}`).addFields(
    {name:'📋 Registration Policy',value:`**${policyLabels[settings.registration_policy]||settings.registration_policy}**
${policyHelp[settings.registration_policy]||''}`},
    {name:'🛡️ Housing Moderator Role',value:`${roles(settings.staff_role_ids)}
Controls Administration access and Housing Moderator-only actions. If configured, only members with this role can see or use Administration.`},
    {name:'👥 Other Roles',value:`**Housing Tours Role:** ${roles(settings.tour_role_ids||[])}
May start and control Shared Server Tours. This role does not grant Housing Moderator privileges.`}
  );
  if(settings.registration_policy!=='open')e.addFields(
    {name:'🔑 Housing Trusted Submitter Role',value:`${roles(settings.registration_role_ids)}
Trusted submitter role used by the selected registration policy. It does not grant Housing Moderator Administration access.`}
  );
  e.addFields({name:'🛠️ Administration tools',value:adminInterface==='web'?'Use the tool menu below for Discord-only administration. Health, audit, maintenance, pending review, problem reports, and export are available in the companion web console.':'Use the tool menu below for health, audit, maintenance, moderation, exports, and review queues. Channel restrictions are under Administration Settings.'});

  const policy=new StringSelectMenuBuilder().setCustomId('hu:admin:policy').setPlaceholder('Choose registration policy…').addOptions(
    {label:'Open — everyone is auto-approved',value:'open',description:'Anyone may submit and entries become active immediately.',default:settings.registration_policy==='open'},
    {label:'Approval — ordinary submissions wait for review',value:'approval',description:'Housing Trusted Submitters and Housing Moderators are trusted submitters.',default:settings.registration_policy==='approval'},
    {label:'Roles — Trusted Submitter / Housing Moderator only',value:'roles',description:'Only the configured roles may submit houses.',default:settings.registration_policy==='roles'}
  );
  const moderator=new RoleSelectMenuBuilder().setCustomId('hu:admin:moderator').setPlaceholder('Choose Housing Moderator roles, or clear for bootstrap access…').setMinValues(0).setMaxValues(25);
  if(settings.staff_role_ids?.length)moderator.setDefaultRoles(...settings.staff_role_ids.slice(0,25));
  const channel=new ChannelSelectMenuBuilder().setCustomId('hu:admin:channel').setPlaceholder('Choose a channel, or clear to allow any channel…').setChannelTypes(ChannelType.GuildText).setMinValues(0).setMaxValues(1);
  if(settings.bot_channel_id)channel.setDefaultChannels(settings.bot_channel_id);
  const components=[new ActionRowBuilder().addComponents(policy),new ActionRowBuilder().addComponents(moderator)];
  if(settings.registration_policy!=='open'){
    const trusted=new RoleSelectMenuBuilder().setCustomId('hu:admin:trusted').setPlaceholder('Choose Housing Trusted Submitter roles, or clear for none…').setMinValues(0).setMaxValues(25);
    if(settings.registration_role_ids?.length)trusted.setDefaultRoles(...settings.registration_role_ids.slice(0,25));
    components.push(new ActionRowBuilder().addComponents(trusted));
  }
  const tools=new StringSelectMenuBuilder().setCustomId('hu:admin:tool').setPlaceholder('Choose an administration tool…').addOptions([
    ['environment','Change ESO Environment','Preview and apply an environment change.'],
    ['legacy-tours','Legacy Tours','Recover older Server or Global tours.'],
    ['featured','Featured Housing','Manage featured houses and tours.'],
    ['health','Health','View operational and integrity checks.'],
    ['audit','Audit Log','Review administrative changes.'],
    ['export','Export Data','Download guild-scoped data.'],
    ['maintenance','Maintenance','Review stale houses and duplicates.'],
    ['reports','Problem Reports','Review submitted problem reports.'],
    ['passes','Share Passes','Review share-pass activity.'],
    ['otherroles','Other Roles','Configure Housing Tours roles.'],
    ['pending','Pending Review','Review pending house submissions.'],
    ['servermod','Server Moderator Requests','Review requests and manage Server grants.'],
    ['globalmod','Global Moderation','Manage Global Moderator access.'],
    ...(isOwner?[['catalog','Add Official House','Bot owners: add a newly released official house.'],['catalog_edit','Edit Official House','Bot owners: correct existing official catalog details.']]:[])
  ].filter(([value])=>adminInterface!=='web'||!['health','audit','export','maintenance','pending','reports'].includes(value)).map(([value,label,description])=>({value,label,description})));
  components.push(new ActionRowBuilder().addComponents(tools),...buttonRows([{customId:'hu:admin:settings',label:'Administration Settings',style:'primary'},{customId:'hu:help',label:'Support & Access',style:'secondary'},{customId:'hu:home',label:'Back',style:'secondary',emoji:'↩️'}]));
  return {embeds:[e],components};
}

export function adminSettingsPayload(settings){
  const channel=new ChannelSelectMenuBuilder().setCustomId('hu:admin:channel').setPlaceholder('Choose a channel, or clear to allow any channel…').setChannelTypes(ChannelType.GuildText).setMinValues(0).setMaxValues(1);
  if(settings.bot_channel_id)channel.setDefaultChannels(settings.bot_channel_id);
  const e=embed('⚙️ Administration Settings',`These settings apply only to this Discord server.\n\n**HearthBound channel:** ${settings.bot_channel_id?`<#${settings.bot_channel_id}>`:'Any channel'}\nOptionally limit normal HearthBound commands and menu interactions to one channel.`);
  return {embeds:[e],components:[new ActionRowBuilder().addComponents(channel),...buttonRows([{customId:'hu:admin',label:'Back to Administration',style:'secondary',emoji:'↩️'}])]};
}

export function legacyTourRecoveryPayload(preview){
  const visibility=preview.visibility==='global'?'Global':'Server',creator=preview.creator_id?`<@${preview.creator_id}>`:'Unknown';
  const warning=preview.counts.retainedStops===0?'\n\n⚠️ This tour will be empty after recovery. You can add eligible houses afterward.':'';
  const e=embed('🧭 Recover Legacy Tour',`Assign **${preview.name}** to **${esoServerLabel(preview.esoServer)}**? Nothing changes until you confirm.${warning}`).addFields(
    {name:'Tour',value:`**Visibility:** ${visibility}\n**Creator:** ${creator}`},
    {name:'Route Preview',value:`Current stops: **${preview.counts.stops}**\nRetained: **${preview.counts.retainedStops}**\nRemoved: **${preview.counts.removedStops}**`},
    {name:'Why stops are removed',value:'A stop is removed when its house is Unassigned, belongs to another ESO environment, or is not allowed by this tour’s visibility.'}
  );
  return {embeds:[e],components:buttonRows([{customId:`hu:legacy:${preview.tourId}:${preview.fingerprint}`,label:'Confirm Recovery',style:'danger'},{customId:'hu:admin:legacy-tours',label:'Back',style:'secondary',emoji:'↩️'}])};
}


export function adminOtherRolesPayload(settings){
  const roles=ids=>ids?.length?ids.map(id=>`<@&${id}>`).join(', '):'Not configured';
  const e=embed('👥 Housing Administration — Other Roles',`Configure optional roles with narrowly scoped HearthBound permissions.

**Housing Tours Role:** ${roles(settings.tour_role_ids||[])}
Members with this role, or the Housing Moderator role, may start and control Shared Server Tours. It grants no Administration, Server Directory moderation, pending-review, trusted-submitter, or channel-recovery privileges.`);
  const tours=new RoleSelectMenuBuilder().setCustomId('hu:admin:tours').setPlaceholder('Choose Housing Tours roles, or clear for none…').setMinValues(0).setMaxValues(25);
  if(settings.tour_role_ids?.length)tours.setDefaultRoles(...settings.tour_role_ids.slice(0,25));
  return {embeds:[e],components:[new ActionRowBuilder().addComponents(tours),...buttonRows([{customId:'hu:admin',label:'Back',style:'secondary',emoji:'↩️'}])]};
}

export function adminHealthPayload(snapshot){
  const channel=snapshot.channel?.id?(snapshot.channel.missing?`Missing or unavailable (${snapshot.channel.id})`:`${snapshot.channel.name||snapshot.channel.id}`):'Any channel';
  const e=embed('🩺 HearthBound Health', 'Operational checks and counts for this Discord server. Secrets and connection credentials are never displayed.').addFields(
    {name:'Backend',value:`${snapshot.backend} — ${snapshot.connection}`,inline:true},{name:'Version',value:String(snapshot.version),inline:true},{name:'HearthBound Channel',value:channel,inline:true},{name:'Registration Policy',value:String(snapshot.registrationPolicy),inline:true},
    {name:'Configured Roles',value:`Moderator: ${snapshot.roleCounts.moderator}\nTrusted Submitter: ${snapshot.roleCounts.trusted}\nHousing Tours: ${snapshot.roleCounts.tours}`,inline:true},
    {name:'Queues',value:`Pending submissions: ${snapshot.pendingSubmissions}\nGlobal Moderator requests: ${snapshot.globalModeratorRequests}\nOpen reports: ${snapshot.openReports}`,inline:true},
    {name:'Share Passes',value:`House active/revoked: ${snapshot.passes.house.active}/${snapshot.passes.house.revoked}\nTour active/revoked: ${snapshot.passes.tour.active}/${snapshot.passes.tour.revoked}`},
    {name:'Reminder Health',value:`Stale claims: ${snapshot.reminderHealth?.staleClaims||0}\nFailed deliveries: ${snapshot.reminderHealth?.failedDeliveries||0}`},
    {name:'Data Integrity',value:`Orphan stops: ${snapshot.integrity?.orphanStops||0}\nDuplicate destinations: ${snapshot.integrity?.duplicateDestinations||0}\nEnvironment mismatches: ${snapshot.integrity?.mismatchedHouses||0}\nStale progress: ${snapshot.integrity?.staleProgress||0}`},
    {name:'House Maintenance',value:`Stale houses: ${snapshot.freshness?.staleHouses||0}\nDuplicate groups: ${snapshot.duplicates?.duplicateGroups||0}`},
    {name:'Last Migration',value:snapshot.lastMigration.version?`Schema ${snapshot.lastMigration.version}${snapshot.lastMigration.appliedAt?` — ${snapshot.lastMigration.appliedAt}`:''}`:'No migration record'},{name:'Backup Reminder',value:snapshot.backupReminder}
  );
  return {embeds:[e],components:buttonRows([{customId:'hu:admin:reports',label:'Problem Reports',style:'primary'},{customId:'hu:admin:passes',label:'Share Passes',style:'secondary'},{customId:'hu:admin',label:'Back',style:'secondary'}])};
}
export function auditLogPayload({ rows = [], page = 1, hasNext = false } = {}) {
  const description = rows.length ? rows.map(row => {
    const actor = row.actor_display_name || row.actor_global_name || row.actor_id || 'System';
    const target = row.entity_name || row.entity_id || 'record';
    const when = row.created_at ? ` · ${row.created_at}` : '';
    return `**${row.action}** — ${target}\n${actor}${when}`;
  }).join('\n\n') : 'No audit entries are available for this page.';
  return { embeds: [embed('📜 HearthBound Audit Log', description)], components: buttonRows([
    { customId: `hu:admin:audit:prev:${Math.max(1, Number(page) - 1)}`, label: 'Previous', style: 'secondary', disabled: Number(page) <= 1 },
    { customId: `hu:admin:audit:next:${Number(page) + 1}`, label: 'Next', style: 'secondary', disabled: !hasNext },
    { customId: 'hu:admin:health', label: 'Health', style: 'primary' },
    { customId: 'hu:admin', label: 'Back', style: 'secondary', emoji: '↩️' }
  ]) };
}
export function maintenancePayload({ stale = [], duplicates = [] } = {}) {
  const e = embed('🧰 HearthBound Maintenance', 'Review house freshness and duplicate-entry groups. Verification updates catalog freshness; merging archives only an exact-context duplicate and preserves comments and route history.');
  if (stale.length) e.addFields({ name: 'Stale houses', value: stale.slice(0, 10).map(row => `**${row.name || 'Unknown house'}** (#${row.house_id}) — ${row.last_verified || 'never verified'}`).join('\n') });
  if (duplicates.length) e.addFields({ name: 'Duplicate groups', value: duplicates.slice(0, 10).map(row => `Destination ${row.destination_id}: ${row.saved_house_ids || 'review required'}`).join('\n') });
  if (!stale.length && !duplicates.length) e.setDescription('No stale houses or duplicate groups were found for this server and ESO environment.');
  const components = [];
  if (stale.length) components.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('hu:admin:maintenance:verify').setPlaceholder('Choose a house to mark verified').addOptions(stale.slice(0, 25).map(row => ({ label: `${row.name || 'Unknown house'} (#${row.house_id})`.slice(0, 100), value: String(row.house_id), description: row.last_verified ? `Last verified ${row.last_verified}` : 'Never verified' })))));
  if (duplicates.length) components.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('hu:admin:maintenance:merge').setPlaceholder('Choose a duplicate group to merge').addOptions(duplicates.slice(0, 25).map(row => { const ids = String(row.saved_house_ids || '').split(',').map(Number).filter(Boolean); return { label: `Destination ${row.destination_id} (${ids.length} entries)`.slice(0, 100), value: `${ids[0]}:${ids[1]}`, description: 'Keep the first entry and archive the duplicate' }; }))));
  return { embeds: [e], components: [...components, ...buttonRows([{ customId: 'hu:admin:health', label: 'Health', style: 'primary' }, { customId: 'hu:admin', label: 'Back', style: 'secondary', emoji: '↩️' }])] };
}
export function adminSharePassesPayload(passes={house:{active:0,revoked:0},tour:{active:0,revoked:0}}){
  const e=embed('🔗 Share Pass Activity','Aggregate revocable-pass counts for this server’s Administration view. Individual private destinations are not exposed here.').addFields({name:'House Share Passes',value:`Active: ${passes.house?.active||0}\nRevoked: ${passes.house?.revoked||0}`,inline:true},{name:'Tour Share Passes',value:`Active: ${passes.tour?.active||0}\nRevoked: ${passes.tour?.revoked||0}`,inline:true});
  return {embeds:[e],components:buttonRows([{customId:'hu:admin:health',label:'Health',style:'primary'},{customId:'hu:admin',label:'Back',style:'secondary'}])};
}

export function houseScopePayload(r,backId='hu:find'){ const current=r.scope==='personal'?'Private':r.scope==='server'?'Server':'Global'; return {embeds:[embed(`🔄 Change House Visibility — ${destinationLabel(r)}`,`Current visibility: **${current}**\n\nChanging visibility keeps the same house record, comments, and metadata. If the house is no longer eligible for a tour, HearthBound will show the affected tours before making the change.`)],components:buttonRows([{customId:`hu:scope:set:global:${r.id}:${encodeURIComponent(backId)}`,label:'Global',style:'secondary'},{customId:`hu:scope:set:public:${r.id}:${encodeURIComponent(backId)}`,label:'Server',style:'success'},{customId:`hu:scope:set:private:${r.id}:${encodeURIComponent(backId)}`,label:'Private',style:'primary'},{customId:backId,label:'Back',style:'secondary',emoji:'↩️'}])}; }
export function globalModeratorRequestModal(){ return new ModalBuilder().setCustomId('hu:modal:globalmod:request').setTitle('Request Global Moderator Access').addComponents(textField('reason','Why do you need Global moderation here?',{required:true,paragraph:true,maxLength:1000})); }
export function globalModeratorPayload({isApprover=false,isModerator=false,isOwner=false,pendingCount=0,esoServer=null,grants=[],requests=[]}={}){ const environment=esoServerLabel(esoServer),grantLabels=grants.map(r=>r.eso_server?esoServerLabel(r.eso_server):'Legacy grant (environment not assigned)'),requestLabels=requests.map(r=>esoServerLabel(r.eso_server)); const details=[`**Current ESO environment:** ${environment}`,`**Your ${environment} moderator status:** ${isModerator?'Active':'Not active'}`,`**Active environments:** ${isOwner?'All ESO environments (bot owner)':grantLabels.length?grantLabels.join(', '):'None'}`,`**Pending requests:** ${requestLabels.length?requestLabels.join(', '):'None'}`]; return {embeds:[embed('🌐 Global Housing Moderation',details.join('\n'))],components:buttonRows([{customId:'hu:globalmod:request',label:`Request ${environment} Access`,style:'primary',disabled:isModerator||requests.some(r=>r.eso_server===esoServer)},...(isApprover?[{customId:'hu:globalmod:requests',label:`Review Requests (${pendingCount})`,style:'success'},{customId:'hu:globalmod:list',label:'Manage Global Moderators',style:'secondary'}]:[]),{customId:'hu:help',label:'Back to Help',style:'secondary',emoji:'↩️'}])}; }


export function globalModeratorRequestsPayload(rows=[],page=1){
  if(!rows.length)return {embeds:[embed('🌐 Pending Global Moderator Requests','There are no pending Global Moderator requests.')],components:buttonRows([{customId:'hu:globalmod',label:'Back',style:'secondary',emoji:'↩️'}])};
  const current=Math.max(1,Math.min(Math.ceil(rows.length/25),Number(page)||1));
  const select=new StringSelectMenuBuilder().setCustomId(`hu:globalmod:requestpick:${current}`).setPlaceholder('Choose a request to review…').addOptions(rows.slice((current-1)*25,current*25).map(r=>({label:`${esoServerLabel(r.eso_server)} — ${r.review_user_name||r.discord_display_name||r.discord_global_name||`User ${r.discord_user_id}`}`.slice(0,100),description:safe(`${r.review_guild_name||r.origin_guild_name||r.origin_guild_id} • ${r.reason}`,100),value:String(r.id)})));
  return {embeds:[embed('🌐 Pending Global Moderator Requests',`**${rows.length}** pending request${rows.length===1?'':'s'}. Page ${current} of ${Math.ceil(rows.length/25)}. Choose one to review.`)],components:[new ActionRowBuilder().addComponents(select),...buttonRows([{customId:`hu:globalmod:requests:${current-1}`,label:'Previous',style:'secondary',disabled:current===1},{customId:`hu:globalmod:requests:${current+1}`,label:'Next',style:'secondary',disabled:current*25>=rows.length},{customId:'hu:globalmod',label:'Back',style:'secondary',emoji:'↩️'}])]};
}
export function globalModeratorRequestReviewPayload(r,page=1){return {embeds:[embed('🌐 Review Global Moderator Request',`**User:** ${r.review_user_name||r.discord_display_name||r.discord_global_name||`<@${r.discord_user_id}>`} (<@${r.discord_user_id}>)\n**ESO environment:** ${esoServerLabel(r.eso_server)}\n**Originating server:** ${r.review_guild_name||r.origin_guild_name||r.origin_guild_id||'Unknown'}\n\n**Reason**\n${r.reason}`)],components:buttonRows([{customId:`hu:globalmod:approve:${r.id}:${page}`,label:'Approve',style:'success'},{customId:`hu:globalmod:deny:${r.id}:${page}`,label:'Deny',style:'danger'},{customId:`hu:globalmod:requests:${page}`,label:'Back',style:'secondary',emoji:'↩️'}])};}
export function globalModeratorListPayload(rows=[],page=1){
  if(!rows.length)return {embeds:[embed('🌐 Global Housing Moderators','No Global Housing Moderators are currently configured.')],components:buttonRows([{customId:'hu:globalmod',label:'Back',style:'secondary',emoji:'↩️'}])};
  const current=Math.max(1,Math.min(Math.ceil(rows.length/25),Number(page)||1));
  const select=new StringSelectMenuBuilder().setCustomId(`hu:globalmod:revokepick:${current}`).setPlaceholder('Choose a moderator grant to revoke…').addOptions(rows.slice((current-1)*25,current*25).map(r=>({label:`${r.eso_server?esoServerLabel(r.eso_server):'Legacy grant'} — ${r.discord_global_name||`User ${r.discord_user_id}`}`.slice(0,100),value:`${r.eso_server||'legacy'}:${r.discord_user_id}`,description:r.approved_by?`Approved by ${r.approved_by}`:undefined})));
  return {embeds:[embed('🌐 Global Housing Moderators',`**${rows.length}** active environment-specific Global Moderator grant${rows.length===1?'':'s'}. Page ${current} of ${Math.ceil(rows.length/25)}. Revoking one environment does not affect the others.`)],components:[new ActionRowBuilder().addComponents(select),...buttonRows([{customId:`hu:globalmod:list:${current-1}`,label:'Previous',style:'secondary',disabled:current===1},{customId:`hu:globalmod:list:${current+1}`,label:'Next',style:'secondary',disabled:current*25>=rows.length},{customId:'hu:globalmod',label:'Back',style:'secondary',emoji:'↩️'}])]};
}
export function globalModeratorRevokePayload(r,page=1){return confirmPayload({title:'Revoke Global Moderator?',description:`Remove **${r.eso_server?esoServerLabel(r.eso_server):'Legacy (unassigned)'}** Global Housing Moderator access from <@${r.discord_user_id}>? Other environment grants will remain active.`,confirmId:`hu:globalmod:revoke:${r.eso_server||'legacy'}:${r.discord_user_id}:${page}`,cancelId:`hu:globalmod:list:${page}`});}

export function registrationNotFoundPayload({retryId,backId='hu:register'}){return {embeds:[embed('No matching ESO house found','Try an official house name, part of its name, or a valid house ID.')],components:buttonRows([{customId:retryId,label:'Try Again',style:'primary'},{customId:backId,label:'Back',style:'secondary'}])};}
