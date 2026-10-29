import {TourCoverService} from '../services/tour-cover-service.js';
import {withTourCover} from './tour-cover.js';
import {houseCapacityText} from '../utils/house-capacity.js';
import {messageControls,mapMessageControls,refreshComponentCommentCount,messageFlagBits} from './message-layout.js';
import {HouseImageService} from '../services/house-image-service.js';
import {commentReaderPayload,commentPageSize,commentPageModal} from './comment-reader.js';
import {eligibleTourHouses,filterTourHouses,tourHouseFiltersModal,tourStopNotesModal,tourHouseAddedPayload} from './tour-house-builder.js';
import {UsageActivityService} from '../services/usage-activity-service.js';
import {createCatalogMenu} from './catalog-menu.js';
import {HouseCatalogService} from '../services/house-catalog-service.js';
import {ContentPolicyService} from '../services/content-policy-service.js';
import {updateOrderedSelection,moveSelection,selectionRows} from '../utils/ordered-selection.js';
import {tourSelectionReviewPayload} from './tour-selection-ui.js';
import {isRetiredEventInteraction,retiredEventPayload} from './retired-events.js';
import {isServerModeratorAction,handleServerModeratorAction} from './server-moderator-menu.js';
import { isTourShareDestination, handleTourShareDestination } from './tour-share-destination.js';
import crypto from 'node:crypto';
import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { one } from '../db/database.js';
import { HouseService } from '../services/house-service.js';
import { RegistrationService } from '../services/registration-service.js';
import { BookmarkService } from '../services/bookmark-service.js';
import { VisitService } from '../services/visit-service.js';
import { TourService, tourSourceForRows } from '../services/tour-service.js';
import { GuildService } from '../services/guild-service.js';
import { GuildEnvironmentService } from '../services/guild-environment-service.js';
import { CommentService } from '../services/comment-service.js';
import { SavedHouseService } from '../services/saved-house-service.js';
import { TourSessionService, sharedTourStillVisible } from '../services/tour-session-service.js';
import { GlobalModeratorService } from '../services/global-moderator-service.js';
import { MyAddressBookService } from '../services/my-addressbook-service.js';
import { RegistrationDraftService } from '../services/registration-draft-service.js';
import { SharePassService } from '../services/share-pass-service.js';
import { HouseCopyService } from '../services/house-copy-service.js';
import { TourCopyService } from '../services/tour-copy-service.js';
import { HousingReportService } from '../services/housing-report-service.js';
import { OnboardingService } from '../services/onboarding-service.js';
import { AdminHealthService } from '../services/admin-health-service.js';
import { AccessContextService } from '../services/access-context-service.js';
import { UserHouseStateService } from '../services/user-house-state-service.js';
import { SavedHouseSearchService } from '../services/saved-house-search-service.js';
import { HouseDiscoveryService } from '../services/house-discovery-service.js';
import { houseTarget, houseTargetKey } from '../utils/house-target.js';
import { hasMeaningfulSearchFilters, normalizeSearchFilters } from '../utils/search-filters.js';
import { destinationLabel } from '../utils/labels.js';
import { registrationScopeFromType } from '../utils/registration-routing.js';
import { resolveDestinationInput } from '../utils/destination-input.js';
import { normalizeAccount, parseTags as parseTagInput } from '../utils/eso.js';
import { esoServerLabel } from '../utils/eso-server.js';
import { tourEmbed, tourButtons } from '../utils/render.js';
import {
  pickerPageModal, houseStateSpecs, homePayload as renderHomePayload, myAddressBookPayload, myPendingPayload, registrationTypePayload, toursPayload, helpPayload,
  pickerPayload, destinationMenuPayload as rawDestinationMenuPayload, officialHousePayload, buttonRows,
  advancedSearchPayload, advancedAttributePayload, advancedManagePayload, advancedRemovePayload, advancedTextModal, searchFiltersModal, houseEditModal, registerHouseFormModal, confirmPayload,
  registrationNotFoundPayload, destinationInputModal, registrationDestinationReviewPayload, registrationMetadataModal, registrationFinalReviewPayload,
  commentModal, tourDetailPayload, tourManagePayload, tourStartChoicePayload,
  tourCreateModal, tourVisibilityPayload, featuredExpiryModal, tourEditDetailsPayload,
  tourEditVisibilityPayload, tourEditModal, stopEditModal, reorderPayload, adminPayload as renderAdminPayload, adminOtherRolesPayload, pendingReviewPayload,
  bulkTourChoicePayload, bulkTourSelectionPayload, bulkTourCreateModal, bulkTourVisibilityPayload,
  houseScopePayload, personalActionsPayload, savedSearchNameModal, savedSearchListPayload, savedSearchDetailPayload, savedSearchConflictPayload, savedSearchDeleteConfirmPayload, globalModeratorRequestModal, globalModeratorPayload, environmentSetupPayload, environmentChangeChoicePayload, environmentChangePreviewPayload, legacyAssignmentPayload,
  globalModeratorRequestsPayload, globalModeratorRequestReviewPayload, globalModeratorListPayload, globalModeratorRevokePayload, adminHealthPayload, adminSharePassesPayload, auditLogPayload, maintenancePayload, legacyTourRecoveryPayload, adminSettingsPayload
} from './housing-ui.js';
import { houseCopyMetadataModal, houseCopyVisibilityPayload, sharedPrivateHousePayload, tourCopyPreviewPayload, tourPassInformationPayload, tourShareCardPayload } from './share-pass-ui.js';
import { reportExplanationModal, reportProblemTypePayload, reportQueuePayload, reportReviewPayload } from './report-ui.js';
import { featuredPayload, progressCompletedPayload, progressHistoryPayload, progressPayload, progressRunPayload } from './engagement-ui.js';
import { TourProgressService } from '../services/tour-progress-service.js';
import { FeaturedContentService } from '../services/featured-content-service.js';
import { TourReadinessService } from '../services/tour-readiness-service.js';
import { AuditLogService } from '../services/audit-log-service.js';
import { DataExportService } from '../services/data-export-service.js';
import { HouseMaintenanceService } from '../services/house-maintenance-service.js';
import { adminInterfaceMode } from '../config/admin-interface.js';

const PAGE=25;
const parseTags=v=>{try{return Array.isArray(v)?v:JSON.parse(v||'[]')}catch{return []}};
const token=()=>crypto.randomBytes(7).toString('hex');
const text=v=>String(v??'').trim();

export function canControlTourSession(session,userId){
  return !!session&&String(session.started_by)===String(userId);
}



export function searchCriteria(searchType,filters={}){
  filters=normalizeSearchFilters(filters);
  const labels={query:'Query',name:'House / Nickname',nickname:'Nickname',owner:'Owner',tag:'Tag / Theme',tags:'Tags / Themes',zone:'Zone',zones:'Zone',houseType:'Size / Type',houseTypes:'Size / Type',classification:'ESO Classification',classifications:'ESO Classification',style:'Architectural Style',styles:'Architectural Style',visibilities:'House Visibility',notOnPublicTours:'Tour Membership'};
  const visibilityLabels={global:'Global',public:'Server',private:'Private'};
  const lines=[];
  for(const [key,label] of Object.entries(labels)){
    const raw=filters[key];
    const vals=Array.isArray(raw)?raw.map(text).filter(Boolean):null;
    const value=key==='notOnPublicTours'?(raw?'Not on a Server or Global Tour':''):vals?(key==='visibilities'?['global','public','private'].filter(v=>vals.includes(v)).map(v=>visibilityLabels[v]).join(', '):key==='owners'?vals.map(v=>`@${v.replace(/^@/,'')}`).join(', '):vals.join(', ')):text(raw);
    if(value)lines.push(`• **${label}:** ${key==='owner'&&!value.startsWith('@')?'@':''}${value}`);
  }
  return `**Search Type:** ${searchType}
**Parameters:**
${lines.length?lines.join('\n'):'• No parameters supplied'}`;
}

export function createHousingMenu(db,{discovery=new HouseDiscoveryService(),adminInterface=adminInterfaceMode(),images=null,tourCovers=null}={}){
  const houses=new HouseService(db),regs=new RegistrationService(db),bookmarks=new BookmarkService(db),visits=new VisitService(db),tours=new TourService(db),guilds=new GuildService(db),environments=new GuildEnvironmentService(db,{guildService:guilds}),comments=new CommentService(db),saved=new SavedHouseService(db),sessions=new TourSessionService(db),globalMods=new GlobalModeratorService(db),myAddressBook=new MyAddressBookService(db);
  const progress=new TourProgressService(db),featured=new FeaturedContentService(db),readiness=new TourReadinessService(db),auditLog=new AuditLogService(db),dataExport=new DataExportService(db),maintenance=new HouseMaintenanceService(db);
  const usage=new UsageActivityService(db);
  const recordUsage=(i,kind,target=null)=>usage.tryRecord({eventKey:`discord:${i.id||crypto.randomUUID()}`,kind,actor:{id:i.user.id,name:i.member?.displayName||i.user.globalName||i.user.username||'A member'},originGuildId:i.guildId,originGuildName:i.guild?.name,esoServer:guilds.getEsoServer(i.guildId),source:'discord',target});
  const registrationDrafts=new RegistrationDraftService();
  const sharePasses=new SharePassService(db);
  const tourCopies=new TourCopyService(db);
  const reports=new HousingReportService(db);
  const onboarding=new OnboardingService(db);
  const adminHealth=new AdminHealthService(db,{version:'1.0.62'});
  const accessContexts=new AccessContextService(db);
  const personalStates=new UserHouseStateService(db,{visitService:visits});
  const savedSearches=new SavedHouseSearchService(db);
  const states=new Map();
  const drafts=new Map();
  const advancedStates=new Map();
  const bulkTourStates=new Map();
  const personalActionStates=new Map();
  const houseManagementStates=new Map();
  function houseReturnOptions(backId){
    const match=/^hu:house-return:([^:]+)$/.exec(String(backId||''));
    return match?houseManagementStates.get(match[1])?.view:null;
  }
  function destinationMenuPayload(row,options={}){
    if(row?.status&&row.status!=='active')return {content:'This house is awaiting approval or is unavailable. Pending submissions are visible only in Administration.',embeds:[],components:buttonRows([{customId:'hu:home',label:'Back',style:'secondary'}])};
    const view=houseReturnOptions(options.backId);
    return rawDestinationMenuPayload(row,view?{...options,...view}:options);
  }
  const savedSearchStates=new Map();
  const quickCommentDrafts=new Map();
  const commentReaders=new Map();
  const activeAdvancedByUser=new Map();
  const surpriseStates=new Map();

  const isAdmin=i=>!!i.guildId&&guilds.canAdmin(i);
  const homePayload=options=>renderHomePayload({...options,adminInterface});
  const adminPayload=settings=>renderAdminPayload(settings,{adminInterface});
  const webOnlyAdminNotice=()=> 'Housing Administration is managed through the companion web administration console for this installation.';
  const movedTools=new Set(['health','audit','export','maintenance','pending','reports']);
  const isDiscordAdminInteraction=id=>adminInterface==='web'&&(
    id==='hu:guild:pending'||['health','audit','export','maintenance','reports'].some(tool=>id===`hu:admin:${tool}`||id.startsWith(`hu:admin:${tool}:`))
  );
  const contextFor=i=>({guildId:String(i.guildId||''),userId:String(i.user.id),esoServer:guilds.getEsoServer(i.guildId)});
  const isModerator=i=>!!i.guildId&&guilds.isModerator(i);
  const canRunSharedPublicTour=i=>!!i.guildId&&guilds.canRunSharedPublicTour(i);
  const houseCopies=i=>new HouseCopyService(db,{policy:{registrationOutcome:async({visibility})=>{
    if(visibility==='private')return {allowed:true,status:'active'};
    const permission=guilds.canRegister(i);
    return permission.allowed?{allowed:true,status:permission.status}:{allowed:false,status:null,reason:'You do not have a role allowed to register Server or Global houses in this server.'};
  }}});
  const canManageReg=(i,r)=>guilds.canManagePublicHouse(i,r);
  const isGlobalTourAdmin=i=>globalMods.isGlobalModeratorCached(i.user.id,guilds.getEsoServer(i.guildId));
  const handleCatalog=createCatalogMenu(new HouseCatalogService(db));
  const contentPolicy=new ContentPolicyService(db);
  const galleryImages=images||new HouseImageService({db,saved,policy:contentPolicy,fresh:context=>contentPolicy.context(context)});
  const coverService=tourCovers||new TourCoverService({db,tours,policy:contentPolicy,fresh:context=>contentPolicy.context(context)});
  const tourCover=(i,t,payload)=>withTourCover(coverService,{...contextFor(i),memberRoleIds:[...(i.member?.roles?.cache?.keys?.()||i.member?.roles||[])].map(String)},i,t,payload);
  const policyContext=i=>({...contextFor(i),isServerAdmin:isModerator(i),isGlobalAdmin:isGlobalTourAdmin(i)});
  const canManageTour=(i,t)=>contentPolicy.canEditTour(t?{...t,visibility:t.visibility||({personal:'private',server:'public'}[t.scope]||t.scope)}:null,policyContext(i));
  const tourUpdateContext=(i,t)=>isGlobalTourAdmin(i)?{
    guildId:t.guild_id||t.source_guild_id||t.origin_guild_id||i.guildId,
    sourceGuildId:t.source_guild_id||t.guild_id||t.origin_guild_id||i.guildId
  }:{guildId:i.guildId,sourceGuildId:i.guildId};
  const canRunSharedTour=(i,t)=>t.scope==='personal'?t.creator_id===i.user.id:t.scope==='global'?true:canRunSharedPublicTour(i);
  const canEditSaved=(i,r)=>contentPolicy.canEditHouse(r?{...r,scope:({personal:'private',server:'public'}[r.scope]||r.scope),eso_server:r.eso_server||guilds.getEsoServer(i.guildId),owner_user_id:r.owner_user_id||(r.scope==='personal'?r.created_by:null)}:null,policyContext(i));
  const reportContext=i=>{const context=contextFor(i);return {viewerId:context.userId,guildId:context.guildId,esoServer:context.esoServer,isServerModerator:isAdmin(i),isGlobalModerator:globalMods.isGlobalModeratorCached(context.userId,context.esoServer),isApprover:globalMods.isApprover(context.userId)};};
  const reportNames=i=>({reporterGlobalName:i.user.globalName||i.user.username,reporterDisplayName:i.member?.displayName,guildName:i.guild?.name});
  async function reportTarget(i,kind,value){
    if(kind==='housepass'){
      const resolved=await sharePasses.resolveHousePass(value,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
      return {destinationId:resolved.house.destination_id,savedHouseId:resolved.house.id,passId:resolved.pass.id,passType:'house'};
    }
    if(kind==='tourpass'){
      const resolved=await sharePasses.resolveTourPass(value,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)}),first=resolved.stops[0];
      if(!first)throw new Error('This tour has no reportable destinations.');
      return {destinationId:first.destination_id,savedHouseId:first.saved_house_id,tourId:resolved.tour.id,stopId:first.id,passId:resolved.pass.id,passType:'tour'};
    }
    if(kind==='houseid'){
      const house=await saved.getVisible(Number(value),{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
      if(!house)throw new Error('That house is no longer available.');
      return {destinationId:house.destination_id,savedHouseId:house.id};
    }
    if(kind==='tourid'){
      const tour=await tourById(i,Number(value)),first=tour&&(await tours.getStops(tour.id))[0];
      if(!tour||!first)throw new Error('That tour is no longer available.');
      return {destinationId:first.destination_id,savedHouseId:first.source_id,tourId:tour.id,stopId:first.id};
    }
    throw new Error('That report target is not valid.');
  }
  async function prepareInteraction(i){
    guilds.invalidate(i.guildId);
    const settings=await guilds.ensureSettings(i.guildId);
    await guilds.ensureModeratorAccess(i);
    if(i.guildId&&!settings.eso_server&&i.customId!=='hu:environment:setup'){
      const payload=environmentSetupPayload();
      if(i.commandName||typeof i.isModalSubmit==='function'&&i.isModalSubmit())await i.reply({...payload,flags:MessageFlags.Ephemeral});
      else await i.update(payload);
      return false;
    }
    await globalMods.ensureUser(i.user.id,guilds.getEsoServer(i.guildId));
    // Cached editor results may contain other creators' Private tours and houses.
    for(const [id,state] of states){
      const context=state.tourAdminContext;
      if(state.userId===i.user.id&&context&&(
        context.guildId!==i.guildId||context.esoServer!==guilds.getEsoServer(i.guildId)||
        (context.globalAdmin&&!isGlobalTourAdmin(i))||(context.serverAdmin&&!isModerator(i))
      ))states.delete(id);
    }
    if(!guilds.isHousingChannelAllowed(i)&&!guilds.canBypassHousingChannel(i)){
      const settings=guilds.getSettings(i.guildId);
      await i.reply({content:`HearthBound interactions can only be used in <#${settings.bot_channel_id}>.`,flags:MessageFlags.Ephemeral});
      return false;
    }
    return true;
  }
  const visibleTours=(i,{forManagement=false}={})=>tours.list({creatorId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),includeOtherServers:forManagement&&isGlobalTourAdmin(i)});
  const registrationPayload=(i,options={})=>registrationTypePayload({...options,defaultVisibility:i.guildId&&guilds.canRegister(i).allowed?'public':'private'});
  const personalRow=r=>({...r,scope:'personal',display_name:r.nickname||r.house_name,description:r.notes});
  const guildRow=r=>({...r,scope:'server'});
  const withCount=async r=>({...r,comment_count:await comments.count(r.scope,r.id,r.eso_server)});
  const withHouseCardContext=async(i,r)=>{ await myAddressBook.recordView(i.user.id,r.id); const stateToken=token();personalActionStates.set(stateToken,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),sourceKind:'saved',sourceId:r.id,target:houseTarget(r),created:Date.now()}); let discordCover=null,coverNeedsPermission=false;
    const imageContext={...contextFor(i),memberRoleIds:[...(i.member?.roles?.cache?.keys?.()||i.member?.roles||[])].map(String)};
    try{const [image]=await galleryImages.list(imageContext,r.id);if(image){
      if(i.appPermissions&&!i.appPermissions.has(PermissionFlagsBits.AttachFiles))coverNeedsPermission=true;
      else discordCover={attachment:await galleryImages.read(imageContext,r.id,image.id),name:'house-cover.webp',description:String(image.caption||r.display_name||r.house_name||'House screenshot').slice(0,1024)};
    }}catch{/* Missing or newly inaccessible screenshots must not break the house card. */}
    return {...await withCount(r),discordCover,coverNeedsPermission,personal_token:stateToken,personal_state:await personalStates.get(i.user.id,houseTarget(r)),associated_tours:await tours.visibleForHouse(r.id,{creatorId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)})}; };
  const dashboard=async(i,{backId='hu:home'}={})=>{await recordUsage(i,'used_personal');const esoServer=guilds.getEsoServer(i.guildId);return myAddressBookPayload({...await myAddressBook.summary(i.user.id,i.guildId,esoServer),continueItems:await myAddressBook.continueItems(i.user.id,i.guildId,esoServer),legacy:await myAddressBook.legacyUnassigned(i.user.id),esoServer,backId});};
  const progressView=async(i,item)=>{
    if(!item)return null;
    const rows=await db.query(`SELECT p.*,ts.position stop_position,CASE WHEN sh.id IS NOT NULL THEN ts.notes ELSE NULL END stop_notes,sh.id current_saved_house_id,sh.scope current_house_scope,COALESCE(h.name,sh.display_name) current_house_name,sh.display_name current_house_nickname,sh.eso_owner current_house_owner
      FROM tour_progress p LEFT JOIN tour_stops ts ON ts.id=p.current_stop_id LEFT JOIN saved_houses sh ON sh.id=ts.saved_house_id AND sh.status='active' LEFT JOIN houses h ON h.house_id=sh.house_id
      WHERE p.id=? AND p.discord_user_id=?`,[Number(item.id),String(i.user.id)]);
    return rows[0]||item;
  };
  async function canEditTourStop(i,stop){
    if(stop?.source_id==null)return false;
    try{const access=await loadSavedReference(i,stop.source_id);return !!access?.record&&canEditSaved(i,legacySavedRow(access.record));}
    catch{return false;}
  }
  async function enrichedFeaturedPayload(i,options){
    const items=[];
    for(const item of options.items||[]){try{if(item.target_kind==='house'){const access=await loadSavedReference(i,item.target_id);if(!access.canView||access.record?.status!=='active'||!['public','global'].includes(access.record.scope))continue;const house=await saved.getVisible(item.target_id,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});if(!house)continue;items.push({...item,description:house.description,zone:house.zone,subzone:house.subzone,style:house.style});}else items.push(item);}catch{}}
    return featuredPayload({...options,items});
  }
  async function personalStopActions(i,payload,stop,routeContext={}){
    if(!stop?.source_id||payload.components.length>=5)return payload;
    const access=await loadSavedReference(i,stop.source_id);
    if(!access.canView||access.record?.status!=='active')return payload;
    const row=legacySavedRow(access.record),stateToken=token();
    personalActionStates.set(stateToken,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),sourceKind:'saved',sourceId:row.id,target:houseTarget(row),...routeContext,created:Date.now()});
    return {...payload,components:[...payload.components,...buttonRows(houseStateSpecs({...row,personal_token:stateToken,personal_state:await personalStates.get(i.user.id,houseTarget(row))}))]};
  }
  async function progressRunCard(i,item,{showDetails=false,content=null,overrideStopId=null,listPage=1}={}){
    let view=await progressView(i,item);
    if(view?.status==='completed')view={...view,...await progress.reconcile({progressId:view.id,userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)})};
    if(view&&overrideStopId!=null)view.current_stop_id=Number(overrideStopId);
    if(!view||view.status==='completed')return {...progressRunPayload({item:view,listPage}),...(content?{content}:{})};
    const current=await readiness.check(view.tour_id,{viewerId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),passId:view.share_pass_id});
    if(current.blocking.length)return {content:`This tour route changed: ${current.blocking[0].message}`,embeds:[],components:buttonRows([{customId:'hu:my:progress',label:'Back to Tour Progress',style:'secondary'}])};
    const tour=await tourById(i,view.tour_id),stops=tour?await tours.getStops(tour.id):[];
    const index=stops.findIndex(stop=>Number(stop.id)===Number(view.current_stop_id));
    if(!tour||index<0)return {...progressRunPayload({item:view,listPage}),...(content?{content}:{})};
    const stop=stops[index],commentCount=await tourStopCommentCount(stop,i.user.id),canEdit=await canEditTourStop(i,stop);
    const payload=await personalStopActions(i,{...progressRunPayload({item:view,tour,stops,currentPosition:index+1,commentCount,showDetails,canEdit,listPage}),...(content?{content}:{})},stop,{progressId:view.id,stopId:stop.id});
    return index===0?tourCover(i,tour,payload):payload;
  }
  const onboardingNames=i=>({globalName:i.user.globalName||i.user.username,displayName:i.member?.displayName});

  function pickerLabel(kind,r){
    if(kind==='admin-legacy-tour')return r.name;
    if(kind==='featured-house')return `${text(r.nickname)||text(r.house_name)||'Unknown House'} — @${String(r.eso_owner||'').replace(/^@/,'')}`;
    if(kind==='featured-tour')return `${r.name} (${r.scope==='global'?'Global':r.scope==='server'?'Server':'Private'})`;
    if(kind==='tour-add-house')return `${text(r.nickname)||text(r.house_name)||'Unknown House'} — @${String(r.eso_owner||'').replace(/^@/,'')}`;
    if(kind.startsWith('tour'))return kind.includes('stop')?`${r.position}. ${destinationLabel(r)}`:`${r.name} (${r.scope==='global'?'Global Tour':r.scope==='server'?'Server Tour':'Private Tour'})`; 
    if(kind==='house-form')return `${r.name} (#${r.house_id})`;
    if(kind==='pending')return `${destinationLabel(r)} — @${r.eso_owner}`;
    if(kind==='advanced-owner')return `@${String(r.eso_owner||'').replace(/^@/,'')}`;
    if(kind==='advanced-name'){
      const official=text(r.house_name||r.display_name)||'Unknown House';
      const nickname=text(r.nickname);
      const name=nickname&&nickname.toLowerCase()!==official.toLowerCase()?`${nickname} (${official})`:official;
      const owner=r.eso_owner?`@${String(r.eso_owner).replace(/^@/,'')}`:'Non-Player Home';
      return `${name} — ${owner}`;
    }
    if(kind==='visit'||kind.startsWith('personal-'))return `${destinationLabel(r)}`;
    return `${destinationLabel(r)}${r.eso_owner?` — @${String(r.eso_owner).replace(/^@/,'')}`:''}`;
  }
  function pickerDescription(kind,r){const description=pickerDescriptionBody(kind,r),capacity=houseCapacityText(r);return capacity?[capacity,description].filter(Boolean).join(' • '):description;}
  function pickerDescriptionBody(kind,r){
    if(kind==='admin-legacy-tour')return `${r.visibility==='global'?'Global':'Server'} • Creator: ${r.creator_display_name||r.creator_global_name||r.creator_id||'Unknown'}`;
    if(kind==='featured-house')return [r.house_name,r.zone,r.scope==='global'?'Global':'Server'].filter(Boolean).join(' • ');
    if(kind==='featured-tour')return r.description||undefined;
    if(kind.startsWith('tour-stop'))return [r.house_name,r.zone].filter(Boolean).join(' • ');
    if(kind==='tour-add-house')return [r.house_name,r.zone,r.source==='personal'?'Private':r.source==='global'?'Global':'Server'].filter(Boolean).join(' • ');
    if(kind.startsWith('tour'))return r.description||undefined;
    if(kind==='house-form')return [r.zone,r.house_type,r.classification].filter(Boolean).join(' • ');
    if(kind==='advanced-owner')return 'ESO owner';
    if(kind==='advanced-name'){
      const source=r.scope==='personal'?'Private Directory':r.scope==='server'?'Server Directory':r.scope==='global'?'Global Directory':'Non-Player Home';
      return [source,r.zone].filter(Boolean).join(' • ');
    }
    if(kind==='visit'||kind.startsWith('personal-'))return [r.house_name,r.zone,r.scope==='server'?'Server':r.scope==='personal'?'Private':r.scope==='global'?'Global':'Non Player'].filter(Boolean).join(' • ');
    return [r.house_name,r.zone].filter(Boolean).join(' • ');
  }
  function createPicker(i,{kind,rows,title='Choose an option',description='Select the item you want to use.',extra={},backId='hu:home',multiple=false}){
    const administrative=['tour-manage','tour-add-house','tour-stop-edit','tour-stop-reorder','tour-stop-remove'].includes(kind);
    const tourAdminContext=administrative?{guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),globalAdmin:isGlobalTourAdmin(i),serverAdmin:isModerator(i)}:null;
    const id=token(); states.set(id,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),kind,rows,extra,backId,page:0,multiple,tourAdminContext,created:Date.now()}); return renderPicker(id);
  }
  const navigableHousePicker=s=>s.kind==='visit'||s.kind.startsWith('personal-');
  function navigationFromBackId(backId){
    backId=houseReturnOptions(backId)?.backId||backId;
    const m=/^hu:results:back:([^:]+):(\d+)$/.exec(String(backId||''));
    if(!m)return null;
    const stateId=m[1],index=Number(m[2]),s=states.get(stateId);
    if(!s||!Number.isInteger(index))return null;
    return {stateId,index,total:s.rows.length};
  }
  function searchContextFromBackId(backId){
    const navigation=navigationFromBackId(backId);
    if(!navigation)return null;
    const state=states.get(navigation.stateId);
    if(!state||!navigableHousePicker(state))return null;
    return {...navigation,state};
  }
  function stateRowMatches(ctx,row,scope,id){ return !!row&&Number(row.id)===Number(id)&&row.scope===scope; }
  function refreshSearchStateRow(backId,row){
    const ctx=searchContextFromBackId(backId);
    if(!ctx)return null;
    const current=ctx.state.rows[ctx.index];
    if(stateRowMatches(ctx,current,row.scope,row.id))ctx.state.rows[ctx.index]=row;
    return ctx;
  }
  function removeFromSearchState(backId,scope,id){
    const ctx=searchContextFromBackId(backId);
    if(!ctx)return null;
    ctx.state.rows=ctx.state.rows.filter(r=>!stateRowMatches(ctx,r,scope,id));
    const index=Math.max(0,Math.min(ctx.index,ctx.state.rows.length-1));
    ctx.state.page=Math.floor(index/PAGE);
    return {...ctx,index,total:ctx.state.rows.length};
  }
  async function housePickerDetail(i,stateId,index,showDetails=false){
    const s=states.get(stateId);
    if(!s||s.userId!==i.user.id||!navigableHousePicker(s))return i.reply({content:'That house list expired. Run the browse or search again.',flags:MessageFlags.Ephemeral});
    const safeIndex=Math.max(0,Math.min(Number(index)||0,s.rows.length-1)),raw=s.rows[safeIndex];
    if(!raw)return i.reply({content:'That house is no longer available in this list.',flags:MessageFlags.Ephemeral});
    const navigation={stateId,index:safeIndex,total:s.rows.length},backId=`hu:results:back:${stateId}:${safeIndex}`;
    s.page=Math.floor(safeIndex/PAGE);
    if(navigableHousePicker(s)){
      if(raw.scope==='official')return i.update(officialHousePayload(await withOfficialState(i,await houses.get(raw.house_id)),backId,showDetails,navigation));
      const access=await accessContexts.forHouse({userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),savedHouseId:raw.id});
      if(!access.canView)return i.reply({content:'That saved house is no longer available in this list. Browse or search again.',flags:MessageFlags.Ephemeral});
      await recordUsage(i,'viewed_house',{kind:'house',id:access.record.id});
      const current=legacySavedRow(access.record);
      return i.update(destinationMenuPayload(await withHouseCardContext(i,current),{canEdit:canEditSaved(i,current),backId,showDetails,navigation}));
    }
    if(s.kind==='bookmark'){ const r=personalRow(raw); return i.update(destinationMenuPayload(await withHouseCardContext(i,r),{canEdit:true,backId,showDetails,navigation})); }
    const r=guildRow(raw); return i.update(destinationMenuPayload(await withHouseCardContext(i,r),{canEdit:canManageReg(i,r),backId,showDetails,navigation}));
  }
  function pickerPageContext(i,stateId){
    const state=states.get(stateId);
    if(!state||Date.now()-state.created>30*60*1000)return {error:'That menu expired. Run the search or browse again.'};
    if(state.userId!==i.user.id)return {error:'That menu belongs to another user.'};
    if(state.guildId!==i.guildId||state.esoServer!==guilds.getEsoServer(i.guildId))return {error:'That menu belongs to another server or ESO environment. Open it again.'};
    return {state,pages:Math.max(1,Math.ceil(state.rows.length/PAGE))};
  }
  function renderPicker(id){
    const s=states.get(id); if(!s)return homePayload();
    const pages=Math.max(1,Math.ceil(s.rows.length/PAGE)); s.page=Math.max(0,Math.min(s.page,pages-1));
    const start=s.page*PAGE,slice=s.rows.slice(start,start+PAGE);
    const options=slice.map((r,n)=>({label:pickerLabel(s.kind,r),description:pickerDescription(s.kind,r),value:String(start+n)}));
    const savedCount=s.kind==='visit'?s.rows.filter(r=>r.scope==='personal'||r.scope==='server'||r.scope==='global').length:0;
    const advanced=s.kind==='visit'&&s.extra.advancedToken?advancedStates.get(s.extra.advancedToken):null;
    const currentFilters=advanced?normalizeSearchFilters({...advanced.filters,includeNonPlayer:advanced.includeNonPlayer}):{};
    const searchActions=s.kind==='visit'&&s.extra.advancedToken?[
      {customId:`hu:advanced:filters:${s.extra.advancedToken}`,label:'Filters',style:'primary',emoji:'🔍'},
      {customId:`hu:advanced:clear:${s.extra.advancedToken}`,label:'Clear Filters',style:'secondary'},
      ...(hasMeaningfulSearchFilters(currentFilters)?[{customId:`hu:savedsearch:save:${s.extra.advancedToken}`,label:'Save Search',style:'success',emoji:'💾'}]:[])
    ]:[];
    const tourActions=savedCount?[{customId:`hu:results:create:${id}`,label:'Create New Tour From Results',style:'success',emoji:'🗺️'},{customId:`hu:results:add:${id}`,label:'Add Results to Existing Tour',style:'primary',emoji:'➕'}]:[];
    const builderActions=s.kind==='tour-add-house'?[{customId:`hu:tour:housefilter:${id}`,label:'Filter houses',style:'primary'},...(s.extra.houseFilters?[{customId:`hu:tour:houseclear:${id}`,label:'Clear filters',style:'secondary'}]:[])]:[];
    const actions=[...searchActions,...tourActions,...builderActions,...(s.extra.actions||[])];
    const pageText=s.rows.length?`Showing ${start+1}-${start+slice.length} of ${s.rows.length}${pages>1?` • Page ${s.page+1} of ${pages}`:''}.`:'No houses match these filters. Clear filters or go back.';
    const filterText=s.kind==='tour-add-house'&&s.extra.houseFilters?'Filters: '+Object.entries(s.extra.houseFilters).filter(([,value])=>value).map(([key,value])=>`${({query:'House/owner',tags:'Tags',visibility:'Visibility',zone:'Zone',architecture:'Style/classification'})[key]}: ${String(value).slice(0,80)}`).join(' · '):'';
    const description=[s.extra.description,filterText,pageText].filter(Boolean).join('\n\n');
    return pickerPayload({title:s.extra.title||'Choose an option',description,customId:`hu:picker:${id}`,options,page:s.page,pages,backId:s.backId,multiple:s.multiple,actions,paginationArrows:s.kind==='visit'});
  }
  async function withPassState(i,house,passToken){
    const stateToken=token(),row={...house,scope:house.scope==='private'?'personal':house.scope};
    personalActionStates.set(stateToken,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),sourceKind:'pass',sourceId:passToken,target:houseTarget(row),created:Date.now()});
    return {...row,personal_token:stateToken,personal_state:await personalStates.get(i.user.id,houseTarget(row))};
  }
  async function withOfficialState(i,house){
    const stateToken=token();personalActionStates.set(stateToken,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),sourceKind:'official',sourceId:house.house_id,created:Date.now()});
    return {...house,personal_token:stateToken,personal_state:await personalStates.get(i.user.id,houseTarget({...house,scope:'official'}))};
  }
  async function personalActionSource(i,context){
    if(context.progressId){const item=await one(db,'SELECT * FROM tour_progress WHERE id=? AND discord_user_id=?',[context.progressId,i.user.id]);if(!item||item.status!=='active'||Number(item.current_stop_id)!==Number(context.stopId)||!await tourById(i,item.tour_id))throw new Error('That tour stop changed or is no longer available.');}
    if(context.sessionId&&context.sourceKind==='saved'){const session=await sessions.get(context.sessionId);if(!session||session.guild_id!==i.guildId||session.channel_id!==i.channelId||String(session.started_by)!==String(i.user.id))throw new Error('That tour has been closed.');const stops=await tours.getStops(session.tour_id);if(Number(stops[Number(session.current_position)-1]?.id)!==Number(context.stopId)||!await tourById(i,session.tour_id))throw new Error('That tour stop changed or is no longer available.');}
    if(context.sourceKind==='saved'){
      const access=await loadSavedReference(i,context.sourceId);
      if(!access.canView||access.record?.status!=='active')throw new Error('That house is no longer available.');
      return {row:legacySavedRow(access.record),access};
    }
    if(context.sourceKind==='tour'){
      const {stop,pass}=await passTourStopContext(i,context.sessionId,context.stopId);
      if(pass&&(pass.status!=='active'||pass.closed_at))throw new Error('This tour Share Pass was revoked.');
      const record=await saved.get(stop.source_id);if(!record||record.status!=='active')throw new Error('That house is no longer available.');return {row:legacySavedRow(record)};
    }
    if(context.sourceKind==='official'){
      const house=await houses.get(context.sourceId);if(!house)throw new Error('That house is no longer available.');
      return {row:{...house,id:house.house_id,scope:'official',display_name:house.name,house_name:house.name}};
    }
    if(context.sourceKind==='pass'){
      const resolved=await sharePasses.resolveHousePass(context.sourceId,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
      return {row:{...resolved.house,scope:resolved.house.scope==='private'?'personal':resolved.house.scope},resolved};
    }
    throw new Error('That house is no longer available.');
  }
  function quickCommentContext(i,stateToken){
    const context=quickCommentDrafts.get(stateToken);
    if(!context||context.used||Date.now()-context.created>30*60*1000)throw new Error('That comment form expired. Open Add Comment again.');
    if(context.userId!==i.user.id)throw new Error('That comment form belongs to another user.');
    if(context.guildId!==i.guildId||context.esoServer!==guilds.getEsoServer(i.guildId))throw new Error('That comment form belongs to another server or ESO environment.');
    return context;
  }
  async function openQuickComment(i,context,{shared=false}={}){
    const source=await personalActionSource(i,context),target=houseTarget(source.row);
    if(context.target&&houseTargetKey(context.target)!==houseTargetKey(target))throw new Error('That house destination changed. Open the house again.');
    const stateToken=token(),snapshot={...(messageFlagBits(i.message?.flags)&MessageFlags.IsComponentsV2?{flags:MessageFlags.IsComponentsV2}:{}),attachments:[...(i.message?.attachments?.values?.()||[])].map(file=>({id:String(file.id)})),embeds:(i.message?.embeds||[]).map(value=>value.toJSON?.()||value),components:(i.message?.components||[]).map(value=>value.toJSON?.()||value)};
    quickCommentDrafts.set(stateToken,{...context,userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),target,created:Date.now(),snapshot,shared});
    return i.showModal(commentModal('global',source.row.id,'hu:home',destinationLabel(source.row)).setCustomId(`hu:modal:quickcomment:${stateToken}`));
  }
  async function openPersonalActions(i,sourceKind,sourceId){
    const context={userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),sourceKind,sourceId,created:Date.now()},source=await personalActionSource(i,context),target=houseTarget(source.row),stateToken=token();
    context.target=target;personalActionStates.set(stateToken,context);
    return i.update(personalActionsPayload({token:stateToken,target,state:await personalStates.get(i.user.id,target)}));
  }
  function personalActionContext(i,stateToken){
    const context=personalActionStates.get(stateToken);
    if(!context||Date.now()-context.created>30*60*1000)return {error:'That Personal Actions menu expired. Open the house again.'};
    if(context.userId!==i.user.id)return {error:'That Personal Actions menu belongs to another user.'};
    return {context};
  }
  function surpriseContext(i,stateToken){
    const context=surpriseStates.get(stateToken);
    if(!context||Date.now()-context.created>30*60*1000||context.guildId!==i.guildId||context.esoServer!==guilds.getEsoServer(i.guildId))return {error:'That Random House session expired. Open Random House from the main menu.'};
    if(context.userId!==i.user.id)return {error:'That Random House session belongs to another user.'};
    return {context};
  }
  async function showSurprise(i,stateToken){
    const found=surpriseContext(i,stateToken);if(found.error)return i.reply({content:found.error,flags:MessageFlags.Ephemeral});
    const backId=`hu:sr:${stateToken}`;
    while(found.context.rows.length){
      const row=discovery.choose(found.context.rows,{previousTargetKey:found.context.previousTargetKey});
      if(row.scope==='official'){
        const house=await houses.get(row.house_id);
        if(house){found.context.previousTargetKey=houseTargetKey(houseTarget(row));return i.update(officialHousePayload(await withOfficialState(i,house),backId,false,null,stateToken));}
      }else{
        const access=await accessContexts.forHouse({userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),savedHouseId:row.id});
        if(access.canView){
          const enriched=await saved.getVisible(row.id,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
          if(!enriched){found.context.rows=found.context.rows.filter(candidate=>candidate.id!==row.id);continue;}
          const current=legacySavedRow(enriched);
          await recordUsage(i,'random_house',{kind:'house',id:current.id});
          found.context.previousTargetKey=houseTargetKey(houseTarget(current));
          return i.update(destinationMenuPayload(await withHouseCardContext(i,current),{canEdit:canEditSaved(i,current),backId,surpriseToken:stateToken}));
        }
      }
      found.context.rows=found.context.rows.filter(candidate=>row.scope==='official'?candidate.scope!=='official'||Number(candidate.house_id)!==Number(row.house_id):candidate.scope==='official'||Number(candidate.id)!==Number(row.id));
    }
    return i.update({content:'No accessible registered houses are available. Register a house or return to the main menu.',embeds:[],components:buttonRows([{customId:found.context.backId,label:'Back',style:'secondary',emoji:'↩️'}])});
  }
  function modalResponse(i,payload){ if(typeof i.isFromMessage==='function'&&i.isFromMessage())return i.update(payload); return i.reply({...payload,flags:MessageFlags.Ephemeral}); }
  function respond(i,payload,mode='update'){ if(mode==='reply')return i.reply({...payload,flags:MessageFlags.Ephemeral}); if(mode==='modal')return modalResponse(i,payload); return i.update(payload); }
  async function resolveComments(i,scope,id,limit=25,offset=0){
    return Promise.all((await comments.list(scope,id,limit,guilds.getEsoServer(i.guildId),offset)).map(async c=>{ let name=String(c.discord_user_id||'Author unavailable'); try{const m=await i.guild?.members.fetch(c.discord_user_id); if(m)name=m.displayName;}catch{try{const u=await i.client.users.fetch(c.discord_user_id);name=u.globalName||u.username;}catch{}} return {...c,author_name:name}; }));
  }
  async function loadSavedReference(i,id){const result=await accessContexts.forHouse({userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),savedHouseId:id});if(!result.environmentMatch)throw new Error(result.message);return result;}
  async function getSaved(scope,id,i){const access=await loadSavedReference(i,id);if(!access.canView)return null;const r=access.record;if(scope==='personal')return r.scope==='private'?personalRow(r):null;if(scope==='global'||r.scope==='global')return r.scope==='global'?{...r,scope:'global'}:null;return r.scope==='public'&&r.guild_id===i.guildId?{...r,scope:'server'}:null;}
  async function commentReaderHouse(i,state){
    let house;
    if(state.kind==='pass')house=(await sharePasses.resolveHousePass(state.passToken,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)})).house;
    else if(state.kind==='tour'){const {stop}=await passTourStopContext(i,state.sessionId,state.stopId);house=await saved.get(stop.source_id);}
    else house=await getSaved(state.scope,state.id,i);
    if(!house||house.status!=='active')throw new Error('That saved house is no longer available.');
    if(state.destinationId&&Number(house.destination_id)!==Number(state.destinationId))throw new Error('That house destination changed. Open Comments again.');
    state.destinationId=house.destination_id;return house;
  }
  function commentReaderState(i,sid){
    const state=commentReaders.get(sid);
    if(!state||Date.now()-state.created>30*60*1000)throw new Error('That comments reader expired. Open Comments again.');
    if(state.userId!==i.user.id)throw new Error('That comments reader belongs to another user.');
    if(state.guildId!==i.guildId||state.channelId!==i.channelId||state.esoServer!==guilds.getEsoServer(i.guildId))throw new Error('That comments reader belongs to another server, channel or ESO environment.');
    return state;
  }
  async function showCommentReader(i,sid,page=1,mode='update',content){
    const state=commentReaderState(i,sid),house=await commentReaderHouse(i,state),total=await comments.count('global',house.id,state.esoServer),pages=Math.max(1,Math.ceil(total/commentPageSize));
    const current=Math.min(pages,Math.max(1,Math.floor(Number(page)||1))),rows=await resolveComments(i,'global',house.id,commentPageSize,(current-1)*commentPageSize);
    return respond(i,{...commentReaderPayload({house,rows,total,page:current,token:sid,backId:state.backId}),content:content||''},mode);
  }
  async function openCommentReader(i,descriptor,mode='update'){
    for(const [sid,state] of commentReaders)if(Date.now()-state.created>30*60*1000)commentReaders.delete(sid);
    const sid=token();commentReaders.set(sid,{...descriptor,userId:i.user.id,guildId:i.guildId,channelId:i.channelId,esoServer:guilds.getEsoServer(i.guildId),created:Date.now()});
    try{return await showCommentReader(i,sid,1,mode);}catch(error){commentReaders.delete(sid);throw error;}
  }
  async function commentsScreen(i,scope,id,mode='update',backId='hu:find'){
    return openCommentReader(i,{kind:'saved',scope,id,backId:backId||'hu:find'},mode);
  }
  async function tourAddHousePayload(i,t,{stateId=null}={}){
    const candidates=await tours.houseCandidates({creatorId:t.creator_id,sourceGuildId:t.source_guild_id||t.guild_id||i.guildId,esoServer:guilds.getEsoServer(i.guildId),visibility:t.visibility}),stops=await tours.getStops(t.id),rows=eligibleTourHouses(candidates,stops);
    const state=stateId?states.get(stateId):null;
    if(!rows.length&&!state?.extra.houseFilters){return {content:'Every eligible house is already on this tour, or no additional houses are available. Register another house to keep building.',embeds:[],components:tourManagePayload(t,stops).components};}
    if(state){state.rows=filterTourHouses(rows,state.extra.houseFilters||{});state.page=0;return renderPicker(stateId);}
    return createPicker(i,{kind:'tour-add-house',rows,extra:{title:`Add House — ${t.name}`,description:'Choose a house to add it immediately. You can add optional tour-specific notes right afterward. Houses already on this tour are omitted.',tourId:t.id},backId:`hu:tour:manage:${t.id}`});
  }

  async function tourById(i,id,{forManagement=false}={}){const access=await accessContexts.forTour({userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),tourId:id});if(!access.environmentMatch)throw new Error(access.message);if(!access.canView&&!(forManagement&&isGlobalTourAdmin(i)&&access.record?.visibility==='public'))return null;const t=access.record;return {...t,scope:t.visibility==='private'?'personal':t.visibility==='public'?'server':'global'};}
  async function tourDetail(i,id,mode='update'){
    const t=await tourById(i,id); if(!t)return respond(i,{content:'Tour not found.',embeds:[],components:[]},mode);
    return respond(i,await tourCover(i,t,tourDetailPayload(t,await tours.getStops(t.id),canManageTour(i,t))),mode);
  }
  async function tourBrowseDetail(i,stateId,index){
    const s=states.get(stateId);
    if(!s||s.userId!==i.user.id||s.kind!=='tour-view')return i.reply({content:'That tour list expired. Browse Tours again.',flags:MessageFlags.Ephemeral});
    const safeIndex=Math.max(0,Math.min(Number(index)||0,s.rows.length-1)),listed=s.rows[safeIndex],t=listed?await tourById(i,listed.id):null;
    if(!t)return i.reply({content:'That tour is no longer available.',flags:MessageFlags.Ephemeral});
    s.page=Math.floor(safeIndex/PAGE);
    return i.update(await tourCover(i,t,tourDetailPayload(t,await tours.getStops(t.id),canManageTour(i,t),{stateId,index:safeIndex,total:s.rows.length})));
  }
  async function tourStartPreflight(i,t,{backId=null}={}){
    const result=await readiness.check(t.id,{viewerId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
    return tourCover(i,t,tourStartChoicePayload(t,canRunSharedTour(i,t),result,{canManage:canManageTour(i,t),backId}));
  }
  async function tourManage(i,id,mode='update'){
    const t=await tourById(i,id,{forManagement:true}); if(!t)return respond(i,{content:'Tour not found.',embeds:[],components:[]},mode);
    if(!canManageTour(i,t))return respond(i,{content:'Only the tour creator or housing moderator can manage this tour.',embeds:[],components:[]},mode);
    return respond(i,tourManagePayload(t,await tours.getStops(t.id)),mode);
  }
  async function tourStopCommentCount(stop,userId){
    if(stop?.personal_bookmark_id){ const b=await bookmarks.get(stop.personal_bookmark_id,userId,stop.eso_server); return b?await comments.count('personal',stop.personal_bookmark_id,stop.eso_server):0; }
    return stop?.registered_house_id?await comments.count('server',stop.registered_house_id,stop.eso_server):stop?.global_house_id?await comments.count('global',stop.global_house_id,stop.eso_server):0;
  }
  async function startTourSession(i,t,visibility){
    const stops=await tours.getStops(t.id); if(!stops.length)return i.update({content:'This tour has no stops yet.',embeds:[],components:[]});
    if(visibility==='public'&&!canRunSharedTour(i,t))return i.update({content:'You do not have permission to start this tour in Shared mode. Choose Self Paced instead.',embeds:[],components:[]});
    if(visibility==='public'&&t.source_guild_id&&t.source_guild_id!==i.guildId)return i.update({content:'This tour uses Server Houses from a different Discord server and cannot be shared here. Start it Self Paced or return to its source server.',embeds:[],components:[]});
    const esoServer=guilds.getEsoServer(i.guildId),session=visibility==='public'?await sessions.startShared({tourId:t.id,guildId:i.guildId,channelId:i.channelId,userId:i.user.id,esoServer}):await sessions.startSelfPaced({tourId:t.id,guildId:i.guildId,channelId:i.channelId,userId:i.user.id,esoServer});
    await recordUsage(i,'started_tour',{kind:'tour',id:t.id});
    const currentStops=await tours.getStops(t.id);
    const payload=await tourSessionCard(i,t,currentStops,session,1,false);
    if(visibility==='public')return i.update({content:`Started **${t.name}** as a Shared tour.`,embeds:[],components:[]}).then(()=>i.followUp({...payload,flags:0}));
    return i.update(payload);
  }
  async function tourSessionCard(i,t,stops,session,position,showDetails=false){
    const stop=stops[Math.max(0,Number(position)-1)],count=await tourStopCommentCount(stop,session.mode==='self_paced'?i.user.id:null),canEdit=await canEditTourStop(i,stop);
    let payload={embeds:[tourEmbed(t,stops,Number(position),count,showDetails,{shared:session.mode==='shared',leaderId:session.started_by})],components:tourButtons(session.id,count,showDetails,{canEdit,savedHouseId:stop?.source_id})};
    if(Number(position)===1)payload=await tourCover(i,t,payload);
    if(session.mode==='self_paced'){const own=await personalStopActions(i,payload,stop,{sessionId:session.id,stopId:stop.id});if(own.components.flatMap(row=>(row.toJSON?.()||row).components).some(c=>c.label==='Add Comment'))return own;}
    return {...payload,components:[...payload.components,...buttonRows([{customId:`tour:commentquick:${session.id}:${stop.id}`,label:'Add Comment',style:'primary'}])]};
  }
  async function openTourHouseEditor(i,savedHouseId,backId){
    const access=await loadSavedReference(i,savedHouseId),raw=access?.record,row=raw?legacySavedRow(raw):null;
    if(!row||!canEditSaved(i,row))return i.reply({content:'You do not have edit access to that house.',flags:MessageFlags.Ephemeral});
    const scope=row.scope==='personal'?'personal':row.scope==='global'?'global':'guild';
    return i.showModal(houseEditModal(scope,row,backId));
  }
  async function tourReturnPayload(i,backId,content=null){
    let match=/^hu:progress:return:(\d+):(?:(\d+):)?(expanded|compact)(?::(\d+))?$/.exec(String(backId||''));
    if(match){
      const rows=await db.query('SELECT * FROM tour_progress WHERE id=? AND discord_user_id=?',[Number(match[1]),String(i.user.id)]),current=rows[0];if(!current)return null;
      const requestedStopId=match[2]?Number(match[2]):Number(current.current_stop_id),showDetails=match[3]==='expanded',listPage=Math.max(1,Number(match[4])||1),suffix=listPage>1?`:${listPage}`:'';
      const requested=await one(db,'SELECT id FROM tour_stops WHERE id=? AND tour_id=?',[requestedStopId,Number(current.tour_id)]),changed=requested&&requestedStopId!==Number(current.current_stop_id);
      const payload=await progressRunCard(i,current,{showDetails,content,overrideStopId:requested?requestedStopId:null,listPage});
      if(changed)payload.components=buttonRows([{customId:`hu:progress:return:${current.id}:${current.current_stop_id}:${showDetails?'expanded':'compact'}${suffix}`,label:'View Current Stop',style:'primary'}]);
      return payload;
    }
    match=/^tour:return:(\d+):(?:(\d+):)?(expanded|compact)$/.exec(String(backId||''));
    if(match){
      const session=await sessions.get(Number(match[1]));if(!session||session.guild_id!==i.guildId||session.channel_id!==i.channelId)return null;
      if(session.mode==='self_paced'&&!canControlTourSession(session,i.user.id))return null;
      const pass=await sessions.passForSession(session.id);
      if(pass&&(pass.status!=='active'||pass.closed_at||Number(pass.tour_id)!==Number(session.tour_id)))return null;
      const current=await readiness.check(session.tour_id,{viewerId:session.started_by,guildId:session.guild_id,esoServer:guilds.getEsoServer(i.guildId),passId:pass?.id});
      if(current.blocking.length){await sessions.end(session.id);return null;}
      const t=pass||session.mode==='shared'?await tours.get(session.tour_id):await tourById(i,session.tour_id);
      if(t&&!sharedTourStillVisible(t,session)){await sessions.end(session.id);return null;}
      const stops=t?await tours.getStops(t.id):[];if(!t||!stops.length)return null;
      const requestedStopId=match[2]?Number(match[2]):Number(stops[Math.max(0,Number(session.current_position||1)-1)]?.id),requestedIndex=stops.findIndex(stop=>Number(stop.id)===requestedStopId),currentIndex=Math.max(0,Math.min(stops.length-1,Number(session.current_position||1)-1)),showDetails=match[3]==='expanded';
      const position=requestedIndex>=0?requestedIndex+1:currentIndex+1,payload={...await tourSessionCard(i,t,stops,session,position,showDetails),...(content?{content}:{})};
      if(requestedIndex>=0&&requestedIndex!==currentIndex)payload.components=buttonRows([{customId:`tour:return:${session.id}:${stops[currentIndex].id}:${showDetails?'expanded':'compact'}`,label:'View Current Stop',style:'primary'}]);
      return payload;
    }
    return null;
  }
  async function passTourStopContext(i,sessionId,stopId){
    const session=await sessions.get(sessionId);
    if(!session||session.guild_id!==i.guildId||session.channel_id!==i.channelId||(session.mode!=='shared'&&String(session.started_by)!==String(i.user.id)))throw new Error('This tour has been closed.');
    const pass=await sessions.passForSession(session.id);
    if(session.mode!=='shared'&&(!pass||pass.status!=='active'||pass.closed_at||Number(pass.tour_id)!==Number(session.tour_id)))throw new Error('This Share Pass was revoked or this tour has been closed.');
    const check=await readiness.check(session.tour_id,{viewerId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),passId:pass?.id});
    if(!sharedTourStillVisible(check.tour,session))throw new Error('This Shared tour has been closed.');
    if(check.blocking.length)throw new Error(check.blocking[0].message);
    const stops=await tours.getStops(session.tour_id),stop=stops[Number(session.current_position)-1];
    if(!stop||Number(stop.id)!==Number(stopId))throw new Error('That tour stop changed. Open Comments from the current stop.');
    return {session,pass,stop};
  }
  function houseFormData(i){ return {house:text(i.fields.getTextInputValue('house')),owner:text(i.fields.getTextInputValue('owner')),nickname:text(i.fields.getTextInputValue('nickname'))||null,description:text(i.fields.getTextInputValue('description'))||null,tags:text(i.fields.getTextInputValue('tags'))}; }
  async function finishHouseForm(i,scope,action,id,data,house,mode='reply',backId=''){
    try{
      if(scope==='personal'){
        let r;
        if(action==='add') r=await bookmarks.create({userId:i.user.id,originGuildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),houseId:house.house_id,esoOwner:data.owner,nickname:data.nickname,notes:data.description,tags:data.tags});
        else { const raw=(await loadSavedReference(i,id)).record,current=raw?.scope==='private'&&raw.owner_user_id===i.user.id?personalRow(raw):null; if(!current)return respond(i,{content:'Private house not found.',components:[],embeds:[]},mode); r=await bookmarks.update(id,i.user.id,{esoServer:guilds.getEsoServer(i.guildId),houseId:house.house_id,esoOwner:data.owner,nickname:data.nickname,notes:data.description,tags:data.tags}); }
        await recordUsage(i,action==='add'?'registered_house':'updated_house',{kind:'house',id:r.id});
        const row=personalRow(r),returnTo=backId||'hu:find'; refreshSearchStateRow(returnTo,row);
        const tourReturn=action==='edit'?await tourReturnPayload(i,returnTo,'House updated.'):null;
        if(tourReturn)return respond(i,tourReturn,mode);
        return respond(i,destinationMenuPayload(await withHouseCardContext(i,row),{canEdit:true,backId:returnTo,navigation:navigationFromBackId(returnTo)}),mode);
      }
      const permission=guilds.canRegister(i);
      if(action==='add'&&!permission.allowed)return respond(i,{content:'You do not have a role allowed to register Server or Global houses.',components:[],embeds:[]},mode);
      let r;
      if(action==='add'){
        if(scope==='global') r=await saved.createGlobal({originGuildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),houseId:house.house_id,esoOwner:data.owner,displayName:data.nickname,description:data.description,tags:data.tags,createdBy:i.user.id,status:permission.status});
        else {
          const existing=await regs.findCanonical(i.guildId,data.owner,house.house_id,guilds.getEsoServer(i.guildId)); if(existing)return respond(i,{content:`That owner + house is already in the Server Directory as #${existing.id}.`,components:[],embeds:[]},mode);
          r=await regs.create({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),houseId:house.house_id,esoOwner:data.owner,displayName:data.nickname,description:data.description,tags:data.tags,createdBy:i.user.id,status:permission.status});
        }
        await recordUsage(i,'registered_house',{kind:'house',id:r.id});
        if(r.status==='pending')return respond(i,{content:`✅ **${destinationLabel(r)}** was submitted and is awaiting Housing Moderator approval. It can be added to tours once approved.`,embeds:[],components:buttonRows([{customId:'hu:home',label:'Back',style:'secondary',emoji:'↩️'}])},mode);
      } else {
        const current=(await loadSavedReference(i,id)).record; if(!current)return respond(i,{content:'Saved house not found.',components:[],embeds:[]},mode);
        const canEdit=current.scope==='global'?(current.created_by===i.user.id||await globalMods.isGlobalModerator(i.user.id,guilds.getEsoServer(i.guildId))):current.scope==='public'?canManageReg(i,{...current,scope:'server'}):current.owner_user_id===i.user.id;
        if(!canEdit)return respond(i,{content:'You do not manage that house.',components:[],embeds:[]},mode);
        r=await saved.update(id,{houseId:house.house_id,esoOwner:data.owner,displayName:data.nickname,description:data.description,tags:data.tags},i.user.id);
        await recordUsage(i,'updated_house',{kind:'house',id:r.id});
      }
      const row={...r,scope:r.scope==='public'?'server':r.scope==='private'?'personal':'global',nickname:r.display_name,notes:r.description},returnTo=backId||'hu:find'; refreshSearchStateRow(returnTo,row);
      const canEdit=row.scope==='global'?(row.created_by===i.user.id||await globalMods.isGlobalModerator(i.user.id,guilds.getEsoServer(i.guildId))):row.scope==='personal'||canManageReg(i,row);
      const tourReturn=action==='edit'?await tourReturnPayload(i,returnTo,'House updated.'):null;
      if(tourReturn)return respond(i,tourReturn,mode);
      return respond(i,destinationMenuPayload(await withHouseCardContext(i,row),{canEdit,backId:returnTo,navigation:navigationFromBackId(returnTo)}),mode);
    }catch(e){ return respond(i,{content:e.code==='VISIBLE_REGISTRATION_EXISTS'?e.message:`Could not save that house: ${e.message}`,components:e.code==='VISIBLE_REGISTRATION_EXISTS'?buttonRows([{customId:`hu:registration:house:${e.existingHouseId}`,label:'Open existing house',style:'primary'}]):[],embeds:[]},mode); }
  }
  async function submitHouseForm(i,scope,action,id=null,backId=''){
    const data=houseFormData(i),resolved=await houses.resolve(data.house);
    if(resolved.exact)return await finishHouseForm(i,scope,action,id,data,resolved.exact,'modal',backId);
    if(resolved.matches.length===1)return await finishHouseForm(i,scope,action,id,data,resolved.matches[0],'modal',backId);
    if(!resolved.matches.length){
      const retry=registrationDrafts.create({kind:'legacy-retry',userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),scope,action,targetId:id,data,backId});
      return modalResponse(i,registrationNotFoundPayload({retryId:`hu:houseform-retry:${retry.id}`,backId:backId||'hu:register'}));
    }
    return modalResponse(i,createPicker(i,{kind:'house-form',rows:resolved.matches,extra:{title:'Which ESO house did you mean?',description:'Several official houses matched your entry.',scope,action,id,data,backId},backId:backId||'hu:find'}));
  }
  async function registrationExistingEntries(i,house,esoOwner){
    return db.query(`SELECT id,scope,display_name,status FROM saved_houses
      WHERE eso_server=? AND normalized_owner=? AND house_id=? AND status='active'
      AND (scope='global' OR (scope='public' AND guild_id=?) OR (scope='private' AND owner_user_id=?))
      ORDER BY CASE scope WHEN 'global' THEN 1 WHEN 'public' THEN 2 ELSE 3 END,id`,[guilds.getEsoServer(i.guildId),normalizeAccount(esoOwner),Number(house.house_id),i.guildId,i.user.id]);
  }
  function registrationExpectedStatus(i,visibility){
    if(visibility==='private')return 'active';
    const permission=guilds.canRegister(i);
    if(!permission.allowed)throw new Error('You do not have a role allowed to register Server or Global houses.');
    return permission.status;
  }
  async function reviewRegistrationDraft(i,draft,mode='modal'){
    if(!draft.house)return respond(i,{content:'Choose an official ESO house before continuing.',embeds:[],components:[]},mode);
    const owner=draft.esoOwner||draft.ownerConflict?.parsed||draft.ownerConflict?.entered;
    draft.existingEntries=owner?await registrationExistingEntries(i,draft.house,owner):[];
    return respond(i,registrationDestinationReviewPayload(draft),mode);
  }
  function savedRowsFromSearchState(s){ return (s?.rows||[]).filter(r=>r.scope==='personal'||r.scope==='server'||r.scope==='global'); }
  function bulkState(i,id){ const b=bulkTourStates.get(id); return b&&b.userId===i.user.id&&b.guildId===i.guildId&&b.esoServer===guilds.getEsoServer(i.guildId)&&Date.now()-b.created<30*60*1000?b:null; }
  function beginBulkTour(i,searchStateId,action){
    const searchState=states.get(searchStateId);
    if(!searchState||searchState.userId!==i.user.id||searchState.kind!=='visit')return i.reply({content:'That house list expired. Run the browse or search again.',flags:MessageFlags.Ephemeral});
    const rows=savedRowsFromSearchState(searchState);
    if(!rows.length)return i.reply({content:'Those results contain no saved Global, Server, or Private houses that can become tour stops.',flags:MessageFlags.Ephemeral});
    const id=token(); bulkTourStates.set(id,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),action,rows,searchStateId,selected:new Set(),page:0,mode:'choice',created:Date.now()});
    return i.update(bulkTourChoicePayload({token:id,action,count:rows.length,backId:`hu:results:back:${searchStateId}`}));
  }
  function bulkSelectedRows(b){ return b.confirmedRows||selectionRows(b.rows,b.selected,b.mode); }
  function renderBulkOrder(b,id){return tourSelectionReviewPayload({token:id,rows:selectionRows(b.rows,b.selected,b.mode),page:b.orderPage||0,selectedPosition:b.orderPosition||0,backId:`hu:bulk:return:${id}`});}
  async function bulkRowsChanged(i,rows,tour=null){
    for(const row of rows){
      const access=await accessContexts.forHouse({userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),savedHouseId:row.id});
      if(!access.canView||legacySavedRow(access.record).scope!==row.scope)return true;
      if(Number(access.record.destination_id)!==Number(row.destination_id)||Number(access.record.house_id)!==Number(row.house_id)||normalizeAccount(access.record.eso_owner)!==normalizeAccount(row.eso_owner))return true;
      if(tour&&access.record.scope==='public'&&String(access.record.guild_id)!==String(tour.source_guild_id||tour.guild_id||tour.origin_guild_id||''))return true;
      if(tour&&access.record.scope==='private'&&String(access.record.owner_user_id)!==String(tour.creator_id))return true;
    }
    return false;
  }
  function staleBulkResults(i){return i.update({content:'Search results changed since this list loaded. Run the search again before creating or updating a tour.',embeds:[],components:buttonRows([{customId:'hu:find',label:'Search Houses',style:'primary'}])});}
  function renderBulkSelection(i,id){
    const b=bulkState(i,id); if(!b)return homePayload({isAdmin:isAdmin(i),esoServer:guilds.getEsoServer(i.guildId)});
    const pageSize=25,pages=Math.max(1,Math.ceil(b.rows.length/pageSize)); b.page=Math.max(0,Math.min(b.page,pages-1));
    const start=b.page*pageSize,slice=b.rows.slice(start,start+pageSize);
    const options=slice.map((r,n)=>({label:pickerLabel('visit',r),description:pickerDescription('visit',r),value:String(start+n),default:b.selected.has(start+n)}));
    return bulkTourSelectionPayload({token:id,action:b.action,options,page:b.page,pages,selectedCount:b.selected.size,backId:`hu:bulk:return:${id}`});
  }
  function houseSourceAllows(source,scope){
    if(scope==='personal'||scope==='private')return ['private','both','private_public','private_global','all'].includes(source);
    if(scope==='server'||scope==='public')return ['public','both','private_public','public_global','all'].includes(source);
    if(scope==='global')return ['global','private_global','public_global','all'].includes(source);
    return false;
  }
  function bulkCompatibleTour(i,t,rows){
    if(!canManageTour(i,t))return false;
    if(t.scope==='global'&&rows.some(r=>r.scope!=='global'))return false;
    return rows.every(r=>houseSourceAllows(t.house_source,r.scope)&&(!['personal','private'].includes(r.scope)||String(r.owner_user_id||r.discord_user_id)===String(t.creator_id))&&(!['server','public'].includes(r.scope)||String(r.guild_id)===String(t.source_guild_id||t.guild_id||t.origin_guild_id||'')));
  }
  async function openBulkExistingTourPicker(i,id){
    const b=bulkState(i,id); if(!b)return i.reply({content:'That bulk-tour selection expired.',flags:MessageFlags.Ephemeral});
    const rows=bulkSelectedRows(b); if(!rows.length)return i.update({...renderBulkSelection(i,id),content:'Select at least one house first.'});
    const eligible=(await visibleTours(i,{forManagement:true})).filter(t=>bulkCompatibleTour(i,t,rows));
    const registrationActions=b.registrationHouseId?[{customId:`hu:registration:newtour:${id}`,label:'Create New Tour',style:'success'}]:[];
    if(!eligible.length)return i.update({content:'No editable tours can accept this house selection. You can create a new tour.',embeds:[],components:buttonRows([...registrationActions,{customId:b.backId||`hu:bulk:return:${id}`,label:b.registrationHouseId?'Back to House':'Back',style:'secondary'}])});
    return i.update(createPicker(i,{kind:'tour-bulk-add',rows:eligible,extra:{title:b.registrationHouseId?'Add House to a Tour':'Add Results to Existing Tour',description:`Choose a tour for ${rows.length} selected house${rows.length===1?'':'s'}.`,bulkToken:id,actions:registrationActions},backId:b.backId||`hu:bulk:return:${id}`}));
  }

  async function createBulkTour(i,id,scope){
    const b=bulkState(i,id); if(!b)return i.reply({content:'That bulk-tour selection expired.',flags:MessageFlags.Ephemeral});
    const rows=bulkSelectedRows(b); if(await bulkRowsChanged(i,rows))return staleBulkResults(i);
    const houseSource=tourSourceForRows(rows); if(!houseSource)return i.update({content:'No saved houses were selected.',embeds:[],components:[]});
    if(scope==='server'&&!i.guildId)return i.update({content:'Server Tours require a Discord server.',embeds:[],components:[]});
    if(scope==='global'&&houseSource!=='global')return i.update({content:'Global Tours can contain Global houses only. Select only Global houses or choose Server/Private visibility.',embeds:[],components:[]});
    const sourceGuildId=['public','both','private_public','public_global','all'].includes(houseSource)?i.guildId:null;
    const result=await tours.createWithStops({creatorId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),visibility:scope==='personal'?'private':scope==='server'?'public':scope,name:b.name,description:b.description,savedHouseIds:rows.map(r=>r.id)}),t=result.tour; bulkTourStates.delete(id);await recordUsage(i,'created_tour',{kind:'tour',id:t.id});
    const summary=`Created **${t.name}** from **${result.added}** search result${result.added===1?'':'s'}.${result.skipped?` **${result.skipped}** duplicate destination${result.skipped===1?' was':'s were'} already in the result set and skipped.`:''}`;
    return i.update(b.registrationHouseId?await registrationTourSuccess(b,t,summary):{...tourManagePayload(t,await tours.getStops(t.id)),content:summary});
  }

  async function registrationHousePayload(i,savedHouseId){
    const access=await accessContexts.forHouse({userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),savedHouseId:Number(savedHouseId)});
    if(!access.canView||access.record?.status!=='active')return {content:'That house is no longer active or available. The saved registration is retained.',embeds:[],components:buttonRows([{customId:'hu:my',label:'My Address Book',style:'primary'}])};
    const enriched=await saved.getVisible(Number(savedHouseId),{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
    if(!enriched)return {content:'That house is no longer active or available.',embeds:[],components:buttonRows([{customId:'hu:my',label:'My Address Book',style:'primary'}])};
    const house=legacySavedRow(enriched);return destinationMenuPayload(await withHouseCardContext(i,house),{canEdit:canEditSaved(i,house),backId:'hu:my'});
  }
  async function startRegistrationTour(i,savedHouseId){
    const access=await accessContexts.forHouse({userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),savedHouseId:Number(savedHouseId)});
    if(!access.canView||access.record?.status!=='active'||access.record.scope==='private'&&String(access.record.owner_user_id)!==String(i.user.id))return i.reply({content:'That house is no longer active or available for tour addition. Your registration remains saved.',flags:MessageFlags.Ephemeral});
    const enriched=await saved.getVisible(Number(savedHouseId),{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
    if(!enriched)return i.reply({content:'That house is no longer active or available for tour addition.',flags:MessageFlags.Ephemeral});
    const id=token(),row=legacySavedRow(enriched);
    bulkTourStates.set(id,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),action:'add',rows:[row],selected:new Set([0]),confirmedRows:[row],page:0,mode:'select',registrationHouseId:Number(savedHouseId),backId:`hu:registration:house:${savedHouseId}`,created:Date.now()});
    return openBulkExistingTourPicker(i,id);
  }
  async function registrationTourSuccess(b,t,content){const house=await saved.get(b.registrationHouseId),stop=(await tours.getStops(t.id)).find(stop=>Number(stop.saved_house_id||stop.source_id)===Number(b.registrationHouseId)||(house?.destination_id&&Number(stop.destination_id)===Number(house.destination_id)));return stop?{...tourHouseAddedPayload(t,stop,{returnHouseId:b.registrationHouseId}),content}:{content,embeds:[],components:buttonRows([{customId:`hu:tour:view:${t.id}`,label:'Open Tour',style:'primary'},{customId:`hu:registration:house:${b.registrationHouseId}`,label:'Back to House',style:'secondary'}])};}


  function advancedState(i,tokenId){
    const s=advancedStates.get(tokenId);
    if(!s||s.userId!==i.user.id)return null;
    return s;
  }
  function combinedAdvancedFilters(s){return normalizeSearchFilters({...s.filters,includeNonPlayer:s.includeNonPlayer});}
  function currentAdvanced(i){const id=activeAdvancedByUser.get(i.user.id),state=id?advancedState(i,id):null;return state&&hasMeaningfulSearchFilters(combinedAdvancedFilters(state))?{id,state}:null;}
  async function savedSearchList(i,page=0){
    const count=await savedSearches.count(i.user.id),pages=Math.max(1,Math.ceil(count/PAGE)),safe=Math.max(0,Math.min(Number(page)||0,pages-1));
    return savedSearchListPayload({rows:await savedSearches.list(i.user.id,{limit:PAGE,offset:safe*PAGE}),page:safe,pages});
  }
  async function savedSearchDetail(i,id){
    const row=await savedSearches.getOwned(id,i.user.id);
    if(!row)return null;
    try{const filters=savedSearches.filters(row);return savedSearchDetailPayload({row,filters,summary:searchCriteria('Saved Search',filters),hasCurrentSearch:!!currentAdvanced(i)});}
    catch(error){return {content:error.message,embeds:[],components:buttonRows([{customId:`hu:savedsearch:delete:${row.id}`,label:'Delete',style:'danger'},{customId:'hu:my:searches',label:'Back',style:'secondary',emoji:'↩️'}])};}
  }
  async function advancedSourceRows(i,scope='all',includeNonPlayerHomes=includeNonPlayer(i)){
    return visits.search({userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),scope,includeNonPlayer:includeNonPlayerHomes,limit:5000});
  }
  async function advancedValues(i,s,field){
    const rows=await advancedSourceRows(i,s.scope,s.includeNonPlayer);
    if(field==='tags')return [...new Set(rows.flatMap(r=>parseTags(r.tags)).map(text).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    const key={zone:'zone',style:'style',classification:'classification',houseType:'house_type'}[field];
    return [...new Set(rows.map(r=>text(r[key])).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  }
  function renderAdvanced(i,tokenId){
    const s=advancedState(i,tokenId); if(!s)return null;
    const scope=s.scope||'all';
    const title=scope==='personal'?'Search Private Houses':scope==='server'?'Search Server Houses':'Search Houses';
    const backId=s.backId||'hu:home';
    return advancedSearchPayload({token:tokenId,filters:s.filters,title,backId,includeNonPlayer:s.includeNonPlayer});
  }
  async function renderAdvancedAttribute(i,tokenId,field){
    const s=advancedState(i,tokenId); if(!s)return null;
    const key={tags:'tags',zone:'zones',style:'styles',classification:'classifications',houseType:'houseTypes'}[field];
    const pageKey={tags:'tag',zone:'zone',style:'style',classification:'classification',houseType:'houseType'}[field];
    return advancedAttributePayload({token:tokenId,field,values:await advancedValues(i,s,field),selected:s.filters[key]||[],page:s.pages[pageKey]||0});
  }
  function emptyAdvancedFilters(){ return {name:'',owner:'',visibilities:['global','public','private'],tags:[],zones:[],styles:[],classifications:[],houseTypes:[],notOnPublicTours:false}; }
  async function startAdvanced(i,scope='all',initialFilters=null,{title=null,backId='hu:home'}={}){
    const normalized=initialFilters?normalizeSearchFilters(initialFilters):null,include=normalized?.includeNonPlayer===true;
    const filters=normalized?{...emptyAdvancedFilters(),...normalized}:emptyAdvancedFilters();delete filters.includeNonPlayer;
    const aid=token(); advancedStates.set(aid,{userId:i.user.id,scope,includeNonPlayer:include,filters,pages:{tag:0,zone:0,style:0,classification:0,houseType:0},created:Date.now(),title,backId});
    activeAdvancedByUser.set(i.user.id,aid);
    return searchResults(i,filters,{searchType:title||'Search Houses',mode:'update',scope,includeNonPlayerHomes:include,backId,alwaysPicker:true,advancedToken:aid});
  }
  function noSearchResults(i,searchType,filters,message='No matching houses were found. Try a broader search.'){
    return i.reply({content:`${message}\n\n${searchCriteria(searchType,filters)}`,flags:MessageFlags.Ephemeral});
  }
  function successfulSearchResponse(i,payload){
    if(typeof i.isFromMessage==='function'&&i.isFromMessage())return i.update(payload);
    return i.reply({...payload,flags:MessageFlags.Ephemeral});
  }
  async function searchResults(i,filters,{searchType='House Search',mode='update',scope='all',includeNonPlayerHomes=false,backId=null,alwaysPicker=false,advancedToken=null,content=null}={}){
    const useNonPlayer=scope==='all'?includeNonPlayerHomes:false;
    const rows=await visits.search({userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),scope,includeNonPlayer:useNonPlayer,...filters,limit:null});
    await recordUsage(i,'searched_houses');
    if(!rows.length){
      const payload=advancedToken?{content:`No matching houses were found. Try a broader search.\n\n${searchCriteria(searchType,filters)}`,embeds:[],components:buttonRows([{customId:`hu:advanced:filters:${advancedToken}`,label:'Filters',style:'primary',emoji:'🔍'},{customId:`hu:advanced:clear:${advancedToken}`,label:'Clear Filters',style:'secondary'},{customId:backId||'hu:home',label:'Back',style:'secondary',emoji:'↩️'}])}:null;
      if(payload)return mode==='modal'?successfulSearchResponse(i,payload):respond(i,payload,mode);
      return noSearchResults(i,searchType,filters);
    }
    let payload;
    const returnId=backId||'hu:find';
    const resultTitle=scope==='personal'?'Private House Search Results':scope==='server'?'Server House Search Results':'House Search Results';
    const resultDescription=scope==='personal'?`Found ${rows.length} matches in your Private Directory.`:scope==='server'?`Found ${rows.length} matches in the Server Directory.`:`Found ${rows.length} matching home${rows.length===1?'':'s'}. Global entries for this ESO environment appear first, then this server’s Server entries, then your Private entries, followed by Non-Player Homes when included.\n\n${searchCriteria(searchType,filters)}`;
    if(rows.length===1&&!alwaysPicker){ const r=rows[0]; payload=r.scope==='official'?officialHousePayload(await withOfficialState(i,await houses.get(r.house_id)),returnId):destinationMenuPayload(await withHouseCardContext(i,r),{canEdit:canEditSaved(i,r),backId:returnId}); }
    else payload=createPicker(i,{kind:'visit',rows,extra:{title:resultTitle,description:resultDescription,advancedToken},backId:returnId});
    if(content)payload.content=content;
    return mode==='modal'?successfulSearchResponse(i,payload):respond(i,payload,mode);
  }

  async function chat(i){
    if(!await prepareInteraction(i))return;
    await recordUsage(i,'opened_bot');
    return i.reply({...homePayload({isAdmin:isAdmin(i),esoServer:guilds.getEsoServer(i.guildId)}),flags:MessageFlags.Ephemeral});
  }

  async function globalModeratorScreen(i,mode='update'){
    const esoServer=guilds.getEsoServer(i.guildId),isApprover=globalMods.isApprover(i.user.id),isGlobal=await globalMods.ensureUser(i.user.id,esoServer);
    const [pending,status]=await Promise.all([isApprover?globalMods.listPending():[],globalMods.statusForUser(i.user.id)]);
    return respond(i,globalModeratorPayload({isApprover,isModerator:isGlobal,pendingCount:pending.length,esoServer,...status}),mode);
  }
  function legacySavedRow(r){ return {...r,scope:r.scope==='private'?'personal':r.scope==='public'?'server':'global',nickname:r.display_name,notes:r.description}; }
  async function scopeChangeContext(i,id,targetScope){
    const current=(await loadSavedReference(i,id)).record; if(!current||current.status==='archived')throw new Error('Saved house not found.');
    const currentLegacy=legacySavedRow(current); if(!canEditSaved(i,currentLegacy))throw new Error('You do not have edit access to that house.');
    let status='active';
    if(targetScope==='public'||targetScope==='global'){
      const permission=guilds.canRegister(i); if(!permission.allowed)throw new Error('You do not have permission to register a Server or Global house in this server.'); status=permission.status;
    }
    const targetOwnerUserId=targetScope==='private'?(current.owner_user_id||current.created_by||i.user.id):null;
    const targetGuildId=(targetScope==='public'||targetScope==='global')?i.guildId:null;
    const preview=await saved.previewScopeChange(id,targetScope,{targetStatus:status,targetGuildId,targetOwnerUserId});
    return {current,currentLegacy,status,targetOwnerUserId,targetGuildId,preview};
  }
  async function applyScopeChange(i,id,targetScope,backId){
    const ctx=await scopeChangeContext(i,id,targetScope);
    const result=await saved.changeScope(id,targetScope,{actorId:i.user.id,targetGuildId:ctx.targetGuildId,targetEsoServer:guilds.getEsoServer(i.guildId),targetOwnerUserId:ctx.targetOwnerUserId,status:ctx.status});
    const row=legacySavedRow(result.house);
    const managedView=houseReturnOptions(backId);
    if(managedView?.navigation){const list=states.get(managedView.navigation.stateId);if(list)list.rows[managedView.navigation.index]=row;}
    else removeFromSearchState(backId,ctx.currentLegacy.scope,id);
    const note=result.removedStops?` Visibility changed and ${result.removedStops} incompatible tour stop${result.removedStops===1?' was':'s were'} removed.`:'';
    const pending=result.house.status==='pending'?' This house is now pending approval and will not appear in normal searches until approved.':'';
    return i.update({...destinationMenuPayload(await withHouseCardContext(i,row),{canEdit:canEditSaved(i,row),backId:managedView?backId:'hu:find'}),content:`House visibility changed to **${targetScope==='private'?'Private':targetScope==='public'?'Server':'Global'}**.${note}${pending}`});
  }
  async function handleTourRuntimeButton(i,id){
    const parts=id.split(':'),action=parts[1],sessionId=Number(parts[2]);
    const session=await sessions.get(sessionId);
    if(!session||session.guild_id!==i.guildId||session.channel_id!==i.channelId)return i.reply({content:'This tour has been closed.',flags:MessageFlags.Ephemeral});
    if(session.mode==='self_paced'&&!canControlTourSession(session,i.user.id))return i.reply({content:'Only the tour leader can open this Self Paced tour.',flags:MessageFlags.Ephemeral});
    const sessionPass=await sessions.passForSession(session.id);
    if(sessionPass&&(sessionPass.status!=='active'||sessionPass.closed_at||Number(sessionPass.tour_id)!==Number(session.tour_id))){await sessions.end(session.id);return i.reply({content:'This tour has been closed because its Share Pass was revoked.',flags:MessageFlags.Ephemeral});}
    const current=await readiness.check(session.tour_id,{viewerId:session.started_by,guildId:session.guild_id,esoServer:guilds.getEsoServer(i.guildId),passId:sessionPass?.id});
    if(current.blocking.length){await sessions.end(session.id);return i.reply({content:`This tour has been closed because its route changed: ${current.blocking[0].message}`,flags:MessageFlags.Ephemeral});}
    const t=await tours.get(session.tour_id); if(!t)return i.reply({content:'This tour has been closed.',flags:MessageFlags.Ephemeral});
    if(!sharedTourStillVisible(t,session)){await sessions.end(session.id);return i.reply({content:'This tour has been closed because its visibility changed or it is no longer shared with this server.',flags:MessageFlags.Ephemeral});}
    const stops=await tours.getStops(t.id); if(!stops.length){await sessions.end(session.id);return i.reply({content:'This tour has been closed.',flags:MessageFlags.Ephemeral});}
    const canControl=canControlTourSession(session,i.user.id);
    if(['next','prev','end'].includes(action)&&!canControl)return i.reply({content:`Only <@${session.started_by}>, the tour leader, can control this ${session.mode==='shared'?'Shared':'Self Paced'} tour.`,flags:MessageFlags.Ephemeral});
    const currentIndex=Math.max(0,Math.min(stops.length-1,Number(session.current_position||1)-1));
    const currentStop=stops[currentIndex];
    if(action==='commentquick'){
      try{return await openQuickComment(i,{sourceKind:'tour',sessionId:session.id,stopId:Number(parts[3])},{shared:session.mode==='shared'});}catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(action==='edit'){
      const savedHouseId=Number(parts[3]),detailState=parts[4]==='expanded'?'expanded':'compact';
      if(savedHouseId!==Number(currentStop.source_id))return i.reply({content:'That tour stop has changed. Use the current Edit House button.',flags:MessageFlags.Ephemeral});
      return openTourHouseEditor(i,savedHouseId,`tour:return:${session.id}:${currentStop.id}:${detailState}`);
    }
    if(action==='end'){
      await sessions.end(session.id);
      const payload=await tourSessionCard(i,t,stops,session,currentIndex+1,false);
      return i.update({...payload,components:[]});
    }
    if(action==='return'){const payload=await tourReturnPayload(i,id);return payload?i.update(payload):i.reply({content:'This tour has been closed.',flags:MessageFlags.Ephemeral});}
    if(action==='list'){
      const detailState=parts[3]==='expanded'?'expanded':'compact';
      return i.reply({embeds:[tourEmbed(t,stops)],components:buttonRows([{customId:`tour:return:${session.id}:${currentStop.id}:${detailState}`,label:'Back to Current Stop',style:'secondary',emoji:'↩️'}]),flags:MessageFlags.Ephemeral});
    }
    if(action==='comments'){
      const detailState=parts[3]==='expanded'?'expanded':'compact';
      const scope=currentStop.source_scope||'server',targetId=currentStop.source_id;
      if(scope==='personal'&&!await getSaved('personal',targetId,i)){
        if(session.mode!=='shared'&&(!sessionPass||sessionPass.status!=='active'))return i.reply({content:'This tour stop is no longer available through its Share Pass.',flags:MessageFlags.Ephemeral});
        const backId=`tour:return:${session.id}:${currentStop.id}:${detailState}`;
        return openCommentReader(i,{kind:'tour',sessionId:session.id,stopId:currentStop.id,backId},'reply');
      }
      return commentsScreen(i,scope,targetId,'reply',`tour:return:${session.id}:${currentStop.id}:${detailState}`);
    }
    if(action==='details'||action==='hide'){
      return i.update(await tourSessionCard(i,t,stops,session,currentIndex+1,action==='details'));
    }
    if(action==='next'||action==='prev'){
      const showDetails=parts[3]==='expanded';
      let updated;
      try{updated=await sessions.advance(session.id,action==='next'?1:-1,stops.length,{esoServer:guilds.getEsoServer(i.guildId)});}
      catch(error){await sessions.end(session.id);return i.reply({content:`This tour has been closed because its route changed: ${error.message}`,flags:MessageFlags.Ephemeral});}
      if(!updated)return i.reply({content:'This tour has been closed.',flags:MessageFlags.Ephemeral});
      if(Number(updated.current_position)!==Number(session.current_position))await recordUsage(i,'advanced_tour',{kind:'tour',id:t.id});
      const liveStops=await tours.getStops(t.id);
      if(!liveStops.length){await sessions.end(session.id);return i.reply({content:'This tour has been closed.',flags:MessageFlags.Ephemeral});}
      return i.update(await tourSessionCard(i,t,liveStops,session,Math.min(liveStops.length,Number(updated.current_position)),showDetails));
    }
  }

  async function button(i){
    if(!await prepareInteraction(i))return;
    const id=i.customId;
    if(id.startsWith('hu:catalog:')||id.startsWith('hu:modal:catalog:')||(id==='hu:admin:tool'&&['catalog','catalog_edit'].includes(i.values?.[0])))return handleCatalog(i);
    if(isRetiredEventInteraction(id))return id.startsWith('hu:modal:')?i.reply({...retiredEventPayload(),flags:MessageFlags.Ephemeral}):i.update(retiredEventPayload());
    if(isServerModeratorAction(id))return handleServerModeratorAction(i,{serverModerators:guilds.serverModerators,guilds});
    if(isTourShareDestination(id))return handleTourShareDestination(i,{sharePasses,tours,guilds,loadHouse:async(i,id)=>(await loadSavedReference(i,id)).record});
    if(isDiscordAdminInteraction(id))return i.reply({content:webOnlyAdminNotice(),flags:MessageFlags.Ephemeral});
    if(id.startsWith('tour:'))return handleTourRuntimeButton(i,id);
    if(id==='hu:tours:featured'||id==='hu:featured'){
      const cycle=await featured.rotateHouses({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
      const rows=await featured.list({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
      await recordUsage(i,'viewed_featured');
      return i.update(await enrichedFeaturedPayload(i,{items:rows,nextRotationAt:cycle.nextRotationAt,backId:id==='hu:featured'?'hu:home':'hu:tours'}));
    }
    if(id.startsWith('hu:featured:tour:')){
      const parts=id.split(':'),tourId=Number(parts[3]),source=parts[4]==='admin'&&isAdmin(i)?'admin':parts[4]==='home'?'home':'viewer';
      const rows=await featured.list({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
      if(!rows.some(item=>item.target_kind==='tour'&&Number(item.target_id)===tourId))return i.reply({content:'That tour is no longer Featured.',flags:MessageFlags.Ephemeral});
      const t=await tourById(i,tourId);
      if(!t)return i.reply({content:'That tour is no longer available.',flags:MessageFlags.Ephemeral});
      return i.update(await tourCover(i,t,tourDetailPayload(t,await tours.getStops(t.id),canManageTour(i,t),null,source)));
    }
    if(id.startsWith('hu:featured:house:')){
      const parts=id.split(':'),houseId=Number(parts[3]),source=parts[4]==='admin'&&isAdmin(i)?'admin':parts[4]==='home'?'home':'viewer';
      const rows=await featured.list({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
      if(!rows.some(item=>item.target_kind==='house'&&Number(item.target_id)===houseId))return i.reply({content:'That house is no longer Featured.',flags:MessageFlags.Ephemeral});
      const access=await loadSavedReference(i,houseId);
      if(!access?.canView)return i.reply({content:'That house is no longer available.',flags:MessageFlags.Ephemeral});
      const house=legacySavedRow(access.record);
      return i.update(destinationMenuPayload(await withHouseCardContext(i,house),{canEdit:canEditSaved(i,house),backId:source==='admin'?'hu:admin:featured':source==='home'?'hu:featured':'hu:tours:featured'}));
    }
    if(id.startsWith('hu:featured:expire:')){
      if(!isAdmin(i))return i.reply({content:'Only Housing Moderators can manage Featured housing.',flags:MessageFlags.Ephemeral});
      const parts=id.split(':'); return i.showModal(featuredExpiryModal(parts[3],Number(parts[4])));
    }
    if(id.startsWith('hu:featured:remove:')){
      if(!isAdmin(i))return i.reply({content:'Only Housing Moderators can manage Featured housing.',flags:MessageFlags.Ephemeral});
      const parts=id.split(':'); await featured.remove({guildId:i.guildId,targetKind:parts[3],targetId:Number(parts[4]),actorId:i.user.id,isModerator:true});
      return i.update(await enrichedFeaturedPayload(i,{items:await featured.list({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)}),canManage:true}));
    }
    if(id.startsWith('hu:featured:move:')){
      if(!isAdmin(i))return i.reply({content:'Only Housing Moderators can manage Featured housing.',flags:MessageFlags.Ephemeral});
      const parts=id.split(':');
      await featured.reorder({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),targetKind:parts[3],targetId:Number(parts[4]),position:Number(parts[5]),actorId:i.user.id,isModerator:true});
      const items=await featured.list({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
      return i.update(await enrichedFeaturedPayload(i,{items,canManage:true,selectedItem:items.find(item=>item.target_kind===parts[3]&&Number(item.target_id)===Number(parts[4]))||null}));
    }
    if(id==='hu:featured:add:house'||id==='hu:featured:add:tour'){
      if(!isAdmin(i))return i.reply({content:'Only Housing Moderators can manage Featured housing.',flags:MessageFlags.Ephemeral});
      const server=guilds.getEsoServer(i.guildId);
      const rows=id.endsWith(':house')
        ? await db.query("SELECT s.*,h.name house_name FROM saved_houses s JOIN houses h ON h.house_id=s.house_id WHERE s.status='active' AND s.eso_server=? AND s.scope IN ('global','public') AND s.destination_id IS NOT NULL AND s.eso_owner IS NOT NULL AND trim(s.eso_owner)<>'' AND (s.scope='global' OR s.guild_id=?) ORDER BY CASE s.scope WHEN 'global' THEN 1 ELSE 2 END,h.name LIMIT 100",[server,i.guildId])
        : await db.query("SELECT t.*,CASE t.visibility WHEN 'global' THEN 'global' ELSE 'server' END scope FROM tours t WHERE t.eso_server=? AND t.visibility IN ('global','public') AND (t.visibility='global' OR t.guild_id=?) ORDER BY CASE t.visibility WHEN 'global' THEN 1 ELSE 2 END,t.name LIMIT 100",[server,i.guildId]);
      return i.update(createPicker(i,{kind:id.endsWith(':house')?'featured-house':'featured-tour',rows,extra:{title:id.endsWith(':house')?'Add Featured House':'Add Featured Tour',description:'Choose an eligible Global or Server entry.',featuredKind:id.endsWith(':house')?'house':'tour'},backId:'hu:admin:featured'}));
    }
    if(id==='hu:home')return i.update(homePayload({isAdmin:isAdmin(i),esoServer:guilds.getEsoServer(i.guildId)}));
    if(id.startsWith('hu:onboarding:go:')){
      const target=id.split(':')[3],page=Number(id.split(':')[4]),backId=page>=1&&page<=7?`hu:onboarding:${page}`:'hu:home';
      await onboarding.complete(i.user.id,onboardingNames(i));
      if(target==='search')return startAdvanced(i,'all',null,{backId});
      if(target==='register')return i.update(registrationPayload(i,{backId}));
      if(target==='addressbook')return i.update(await dashboard(i,{backId}));
      if(target==='tours'){const rows=await visibleTours(i);return i.update(toursPayload(rows.length,{backId}));}
      if(target==='help')return i.update(helpPayload({backId}));
      return i.update(homePayload({isAdmin:isAdmin(i),esoServer:guilds.getEsoServer(i.guildId)}));
    }
    if(id.startsWith('hu:onboarding:'))return i.update(homePayload({isAdmin:isAdmin(i),esoServer:guilds.getEsoServer(i.guildId)}));
    if(['hu:find','hu:register','hu:tours:start'].includes(id)&&!await onboarding.get(i.user.id))await onboarding.complete(i.user.id,onboardingNames(i));
    if(id==='hu:my')return i.update(await dashboard(i));
    if(id.startsWith('hu:savedsearch:save:')){
      const aid=id.split(':')[3],s=advancedState(i,aid);
      if(!s)return i.reply({content:'That Search Houses session expired. Open Search Houses again.',flags:MessageFlags.Ephemeral});
      if(!hasMeaningfulSearchFilters(combinedAdvancedFilters(s)))return i.reply({content:'Add at least one filter before saving this search.',flags:MessageFlags.Ephemeral});
      return i.showModal(savedSearchNameModal(aid));
    }
    if(id.startsWith('hu:savedsearch:replace:')||id.startsWith('hu:savedsearch:cancel:')){
      const action=id.split(':')[2],stateToken=id.split(':')[3],pending=savedSearchStates.get(stateToken);
      if(!pending||pending.userId!==i.user.id||Date.now()-pending.created>30*60*1000)return i.reply({content:'That saved-search confirmation belongs to another user or has expired.',flags:MessageFlags.Ephemeral});
      const s=advancedState(i,pending.advancedToken);if(!s)return i.reply({content:'That Search Houses session expired. Open Search Houses again.',flags:MessageFlags.Ephemeral});
      if(action==='replace')await savedSearches.save({userId:i.user.id,name:pending.name,filters:combinedAdvancedFilters(s),...onboardingNames(i),replace:true});
      savedSearchStates.delete(stateToken);
      return searchResults(i,s.filters,{searchType:s.title||'Search Houses',mode:'update',scope:s.scope||'all',includeNonPlayerHomes:s.includeNonPlayer,backId:'hu:home',alwaysPicker:true,advancedToken:pending.advancedToken,content:action==='replace'?'Saved search replaced.':'The existing saved search was not changed.'});
    }
    if(id.startsWith('hu:savedsearch:page:'))return i.update(await savedSearchList(i,Number(id.split(':')[3])));
    if(id.startsWith('hu:savedsearch:detail:')){
      const payload=await savedSearchDetail(i,Number(id.split(':')[3]));
      if(!payload)return i.reply({content:'That saved search belongs to another user or is no longer available.',flags:MessageFlags.Ephemeral});
      return i.update(payload);
    }
    if(id.startsWith('hu:savedsearch:run:')){
      const row=await savedSearches.getOwned(Number(id.split(':')[3]),i.user.id);
      if(!row)return i.reply({content:'That saved search belongs to another user or is no longer available.',flags:MessageFlags.Ephemeral});
      try{return startAdvanced(i,'all',savedSearches.filters(row),{title:row.name});}
      catch(error){return i.update({content:error.message,embeds:[],components:buttonRows([{customId:`hu:savedsearch:delete:${row.id}`,label:'Delete',style:'danger'},{customId:'hu:my:searches',label:'Back',style:'secondary',emoji:'↩️'}])});}
    }
    if(id.startsWith('hu:savedsearch:rename:')){
      const row=await savedSearches.getOwned(Number(id.split(':')[3]),i.user.id);
      if(!row)return i.reply({content:'That saved search belongs to another user or is no longer available.',flags:MessageFlags.Ephemeral});
      return i.showModal(savedSearchNameModal(String(row.id),{name:row.name,mode:'rename'}));
    }
    if(id.startsWith('hu:savedsearch:replacecurrent:')){
      const row=await savedSearches.getOwned(Number(id.split(':')[3]),i.user.id),current=currentAdvanced(i);
      if(!row)return i.reply({content:'That saved search belongs to another user or is no longer available.',flags:MessageFlags.Ephemeral});
      if(!current)return i.reply({content:'Run a filtered house search before replacing these filters.',flags:MessageFlags.Ephemeral});
      await savedSearches.save({userId:i.user.id,name:row.name,filters:combinedAdvancedFilters(current.state),...onboardingNames(i),replace:true});
      return i.update({...await savedSearchDetail(i,row.id),content:'Saved-search filters replaced with your current search.'});
    }
    if(id.startsWith('hu:savedsearch:deleteconfirm:')){
      const result=await savedSearches.delete({id:Number(id.split(':')[3]),userId:i.user.id});
      if(result.status!=='deleted')return i.reply({content:'That saved search belongs to another user or is no longer available.',flags:MessageFlags.Ephemeral});
      return i.update({...await savedSearchList(i,0),content:'Saved search deleted.'});
    }
    if(id.startsWith('hu:savedsearch:delete:')){
      const row=await savedSearches.getOwned(Number(id.split(':')[3]),i.user.id);
      if(!row)return i.reply({content:'That saved search belongs to another user or is no longer available.',flags:MessageFlags.Ephemeral});
      return i.update(savedSearchDeleteConfirmPayload({id:row.id,name:row.name}));
    }
    if(id==='hu:random'){
      const rows=await visits.search({userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),scope:'all',includeNonPlayer:false,limit:null});
      const stateToken=token();surpriseStates.set(stateToken,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),rows,previousTargetKey:null,backId:'hu:home',created:Date.now()});
      return showSurprise(i,stateToken);
    }
    if(id.startsWith('hu:surprise:from:')){
      const stateId=id.split(':')[3],state=states.get(stateId);
      if(!state||state.userId!==i.user.id||state.kind!=='visit')return i.reply({content:'That house list belongs to another user or has expired.',flags:MessageFlags.Ephemeral});
      const stateToken=token();surpriseStates.set(stateToken,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),rows:state.rows,previousTargetKey:null,backId:`hu:results:back:${stateId}`,created:Date.now()});
      return showSurprise(i,stateToken);
    }
    if(id.startsWith('hu:surprise:again:'))return showSurprise(i,id.split(':')[3]);
    if(id.startsWith('hu:sr:')){
      const found=surpriseContext(i,id.split(':')[2]);if(found.error)return i.reply({content:found.error,flags:MessageFlags.Ephemeral});
      const stateId=found.context.backId.split(':')[3],state=states.get(stateId);
      return state&&state.userId===i.user.id?i.update(renderPicker(stateId)):i.update(homePayload({isAdmin:isAdmin(i),esoServer:guilds.getEsoServer(i.guildId)}));
    }
    if(id.startsWith('hu:comment:quick:')){
      const found=personalActionContext(i,id.split(':')[3]);if(found.error)return i.reply({content:found.error,flags:MessageFlags.Ephemeral});
      try{if(found.context.guildId!==i.guildId||found.context.esoServer!==guilds.getEsoServer(i.guildId))throw new Error('That house card belongs to another server or ESO environment.');return await openQuickComment(i,found.context);}catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:mark:')){
      const [, ,action,stateToken]=id.split(':');
      const found=personalActionContext(i,stateToken);
      if(found.error)return i.reply({content:found.error,flags:MessageFlags.Ephemeral});
      const context=found.context;
      if(context.guildId&&(context.guildId!==i.guildId||context.esoServer!==guilds.getEsoServer(i.guildId)))return i.reply({content:'That house card belongs to another ESO environment. Open the house again.',flags:MessageFlags.Ephemeral});
      try{
        const source=await personalActionSource(i,context),target=houseTarget(source.row);if(context.target&&houseTargetKey(context.target)!==houseTargetKey(target))throw new Error('That house destination changed. Open the house again.');const current=await personalStates.get(i.user.id,target),names=onboardingNames(i);
        if(action==='favorite')await personalStates.setFavorite({userId:i.user.id,target,favorite:Number(current?.is_favorite)!==1,...names,visibleTarget:source.row});
        else if(action==='want'||action==='visited'){const desired=action==='want'?'want_to_visit':'visited';await personalStates.setVisitState({userId:i.user.id,target,visitState:current?.visit_state===desired?'none':desired,...names,visibleTarget:source.row});}
        else return i.reply({content:'That house action is unavailable.',flags:MessageFlags.Ephemeral});
        const row={...source.row,personal_token:stateToken,personal_state:await personalStates.get(i.user.id,target)},specs=houseStateSpecs(row,context.sourceKind);
        if(i.message?.components){const replacements=new Map(specs.map(spec=>[spec.customId,spec]));const components=mapMessageControls(i.message.components,component=>{const spec=replacements.get(component.custom_id);return spec?{...component,label:spec.label,style:spec.style==='success'?3:spec.style==='primary'?1:2}:component;});return i.update({components});}
        return i.update(context.sourceKind==='official'?officialHousePayload(row):destinationMenuPayload(row,{canEdit:canEditSaved(i,row)}));
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:personal:open:')){
      const parts=id.split(':'),sourceKind=parts[3],sourceId=sourceKind==='saved'||sourceKind==='official'?Number(parts[4]):parts.slice(4).join(':');
      try{return await openPersonalActions(i,sourceKind,sourceId);}catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:personal:act:')){
      const parts=id.split(':'),action=parts[3],stateToken=parts[4],found=personalActionContext(i,stateToken);
      if(found.error)return i.reply({content:found.error,flags:MessageFlags.Ephemeral});
      try{
        const source=await personalActionSource(i,found.context),target=houseTarget(source.row);if(found.context.target&&houseTargetKey(found.context.target)!==houseTargetKey(target))throw new Error('That house destination changed. Open the house again.');const names=onboardingNames(i),current=await personalStates.get(i.user.id,target);
        let message;
        if(action==='favorite'){
          const favorite=Number(current?.is_favorite)!==1;
          await personalStates.setFavorite({userId:i.user.id,target,favorite,globalName:names.globalName,displayName:names.displayName,visibleTarget:source.row});
          message=favorite?'Added to Favorites.':'Removed from Favorites.';
        }else if(action==='want'){
          await personalStates.setVisitState({userId:i.user.id,target,visitState:'want_to_visit',globalName:names.globalName,displayName:names.displayName,visibleTarget:source.row});
          message='Added to Want to Visit.';
        }else if(action==='visited'){
          await personalStates.setVisitState({userId:i.user.id,target,visitState:'visited',globalName:names.globalName,displayName:names.displayName,visibleTarget:source.row});
          message='Marked as Visited.';
        }else if(action==='clear'){
          await personalStates.setVisitState({userId:i.user.id,target,visitState:'none',globalName:names.globalName,displayName:names.displayName,visibleTarget:source.row});
          message='Visit status cleared.';
        }else return i.reply({content:'That Personal Actions choice is not valid.',flags:MessageFlags.Ephemeral});
        return i.update({...personalActionsPayload({token:stateToken,target,state:await personalStates.get(i.user.id,target)}),content:message});
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:personal:return:')){
      const stateToken=id.split(':')[3],found=personalActionContext(i,stateToken);
      if(found.error)return i.reply({content:found.error,flags:MessageFlags.Ephemeral});
      try{
        const source=await personalActionSource(i,found.context);
        if(found.context.sourceKind==='official')return i.update(officialHousePayload(await withOfficialState(i,source.row),'hu:find'));
        if(found.context.sourceKind==='pass')return i.update(sharedPrivateHousePayload(await withPassState(i,source.row,found.context.sourceId),{token:found.context.sourceId,canCopy:source.resolved.access.canCopy}));
        return i.update(destinationMenuPayload(await withHouseCardContext(i,source.row),{canEdit:canEditSaved(i,source.row),backId:'hu:find'}));
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id==='hu:legacy:preview'){
      const deferred=typeof i.deferUpdate==='function';if(deferred)await i.deferUpdate();
      const preview=await environments.previewPrivateLegacy({userId:i.user.id,esoServer:guilds.getEsoServer(i.guildId)});
      const payload=legacyAssignmentPayload(preview,{confirm:true});return deferred?i.editReply(payload):i.update(payload);
    }
    if(id.startsWith('hu:legacy:confirm:')){
      const parts=id.split(':'),esoServer=parts[3],expectedFingerprint=parts[4];
      const deferred=typeof i.deferUpdate==='function';if(deferred)await i.deferUpdate();
      try{const result=await environments.confirmPrivateLegacy({userId:i.user.id,esoServer,actorId:i.user.id,expectedFingerprint,guildId:i.guildId,names:{guildName:i.guild?.name,actorGlobalName:i.user.globalName||i.user.username,actorDisplayName:i.member?.displayName}}),payload={...await dashboard(i),content:`Assigned **${result.houses}** house${result.houses===1?'':'s'} and **${result.tours}** tour${result.tours===1?'':'s'} to this ESO environment.`};return deferred?i.editReply(payload):i.update(payload);}
      catch(error){const payload={...await dashboard(i),content:error.message};return deferred?i.editReply(payload):i.update(payload);}
    }
    if(id==='hu:my:library'){
      const owned=(await myAddressBook.houses(i.user.id,guilds.getEsoServer(i.guildId))).filter(row=>row.scope==='global'||row.scope==='public'&&String(row.guild_id)===String(i.guildId)||row.scope==='private'&&String(row.owner_user_id)===String(i.user.id)).map(legacySavedRow);
      const marked=await Promise.all(['favorites','wantToVisit','visited'].map(kind=>personalStates.list({...contextFor(i),kind})));
      const unique=new Map();for(const row of [...owned,...marked.flat()]){const key=houseTargetKey(houseTarget(row));if(!unique.has(key))unique.set(key,row);}
      const rows=[...unique.values()];
      if(!rows.length)return i.update({...await dashboard(i),content:'Your address book is empty. Register a house or choose Favorite on a house card.'});
      return i.update(createPicker(i,{kind:'visit',rows,extra:{title:'📖 All Saved Places',description:'Your houses and intentionally saved places.',actions:[{customId:'hu:my:favorites',label:'Favorites',style:'secondary'}]},backId:'hu:my'}));
    }
    if(id==='hu:my:houses'){
      const rows=(await myAddressBook.houses(i.user.id,guilds.getEsoServer(i.guildId))).map(legacySavedRow);
      if(!rows.length)return i.update({...await dashboard(i),content:'You have not registered or saved any houses yet.'});
      return i.update(createPicker(i,{kind:'visit',rows,extra:{title:'🏠 My Houses',description:`You have ${rows.length} saved or submitted house${rows.length===1?'':'s'}. Global houses appear first, then Server, then Private.`},backId:'hu:my'}));
    }
    if(id==='hu:my:tours'){
      const rows=await myAddressBook.tours(i.user.id,guilds.getEsoServer(i.guildId));
      if(!rows.length)return i.update({...await dashboard(i),content:'You have not created any tours yet.'});
      return i.update(createPicker(i,{kind:'tour-view',rows,extra:{title:'🗺️ My Tours',description:`You have created ${rows.length} tour${rows.length===1?'':'s'}.`},backId:'hu:my'}));
    }
    if(id==='hu:my:pending')return i.update(myPendingPayload(await myAddressBook.pending(i.user.id,guilds.getEsoServer(i.guildId),i.guildId)));
    if(id==='hu:my:recent'){
      const rows=(await myAddressBook.recent(i.user.id,i.guildId,guilds.getEsoServer(i.guildId))).map(legacySavedRow);
      if(!rows.length)return i.update({...await dashboard(i),content:'Houses you open will appear here for quick access.'});
      return i.update(createPicker(i,{kind:'visit',rows,extra:{title:'🕘 Recently Viewed',description:'Your most recently opened saved houses, newest first.'},backId:'hu:my'}));
    }
    if(['hu:my:favorites','hu:my:want','hu:my:visited'].includes(id)){
      const config={
        'hu:my:favorites':{kind:'favorites',picker:'personal-favorites',title:'⭐ My Favorites',empty:'Choose Favorite on a house card.'},
        'hu:my:want':{kind:'wantToVisit',picker:'personal-want',title:'📌 Want to Visit',empty:'Choose Want to Visit on a house card.'},
        'hu:my:visited':{kind:'visited',picker:'personal-visited',title:'✅ Visited Houses',empty:'Choose Visited on a house card.'}
      }[id];
      const rows=await personalStates.list({...contextFor(i),kind:config.kind});
      if(!rows.length)return i.update({...await dashboard(i),content:config.empty});
      return i.update(createPicker(i,{kind:config.picker,rows,extra:{title:config.title,description:`${rows.length} accessible house${rows.length===1?'':'s'}.`},backId:'hu:my'}));
    }
    if(id==='hu:my:searches')return i.update(await savedSearchList(i,0));
    if(id==='hu:my:progress'||id.startsWith('hu:my:progress:prev:')||id.startsWith('hu:my:progress:next:')||id.startsWith('hu:my:progress:page:')){
      const page=id==='hu:my:progress'?1:Math.max(1,Number(id.split(':')[4])||1);
      const rows=await progress.listInProgress({userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
      return i.update(progressPayload({item:rows[0]||null,items:rows,page}));
    }
    if(id==='hu:progress:completed'||id.startsWith('hu:progress:completed:from:')||id.startsWith('hu:progress:completed:prev:')||id.startsWith('hu:progress:completed:next:')||id.startsWith('hu:progress:completed:page:')){
      const parts=id.split(':'),page=['prev','next','page'].includes(parts[3])?Math.max(1,Number(parts[4])||1):1,from=parts.indexOf('from'),activePage=from>=0?Math.max(1,Number(parts[from+1])||1):1;
      const rows=await progress.listCompleted({userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
      return i.update(progressCompletedPayload({items:rows,page,activePage}));
    }
    if(id.startsWith('hu:progress:history:prev:')||id.startsWith('hu:progress:history:next:')){
      const parts=id.split(':'),progressId=Number(parts[4]),page=Number(parts[5]),listPage=Math.max(1,Number(parts[6])||1),from=parts.indexOf('from'),activePage=from>=0?Math.max(1,Number(parts[from+1])||1):1;
      try{const rows=await db.query('SELECT * FROM tour_progress WHERE id=? AND discord_user_id=?',[progressId,String(i.user.id)]);if(!rows[0])return i.reply({content:'That progress run is no longer available.',flags:MessageFlags.Ephemeral});const stops=await progress.completedStops({progressId,userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});return i.update(progressHistoryPayload({progress:rows[0].status==='completed'?await progress.reconcile({progressId,userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)}):rows[0],stops,page,listPage,activePage}));}catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:ph:')){
      const parts=id.split(':'),progressId=Number(parts[2]),listPage=Math.max(1,Number(parts[3])||1),page=Math.max(1,Number(parts[4])||1),activePage=Math.max(1,Number(parts[5])||1);
      try{const rows=await db.query('SELECT * FROM tour_progress WHERE id=? AND discord_user_id=?',[progressId,String(i.user.id)]);if(!rows[0])return i.reply({content:'That progress run is no longer available.',flags:MessageFlags.Ephemeral});const stops=await progress.completedStops({progressId,userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});return i.update(progressHistoryPayload({progress:rows[0].status==='completed'?await progress.reconcile({progressId,userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)}):rows[0],stops,page,listPage,activePage}));}catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:progress:history:')){
      const parts=id.split(':'),progressId=Number(parts[3]),listPage=Math.max(1,Number(parts[4])||1),page=Math.max(1,Number(parts[5])||1),from=parts.indexOf('from'),activePage=from>=0?Math.max(1,Number(parts[from+1])||1):1;
      try{const rows=await db.query('SELECT * FROM tour_progress WHERE id=? AND discord_user_id=?',[progressId,String(i.user.id)]);if(!rows[0])return i.reply({content:'That progress run is no longer available.',flags:MessageFlags.Ephemeral});const stops=await progress.completedStops({progressId,userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});return i.update(progressHistoryPayload({progress:rows[0].status==='completed'?await progress.reconcile({progressId,userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)}):rows[0],stops,page,listPage,activePage}));}catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:progress:resume:')){
      const item=await db.query('SELECT * FROM tour_progress WHERE id=? AND discord_user_id=?',[Number(id.split(':')[3]),String(i.user.id)]);
      try{const current=item[0]?await progress.startOrResume({userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),tourId:item[0].tour_id,sharePassId:item[0].share_pass_id}):null;return i.update(await progressRunCard(i,current,{listPage:Math.max(1,Number(id.split(':')[4])||1)}));}catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:progress:return:')){
      const payload=await tourReturnPayload(i,id);
      return payload?i.update(payload):i.reply({content:'That tour progress is no longer available.',flags:MessageFlags.Ephemeral});
    }
    if(id.startsWith('hu:progress:details:')||id.startsWith('hu:progress:hide:')){
      const parts=id.split(':'),progressId=Number(parts[3]),rows=await db.query('SELECT * FROM tour_progress WHERE id=? AND discord_user_id=?',[progressId,String(i.user.id)]);
      if(!rows[0])return i.reply({content:'That tour progress is no longer available.',flags:MessageFlags.Ephemeral});
      return i.update(await progressRunCard(i,rows[0],{showDetails:parts[2]==='details',listPage:Math.max(1,Number(parts[4])||1)}));
    }
    if(id.startsWith('hu:progress:edit:')){
      const parts=id.split(':'),progressId=Number(parts[3]),savedHouseId=Number(parts[4]),detailState=parts[5]==='expanded'?'expanded':'compact';
      const rows=await db.query('SELECT current_stop_id FROM tour_progress WHERE id=? AND discord_user_id=?',[progressId,String(i.user.id)]),stop=rows[0]?await db.query('SELECT saved_house_id FROM tour_stops WHERE id=?',[Number(rows[0].current_stop_id)]):[];
      if(!rows[0]||Number(stop[0]?.saved_house_id)!==savedHouseId)return i.reply({content:'That tour stop has changed. Use the current Edit House button.',flags:MessageFlags.Ephemeral});
      return openTourHouseEditor(i,savedHouseId,`hu:progress:return:${progressId}:${rows[0].current_stop_id}:${detailState}${Number(parts[6])>1?`:${Math.floor(Number(parts[6]))}`:''}`);
    }
    if(id.startsWith('hu:progress:comments:')){
      const parts=id.split(':'),progressId=Number(parts[3]),detailState=parts[4]==='expanded'?'expanded':'compact';
      const rows=await db.query('SELECT * FROM tour_progress WHERE id=? AND discord_user_id=?',[progressId,String(i.user.id)]),view=await progressView(i,rows[0]||null);
      if(!view?.current_saved_house_id)return i.reply({content:'That tour stop is no longer available.',flags:MessageFlags.Ephemeral});
      const access=await loadSavedReference(i,view.current_saved_house_id),scope=access.record.scope==='private'?'personal':access.record.scope==='global'?'global':'server';
      return commentsScreen(i,scope,view.current_saved_house_id,'reply',`hu:progress:return:${progressId}:${rows[0].current_stop_id}:${detailState}${Number(parts[5])>1?`:${Math.floor(Number(parts[5]))}`:''}`);
    }
    if(id.startsWith('hu:progress:list:')){
      const parts=id.split(':'),progressId=Number(parts[3]),detailState=parts[4]==='expanded'?'expanded':'compact';
      const rows=await db.query('SELECT * FROM tour_progress WHERE id=? AND discord_user_id=?',[progressId,String(i.user.id)]),view=await progressView(i,rows[0]||null),t=view?await tourById(i,view.tour_id):null,stops=t?await tours.getStops(t.id):[];
      if(!view||!t)return i.reply({content:'That tour progress is no longer available.',flags:MessageFlags.Ephemeral});
      return i.reply({embeds:[tourEmbed(t,stops)],components:buttonRows([{customId:`hu:progress:return:${progressId}:${rows[0].current_stop_id}:${detailState}${Number(parts[5])>1?`:${Math.floor(Number(parts[5]))}`:''}`,label:'Back to Current Stop',style:'secondary',emoji:'↩️'}]),flags:MessageFlags.Ephemeral});
    }
    if(id.startsWith('hu:progress:house:')){
      try{const parts=id.split(':'),access=await loadSavedReference(i,Number(parts[3]));if(!access?.record)return i.reply({content:'That tour stop house is no longer available.',flags:MessageFlags.Ephemeral});return i.update(destinationMenuPayload(await withHouseCardContext(i,legacySavedRow(access.record)),{backId:Number(parts[4])>1?`hu:my:progress:page:${Math.floor(Number(parts[4]))}`:'hu:my:progress'}));}catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:progress:next:')||id.startsWith('hu:progress:back:')||id.startsWith('hu:progress:restart:')){
      const parts=id.split(':'),action=parts[2],progressId=Number(parts[3]),showDetails=parts[4]==='expanded',listPage=Math.max(1,Number(parts[5]||(parts[4]==='expanded'||parts[4]==='compact'?1:parts[4]))||1);
      let item;
      if(action==='next')item=await progress.advance({progressId,userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
      else if(action==='back')item=await progress.back({progressId,userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
      else item=await progress.restart({progressId,userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
      if(action==='next')await recordUsage(i,'advanced_tour',{kind:'tour',id:item.tour_id});if(action==='restart')await recordUsage(i,'started_tour',{kind:'tour',id:item.tour_id});
      return i.update(await progressRunCard(i,item,{showDetails,listPage}));
    }
    if(id.startsWith('hu:my:resume:')||id.startsWith('hu:my:restart:')||id.startsWith('hu:my:end:')){
      const parts=id.split(':'),action=parts[2],session=await sessions.get(Number(parts[3]));
      if(!session||!canControlTourSession(session,i.user.id)||String(session.guild_id)!==String(i.guildId)||String(session.channel_id)!==String(i.channelId))return i.reply({content:'This tour has been closed.',flags:MessageFlags.Ephemeral});
      if(action==='end'){await sessions.end(session.id);return i.update({...await dashboard(i),content:'Tour ended.'});}
      const tour=await tours.get(session.tour_id),stops=tour?await tours.getStops(tour.id):[];
      if(!tour||!stops.length){await sessions.end(session.id);return i.update({...await dashboard(i),content:'That tour is no longer available.'});}
      if(!sharedTourStillVisible(tour,session)){await sessions.end(session.id);return i.reply({content:'This Shared tour has been closed because its visibility or server changed.',flags:MessageFlags.Ephemeral});}
      const route=await readiness.check(session.tour_id,{viewerId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
      if(route.blocking.length)return i.reply({content:route.blocking[0].message,flags:MessageFlags.Ephemeral});
      if(action==='restart'){await db.query('UPDATE tour_sessions SET current_position=1 WHERE id=?',[session.id]);session.current_position=1;}
      const position=Math.max(1,Math.min(stops.length,Number(session.current_position)));
      return i.update(await tourSessionCard(i,tour,stops,session,position,false));
    }
    if(id==='hu:globalmod')return globalModeratorScreen(i);
    if(id==='hu:globalmod:request')return i.showModal(globalModeratorRequestModal());
    if(id==='hu:globalmod:requests'||id.startsWith('hu:globalmod:requests:')){
      if(!globalMods.isApprover(i.user.id))return i.reply({content:'Only a configured Global Moderator approver can review requests.',flags:MessageFlags.Ephemeral});
      return i.update(globalModeratorRequestsPayload(await globalMods.listPending(),Number(id.split(':')[3])||1));
    }
    if(id==='hu:globalmod:list'||id.startsWith('hu:globalmod:list:')){
      if(!globalMods.isApprover(i.user.id))return i.reply({content:'Only a configured Global Moderator approver can manage Global Moderators.',flags:MessageFlags.Ephemeral});
      return i.update(globalModeratorListPayload(await globalMods.listModerators(),Number(id.split(':')[3])||1));
    }
    if(id.startsWith('hu:globalmod:approve:')||id.startsWith('hu:globalmod:deny:')){
      if(!globalMods.isApprover(i.user.id))return i.reply({content:'Only a configured Global Moderator approver can review requests.',flags:MessageFlags.Ephemeral});
      const parts=id.split(':'),requestId=Number(parts[3]),page=Number(parts[4])||1,deferred=typeof i.deferUpdate==='function';
      if(deferred)await i.deferUpdate();
      try{
        if(parts[2]==='approve')await globalMods.approve(requestId,i.user.id); else await globalMods.deny(requestId,i.user.id);
        const payload={...globalModeratorRequestsPayload(await globalMods.listPending(),page),content:`Global Moderator request ${parts[2]==='approve'?'approved':'denied'}.`};
        return deferred?i.editReply(payload):i.update(payload);
      }catch(error){
        const stale=/not found|already reviewed|no longer pending/i.test(String(error?.message||''));
        const payload={...globalModeratorRequestsPayload(await globalMods.listPending(),page),content:stale?'That request was already reviewed or is no longer pending. The queue has been refreshed.':'That request could not be reviewed. The queue has been refreshed.'};
        return deferred?i.editReply(payload):i.update(payload);
      }
    }
    if(id.startsWith('hu:globalmod:revoke:')){
      if(!globalMods.isApprover(i.user.id))return i.reply({content:'Only a configured Global Moderator approver can revoke access.',flags:MessageFlags.Ephemeral});
      const parts=id.split(':'),page=Number(parts[5])||1,deferred=typeof i.deferUpdate==='function';
      if(deferred)await i.deferUpdate();
      try{
        const revoked=await globalMods.revoke(parts[4],parts[3],i.user.id);
        const payload={...globalModeratorListPayload(await globalMods.listModerators(),page),content:revoked?'Global Moderator access revoked.':'That grant was already revoked. The list has been refreshed.'};
        return deferred?i.editReply(payload):i.update(payload);
      }catch{
        const payload={...globalModeratorListPayload(await globalMods.listModerators(),page),content:'That grant could not be revoked. The list has been refreshed.'};
        return deferred?i.editReply(payload):i.update(payload);
      }
    }
    if(id==='hu:environment:change:start'){
      if(!isAdmin(i))return i.reply({content:'You do not have Housing administration access.',flags:MessageFlags.Ephemeral});
      return i.update(environmentChangeChoicePayload(guilds.getEsoServer(i.guildId)));
    }
    if(id.startsWith('hu:environment:confirm:')){
      if(!isAdmin(i))return i.reply({content:'You do not have Housing administration access.',flags:MessageFlags.Ephemeral});
      const parts=id.split(':'),toEsoServer=parts[3],expectedFingerprint=parts[4];
      const deferred=typeof i.deferUpdate==='function';if(deferred)await i.deferUpdate();
      try{const result=await environments.confirmChange({guildId:i.guildId,toEsoServer,actorId:i.user.id,expectedFingerprint,names:{guildName:i.guild?.name,actorGlobalName:i.user.globalName||i.user.username,actorDisplayName:i.member?.displayName}});await guilds.ensureSettings(i.guildId);const payload={...adminPayload(guilds.getSettings(i.guildId)),content:`ESO environment changed to **${esoServerLabel(result.toEsoServer)}**. ${result.counts.removedStops} incompatible tour stop${result.counts.removedStops===1?' was':'s were'} removed.`};return deferred?i.editReply(payload):i.update(payload);}
      catch(error){const payload={content:error.message,embeds:[],components:buttonRows([{customId:'hu:environment:change:start',label:'Review Again',style:'primary'},{customId:'hu:admin',label:'Back',style:'secondary'}])};return deferred?i.editReply(payload):i.update(payload);}
    }
    if(id.startsWith('hu:manage:')||id.startsWith('hu:house-return:')){
      try{
        const sid=id.split(':')[2],context=personalActionStates.get(sid);
        if(!context||context.userId!==i.user.id||context.guildId!==i.guildId||context.esoServer!==guilds.getEsoServer(i.guildId)||Date.now()-context.created>30*60*1000)throw new Error('That house menu expired. Open the house again.');
        const access=await loadSavedReference(i,context.sourceId),row=access.record&&legacySavedRow(access.record);
        if(context.sourceKind!=='saved'||!row||(!access.canView&&!canEditSaved(i,row)))throw new Error('That house is no longer available.');
        if(id.startsWith('hu:house-return:')){
          const state=houseManagementStates.get(sid);if(!state)throw new Error('That house menu expired. Open the house again.');
          return i.update(destinationMenuPayload(await withHouseCardContext(i,row),{canEdit:canEditSaved(i,row),...state.view}));
        }
        if(!canEditSaved(i,row))throw new Error('You do not have edit access to that house.');
        const controls=messageControls(i.message?.components);
        const detail=controls.find(b=>String(b.custom_id||b.customId||'').startsWith('hu:details:'));
        if(!detail)throw new Error('Open the house again to manage it.');
        const parts=(detail.custom_id||detail.customId).split(':'),backId=decodeURIComponent(parts.slice(5).join(':'));
        const random=controls.find(b=>String(b.custom_id||b.customId||'').startsWith('hu:surprise:again:'));
        const view={backId,showDetails:parts[4]==='hide',navigation:navigationFromBackId(backId),surpriseToken:random?(random.custom_id||random.customId).split(':')[3]:null};
        houseManagementStates.set(sid,{view});
        const returnId=`hu:house-return:${sid}`,actionBack=encodeURIComponent(returnId),scope=row.scope==='personal'?'personal':row.scope==='global'?'global':'guild';
        return i.update({...destinationMenuPayload(await withHouseCardContext(i,row),{showDetails:view.showDetails}),components:buttonRows([
          {customId:`hu:${scope}:edit:${row.id}:${actionBack}`,label:'Edit House',style:'secondary'},
          {customId:`hu:scope:change:${row.id}:${actionBack}`,label:'Change Visibility',style:'secondary'},
          {customId:`hu:${scope}:remove:${row.id}:${actionBack}`,label:'Delete House',style:'danger'},
          {customId:returnId,label:'Back to house',style:'secondary'}
        ])});
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:scope:change:')){
      const p=id.split(':'),rid=Number(p[3]),backId=decodeURIComponent(p.slice(4).join(':')||'hu:find'),r=(await loadSavedReference(i,rid)).record;
      if(!r||!canEditSaved(i,legacySavedRow(r)))return i.reply({content:'You do not have edit access to that house.',flags:MessageFlags.Ephemeral});
      return i.update(houseScopePayload(legacySavedRow(r),backId));
    }
    if(id.startsWith('hu:scope:set:')){
      const p=id.split(':'),targetScope=p[3],rid=Number(p[4]),backId=decodeURIComponent(p.slice(5).join(':')||'hu:find');
      try{
        const ctx=await scopeChangeContext(i,rid,targetScope);
        if(ctx.current.scope===targetScope)return i.update(destinationMenuPayload(await withHouseCardContext(i,ctx.currentLegacy),{canEdit:true,backId}));
        if(ctx.preview.affectedTours.length){
          const list=ctx.preview.affectedTours.slice(0,12).map(t=>`• ${t.name}`).join('\n');
          const more=ctx.preview.affectedTours.length>12?`\n…plus ${ctx.preview.affectedTours.length-12} more.`:'';
          return i.update(confirmPayload({title:'Change House Visibility?',description:`Changing this house to **${targetScope==='private'?'Private':targetScope==='public'?'Server':'Global'}** will remove it from **${ctx.preview.affectedTours.length} tour${ctx.preview.affectedTours.length===1?'':'s'}** where it will no longer be eligible:\n\n${list}${more}\n\nComments and the saved-house record will be retained.`,confirmId:`hu:scope:confirm:${targetScope}:${rid}:${encodeURIComponent(backId)}`,cancelId:`hu:context:view:${ctx.currentLegacy.scope}:${rid}:${encodeURIComponent(backId)}`}));
        }
        return applyScopeChange(i,rid,targetScope,backId);
      }catch(e){return i.reply({content:e.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:scope:confirm:')){
      const p=id.split(':'),targetScope=p[3],rid=Number(p[4]),backId=decodeURIComponent(p.slice(5).join(':')||'hu:find');
      try{return await applyScopeChange(i,rid,targetScope,backId);}catch(e){return i.reply({content:e.message,flags:MessageFlags.Ephemeral});}
    }
    if(id==='hu:find')return startAdvanced(i,'all');
    if(id==='hu:register')return i.update(registrationPayload(i));
    if(id.startsWith('hu:register:continue:')){const type=id.split(':')[3];if(!registrationScopeFromType(type))return;return i.showModal(destinationInputModal(type));}
    if(id.startsWith('hu:pass:house:comments:')){
      const passToken=id.split(':').slice(4).join(':');
      try{
        return await openCommentReader(i,{kind:'pass',passToken,backId:`hu:pass:house:view:${passToken}`});
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:pass:house:comment:add:')){
      const passToken=id.split(':').slice(5).join(':');
      try{
        const resolved=await sharePasses.resolveHousePass(passToken,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
        return i.showModal(commentModal('personal',resolved.house.id,`hu:pass:house:view:${passToken}`,destinationLabel(resolved.house)).setCustomId(`hu:modal:pass:house:comment:${passToken}`));
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:pass:house:details:')){
      const parts=id.split(':'),showDetails=parts[4]!=='hide',passToken=parts.slice(parts[4]==='hide'||parts[4]==='show'?5:4).join(':');
      try{
        const resolved=await sharePasses.resolveHousePass(passToken,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
        return i.update(sharedPrivateHousePayload(await withPassState(i,resolved.house,passToken),{token:passToken,canCopy:resolved.access.canCopy,showDetails}));
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:pass:house:view:')){
      const passToken=id.split(':').slice(4).join(':');
      try{
        const resolved=await sharePasses.resolveHousePass(passToken,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
        const payload=sharedPrivateHousePayload(await withPassState(i,resolved.house,passToken),{token:passToken,canCopy:resolved.access.canCopy});
        return i.message?.flags?.has?.(MessageFlags.Ephemeral)?i.update(payload):i.reply({...payload,flags:MessageFlags.Ephemeral});
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:pass:house:copyvisibility:')){
      const parts=id.split(':'),visibility=parts[4],passToken=parts.slice(5).join(':');
      try{
        const resolved=await sharePasses.resolveHousePass(passToken,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
        const preview=await houseCopies(i).preview({sourceSavedHouseId:resolved.house.id,userId:i.user.id,guildId:i.guildId,passId:resolved.pass.id,targetEsoServer:guilds.getEsoServer(i.guildId)});
        const choice=preview.choices.find(item=>item.visibility===visibility);
        if(!choice?.enabled)throw new Error(choice?.reason||'That visibility is not available.');
        return i.showModal(houseCopyMetadataModal(preview,{token:passToken,visibility}));
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:pass:house:copy:')){
      const passToken=id.split(':').slice(4).join(':');
      try{
        const resolved=await sharePasses.resolveHousePass(passToken,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
        const preview=await houseCopies(i).preview({sourceSavedHouseId:resolved.house.id,userId:i.user.id,guildId:i.guildId,passId:resolved.pass.id,targetEsoServer:guilds.getEsoServer(i.guildId)});
        return i.update(houseCopyVisibilityPayload(preview,{token:passToken}));
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:pass:tour:info:')){
      const passToken=id.split(':').slice(4).join(':');
      const updateDeferred=!!i.message?.flags?.has?.(MessageFlags.Ephemeral)&&typeof i.deferUpdate==='function';
      const replyDeferred=!updateDeferred&&typeof i.deferReply==='function';
      try{
        if(updateDeferred)await i.deferUpdate();else if(replyDeferred)await i.deferReply({flags:MessageFlags.Ephemeral});
        const resolved=await sharePasses.resolveTourPass(passToken,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
        const payload=tourPassInformationPayload(resolved,{token:passToken});
        if(updateDeferred||replyDeferred)return i.editReply(payload);
        return i.message?.flags?.has?.(MessageFlags.Ephemeral)?i.update(payload):i.reply({...payload,flags:MessageFlags.Ephemeral});
      }catch(error){const payload={content:error.message,embeds:[],components:[]};return updateDeferred||replyDeferred?i.editReply(payload):i.reply({...payload,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:pass:tour:comment:add:')){
      const parts=id.split(':'),sessionId=Number(parts[5]),stopId=Number(parts[6]),detailState=parts[7]==='expanded'?'expanded':'compact';
      try{
        const {stop}=await passTourStopContext(i,sessionId,stopId);
        return i.showModal(commentModal('personal',stop.source_id,`tour:return:${sessionId}:${stopId}:${detailState}`,destinationLabel(stop)).setCustomId(`hu:modal:pass:tour:comment:${sessionId}:${stopId}:${detailState}`));
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:pass:tour:start:')){
      const passToken=id.split(':').slice(4).join(':');
      const deferred=typeof i.deferReply==='function';
      try{
        if(deferred)await i.deferReply({flags:MessageFlags.Ephemeral});
        const resolved=await sharePasses.resolveTourPass(passToken,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
        const session=await sessions.startFromPass({passId:resolved.pass.id,tourId:resolved.tour.id,guildId:i.guildId,channelId:i.channelId,userId:i.user.id,esoServer:guilds.getEsoServer(i.guildId)});
        const count=resolved.stops.length?await tourStopCommentCount(resolved.stops[0],i.user.id):0;
        const payload={embeds:[tourEmbed(resolved.tour,resolved.stops,1,count,false,{shared:false,leaderId:i.user.id})],components:tourButtons(session.id,count)};
        return deferred?i.editReply(payload):i.reply({...payload,flags:MessageFlags.Ephemeral});
      }catch(error){const payload={content:error.message,embeds:[],components:[]};return deferred?i.editReply(payload):i.reply({...payload,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:pass:tour:copyconfirm:')){
      const passToken=id.split(':').slice(4).join(':');
      try{
        await i.deferUpdate();
        const resolved=await sharePasses.resolveTourPass(passToken,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
        const copied=await tourCopies.copy({tourId:resolved.tour.id,passId:resolved.pass.id,userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
        const stops=await tours.getStops(copied.id);
        return i.editReply({...tourDetailPayload(copied,stops,true),content:'Tour copied successfully. This Private tour is now independent of the Share Pass.'});
      }catch(error){
        const payload={content:`Nothing was copied. ${error.message}`,embeds:[],components:[]};
        return i.deferred?i.editReply(payload):i.reply({...payload,flags:MessageFlags.Ephemeral});
      }
    }
    if(id.startsWith('hu:pass:tour:copy:')){
      const passToken=id.split(':').slice(4).join(':');
      const updateDeferred=!!i.message?.flags?.has?.(MessageFlags.Ephemeral)&&typeof i.deferUpdate==='function';
      const replyDeferred=!updateDeferred&&typeof i.deferReply==='function';
      try{
        if(updateDeferred)await i.deferUpdate();else if(replyDeferred)await i.deferReply({flags:MessageFlags.Ephemeral});
        const resolved=await sharePasses.resolveTourPass(passToken,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
        const preview=await tourCopies.preview({tourId:resolved.tour.id,passId:resolved.pass.id,userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
        const payload=tourCopyPreviewPayload(preview,{token:passToken});
        if(updateDeferred||replyDeferred)return i.editReply(payload);
        return i.message?.flags?.has?.(MessageFlags.Ephemeral)?i.update(payload):i.reply({...payload,flags:MessageFlags.Ephemeral});
      }catch(error){const payload={content:error.message,embeds:[],components:[]};return updateDeferred||replyDeferred?i.editReply(payload):i.reply({...payload,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:houseform-retry:')){
      const retry=registrationDrafts.get(id.split(':')[2],i.user.id);
      if(!retry||retry.kind!=='legacy-retry'||retry.guildId!==i.guildId||retry.esoServer!==guilds.getEsoServer(i.guildId))return i.reply({content:'That retry expired or belongs to another server or ESO environment.',flags:MessageFlags.Ephemeral});
      if(retry.action==='edit'){
        const access=await loadSavedReference(i,retry.targetId);
        if(!access.canView||!canEditSaved(i,legacySavedRow(access.record)))return i.reply({content:'You no longer have edit access to that house.',flags:MessageFlags.Ephemeral});
      }
      const data=retry.data,fields={id:retry.targetId,house_name:data.house,eso_owner:data.owner,nickname:data.nickname,display_name:data.nickname,notes:data.description,description:data.description,tags:JSON.stringify(parseTagInput(data.tags))};
      return i.showModal(retry.action==='edit'?houseEditModal(retry.scope,fields,retry.backId):registerHouseFormModal(retry.scope==='personal'?'private':retry.scope==='guild'?'public':'global',fields));
    }
    if(id.startsWith('hu:register-retry:')){
      const retry=registrationDrafts.get(id.split(':')[2],i.user.id);
      if(!retry||retry.kind!=='retry'||retry.guildId!==i.guildId||retry.esoServer!==guilds.getEsoServer(i.guildId))return i.reply({content:'That retry expired or belongs to another server or ESO environment. Start registration again.',flags:MessageFlags.Ephemeral});
      return i.showModal(destinationInputModal(retry.visibility,{destination:retry.input,owner:retry.owner}));
    }
    if(id.startsWith('hu:register-cancel:')){ registrationDrafts.remove(id.split(':')[2],i.user.id); return i.update(homePayload({isAdmin:isAdmin(i),esoServer:guilds.getEsoServer(i.guildId)})); }
    if(id.startsWith('hu:register-owner:')){
      const p=id.split(':'),choice=p[2],draft=registrationDrafts.get(p[3],i.user.id);
      if(!draft)return i.reply({content:'That registration draft expired. Start Register New House again.',flags:MessageFlags.Ephemeral});
      const owner=choice==='parsed'?draft.ownerConflict?.parsed:draft.ownerConflict?.entered;
      registrationDrafts.update(draft.id,i.user.id,{esoOwner:owner,ownerConflict:null});
      return reviewRegistrationDraft(i,draft,'update');
    }
    if(id.startsWith('hu:register-metadata:')){
      const draft=registrationDrafts.get(id.split(':')[2],i.user.id);
      if(!draft)return i.reply({content:'That registration draft expired. Start Register New House again.',flags:MessageFlags.Ephemeral});
      return i.showModal(registrationMetadataModal(draft.id,draft));
    }
    if(id.startsWith('hu:register-privatecopy:')){
      const draft=registrationDrafts.get(id.split(':')[2],i.user.id);
      if(!draft)return i.reply({content:'That registration draft expired. Start Register New House again.',flags:MessageFlags.Ephemeral});
      registrationDrafts.update(draft.id,i.user.id,{visibility:'private',expectedStatus:'active'});
      return i.showModal(registrationMetadataModal(draft.id,draft));
    }
    if(id.startsWith('hu:register-report:')){
      const parts=id.split(':'),draft=registrationDrafts.get(parts[2],i.user.id),savedHouseId=Number(parts[3]);
      if(!draft)return i.reply({content:'That registration draft expired. Start Register New House again.',flags:MessageFlags.Ephemeral});
      return i.showModal(reportExplanationModal({kind:'houseid',token:String(savedHouseId),problemType:'misleading_information'}));
    }
    if(id.startsWith('hu:register-save:')){
      const draft=registrationDrafts.get(id.split(':')[2],i.user.id);
      if(!draft)return i.reply({content:'That registration draft expired. Start Register New House again.',flags:MessageFlags.Ephemeral});
      if(draft.esoServer!==guilds.getEsoServer(i.guildId))return i.reply({content:'This Discord server’s ESO environment changed while you were registering the house. Start again so the destination is saved in the correct environment.',flags:MessageFlags.Ephemeral});
      registrationDrafts.remove(draft.id,i.user.id);
      const scope=registrationScopeFromType(draft.visibility);
      return finishHouseForm(i,scope,'add',null,{owner:draft.esoOwner,nickname:draft.nickname||null,description:draft.description||null,tags:draft.tags||[]},draft.house,'update','hu:home');
    }
    if(id==='hu:tours'){ await recordUsage(i,'searched_tours');const rows=await visibleTours(i); return i.update(toursPayload(rows.length)); }
    if(id.startsWith('hu:help:learning')||id.startsWith('hu:help:whatsnew')||id.startsWith('hu:help:topic:'))return i.update(helpPayload());
    if(id==='hu:help')return i.update(helpPayload());
    if(id==='hu:admin'){ if(!isAdmin(i))return i.reply({content:'You do not have access to Housing administration.',flags:MessageFlags.Ephemeral}); return i.update(renderAdminPayload(guilds.getSettings(i.guildId),{adminInterface,isOwner:guilds.isBotOwner(i)})); }
    if(id==='hu:admin:settings'){ if(!isAdmin(i))return i.reply({content:'You do not have access to Housing administration.',flags:MessageFlags.Ephemeral}); return i.update(adminSettingsPayload(guilds.getSettings(i.guildId))); }
    if(id==='hu:admin:otherroles'){ if(!isAdmin(i))return i.reply({content:'You do not have access to Housing administration.',flags:MessageFlags.Ephemeral}); return i.update(adminOtherRolesPayload(guilds.getSettings(i.guildId))); }
    if(id==='hu:admin:legacy-tours'){
      if(!isAdmin(i))return i.reply({content:'You do not have Housing administration access.',flags:MessageFlags.Ephemeral});
      const rows=await environments.listGuildLegacyTours({guildId:i.guildId});
      if(!rows.length)return i.update({...adminPayload(guilds.getSettings(i.guildId)),content:'There are no recoverable Server or Global legacy tours linked to this Discord server.'});
      return i.update(createPicker(i,{kind:'admin-legacy-tour',rows,extra:{title:'🧭 Legacy Tours',description:'Choose an Unassigned Server or Global tour linked to this Discord server. Private tours remain visible only to their creators.'},backId:'hu:admin'}));
    }
    if(id.startsWith('hu:legacy:')){
      if(!isAdmin(i))return i.reply({content:'You do not have Housing administration access.',flags:MessageFlags.Ephemeral});
      const parts=id.split(':'),tourId=Number(parts[2]),expectedFingerprint=parts[3];
      try{
        const result=await environments.confirmGuildLegacyTour({guildId:i.guildId,tourId,actorId:i.user.id,expectedFingerprint,names:{guildName:i.guild?.name,actorGlobalName:i.user.globalName||i.user.username,actorDisplayName:i.member?.displayName}});
        return i.update({...adminPayload(guilds.getSettings(i.guildId)),content:`Recovered **${result.name}** for ${esoServerLabel(result.esoServer)}. Retained **${result.counts.retainedStops}** stop${result.counts.retainedStops===1?'':'s'} and removed **${result.counts.removedStops}**.`});
      }catch(error){return i.update({...adminPayload(guilds.getSettings(i.guildId)),content:error.message});}
    }
    if(id==='hu:guild:pending'){
      if(!guilds.canReviewPending(i))return i.reply({content:'You do not have Housing administration access to review pending houses.',flags:MessageFlags.Ephemeral});
      const rows=await regs.searchPending(i.guildId,{esoServer:guilds.getEsoServer(i.guildId)});
      if(!rows.length)return i.update({...adminPayload(guilds.getSettings(i.guildId)),content:'There are no pending Server or Global house submissions from this server.'});
      return i.update(createPicker(i,{kind:'pending',rows,extra:{title:'📝 Pending House Review',description:'Choose a pending Server or Global house submission to review.'},backId:'hu:admin'}));
    }
    if(id==='hu:admin:health'){
      if(!isAdmin(i))return i.reply({content:'You do not have access to Housing administration.',flags:MessageFlags.Ephemeral});
      const channels=i.guild?.channels?.cache?[...i.guild.channels.cache.keys()]:[];
      return i.update(adminHealthPayload(await adminHealth.snapshot({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),availableChannelIds:channels})));
    }
    if(id==='hu:admin:audit'||id.startsWith('hu:admin:audit:prev:')||id.startsWith('hu:admin:audit:next:')){
      if(!isAdmin(i))return i.reply({content:'Only Housing Moderators can view the audit log.',flags:MessageFlags.Ephemeral});
      const page=id==='hu:admin:audit'?1:Number(id.split(':').at(-1));
      return i.update(auditLogPayload(await auditLog.list({guildId:i.guildId,page,pageSize:10})));
    }
    if(id==='hu:admin:export'){
      if(!isAdmin(i))return i.reply({content:'Only Housing Moderators can export guild data.',flags:MessageFlags.Ephemeral});
      try {
        const json=await dataExport.toJson({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),includePrivate:false});
        return i.reply({content:'Guild-scoped HearthBound export. Private records and audit history are excluded.',files:[{attachment:Buffer.from(json),name:`hearthbound-${i.guildId}-${guilds.getEsoServer(i.guildId)}.json`}],flags:MessageFlags.Ephemeral});
      } catch(error) { return i.reply({content:error.message,flags:MessageFlags.Ephemeral}); }
    }
    if(id==='hu:admin:maintenance'){
      if(!isAdmin(i))return i.reply({content:'Only Housing Moderators can manage data maintenance.',flags:MessageFlags.Ephemeral});
      return i.update(maintenancePayload({stale:await maintenance.stale({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)}),duplicates:await maintenance.duplicates({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)})}));
    }
    if(id.startsWith('hu:admin:maintenance:mergeconfirm:')){
      if(!isAdmin(i))return i.reply({content:'Only Housing Moderators can merge duplicate entries.',flags:MessageFlags.Ephemeral});
      const [, , , , keepId, removeId] = id.split(':');
      try { await maintenance.mergeDuplicate({keepId,removeId,actorId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)}); return i.update(maintenancePayload({stale:await maintenance.stale({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)}),duplicates:await maintenance.duplicates({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)})})); }
      catch(error) { return i.reply({content:error.message,flags:MessageFlags.Ephemeral}); }
    }
    if(id==='hu:admin:featured'){
      if(!isAdmin(i))return i.reply({content:'You do not have access to Housing administration.',flags:MessageFlags.Ephemeral});
      const rows=await featured.list({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
      return i.update(await enrichedFeaturedPayload(i,{items:rows,canManage:true}));
    }
    if(id==='hu:admin:passes'){
      if(!isAdmin(i))return i.reply({content:'You do not have access to Housing administration.',flags:MessageFlags.Ephemeral});
      return i.update(adminSharePassesPayload((await adminHealth.snapshot({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)})).passes));
    }
    if(id==='hu:admin:reports'){
      if(!isAdmin(i)&&!globalMods.isGlobalModeratorCached(i.user.id,guilds.getEsoServer(i.guildId)))return i.reply({content:'You do not have access to housing problem reports.',flags:MessageFlags.Ephemeral});
      const deferred=typeof i.deferUpdate==='function';if(deferred)await i.deferUpdate();const payload=reportQueuePayload(await reports.listForModerator(reportContext(i)));return deferred?i.editReply(payload):i.update(payload);
    }
    if(id.startsWith('hu:report:review:')){
      try{return i.update(reportReviewPayload(await reports.getForModerator(Number(id.split(':')[3]),reportContext(i))));}
      catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:report:markreviewing:')||id.startsWith('hu:report:resolve:')||id.startsWith('hu:report:dismiss:')){
      const parts=id.split(':'),action=parts[2],reportId=Number(parts[3]),context=reportContext(i),names={reviewerGlobalName:i.user.globalName||i.user.username,reviewerDisplayName:i.member?.displayName};
      try{
        if(action==='markreviewing')await reports.review(reportId,{reviewerId:i.user.id,guildId:i.guildId,esoServer:context.esoServer,isServerModerator:context.isServerModerator,isGlobalModerator:context.isGlobalModerator,isApprover:context.isApprover,names});
        else await reports.resolve(reportId,{reviewerId:i.user.id,guildId:i.guildId,esoServer:context.esoServer,isServerModerator:context.isServerModerator,isGlobalModerator:context.isGlobalModerator,isApprover:context.isApprover,resolution:action==='dismiss'?'dismissed':'resolved',names});
        return i.update(reportQueuePayload(await reports.listForModerator(context)));
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:pass:house:report:'))return i.reply({...reportProblemTypePayload({kind:'housepass',token:id.split(':').slice(4).join(':')}),flags:MessageFlags.Ephemeral});
    if(id.startsWith('hu:pass:tour:report:'))return i.reply({...reportProblemTypePayload({kind:'tourpass',token:id.split(':').slice(4).join(':')}),flags:MessageFlags.Ephemeral});
    if(id.startsWith('hu:report:houseid:')||id.startsWith('hu:report:tourid:')){
      const parts=id.split(':');
      return i.reply({...reportProblemTypePayload({kind:parts[2],token:parts.slice(3).join(':')}),flags:MessageFlags.Ephemeral});
    }

    if(id.startsWith('hu:advanced:x:')){
      const p=id.split(':'),aid=p[3],field=p[4],index=Number(p[5]),s=advancedState(i,aid);
      if(!s)return i.reply({content:'That Search Houses session expired. Open Search Houses again.',flags:MessageFlags.Ephemeral});
      const values=Array.isArray(s.filters[field])?s.filters[field]:null;
      if(values&&Number.isInteger(index)&&index>=0&&index<values.length)values.splice(index,1);
      return i.update(renderAdvanced(i,aid));
    }
    if(id.startsWith('hu:advanced:')){
      const p=id.split(':'),action=p[2],aid=p[3],s=advancedState(i,aid);
      if(!s)return i.reply({content:'That Search Houses session expired. Open Search Houses again.',flags:MessageFlags.Ephemeral});
      if(action==='name'||action==='owner')return i.showModal(advancedTextModal(aid,action,s.filters[action]||''));
      const openField={tagsopen:'tags',zoneopen:'zone',styleopen:'style',classificationopen:'classification',houseTypeopen:'houseType'}[action];
      if(openField)return i.update(await renderAdvancedAttribute(i,aid,openField));
      if(action==='filters')return i.showModal(searchFiltersModal(aid,s.filters,s.includeNonPlayer));
      if(action==='clear'){ s.filters=emptyAdvancedFilters(); s.includeNonPlayer=false; s.pages={tag:0,zone:0,style:0,classification:0,houseType:0}; return searchResults(i,s.filters,{searchType:'Search Houses',mode:'update',scope:s.scope||'all',includeNonPlayerHomes:false,backId:s.backId||'hu:home',alwaysPicker:true,advancedToken:aid}); }
      if(action==='manage')return i.update(advancedManagePayload(aid,s.filters));
      if(action==='remove'){ const field=p[4],page=Number(p[5]||0),values=Array.isArray(s.filters[field])?s.filters[field]:[]; return i.update(advancedRemovePayload({token:aid,field,values,page})); }
      if(action==='nonplayer'){ if((s.scope||'all')==='all'&&!s.filters.notOnPublicTours)s.includeNonPlayer=!s.includeNonPlayer; return i.update(renderAdvanced(i,aid)); }
      if(action==='search'||action==='results'){ const scope=s.scope||'all',searchType=scope==='personal'?'Private House Search':scope==='server'?'Server House Search':'Search Houses'; return searchResults(i,s.filters,{searchType,mode:'update',scope,includeNonPlayerHomes:s.includeNonPlayer,backId:s.backId||'hu:home',alwaysPicker:true,advancedToken:aid}); }
      if(action==='open')return i.update(renderAdvanced(i,aid));
    }

    if(id.startsWith('hu:personal:edit:')){ const p=id.split(':'),rid=Number(p[3]),backId=decodeURIComponent(p.slice(4).join(':')||''),raw=(await loadSavedReference(i,rid)).record,r=raw?.scope==='private'&&raw.owner_user_id===i.user.id?personalRow(raw):null; if(!r)return i.reply({content:'Private house not found.',flags:MessageFlags.Ephemeral}); return i.showModal(houseEditModal('personal',r,backId)); }
    if(id.startsWith('hu:personal:remove:')){ const p=id.split(':'),rid=Number(p[3]),backId=decodeURIComponent(p.slice(4).join(':')||''),raw=(await loadSavedReference(i,rid)).record,r=raw?.scope==='private'&&raw.owner_user_id===i.user.id?personalRow(raw):null; if(!r)return i.update({content:'Private house not found.',embeds:[],components:[]}); const ctx=encodeURIComponent(backId); return i.update(confirmPayload({title:'Remove Private House?',description:`Permanently delete **${destinationLabel(r)}** from your Private houses? Its comments and tour references will also be deleted.`,confirmId:`hu:personal:removeconfirm:${rid}:${ctx}`,cancelId:`hu:context:view:personal:${rid}:${ctx}`})); }
    if(id.startsWith('hu:personal:removeconfirm:')){ const p=id.split(':'),rid=Number(p[3]),backId=decodeURIComponent(p.slice(4).join(':')||''),raw=(await loadSavedReference(i,rid)).record,r=raw?.scope==='private'&&raw.owner_user_id===i.user.id?personalRow(raw):null; if(!r)return i.update({content:'Private house not found.',embeds:[],components:[]}); await saved.delete(rid,i.user.id); const ctx=removeFromSearchState(backId,'personal',rid); if(houseReturnOptions(backId)&&ctx)return i.update({...renderPicker(ctx.stateId),content:'House deleted.'}); if(ctx){ if(ctx.total>0)return housePickerDetail(i,ctx.stateId,ctx.index); const m=/^hu:advanced:open:([^:]+)$/.exec(ctx.state.backId||''); if(m&&advancedState(i,m[1]))return i.update({...renderAdvanced(i,m[1]),content:'Private house deleted. No houses remain in that result list.'}); return i.update({...homePayload({isAdmin:isAdmin(i),esoServer:guilds.getEsoServer(i.guildId)}),content:'Private house deleted. No houses remain in that result list.'}); } return i.update(homePayload({isAdmin:isAdmin(i),esoServer:guilds.getEsoServer(i.guildId)})); }

    if(id.startsWith('hu:guild:edit:')){ const p=id.split(':'),rid=Number(p[3]),backId=decodeURIComponent(p.slice(4).join(':')||''); const r=await regs.get(rid); if(!r||r.guild_id!==i.guildId||!canManageReg(i,r))return i.reply({content:'You do not manage that public house.',flags:MessageFlags.Ephemeral}); return i.showModal(houseEditModal('guild',r,backId)); }
    if(id.startsWith('hu:guild:remove:')){ const p=id.split(':'),rid=Number(p[3]),backId=decodeURIComponent(p.slice(4).join(':')||''); const r=await regs.get(rid); if(!r||r.guild_id!==i.guildId||!canManageReg(i,r))return i.update({content:'You do not manage that Server house.',embeds:[],components:[]}); const ctx=encodeURIComponent(backId); return i.update(confirmPayload({title:'Remove Server House?',description:`Permanently delete **${destinationLabel(r)}** from this server’s Server houses? Its comments and tour references will also be deleted.`,confirmId:`hu:guild:removeconfirm:${rid}:${ctx}`,cancelId:`hu:context:view:guild:${rid}:${ctx}`})); }
    if(id.startsWith('hu:global:edit:')){ const p=id.split(':'),rid=Number(p[3]),backId=decodeURIComponent(p.slice(4).join(':')||''); const r=(await loadSavedReference(i,rid)).record; if(!r||r.scope!=='global'||!canEditSaved(i,{...r,scope:'global'}))return i.reply({content:'You do not manage that Global house.',flags:MessageFlags.Ephemeral}); return i.showModal(houseEditModal('global',{...r,nickname:r.display_name,notes:r.description},backId)); }
    if(id.startsWith('hu:global:remove:')){ const p=id.split(':'),rid=Number(p[3]),backId=decodeURIComponent(p.slice(4).join(':')||''); const r=(await loadSavedReference(i,rid)).record; if(!r||r.scope!=='global'||!canEditSaved(i,{...r,scope:'global'}))return i.update({content:'You do not manage that Global house.',embeds:[],components:[]}); const ctx=encodeURIComponent(backId); return i.update(confirmPayload({title:'Delete Global House?',description:`Permanently delete **${destinationLabel(r)}** from the ${esoServerLabel(r.eso_server)} Global directory? Its comments and tour references will also be removed.`,confirmId:`hu:global:removeconfirm:${rid}:${ctx}`,cancelId:`hu:context:view:global:${rid}:${ctx}`})); }
    if(id.startsWith('hu:global:removeconfirm:')){ const p=id.split(':'),rid=Number(p[3]),backId=decodeURIComponent(p.slice(4).join(':')||''); const r=(await loadSavedReference(i,rid)).record; if(!r||r.scope!=='global'||!canEditSaved(i,{...r,scope:'global'}))return i.update({content:'You do not manage that Global house.',embeds:[],components:[]}); await saved.delete(rid,i.user.id); const ctx=removeFromSearchState(backId,'global',rid); if(houseReturnOptions(backId)&&ctx)return i.update({...renderPicker(ctx.stateId),content:'House deleted.'}); if(ctx?.total>0)return housePickerDetail(i,ctx.stateId,ctx.index); return i.update({...homePayload({isAdmin:isAdmin(i),esoServer:guilds.getEsoServer(i.guildId)}),content:'Global house deleted.'}); }

    if(id.startsWith('hu:guild:removeconfirm:')){ const p=id.split(':'),rid=Number(p[3]),backId=decodeURIComponent(p.slice(4).join(':')||''); const r=await regs.get(rid); if(!r||r.guild_id!==i.guildId||!canManageReg(i,r))return i.update({content:'You do not manage that Server house.',embeds:[],components:[]}); await regs.archive(rid,i.user.id); const ctx=removeFromSearchState(backId,'server',rid); if(houseReturnOptions(backId)&&ctx)return i.update({...renderPicker(ctx.stateId),content:'House deleted.'}); if(ctx){ if(ctx.total>0)return housePickerDetail(i,ctx.stateId,ctx.index); const m=/^hu:advanced:open:([^:]+)$/.exec(ctx.state.backId||''); if(m&&advancedState(i,m[1]))return i.update({...renderAdvanced(i,m[1]),content:'Server house deleted. No houses remain in that result list.'}); return i.update({...homePayload({isAdmin:isAdmin(i),esoServer:guilds.getEsoServer(i.guildId)}),content:'Server house deleted. No houses remain in that result list.'}); } return i.update(homePayload({isAdmin:isAdmin(i),esoServer:guilds.getEsoServer(i.guildId)})); }
    if(id.startsWith('hu:pending:approve:')||id.startsWith('hu:pending:deny:')){
      if(!guilds.canReviewPending(i))return i.reply({content:'You do not have Housing administration access to review pending houses.',flags:MessageFlags.Ephemeral});
      const parts=id.split(':'),action=parts[2],rid=Number(parts[3]),record=await regs.get(rid);
      const belongsHere=record?.status==='pending'&&((record.scope==='server'&&record.guild_id===i.guildId)||(record.scope==='global'&&record.origin_guild_id===i.guildId));
      if(!belongsHere)return i.reply({content:'That pending house does not belong to this server’s review queue.',flags:MessageFlags.Ephemeral});
      try{action==='approve'?await regs.approve(rid,i.user.id):await regs.deny(rid,i.user.id); return i.update(adminPayload(guilds.getSettings(i.guildId)));}catch(e){return i.update({content:e.message,embeds:[],components:[]});}
    }

    if(id==='hu:tours:browse'||id==='hu:tours:start'||id==='hu:tours:manage'){
      let rows=await visibleTours(i,{forManagement:id==='hu:tours:manage'}); if(id==='hu:tours:manage')rows=rows.filter(t=>canManageTour(i,t)); if(!rows.length)return i.update({content:id==='hu:tours:manage'?'There are no tours you can manage.':'No tours are available yet.',embeds:[],components:toursPayload((await visibleTours(i)).length).components});
      const kind=id==='hu:tours:start'?'tour-start':id==='hu:tours:manage'?'tour-manage':'tour-view';
      return i.update(createPicker(i,{kind,rows,extra:{title:id==='hu:tours:start'?'Start a Tour':id==='hu:tours:manage'?'Edit Tour':'Browse Tours',description:'Choose a tour.'},backId:'hu:tours'}));
    }
    if(id==='hu:tours:create')return i.showModal(tourCreateModal());
    if(id.startsWith('hu:picker:return:')){const sid=id.split(':')[3],s=states.get(sid);if(!s||s.userId!==i.user.id)return i.reply({content:'That menu expired. Browse Tours again.',flags:MessageFlags.Ephemeral});return i.update(renderPicker(sid));}
    if(id.startsWith('hu:tourbrowse:prev:')||id.startsWith('hu:tourbrowse:next:')||id.startsWith('hu:tourbrowse:open:')){const p=id.split(':');return tourBrowseDetail(i,p[3],Number(p[4]));}
    if(id.startsWith('hu:tour:view:'))return tourDetail(i,Number(id.split(':')[3]));
    if(id.startsWith('hu:tour:start:')){ const parts=id.split(':'),t=await tourById(i,Number(parts[3])); if(!t)return i.update({content:'Tour not found.',embeds:[],components:[]}); const state=states.get(parts[4]),index=Number(parts[5]),browse=state?.userId===i.user.id&&state.kind==='tour-view'&&Number.isInteger(index)&&Number(state.rows[index]?.id)===Number(t.id); const fromFeatured=parts[4]==='featured'&&(await featured.list({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)})).some(item=>item.target_kind==='tour'&&Number(item.target_id)===Number(t.id)); const featuredSource=parts[5]==='admin'&&isAdmin(i)?'admin':parts[5]==='home'?'home':'viewer'; return i.update(await tourStartPreflight(i,t,{backId:browse?`hu:tourbrowse:open:${parts[4]}:${index}`:fromFeatured?`hu:featured:tour:${t.id}:${featuredSource}`:null})); }
    if(id.startsWith('hu:tour:startprivate:')||id.startsWith('hu:tour:startpublic:')){ const p=id.split(':'),t=await tourById(i,Number(p[3])); if(!t)return i.update({content:'Tour not found.',embeds:[],components:[]}); if(p[2]==='startprivate'){try{const item=await progress.startOrResume({userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),tourId:t.id,globalName:i.user.globalName||i.user.username,displayName:i.member?.displayName});if(item._startedNew)await recordUsage(i,'started_tour',{kind:'tour',id:t.id});else if(item.status==='active')await recordUsage(i,'resumed_tour',{kind:'tour',id:t.id});return i.update(await progressRunCard(i,item));}catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}} return startTourSession(i,t,'public'); }
    if(id.startsWith('hu:tour:manage:'))return tourManage(i,Number(id.split(':')[3]));
    if(id.startsWith('hu:tour:housefilter:')||id.startsWith('hu:tour:houseclear:')){const sid=id.split(':')[3],found=pickerPageContext(i,sid);if(found.error||found.state.kind!=='tour-add-house')return i.reply({content:found.error||'Open Add House again.',flags:MessageFlags.Ephemeral});const t=await tourById(i,found.state.extra.tourId,{forManagement:true});if(!t||!canManageTour(i,t))return i.reply({content:'You cannot manage that tour.',flags:MessageFlags.Ephemeral});if(id.startsWith('hu:tour:housefilter:'))return i.showModal(tourHouseFiltersModal(sid,found.state.extra.houseFilters));delete found.state.extra.houseFilters;return i.update(await tourAddHousePayload(i,t,{stateId:sid}));}
    if(id.startsWith('hu:tour:addmore:')){const p=id.split(':'),tid=Number(p[3]),sid=p[4],t=await tourById(i,tid,{forManagement:true});if(!t||!canManageTour(i,t))return i.update({content:'You cannot manage that tour.',embeds:[],components:[]});if(sid==='none')return i.update(await tourAddHousePayload(i,t));const found=pickerPageContext(i,sid);if(found.error||found.state.kind!=='tour-add-house'||Number(found.state.extra.tourId)!==tid)return i.reply({content:found.error||'Open Add House again.',flags:MessageFlags.Ephemeral});return i.update(await tourAddHousePayload(i,t,{stateId:sid}));}
    if(id.startsWith('hu:stop:notes:')){const p=id.split(':'),t=await tourById(i,Number(p[3]),{forManagement:true});if(!t||!canManageTour(i,t))return i.update({content:'You cannot manage that tour.',embeds:[],components:[]});const stop=(await tours.getStops(t.id)).find(stop=>Number(stop.id)===Number(p[4]));if(!stop)return i.update({content:'That tour stop no longer exists.',embeds:[],components:[]});return i.showModal(tourStopNotesModal(t,stop,p[5]||'none',Number(p[6])||null));}
    if(id.startsWith('hu:tour:add:')){ const tid=Number(id.split(':')[3]),t=await tourById(i,tid,{forManagement:true}); if(!t||!canManageTour(i,t))return i.update({content:'You cannot manage that tour.',embeds:[],components:[]}); return i.update(await tourAddHousePayload(i,t)); }
    if(id.startsWith('hu:tour:editstop:')||id.startsWith('hu:tour:reorder:')||id.startsWith('hu:tour:removestop:')){
      const p=id.split(':'),action=p[2],tid=Number(p[3]),t=await tourById(i,tid,{forManagement:true}); if(!t||!canManageTour(i,t))return i.update({content:'You cannot manage that tour.',embeds:[],components:[]}); const rows=await tours.getStops(tid); if(!rows.length)return i.update({content:'This tour has no stops yet.',embeds:[],components:tourManagePayload(t,rows).components}); const kind=action==='editstop'?'tour-stop-edit':action==='reorder'?'tour-stop-reorder':'tour-stop-remove'; return i.update(createPicker(i,{kind,rows,extra:{title:`${action==='editstop'?'Edit a Stop':action==='reorder'?'Reorder Stops':'Remove a Stop'} — ${t.name}`,description:'Choose a tour stop.',tourId:tid},backId:`hu:tour:manage:${tid}`}));
    }
    if(id.startsWith('hu:tour:edit:')){ const t=await tourById(i,Number(id.split(':')[3]),{forManagement:true}); if(!t||!canManageTour(i,t))return i.update({content:'You cannot manage that tour.',embeds:[],components:[]}); return i.update(tourEditDetailsPayload(t)); }
    if(id.startsWith('hu:tour:edittext:')){ const t=await tourById(i,Number(id.split(':')[3]),{forManagement:true}); if(!t||!canManageTour(i,t))return i.reply({content:'You cannot manage that tour.',flags:MessageFlags.Ephemeral}); return i.showModal(tourEditModal(t)); }
    if(id.startsWith('hu:tour:editvisibility:')){ const t=await tourById(i,Number(id.split(':')[3]),{forManagement:true}); if(!t||!canManageTour(i,t))return i.update({content:'You cannot manage that tour.',embeds:[],components:[]}); return i.update(tourEditVisibilityPayload(t)); }
    if(id.startsWith('hu:tour:setvisibility:')){ const p=id.split(':'),scope=p[3],tid=Number(p[4]),t=await tourById(i,tid,{forManagement:true}); if(!t||!canManageTour(i,t))return i.update({content:'You cannot manage that tour.',embeds:[],components:[]}); if(scope==='server'&&!i.guildId)return i.update({content:'Server Tours require a Discord server.',embeds:[],components:[]}); if(scope==='global'&&t.creator_id!==i.user.id&&!globalMods.isGlobalModeratorCached(i.user.id,guilds.getEsoServer(i.guildId)))return i.update({content:'Only the tour creator or a Global Housing Moderator can make a tour Global.',embeds:[],components:[]}); const visibility=scope==='server'?'public':scope==='personal'?'private':'global',impact=await tours.visibilityChangeImpact(tid,visibility); if(impact.total){return i.update(confirmPayload({title:'Change Tour Visibility?',description:`This visibility change will remove **${impact.total} incompatible stop${impact.total===1?'':'s'}**.`,confirmId:`hu:tour:setvisibilityconfirm:${scope}:${tid}`,cancelId:`hu:tour:edit:${tid}`}));} const updated=await tours.update(tid,{scope,...tourUpdateContext(i,t)});if(updated.visibility!==t.visibility)await recordUsage(i,'updated_tour',{kind:'tour',id:tid}); return i.update(canManageTour(i,updated)?tourEditDetailsPayload(updated):{...toursPayload((await visibleTours(i)).length),content:'Visibility updated. This Private tour remains accessible only to its creator.'}); }
    if(id.startsWith('hu:tour:setvisibilityconfirm:')){ const p=id.split(':'),scope=p[3],tid=Number(p[4]),t=await tourById(i,tid,{forManagement:true}); if(!t||!canManageTour(i,t))return i.update({content:'You cannot manage that tour.',embeds:[],components:[]}); if(scope==='global'&&t.creator_id!==i.user.id&&!globalMods.isGlobalModeratorCached(i.user.id,guilds.getEsoServer(i.guildId)))return i.update({content:'Only the tour creator or a Global Housing Moderator can make a tour Global.',embeds:[],components:[]}); const updated=await tours.update(tid,{scope,...tourUpdateContext(i,t)});if(updated.visibility!==t.visibility)await recordUsage(i,'updated_tour',{kind:'tour',id:tid}); return i.update(canManageTour(i,updated)?tourEditDetailsPayload(updated):{...toursPayload((await visibleTours(i)).length),content:'Visibility updated. This Private tour remains accessible only to its creator.'}); }
    if(id.startsWith('hu:tour:delete:')){ const tid=Number(id.split(':')[3]),t=await tourById(i,tid,{forManagement:true}); if(!t||!canManageTour(i,t))return i.update({content:'You cannot manage that tour.',embeds:[],components:[]}); return i.update(confirmPayload({title:'Delete Housing Tour?',description:`Permanently delete **${t.name}** and all of its tour stops? Saved/public houses are not deleted.`,confirmId:`hu:tour:deleteconfirm:${tid}`,cancelId:`hu:tour:manage:${tid}`})); }
    if(id.startsWith('hu:tour:deleteconfirm:')){ const tid=Number(id.split(':')[3]),t=await tourById(i,tid,{forManagement:true}); if(!t||!canManageTour(i,t))return i.update({content:'You cannot manage that tour.',embeds:[],components:[]}); await tours.remove(tid); return i.update(toursPayload((await visibleTours(i)).length)); }
    if(id.startsWith('hu:tour:createvis:')){ const p=id.split(':'),scope=p[3],draftId=p[4],d=drafts.get(draftId); if(!d||d.userId!==i.user.id)return i.update({content:'That tour draft expired. Choose Create Tour again.',embeds:[],components:[]}); if(scope==='server'&&!i.guildId)return i.update({content:'Server Tours require a Discord server.',embeds:[],components:[]}); const t=await tours.create({creatorId:i.user.id,guildId:i.guildId,originGuildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),scope,sourceGuildId:i.guildId,name:d.name,description:d.description}); drafts.delete(draftId);await recordUsage(i,'created_tour',{kind:'tour',id:t.id}); return i.update(await tourAddHousePayload(i,t)); }
    if(id.startsWith('hu:reorder:')){ const p=id.split(':'),action=p[2],tid=Number(p[3]),stopId=Number(p[4]),t=await tourById(i,tid,{forManagement:true}); if(!t||!canManageTour(i,t))return i.update({content:'You cannot manage that tour.',embeds:[],components:[]}); let rows=await tours.getStops(tid),stop=rows.find(s=>s.id===stopId); if(!stop)return i.update({content:'That stop no longer exists.',embeds:[],components:[]}); let to=stop.position; if(action==='up')to--; if(action==='down')to++; if(action==='first')to=1;if(action==='last')to=rows.length; if(to!==stop.position){await tours.moveStop(tid,stop.position,to);await recordUsage(i,'updated_tour',{kind:'tour',id:tid});} rows=await tours.getStops(tid); stop=rows.find(s=>s.id===stopId); return i.update(reorderPayload(t,stop,rows.length)); }
    if(id.startsWith('hu:stop:removeconfirm:')){ const p=id.split(':'),tid=Number(p[3]),stopId=Number(p[4]),t=await tourById(i,tid,{forManagement:true}); if(!t||!canManageTour(i,t))return i.update({content:'You cannot manage that tour.',embeds:[],components:[]}); const stop=(await tours.getStops(tid)).find(s=>s.id===stopId); if(stop){await tours.removeStop(tid,stop.position);await recordUsage(i,'updated_tour',{kind:'tour',id:tid});} return i.update(tourManagePayload(t,await tours.getStops(tid))); }

    if(id.startsWith('hu:context:view:')){ const p=id.split(':'),scope=p[3],rid=Number(p[4]),backId=decodeURIComponent(p.slice(5).join(':')||''); const savedScope=scope==='personal'?'personal':scope==='global'?'global':'server',r=await getSaved(savedScope,rid,i); if(!r)return i.update({content:'That saved house is no longer available.',embeds:[],components:[]}); return i.update(destinationMenuPayload(await withHouseCardContext(i,r),{canEdit:canEditSaved(i,r),backId:backId||'hu:find',navigation:navigationFromBackId(backId)})); }

    if(id.startsWith('hu:details:')){
      const p=id.split(':'),scope=p[2],rid=Number(p[3]),showDetails=p[4]==='show',backId=decodeURIComponent(p.slice(5).join(':')||'hu:home'),navigation=navigationFromBackId(backId);
      const surpriseToken=/^hu:sr:([^:]+)$/.exec(backId)?.[1]||null;
      if(scope==='official'){
        const house=await houses.get(rid); if(!house)return i.update({content:'That Non-Player Home is no longer available.',embeds:[],components:[]});
        return i.update(officialHousePayload(await withOfficialState(i,house),backId,showDetails,navigation,surpriseToken));
      }
      const savedScope=scope==='personal'?'personal':scope==='global'?'global':'server',r=await getSaved(savedScope,rid,i); if(!r)return i.update({content:'That saved house is no longer available.',embeds:[],components:[]});
      return i.update(destinationMenuPayload(await withHouseCardContext(i,r),{canEdit:canEditSaved(i,r),backId,showDetails,navigation,surpriseToken}));
    }
    if(id.startsWith('hu:discussion:')){
      const parts=id.split(':'),sid=parts[3];
      try{
        if(parts[2]==='page')return await showCommentReader(i,sid,parts[4]);
        if(parts[2]==='jump'){const state=commentReaderState(i,sid),house=await commentReaderHouse(i,state),total=await comments.count('global',house.id,state.esoServer);return i.showModal(commentPageModal(sid,Math.max(1,Math.ceil(total/commentPageSize))));}
        if(parts[2]==='add'){const state=commentReaderState(i,sid),house=await commentReaderHouse(i,state);return i.showModal(commentModal('global',house.id,'hu:home',destinationLabel(house)).setCustomId(`hu:modal:discussion:${sid}`));}
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:comments:')){ const p=id.split(':'),scope=p[2],rid=Number(p[3]),backId=decodeURIComponent(p.slice(4).join(':')||'hu:find'); return commentsScreen(i,scope,rid,'update',backId); }
    if(id.startsWith('hu:comment:add:')){ const p=id.split(':'),scope=p[3],rid=Number(p[4]),backId=decodeURIComponent(p.slice(5).join(':')); const r=await getSaved(scope,rid,i); if(!r)return i.reply({content:'That saved house is no longer available.',flags:MessageFlags.Ephemeral}); return i.showModal(commentModal(scope,rid,backId,destinationLabel(r))); }

    if(id.startsWith('hu:house-nav:')){ const p=id.split(':'),sid=p[2],index=Number(p[3]); return housePickerDetail(i,sid,index,p[4]==='show'); }
    if(id.startsWith('hu:results:create:'))return beginBulkTour(i,id.split(':')[3],'create');
    if(id.startsWith('hu:results:add:'))return beginBulkTour(i,id.split(':')[3],'add');
    if(id.startsWith('hu:results:back:')){ const sid=id.split(':')[3],s=states.get(sid); if(!s||s.userId!==i.user.id)return i.reply({content:'That house list expired. Run the browse or search again.',flags:MessageFlags.Ephemeral}); return i.update(renderPicker(sid)); }
    if(id.startsWith('hu:registration:tour:'))return startRegistrationTour(i,Number(id.split(':')[3]));
    if(id.startsWith('hu:registration:house:'))return i.update(await registrationHousePayload(i,Number(id.split(':')[3])));
    if(id.startsWith('hu:registration:newtour:')){
      const bid=id.split(':')[3],b=bulkState(i,bid);if(!b)return i.reply({content:'That tour selection expired.',flags:MessageFlags.Ephemeral});
      b.action='create';return i.showModal(bulkTourCreateModal(bid));
    }
    if(id.startsWith('hu:bulkorder:')){
      const p=id.split(':'),action=p[2],bid=p[3],b=bulkState(i,bid);
      if(!b)return i.reply({content:'That tour selection expired.',flags:MessageFlags.Ephemeral});
      if(action==='confirm'){b.confirmedRows=selectionRows(b.rows,b.selected,b.mode).map(r=>({...r}));return b.action==='create'?i.showModal(bulkTourCreateModal(bid)):openBulkExistingTourPicker(i,bid);}
      if(action==='page')b.orderPage=Number(p[4])||0;
      if(action==='move'){const from=b.orderPosition||0,to=from+(p[4]==='up'?-1:1);try{b.selected=moveSelection(b.selected,from,to);b.mode='select';b.orderPosition=to;b.orderPage=Math.floor(to/25);b.confirmedRows=null;}catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}}
      return i.update(renderBulkOrder(b,bid));
    }
    if(id.startsWith('hu:bulk:cancel:')){ const bid=id.split(':')[3],b=bulkState(i,bid); if(!b)return i.reply({content:'That bulk-tour selection expired.',flags:MessageFlags.Ephemeral}); bulkTourStates.delete(bid); const s=states.get(b.searchStateId); return s?i.update(renderPicker(b.searchStateId)):i.update(homePayload({isAdmin:isAdmin(i),esoServer:guilds.getEsoServer(i.guildId)})); }
    if(id.startsWith('hu:bulk:return:')){ const bid=id.split(':')[3],b=bulkState(i,bid); if(!b)return i.reply({content:'That bulk-tour selection expired.',flags:MessageFlags.Ephemeral}); if(b.registrationHouseId){b.action='add';return openBulkExistingTourPicker(i,bid);}if(b.mode==='select')return i.update(renderBulkSelection(i,bid)); b.mode='choice'; return i.update(bulkTourChoicePayload({token:bid,action:b.action,count:b.rows.length,backId:`hu:results:back:${b.searchStateId}`})); }
    if(id.startsWith('hu:bulk:all:')){ const bid=id.split(':')[3],b=bulkState(i,bid); if(!b)return i.reply({content:'That bulk-tour selection expired.',flags:MessageFlags.Ephemeral}); b.mode='all';b.confirmedRows=null;b.selected=new Set(b.rows.map((_,n)=>n));return i.update(renderBulkOrder(b,bid)); }
    if(id.startsWith('hu:bulk:select:')){ const bid=id.split(':')[3],b=bulkState(i,bid); if(!b)return i.reply({content:'That bulk-tour selection expired.',flags:MessageFlags.Ephemeral}); b.mode='select'; b.page=0; b.selected=new Set(); return i.update(renderBulkSelection(i,bid)); }
    if(id.startsWith('hu:bulkselect:prev:')||id.startsWith('hu:bulkselect:next:')){ const p=id.split(':'),dir=p[2],bid=p[3],b=bulkState(i,bid); if(!b)return i.reply({content:'That bulk-tour selection expired.',flags:MessageFlags.Ephemeral}); b.page+=dir==='next'?1:-1; return i.update(renderBulkSelection(i,bid)); }
    if(id.startsWith('hu:bulkselect:done:')){ const bid=id.split(':')[3],b=bulkState(i,bid); if(!b)return i.reply({content:'That bulk-tour selection expired.',flags:MessageFlags.Ephemeral}); if(!b.selected.size)return i.update({...renderBulkSelection(i,bid),content:'Select at least one house first.'}); b.confirmedRows=null;return i.update(renderBulkOrder(b,bid)); }
    if(id.startsWith('hu:bulk:visibility:')){ const p=id.split(':'),scope=p[3],bid=p[4]; return createBulkTour(i,bid,scope); }

    if(id.startsWith('hu:picker:jump:')){const sid=id.split(':')[3],found=pickerPageContext(i,sid);if(found.error)return i.reply({content:found.error,flags:MessageFlags.Ephemeral});return i.showModal(pickerPageModal(sid,{page:found.state.page+1,pages:found.pages}));}
    if(id.startsWith('hu:picker:prev:')||id.startsWith('hu:picker:next:')){ const p=id.split(':'),dir=p[2],sid=p[3],s=states.get(sid); if(!s)return i.reply({content:'That menu expired. Run /housing again.',flags:MessageFlags.Ephemeral}); if(s.userId!==i.user.id)return i.reply({content:'That menu belongs to another user.',flags:MessageFlags.Ephemeral}); s.page+=dir==='next'?1:-1; return i.update(renderPicker(sid)); }
  }

  async function select(i){
    if(!await prepareInteraction(i))return;
    const id=i.customId;
    if(id.startsWith('hu:catalog:')||id.startsWith('hu:modal:catalog:')||(id==='hu:admin:tool'&&['catalog','catalog_edit'].includes(i.values?.[0])))return handleCatalog(i);
    if(isRetiredEventInteraction(id))return id.startsWith('hu:modal:')?i.reply({...retiredEventPayload(),flags:MessageFlags.Ephemeral}):i.update(retiredEventPayload());
    if(isServerModeratorAction(id))return handleServerModeratorAction(i,{serverModerators:guilds.serverModerators,guilds});
    if(isTourShareDestination(id))return handleTourShareDestination(i,{sharePasses,tours,guilds,loadHouse:async(i,id)=>(await loadSavedReference(i,id)).record});
    if(isDiscordAdminInteraction(id))return i.reply({content:webOnlyAdminNotice(),flags:MessageFlags.Ephemeral});
    if(id.startsWith('hu:savedsearch:list:')){
      const payload=await savedSearchDetail(i,Number(i.values?.[0]));
      if(!payload)return i.reply({content:'That saved search belongs to another user or is no longer available.',flags:MessageFlags.Ephemeral});
      return i.update(payload);
    }
    if(id==='hu:featured:select'){
      if(!isAdmin(i))return i.reply({content:'Only Housing Moderators can manage Featured housing.',flags:MessageFlags.Ephemeral});
      const [targetKind,targetId]=String(i.values?.[0]||'').split(':');
      const rows=await featured.list({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
      const selectedItem=rows.find(item=>item.target_kind===targetKind&&String(item.target_id)===String(targetId));
      if(!selectedItem)return i.reply({content:'That Featured entry is no longer available.',flags:MessageFlags.Ephemeral});
      return i.update(await enrichedFeaturedPayload(i,{items:rows,canManage:true,selectedItem}));
    }
    if(id.startsWith('hu:progress:history:house:')){
      const parts=id.split(':'),progressId=Number(parts[4]),listPage=Math.max(1,Number(parts[5])||1),page=Math.max(1,Number(parts[6])||1),from=parts.indexOf('from'),activePage=from>=0?Math.max(1,Number(parts[from+1])||1):1,savedHouseId=Number(i.values?.[0]);
      try{
        const rows=await db.query('SELECT * FROM tour_progress WHERE id=? AND discord_user_id=?',[progressId,String(i.user.id)]);
        if(!rows[0])return i.reply({content:'That progress run is no longer available.',flags:MessageFlags.Ephemeral});
        const stops=await progress.completedStops({progressId,userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
        if(!stops.some(stop=>Number(stop.saved_house_id)===savedHouseId))return i.reply({content:'That completed house is not part of this progress run.',flags:MessageFlags.Ephemeral});
        const access=await loadSavedReference(i,savedHouseId);
        if(!access?.record)return i.reply({content:'That completed house is no longer available.',flags:MessageFlags.Ephemeral});
        return i.update(destinationMenuPayload(await withHouseCardContext(i,legacySavedRow(access.record)),{backId:`hu:ph:${progressId}:${listPage}:${page}:${activePage}`}));
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id==='hu:environment:setup'){
      const esoServer=String(i.values?.[0]||'');
      const deferred=typeof i.deferUpdate==='function';if(deferred)await i.deferUpdate();
      try{
        const result=await environments.selectInitial({guildId:i.guildId,esoServer,actorId:i.user.id,names:{guildName:i.guild?.name,actorGlobalName:i.user.globalName||i.user.username,actorDisplayName:i.member?.displayName}});
        await guilds.ensureSettings(i.guildId);
        const content=result.selected?`HearthBound is now configured for **${esoServerLabel(result.esoServer)}**.`:`Another member completed setup first. This server is now configured for ${esoServerLabel(result.esoServer)}.`;
        const payload={...homePayload({isAdmin:isAdmin(i),esoServer:result.esoServer}),content};
        return deferred?i.editReply(payload):i.update(payload);
      }catch(error){const payload=environmentSetupPayload({message:error.message});return deferred?i.editReply(payload):i.update(payload);}
    }
    if(id==='hu:environment:change'){
      if(!isAdmin(i))return i.reply({content:'You do not have Housing administration access.',flags:MessageFlags.Ephemeral});
      const toEsoServer=String(i.values?.[0]||''),deferred=typeof i.deferUpdate==='function';if(deferred)await i.deferUpdate();
      try{const payload=environmentChangePreviewPayload(await environments.previewChange({guildId:i.guildId,toEsoServer}));return deferred?i.editReply(payload):i.update(payload);}
      catch(error){const payload={content:error.message,embeds:[],components:buttonRows([{customId:'hu:environment:change:start',label:'Try Again',style:'primary'},{customId:'hu:admin',label:'Back',style:'secondary'}])};return deferred?i.editReply(payload):i.update(payload);}
    }
    if(id.startsWith('hu:report:type:')){
      const parts=id.split(':'),kind=parts[3],targetToken=parts.slice(4).join(':'),problemType=String(i.values?.[0]||'');
      return i.showModal(reportExplanationModal({kind,token:targetToken,problemType}));
    }
    if(id==='hu:register:type'){ const type=i.values?.[0],scope=registrationScopeFromType(type); if(!scope)return i.reply({content:'Choose Global, Server, or Private before continuing.',flags:MessageFlags.Ephemeral}); return i.showModal(destinationInputModal(type)); }
    if(id==='hu:globalmod:requestpick'||id.startsWith('hu:globalmod:requestpick:')){
      if(!globalMods.isApprover(i.user.id))return i.reply({content:'Only a configured Global Moderator approver can review requests.',flags:MessageFlags.Ephemeral});
      const requestId=Number(i.values?.[0]),req=(await globalMods.listPending()).find(r=>Number(r.id)===requestId);
      const page=Number(id.split(':')[3])||1;
      if(!req)return i.update(globalModeratorRequestsPayload(await globalMods.listPending(),page));
      return i.update(globalModeratorRequestReviewPayload(req,page));
    }
    if(id==='hu:globalmod:revokepick'||id.startsWith('hu:globalmod:revokepick:')){
      if(!globalMods.isApprover(i.user.id))return i.reply({content:'Only a configured Global Moderator approver can revoke access.',flags:MessageFlags.Ephemeral});
      const [esoServer,userId]=String(i.values?.[0]||'').split(':'),row=(await globalMods.listModerators()).find(r=>(r.eso_server||'legacy')===esoServer&&String(r.discord_user_id)===userId);
      const page=Number(id.split(':')[3])||1;
      if(!row)return i.update(globalModeratorListPayload(await globalMods.listModerators(),page));
      return i.update(globalModeratorRevokePayload(row,page));
    }
    if(id.startsWith('hu:advanced-remove:')){
      const p=id.split(':'),field=p[2],aid=p[3],page=Number(p[4]||0),s=advancedState(i,aid);
      if(!s)return i.reply({content:'That Search Houses session expired. Open Search Houses again.',flags:MessageFlags.Ephemeral});
      const remove=new Set((i.values||[]).map(text));
      s.filters[field]=(Array.isArray(s.filters[field])?s.filters[field]:[]).filter(v=>!remove.has(text(v)));
      const values=s.filters[field]||[],pages=Math.max(1,Math.ceil(values.length/25)),safePage=Math.min(page,pages-1);
      return i.update(advancedRemovePayload({token:aid,field,values,page:safePage}));
    }
    if(id.startsWith('hu:advanced:')){
      const p=id.split(':'),field=p[2],aid=p[3],s=advancedState(i,aid);
      if(!s)return i.reply({content:'That Search Houses session expired. Open Search Houses again.',flags:MessageFlags.Ephemeral});
      const vals=i.values||[],prev=vals.includes('__prev__'),next=vals.includes('__next__');
      const key={tags:'tags',zone:'zones',style:'styles',classification:'classifications',houseType:'houseTypes'}[field],pageKey={tags:'tag',zone:'zone',style:'style',classification:'classification',houseType:'houseType'}[field];
      if(key){
        if(!prev&&!next){
          const available=await advancedValues(i,s,field),pageSize=23,start=(s.pages[pageKey]||0)*pageSize,current=new Set(available.slice(start,start+pageSize));
          s.filters[key]=(s.filters[key]||[]).filter(v=>!current.has(v));
          for(const v of vals)if(!v.startsWith('__')&&v!=='__none__')s.filters[key].push(v);
          s.filters[key]=[...new Set(s.filters[key])].sort((a,b)=>a.localeCompare(b));
        }
        if(prev)s.pages[pageKey]=Math.max(0,(s.pages[pageKey]||0)-1);
        if(next)s.pages[pageKey]=(s.pages[pageKey]||0)+1;
      }
      if(prev||next)return i.update(await renderAdvancedAttribute(i,aid,field));
      return searchResults(i,s.filters,{searchType:'Search Houses',mode:'update',scope:s.scope||'all',includeNonPlayerHomes:s.includeNonPlayer,backId:'hu:home',alwaysPicker:true,advancedToken:aid});
    }
    if(id.startsWith('hu:bulkorder:pick:')){
      const bid=id.split(':')[3],b=bulkState(i,bid),position=Number(i.values?.[0]);
      if(!b||!Number.isInteger(position)||position<0||position>=bulkSelectedRows(b).length)return i.reply({content:'That route position is no longer available.',flags:MessageFlags.Ephemeral});
      b.orderPosition=position;return i.update(renderBulkOrder(b,bid));
    }
    if(id.startsWith('hu:bulkselect:')){
      const bid=id.split(':')[2],b=bulkState(i,bid); if(!b)return i.reply({content:'That bulk-tour selection expired.',flags:MessageFlags.Ephemeral});
      const pageSize=25,start=b.page*pageSize,end=Math.min(start+pageSize,b.rows.length);
      try{b.selected=updateOrderedSelection(b.selected,i.values||[],start,end);b.confirmedRows=null;}catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
      return i.update(renderBulkSelection(i,bid));
    }
    if(id==='hu:admin:tool'){
      if(!isAdmin(i))return i.reply({content:'You do not have Housing administration access.',flags:MessageFlags.Ephemeral});
      const tool=String(i.values?.[0]||''),settings=guilds.getSettings(i.guildId),server=guilds.getEsoServer(i.guildId);
      if(adminInterface==='web'&&movedTools.has(tool))return i.reply({content:webOnlyAdminNotice(),flags:MessageFlags.Ephemeral});
      if(tool==='environment')return i.update(environmentChangeChoicePayload(server));
      if(tool==='legacy-tours'){
        const rows=await environments.listGuildLegacyTours({guildId:i.guildId});
        if(!rows.length)return i.update({...adminPayload(settings),content:'There are no recoverable Server or Global legacy tours linked to this Discord server.'});
        return i.update(createPicker(i,{kind:'admin-legacy-tour',rows,extra:{title:'🧭 Legacy Tours',description:'Choose an Unassigned Server or Global tour linked to this Discord server. Private tours remain visible only to their creators.'},backId:'hu:admin'}));
      }
      if(tool==='featured')return i.update(await enrichedFeaturedPayload(i,{items:await featured.list({guildId:i.guildId,esoServer:server}),canManage:true}));
      if(tool==='health'){
        const channels=i.guild?.channels?.cache?[...i.guild.channels.cache.keys()]:[];
        return i.update(adminHealthPayload(await adminHealth.snapshot({guildId:i.guildId,esoServer:server,availableChannelIds:channels})));
      }
      if(tool==='audit')return i.update(auditLogPayload(await auditLog.list({guildId:i.guildId,page:1,pageSize:10})));
      if(tool==='export'){
        try{
          const json=await dataExport.toJson({guildId:i.guildId,esoServer:server,includePrivate:false});
          return i.reply({content:'Guild-scoped HearthBound export. Private records and audit history are excluded.',files:[{attachment:Buffer.from(json),name:`hearthbound-${i.guildId}-${server}.json`}],flags:MessageFlags.Ephemeral});
        }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
      }
      if(tool==='maintenance')return i.update(maintenancePayload({stale:await maintenance.stale({guildId:i.guildId,esoServer:server}),duplicates:await maintenance.duplicates({guildId:i.guildId,esoServer:server})}));
      if(tool==='reports'){
        const deferred=typeof i.deferUpdate==='function';if(deferred)await i.deferUpdate();
        const payload=reportQueuePayload(await reports.listForModerator(reportContext(i)));
        return deferred?i.editReply(payload):i.update(payload);
      }
      if(tool==='passes')return i.update(adminSharePassesPayload((await adminHealth.snapshot({guildId:i.guildId,esoServer:server})).passes));
      if(tool==='otherroles')return i.update(adminOtherRolesPayload(settings));
      if(tool==='pending'){
        const rows=await regs.searchPending(i.guildId,{esoServer:server});
        if(!rows.length)return i.update({...adminPayload(settings),content:'There are no pending Server or Global house submissions from this server.'});
        return i.update(createPicker(i,{kind:'pending',rows,extra:{title:'📝 Pending House Review',description:'Choose a pending Server or Global house submission to review.'},backId:'hu:admin'}));
      }
      if(tool==='servermod')return handleServerModeratorAction(i,{serverModerators:guilds.serverModerators,guilds,actionId:'hu:servermod:requests'});
      if(tool==='globalmod')return globalModeratorScreen(i);
      return i.update(adminPayload(settings));
    }
    if(id==='hu:admin:policy'||id==='hu:admin:moderator'||id==='hu:admin:trusted'||id==='hu:admin:tours'||id==='hu:admin:channel'||id==='hu:admin:timezone'){
      if(!isAdmin(i))return i.reply({content:'You do not have Housing administration access.',flags:MessageFlags.Ephemeral});
      if(id==='hu:admin:policy')await guilds.setPolicy(i.guildId,i.values[0]);
      if(id==='hu:admin:moderator')await guilds.setRoles(i.guildId,'moderator',i.values||[]);
      if(id==='hu:admin:trusted')await guilds.setRoles(i.guildId,'trusted',i.values||[]);
      if(id==='hu:admin:tours'){ await guilds.setRoles(i.guildId,'tours',i.values||[]); return i.update(adminOtherRolesPayload(guilds.getSettings(i.guildId))); }
      if(id==='hu:admin:channel')await guilds.setChannel(i.guildId,i.values[0]??null);
      if(id==='hu:admin:timezone')await guilds.setTimezone(i.guildId,i.values[0]);
      return i.update(id==='hu:admin:channel'||id==='hu:admin:timezone' ? adminSettingsPayload(guilds.getSettings(i.guildId)) : adminPayload(guilds.getSettings(i.guildId)));
    }
    if(id==='hu:admin:maintenance:verify'){
      if(!isAdmin(i))return i.reply({content:'Only Housing Moderators can verify houses.',flags:MessageFlags.Ephemeral});
      try { await maintenance.markVerified({houseId:Number(i.values?.[0]),actorId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)}); return i.update(maintenancePayload({stale:await maintenance.stale({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)}),duplicates:await maintenance.duplicates({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)})})); }
      catch(error) { return i.reply({content:error.message,flags:MessageFlags.Ephemeral}); }
    }
    if(id==='hu:admin:maintenance:merge'){
      if(!isAdmin(i))return i.reply({content:'Only Housing Moderators can merge duplicate entries.',flags:MessageFlags.Ephemeral});
      const [keepId,removeId]=String(i.values?.[0]||'').split(':');
      return i.update(confirmPayload({title:'Merge Duplicate House?',description:`Keep saved house **#${keepId}** and archive duplicate **#${removeId}**? Comments and compatible tour stops will be retained.`,confirmId:`hu:admin:maintenance:mergeconfirm:${keepId}:${removeId}`,cancelId:'hu:admin:maintenance'}));
    }
    if(!id.startsWith('hu:picker:'))return;
    const sid=id.split(':')[2],s=states.get(sid); if(!s)return i.reply({content:'That menu expired. Run /housing again.',flags:MessageFlags.Ephemeral}); if(s.userId!==i.user.id)return i.reply({content:'That menu belongs to another user.',flags:MessageFlags.Ephemeral});
    if(s.kind==='tour-add-house'){const found=pickerPageContext(i,sid);if(found.error)return i.reply({content:found.error,flags:MessageFlags.Ephemeral});}
    const selectedIndex=Number(i.values[0]),r=s.rows[selectedIndex]; if(r===undefined)return i.reply({content:'That selection is no longer available.',flags:MessageFlags.Ephemeral});
    if(!navigableHousePicker(s)&&!['tour-view','tour-add-house'].includes(s.kind))states.delete(sid);
    if(navigableHousePicker(s))return housePickerDetail(i,sid,selectedIndex);
    if(s.kind==='house-form')return finishHouseForm(i,s.extra.scope,s.extra.action,s.extra.id,s.extra.data,r,'update',s.extra.backId||'');
    if(s.kind==='registration-house-match'){
      const draft=registrationDrafts.get(s.extra.draftId,i.user.id);
      if(!draft)return i.reply({content:'That registration draft expired. Start Register New House again.',flags:MessageFlags.Ephemeral});
      registrationDrafts.update(draft.id,i.user.id,{house:r});
      return reviewRegistrationDraft(i,draft,'update');
    }
    if(s.kind==='pending')return i.update(pendingReviewPayload(r));
    if(s.kind==='admin-legacy-tour'){
      if(!isAdmin(i))return i.reply({content:'You do not have Housing administration access.',flags:MessageFlags.Ephemeral});
      try{return i.update(legacyTourRecoveryPayload(await environments.previewGuildLegacyTour({guildId:i.guildId,tourId:r.id})));}
      catch(error){return i.update({...adminPayload(guilds.getSettings(i.guildId)),content:error.message});}
    }
    if(s.kind==='featured-house'||s.kind==='featured-tour'){
      if(!isAdmin(i))return i.reply({content:'Only Housing Moderators can manage Featured housing.',flags:MessageFlags.Ephemeral});
      return i.showModal(featuredExpiryModal(s.kind==='featured-house'?'house':'tour',r.id));
    }
    if(s.kind==='tour-view')return tourBrowseDetail(i,sid,selectedIndex);
    if(s.kind==='tour-start'){const t=await tourById(i,r.id);if(!t)return i.update({content:'That tour is no longer available.',embeds:[],components:[]});return i.update(await tourStartPreflight(i,t,{backId:'hu:tours:start'}));}
    if(s.kind==='tour-manage')return tourManage(i,r.id);
    if(s.kind==='tour-bulk-add'){
      const bid=s.extra.bulkToken,b=bulkState(i,bid); if(!b)return i.update({content:'That bulk-tour selection expired.',embeds:[],components:[]});
      const rows=bulkSelectedRows(b),t=await tourById(i,r.id,{forManagement:true}); if(!t||!bulkCompatibleTour(i,t,rows))return i.update({content:'That tour is no longer available for these results.',embeds:[],components:[]});
      if(await bulkRowsChanged(i,rows,t))return staleBulkResults(i);
      const result=await tours.addStops(t.id,rows);if(result.added)await recordUsage(i,'updated_tour',{kind:'tour',id:t.id}); bulkTourStates.delete(bid);
      const duplicateText=result.skipped?` **${result.skipped}** house${result.skipped===1?' was':'s were'} already on the tour and skipped.`:'';
      const content=`Added **${result.added}** house${result.added===1?'':'s'} to **${t.name}**.${duplicateText}`;
      return i.update(b.registrationHouseId?await registrationTourSuccess(b,t,content):{...tourManagePayload(t,await tours.getStops(t.id)),content});
    }
    if(s.kind==='tour-add-house'){
      const t=await tourById(i,s.extra.tourId,{forManagement:true}); if(!t||!canManageTour(i,t))return i.update({content:'You cannot manage that tour.',embeds:[],components:[]});
      // A Global admin may edit a foreign Server tour, but Private houses
      // remain accessible only to their owner.
      const access=await accessContexts.forHouse({userId:i.user.id,guildId:isGlobalTourAdmin(i)?(t.source_guild_id||t.guild_id||t.origin_guild_id||i.guildId):i.guildId,esoServer:guilds.getEsoServer(i.guildId),savedHouseId:r.source_id??r.id});
      if(!access.canView||legacySavedRow(access.record).scope!==(r.source||r.scope))return i.update({content:'That house is no longer eligible for this tour. Open Add House again for a current list.',embeds:[],components:buttonRows([{customId:`hu:tour:add:${t.id}`,label:'Add House',style:'primary'}])});
      let addedStop;try{addedStop=await tours.addStop(t.id,r.source_id??r.id,null,r.source||'server');await recordUsage(i,'updated_tour',{kind:'tour',id:t.id});}
      catch(error){return i.update({content:`That house is no longer eligible for this tour: ${error.message}`,embeds:[],components:buttonRows([{customId:`hu:tour:add:${t.id}`,label:'Add House',style:'primary'}])});}
      const stops=await tours.getStops(t.id),current=stops.find(stop=>Number(stop.id)===Number(addedStop.id));return i.update(current?tourHouseAddedPayload(t,current,{pickerId:id.split(':')[2]}):tourManagePayload(t,stops));
    }
    if(['tour-stop-edit','tour-stop-reorder','tour-stop-remove'].includes(s.kind)){
      const t=await tourById(i,s.extra.tourId,{forManagement:true});
      if(!t||!canManageTour(i,t))return i.update({content:'You cannot manage that tour.',embeds:[],components:[]});
      const rows=await tours.getStops(t.id),current=rows.find(stop=>Number(stop.id)===Number(r.id));
      if(!current)return i.update({content:'That tour stop is no longer available.',embeds:[],components:[]});
      if(s.kind==='tour-stop-edit')return i.showModal(stopEditModal(t.id,current));
      if(s.kind==='tour-stop-reorder')return i.update(reorderPayload(t,current,rows.length));
      return i.update(confirmPayload({title:'Remove Tour Stop?',description:`Remove stop ${current.position}, **${destinationLabel(current)}**, from **${t.name}**? The underlying public house is not removed.`,confirmId:`hu:stop:removeconfirm:${t.id}:${current.id}`,cancelId:`hu:tour:manage:${t.id}`}));
    }
  }

  async function modal(i){
    if(!await prepareInteraction(i))return;
    const id=i.customId;
    if(id.startsWith('hu:modal:discussionpage:')){
      try{const sid=id.split(':')[3],state=commentReaderState(i,sid),house=await commentReaderHouse(i,state),total=await comments.count('global',house.id,state.esoServer),pages=Math.max(1,Math.ceil(total/commentPageSize)),value=String(i.fields.getTextInputValue('page')).trim(),page=Number(value);
        if(!/^\d+$/.test(value)||!Number.isSafeInteger(page)||page<1||page>pages)throw new Error(`Enter a page number from 1 to ${pages}.`);
        return await showCommentReader(i,sid,page,'modal');
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:modal:discussion:')){
      try{const sid=id.split(':')[3],state=commentReaderState(i,sid),house=await commentReaderHouse(i,state);
        await comments.add({esoServer:state.esoServer,savedHouseId:house.id,commenterUserId:i.user.id,text:i.fields.getTextInputValue('comment')});
        return await showCommentReader(i,sid,1,'modal','Comment added.');
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:modal:quickcomment:')){
      try{const context=quickCommentContext(i,id.split(':')[3]),source=await personalActionSource(i,context),target=houseTarget(source.row);if(houseTargetKey(target)!==houseTargetKey(context.target))throw new Error('That house destination changed. Open the house again.');
        await comments.add({esoServer:context.esoServer,savedHouseId:source.row.id,destinationId:source.row.destination_id,commenterUserId:i.user.id,text:i.fields.getTextInputValue('comment')});context.used=true;
        const payload={...context.snapshot,content:'Comment added.'};
        const isHouseCard=messageControls(context.snapshot.components).some(control=>String(control.custom_id||'').startsWith('hu:details:'));
        if(isHouseCard){
          const count=await comments.count('global',source.row.id,context.esoServer);
          payload.embeds=payload.embeds.map(embed=>({...embed,fields:embed.fields?.map(field=>field.name==='💬 Comments'?{...field,value:`${count} comment${count===1?'':'s'}`}:field)}));
          payload.components=refreshComponentCommentCount(payload.components,count);
        }
        return context.shared?i.reply({...payload,components:[],flags:MessageFlags.Ephemeral}):modalResponse(i,payload);
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:modal:pickerpage:')){
      const sid=id.split(':')[3],found=pickerPageContext(i,sid);if(found.error)return i.reply({content:found.error,flags:MessageFlags.Ephemeral});
      const input=String(i.fields.getTextInputValue('page')).trim(),page=Number(input);
      if(!/^\d+$/.test(input)||!Number.isSafeInteger(page)||page<1||page>found.pages)return i.reply({content:`Enter a page number from 1 to ${found.pages}.`,flags:MessageFlags.Ephemeral});
      found.state.page=page-1;return modalResponse(i,renderPicker(sid));
    }
    if(id.startsWith('hu:catalog:')||id.startsWith('hu:modal:catalog:')||(id==='hu:admin:tool'&&['catalog','catalog_edit'].includes(i.values?.[0])))return handleCatalog(i);
    if(isRetiredEventInteraction(id))return id.startsWith('hu:modal:')?i.reply({...retiredEventPayload(),flags:MessageFlags.Ephemeral}):i.update(retiredEventPayload());
    if(isServerModeratorAction(id))return handleServerModeratorAction(i,{serverModerators:guilds.serverModerators,guilds});
    if(isTourShareDestination(id))return handleTourShareDestination(i,{sharePasses,tours,guilds,loadHouse:async(i,id)=>(await loadSavedReference(i,id)).record});
    if(id.startsWith('hu:modal:savedsearch:')){
      const parts=id.split(':'),mode=parts[3],target=parts[4],name=text(i.fields.getTextInputValue('name'));
      try{
        if(mode==='rename'){
          const result=await savedSearches.rename({id:Number(target),userId:i.user.id,name});
          if(result.status==='not_found')return i.reply({content:'That saved search belongs to another user or is no longer available.',flags:MessageFlags.Ephemeral});
          if(result.status==='conflict')return i.reply({content:'You already have a saved search with that name. Choose a different name.',flags:MessageFlags.Ephemeral});
          return successfulSearchResponse(i,{...await savedSearchDetail(i,result.search.id),content:'Saved search renamed.'});
        }
        const s=advancedState(i,target);
        if(!s)return i.reply({content:'That Search Houses session expired. Open Search Houses again.',flags:MessageFlags.Ephemeral});
        const result=await savedSearches.save({userId:i.user.id,name,filters:combinedAdvancedFilters(s),...onboardingNames(i)});
        if(result.status==='conflict'){
          const stateToken=token();savedSearchStates.set(stateToken,{userId:i.user.id,advancedToken:target,name,created:Date.now()});
          return successfulSearchResponse(i,savedSearchConflictPayload({token:stateToken,name}));
        }
        return searchResults(i,s.filters,{searchType:s.title||'Search Houses',mode:'modal',scope:s.scope||'all',includeNonPlayerHomes:s.includeNonPlayer,backId:'hu:home',alwaysPicker:true,advancedToken:target,content:'Search saved to My Address Book.'});
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:modal:report:')){
      const parts=id.split(':'),kind=parts[3],problemType=parts[4],targetToken=parts.slice(5).join(':');
      try{
        const target=await reportTarget(i,kind,targetToken);
        await reports.submit({...target,esoServer:guilds.getEsoServer(i.guildId),reporterId:i.user.id,guildId:i.guildId,problemType,explanation:text(i.fields.getTextInputValue('explanation')),names:reportNames(i)});
        return i.reply({content:'Thank you. Your housing problem report was submitted for review.',flags:MessageFlags.Ephemeral});
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:modal:pass:house:copy:')){
      const parts=id.split(':'),visibility=parts[5],passToken=parts.slice(6).join(':');
      try{
        const resolved=await sharePasses.resolveHousePass(passToken,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
        const result=await houseCopies(i).copy({
          sourceSavedHouseId:resolved.house.id,userId:i.user.id,guildId:i.guildId,passId:resolved.pass.id,targetEsoServer:guilds.getEsoServer(i.guildId),visibility,
          nickname:text(i.fields.getTextInputValue('nickname'))||null,
          description:text(i.fields.getTextInputValue('description'))||null,
          tags:parseTagInput(i.fields.getTextInputValue('tags'))
        });
        const row=legacySavedRow(result.house),pending=result.house.status==='pending'?' It is awaiting Housing Moderator approval and will not appear in normal searches until approved.':'';
        const message=result.existing?'You already have this ESO destination saved at that visibility.':`House copied to your **${visibility==='private'?'Private':visibility==='public'?'Server':'Global'}** HearthBound collection.${pending}`;
        return modalResponse(i,{...destinationMenuPayload(await withHouseCardContext(i,row),{canEdit:true,backId:'hu:home'}),content:message});
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id==='hu:modal:globalmod:request'){
      try{await globalMods.requestAccess({userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),reason:i.fields.getTextInputValue('reason'),names:{globalName:i.user.globalName||i.user.username,displayName:i.member?.displayName,guildName:i.guild?.name}});return modalResponse(i,{content:'Your environment-specific Global Housing Moderator request was submitted for centralized approval.',embeds:[],components:buttonRows([{customId:'hu:globalmod',label:'Back',style:'secondary',emoji:'↩️'}])});}
      catch(e){return i.reply({content:e.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:modal:advanced:')){
      const p=id.split(':'),kind=p[3],aid=p[4],s=advancedState(i,aid);
      if(!s)return i.reply({content:'That Search Houses session expired. Open Search Houses again.',flags:MessageFlags.Ephemeral});
      if(kind==='filters'){
        s.filters.name=text(i.fields.getTextInputValue('name'));
        s.filters.owner=text(i.fields.getTextInputValue('owner')).replace(/^@/,'');
        s.filters.visibilities=[...i.fields.getStringSelectValues('visibilities')];
        s.includeNonPlayer=i.fields.getStringSelectValues('nonplayer').includes('include');
        const additional=i.fields.getStringSelectValues('attribute');
        s.filters.notOnPublicTours=additional.includes('notOnPublicTours');
        if(s.filters.notOnPublicTours)s.includeNonPlayer=false;
        const attribute=additional.find(value=>value!=='notOnPublicTours');
        if(attribute)return successfulSearchResponse(i,await renderAdvancedAttribute(i,aid,attribute));
        const scope=s.scope||'all',searchType=scope==='personal'?'Private House Search':scope==='server'?'Server House Search':'Search Houses';
        return searchResults(i,s.filters,{searchType,mode:'modal',scope,includeNonPlayerHomes:s.includeNonPlayer,backId:'hu:home',alwaysPicker:true,advancedToken:aid});
      }
      const q=text(i.fields.getTextInputValue('query'));
      if(kind==='owner')s.filters.owner=q.replace(/^@/,'');
      else s.filters.name=q;
      return successfulSearchResponse(i,renderAdvanced(i,aid));
    }
    if(id.startsWith('hu:modal:register-destination:')){
      const visibility=id.split(':')[3],scope=registrationScopeFromType(visibility);
      if(!scope)return i.reply({content:'House visibility is required.',flags:MessageFlags.Ephemeral});
      const input=text(i.fields.getTextInputValue('destination')),owner=text(i.fields.getTextInputValue('owner'));
      try{
        const resolved=await resolveDestinationInput({input,owner},houses);
        if(!resolved.house&&resolved.matches?.length&&!resolved.esoOwner)throw new Error('Enter the ESO owner when registering by house name or numeric ID.');
        const draft=registrationDrafts.create({userId:i.user.id,esoServer:guilds.getEsoServer(i.guildId),visibility,expectedStatus:registrationExpectedStatus(i,visibility),house:resolved.house,esoOwner:resolved.esoOwner,ownerConflict:resolved.ownerConflict||null,nickname:null,description:null,tags:[]});
        if(!resolved.house){
          return modalResponse(i,createPicker(i,{kind:'registration-house-match',rows:resolved.matches,extra:{title:'Which ESO house did you mean?',description:'Several official houses matched your entry.',draftId:draft.id},backId:'hu:register'}));
        }
        return reviewRegistrationDraft(i,draft,'modal');
      }catch(error){
        if(error.code==='HOUSE_NOT_FOUND'){
          const retry=registrationDrafts.create({kind:'retry',userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),visibility,input,owner});
          return modalResponse(i,registrationNotFoundPayload({retryId:`hu:register-retry:${retry.id}`}));
        }
        return i.reply({content:error.message,flags:MessageFlags.Ephemeral});
      }
    }
    if(id.startsWith('hu:modal:register-metadata:')){
      const draft=registrationDrafts.get(id.split(':')[3],i.user.id);
      if(!draft)return i.reply({content:'That registration draft expired. Start Register New House again.',flags:MessageFlags.Ephemeral});
      registrationDrafts.update(draft.id,i.user.id,{nickname:text(i.fields.getTextInputValue('nickname'))||null,description:text(i.fields.getTextInputValue('description'))||null,tags:parseTagInput(i.fields.getTextInputValue('tags'))});
      return modalResponse(i,registrationFinalReviewPayload(draft));
    }
    if(id.startsWith('hu:modal:register:')){ const scope=registrationScopeFromType(id.split(':')[3]); if(!scope)return i.reply({content:'Registration Type is required.',flags:MessageFlags.Ephemeral}); return submitHouseForm(i,scope,'add',null,'hu:home'); }
    if(id.startsWith('hu:modal:personal:edit:')){ const p=id.split(':'); return submitHouseForm(i,'personal','edit',Number(p[4]),decodeURIComponent(p.slice(5).join(':')||'')); }
    if(id.startsWith('hu:modal:guild:edit:')){ const p=id.split(':'); return submitHouseForm(i,'guild','edit',Number(p[4]),decodeURIComponent(p.slice(5).join(':')||'')); }
    if(id.startsWith('hu:modal:global:edit:')){ const p=id.split(':'); return submitHouseForm(i,'global','edit',Number(p[4]),decodeURIComponent(p.slice(5).join(':')||'')); }
    if(id.startsWith('hu:modal:pass:tour:comment:')){
      const parts=id.split(':'),sessionId=Number(parts[5]),stopId=Number(parts[6]),detailState=parts[7]==='expanded'?'expanded':'compact';
      try{
        const {stop}=await passTourStopContext(i,sessionId,stopId),esoServer=guilds.getEsoServer(i.guildId);
        await comments.add({esoServer,savedHouseId:stop.source_id,commenterUserId:i.user.id,text:i.fields.getTextInputValue('comment')});
        return await openCommentReader(i,{kind:'tour',sessionId,stopId,backId:`tour:return:${sessionId}:${stopId}:${detailState}`},'modal');
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:modal:pass:house:comment:')){
      const passToken=id.split(':').slice(5).join(':');
      try{
        const resolved=await sharePasses.resolveHousePass(passToken,{userId:i.user.id,guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});
        await comments.add({esoServer:guilds.getEsoServer(i.guildId),savedHouseId:resolved.house.id,commenterUserId:i.user.id,text:i.fields.getTextInputValue('comment')});
        return await openCommentReader(i,{kind:'pass',passToken,backId:`hu:pass:house:view:${passToken}`},'modal');
      }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}
    }
    if(id.startsWith('hu:modal:comment:')){
      const p=id.split(':'),scope=p[3],rid=Number(p[4]),backId=decodeURIComponent(p.slice(5).join(':')),r=await getSaved(scope,rid,i); if(!r)return i.reply({content:'That saved house is no longer available.',flags:MessageFlags.Ephemeral}); const value=i.fields.getTextInputValue('comment');
      const esoServer=guilds.getEsoServer(i.guildId);
      if(scope==='personal')await comments.addPersonal({esoServer,bookmarkId:rid,ownerUserId:i.user.id,commenterUserId:i.user.id,text:value}); else if(scope==='global')await comments.addGlobal({esoServer,savedHouseId:rid,commenterUserId:i.user.id,text:value}); else await comments.addServer({esoServer,registrationId:rid,guildId:i.guildId,commenterUserId:i.user.id,text:value});
      return commentsScreen(i,scope,rid,'modal',backId);
    }
    if(id.startsWith('hu:modal:bulk:create:')){
      const bid=id.split(':')[4],b=bulkState(i,bid); if(!b)return i.reply({content:'That bulk-tour selection expired.',flags:MessageFlags.Ephemeral});
      b.name=text(i.fields.getTextInputValue('name')); b.description=text(i.fields.getTextInputValue('description'))||null;
      if(!b.name)return i.reply({content:'Tour name is required.',flags:MessageFlags.Ephemeral});
      const rows=bulkSelectedRows(b);return modalResponse(i,bulkTourVisibilityPayload(bid,{allowPublic:!!i.guildId&&rows.every(r=>!['personal','private'].includes(r.scope)),allowGlobal:rows.every(r=>r.scope==='global')}));
    }
    if(id==='hu:modal:tour:create'){
      const did=token(); drafts.set(did,{userId:i.user.id,name:text(i.fields.getTextInputValue('name')),description:text(i.fields.getTextInputValue('description'))||null,created:Date.now()}); return modalResponse(i,tourVisibilityPayload(did));
    }
    if(id.startsWith('hu:modal:featured:expiry:')){ const parts=id.split(':'),targetKind=parts[4],targetId=Number(parts[5]); if(!isAdmin(i))return i.reply({content:'Only Housing Moderators can manage Featured housing.',flags:MessageFlags.Ephemeral}); const days=Number(text(i.fields.getTextInputValue('days'))); if(!Number.isInteger(days)||days<0||days>3650)return i.reply({content:'Enter a whole number of days from 0 to 3650. Use 0 for no expiration.',flags:MessageFlags.Ephemeral}); const expiresAt=days===0?null:new Date(Date.now()+days*86400000); try{await featured.set({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId),targetKind,targetId,expiresAt,actorId:i.user.id,isModerator:true,actorGlobalName:i.user.globalName||i.user.username,actorDisplayName:i.member?.displayName});const items=await featured.list({guildId:i.guildId,esoServer:guilds.getEsoServer(i.guildId)});return modalResponse(i,await enrichedFeaturedPayload(i,{items,canManage:true,selectedItem:items.find(item=>item.target_kind===targetKind&&Number(item.target_id)===targetId)||null}));}catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});} }
    if(id.startsWith('hu:modal:tour:edit:')){ const tid=Number(id.split(':')[4]),t=await tourById(i,tid,{forManagement:true}); if(!t||!canManageTour(i,t))return i.reply({content:'You cannot manage that tour.',flags:MessageFlags.Ephemeral}); const updated=await tours.update(tid,{name:text(i.fields.getTextInputValue('name')),description:text(i.fields.getTextInputValue('description'))||null}); await recordUsage(i,'updated_tour',{kind:'tour',id:tid});return modalResponse(i,tourEditDetailsPayload(updated)); }
    if(id.startsWith('hu:modal:tourhouses:')){const sid=id.split(':')[3],found=pickerPageContext(i,sid);if(found.error||found.state.kind!=='tour-add-house')return i.reply({content:found.error||'Open Add House again.',flags:MessageFlags.Ephemeral});const t=await tourById(i,found.state.extra.tourId,{forManagement:true});if(!t||!canManageTour(i,t))return i.reply({content:'You cannot manage that tour.',flags:MessageFlags.Ephemeral});const filters=Object.fromEntries(['query','tags','visibility','zone','architecture'].map(key=>[key,text(i.fields.getTextInputValue(key))]));try{filterTourHouses([],filters);}catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral});}if(Object.values(filters).some(Boolean))found.state.extra.houseFilters=filters;else delete found.state.extra.houseFilters;return modalResponse(i,await tourAddHousePayload(i,t,{stateId:sid}));}
    if(id.startsWith('hu:modal:stop:notes:')){const p=id.split(':'),t=await tourById(i,Number(p[4]),{forManagement:true});if(!t||!canManageTour(i,t))return modalResponse(i,{content:'You cannot manage that tour.',embeds:[],components:[]});let stop=(await tours.getStops(t.id)).find(stop=>Number(stop.id)===Number(p[5]));if(!stop)return modalResponse(i,{content:'That tour stop no longer exists.',embeds:[],components:[]});const notes=text(i.fields.getTextInputValue('description'))||null;await tours.updateStop(stop.id,{notes});if(notes!==stop.notes)await recordUsage(i,'updated_tour',{kind:'tour',id:t.id});stop=(await tours.getStops(t.id)).find(row=>Number(row.id)===Number(stop.id));return modalResponse(i,stop?tourHouseAddedPayload(t,stop,{pickerId:p[6]||'none',notesSaved:true,returnHouseId:Number(p[7])||null}):tourManagePayload(t,await tours.getStops(t.id)));}
    if(id.startsWith('hu:modal:stop:edit:')){ const p=id.split(':'),tid=Number(p[4]),stopId=Number(p[5]),t=await tourById(i,tid,{forManagement:true}); if(!t||!canManageTour(i,t))return modalResponse(i,{content:'You cannot manage that tour.',embeds:[],components:[]}); const current=(await tours.getStops(tid)).find(s=>s.id===stopId); if(!current)return modalResponse(i,{content:'That tour stop no longer exists.',embeds:[],components:[]}); const enteredTitle=text(i.fields.getTextInputValue('title')),defaultTitle=text(current.registration_nickname||current.house_name||current.title); const customTitle=enteredTitle&&enteredTitle!==defaultTitle?enteredTitle:null; await tours.updateStop(stopId,{title:customTitle,notes:text(i.fields.getTextInputValue('description'))||null});if(customTitle!==current.custom_title||(text(i.fields.getTextInputValue('description'))||null)!==current.notes)await recordUsage(i,'updated_tour',{kind:'tour',id:tid}); return modalResponse(i,tourManagePayload(t,await tours.getStops(tid))); }
  }
  return {chat,button,select,modal,invalidateSettings(guildId){guilds.invalidate(guildId);environments.invalidate(guildId);}};
}
