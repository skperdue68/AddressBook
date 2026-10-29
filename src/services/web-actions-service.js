import {createHash} from 'node:crypto';
import {one,withTransaction} from '../db/database.js';
import {UserHouseStateService} from './user-house-state-service.js';
import {MyAddressBookService} from './my-addressbook-service.js';
import {SavedHouseSearchService} from './saved-house-search-service.js';
import {VisitService} from './visit-service.js';
import {CommentService} from './comment-service.js';
import {HousingReportService} from './housing-report-service.js';
import {SharePassService} from './share-pass-service.js';
import {GuildEnvironmentService} from './guild-environment-service.js';
import {HouseCopyService} from './house-copy-service.js';
import {TourCopyService} from './tour-copy-service.js';
import {houseTarget} from '../utils/house-target.js';
import {normalizeSearchFilters} from '../utils/search-filters.js';

const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const id=value=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<1)throw new Error('Invalid record selection.');return n;};
export class WebActionsService {
 constructor(workspace){this.w=workspace;this.db=workspace.db;this.states=new UserHouseStateService(this.db);this.book=new MyAddressBookService(this.db);this.searches=new SavedHouseSearchService(this.db);this.visits=new VisitService(this.db);this.comments=new CommentService(this.db);this.reports=new HousingReportService(this.db);this.passes=new SharePassService(this.db);this.environments=new GuildEnvironmentService(this.db);}
 async context(c){return this.w.fresh(c);}
 async writable(c,kind,targetId,conn=this.db){
  const row=kind==='house'?await this.w.saved.get(id(targetId),conn):kind==='tour'?await this.w.tours.get(id(targetId),conn):null;
  if(!row||!(kind==='house'?this.w.policy.canEditHouse(row,c):this.w.policy.canEditTour(row,c)))throw new Error('That record is not available for editing.');
  return row;
 }
 async deletionSnapshot(c,kind,targetId,conn=this.db){
  const record=await this.writable(c,kind,targetId,conn);
  const stops=await conn.query(`SELECT id,tour_id,position,saved_house_id,custom_title,notes FROM tour_stops WHERE ${kind==='house'?'saved_house_id':'tour_id'}=? ORDER BY id`,[id(targetId)]);
  return {record,version:fingerprint({record,stops}),impact:{stops:stops.length,tours:kind==='house'?new Set(stops.map(s=>s.tour_id)).size:1}};
 }
 async deletePreview(context,kind,targetId){return this.deletionSnapshot(await this.context(context),kind,targetId);}
 async deleteConfirmed(context,kind,targetId,version){
  const c=await this.context(context);
  return withTransaction(this.db,async conn=>{
   const table=kind==='house'?'saved_houses':kind==='tour'?'tours':null;if(!table)throw new Error('Invalid record type.');
   await one(conn,`SELECT id FROM ${table} WHERE id=? FOR UPDATE`,[id(targetId)]);
   const snap=await this.deletionSnapshot(c,kind,targetId,conn);
   if(version!==snap.version)throw new Error('This record or its tour links changed. Review the deletion again.');
   if(kind==='house')return this.w.saved.delete(targetId,c.userId,conn);
   await conn.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,entity_name,details) VALUES(?,?,?,?,?,?,?)',[c.guildId,c.userId,'delete_tour','tour',String(targetId),snap.record.name,JSON.stringify({source:'web',stops:snap.impact.stops})]);
   return this.w.tours.remove(targetId,conn);
  });
 }
 async houseExtras(context,houseId){
  const c=await this.context(context),house=await this.w.getHouse(c,houseId);
  const [state,comments]=await Promise.all([this.states.get(c.userId,houseTarget(house)),this.db.query("SELECT hc.*,coalesce(u.global_name,u.username,hc.discord_user_id) author_name FROM house_comments hc LEFT JOIN discord_users u ON u.discord_user_id=hc.discord_user_id WHERE hc.destination_id=? AND hc.status='active' ORDER BY hc.created_at DESC,hc.id DESC LIMIT 25",[house.destination_id])]);
  return {house,state,comments};
 }
 async houseAction(context,houseId,action,input={}){
  const c=await this.context(context),house=await this.w.getHouse(c,houseId);if(house.status!=='active')throw new Error('House is not available.');
  const args={userId:c.userId,target:houseTarget(house),visibleTarget:house};
  if(action==='favorite')return this.states.setFavorite({...args,favorite:input.value==='1'});
  if(action==='visit')return this.states.setVisitState({...args,visitState:input.value});
  if(action==='comment'){const text=String(input.text||'').trim();if(!text||text.length>2000)throw new Error('Enter a comment between 1 and 2000 characters.');return this.comments.add({esoServer:c.esoServer,savedHouseId:house.id,commenterUserId:c.userId,text});}
  if(action==='report'){const explanation=String(input.explanation||'').trim();if(explanation.length>2000)throw new Error('Report explanation is too long.');return this.reports.submit({esoServer:c.esoServer,destinationId:house.destination_id,savedHouseId:house.id,reporterId:c.userId,guildId:c.guildId,problemType:input.problemType,explanation,names:{guildName:c.guildName}});}
  throw new Error('Invalid house action.');
 }
 async personal(context,kind){
  const c=await this.context(context),args={userId:c.userId,guildId:c.guildId,esoServer:c.esoServer};
  if(['favorites','wantToVisit','visited'].includes(kind))return this.states.list({...args,kind});
  if(kind==='recent')return this.book.recent(c.userId,c.guildId,c.esoServer,100);
  if(kind==='pending')return this.book.pending(c.userId,c.esoServer,c.guildId);
  throw new Error('Invalid personal collection.');
 }
 async search(context,raw={}){
  const c=await this.context(context),filters=normalizeSearchFilters(raw);
  const rows=await this.visits.search({userId:c.userId,guildId:c.guildId,esoServer:c.esoServer,...filters,limit:null});
  return {filters,rows:rows.sort((a,b)=>String(a.display_name||a.house_name).localeCompare(String(b.display_name||b.house_name))||Number(a.id)-Number(b.id))};
 }
 async saveSearch(context,{name,filters,replace=false}){const c=await this.context(context);return this.searches.save({userId:c.userId,name,filters:normalizeSearchFilters(filters),replace});}
 async ownedSearch(context,searchId){const c=await this.context(context),search=await this.searches.getOwned(id(searchId),c.userId);if(!search)throw new Error('Saved search is not available.');return {c,search};}
 async runSearch(context,searchId){const {c,search}=await this.ownedSearch(context,searchId);return {...await this.search(c,this.searches.filters(search)),search};}
 async player(context,tourId){
  const c=await this.context(context),draft=await this.w.getTourDraft(c,tourId);if(!draft.canView)throw new Error('Tour is not available for playback.');
  let progress=await one(this.db,'SELECT * FROM tour_progress WHERE tour_id=? AND discord_user_id=? AND eso_server=?',[id(tourId),c.userId,c.esoServer]);
  if(progress?.status==='active')progress=await this.w.progress.reconcile({progressId:progress.id,userId:c.userId,guildId:c.guildId,esoServer:c.esoServer});
  const current=draft.stops.find(s=>Number(s.id)===Number(progress?.current_stop_id))||null;
  const house=current?await this.w.getHouse(c,current.saved_house_id):null;
  const completed=progress?await this.w.progress.completedStops({progressId:progress.id,userId:c.userId,guildId:c.guildId,esoServer:c.esoServer}):[];
  return {draft,progress,current,house,completed};
 }
 async playAction(context,tourId,action,expectedStopId){
  const c=await this.context(context),draft=await this.w.getTourDraft(c,tourId);if(!draft.canView)throw new Error('Tour is not available for playback.');
  if(action==='start')return this.w.startTour(c,tourId);
  if(action==='restart')return this.w.restartTour(c,tourId);
  const row=await one(this.db,'SELECT * FROM tour_progress WHERE tour_id=? AND discord_user_id=? AND eso_server=?',[id(tourId),c.userId,c.esoServer]);
  if(!row||row.status!=='active'||!expectedStopId)throw new Error('This tour progress changed. Reload the player.');
  const args={progressId:row.id,userId:c.userId,guildId:c.guildId,esoServer:c.esoServer,expectedStopId:id(expectedStopId)};
  if(action==='next')return this.w.progress.advance(args);
  if(action==='back')return this.w.progress.back(args);
  throw new Error('Invalid player action.');
 }
 async scopePreview(context,houseId,visibility){
  const c=await this.context(context),house=await this.writable(c,'house',houseId);
  if(!['private','public','global'].includes(visibility))throw new Error('Invalid visibility.');if(c.personalWorkspace&&visibility==='public')throw new Error('Server visibility requires a connected Discord server.');
  const trusted=c.isOwner||JSON.parse(c.settings.registration_role_ids||'[]').some(r=>c.memberRoleIds.includes(r));
  if(visibility!=='private'&&!c.isServerAdmin&&c.settings.registration_policy==='roles'&&!trusted)throw new Error('A registration role is required for shared houses.');
  const status=visibility!=='private'&&!c.isServerAdmin&&!trusted&&c.settings.registration_policy==='approval'?'pending':'active';
  const preview=await this.w.saved.previewScopeChange(house.id,visibility,{targetStatus:status,targetGuildId:c.guildId,targetOwnerUserId:house.owner_user_id||house.created_by||c.userId});
  return {house,visibility,status,impact:{tours:preview.affectedTours.length,stops:preview.affectedStops.length},version:fingerprint({house,visibility,status,stops:preview.affectedStops})};
 }
 async changeScope(context,houseId,visibility,version){
  const c=await this.context(context),preview=await this.scopePreview(c,houseId,visibility);
  if(preview.version!==version)throw new Error('The visibility impact changed. Review it again.');
  return this.w.saved.changeScope(houseId,visibility,{actorId:c.userId,targetGuildId:c.guildId,targetEsoServer:c.esoServer,targetOwnerUserId:preview.house.owner_user_id||preview.house.created_by||c.userId,status:preview.status,validate:locked=>{if(!this.w.policy.canEditHouse(locked.house,c)||fingerprint({house:locked.house,visibility,status:preview.status,stops:locked.affectedStops})!==version)throw new Error('The visibility impact changed. Review it again.');}});
 }
 async updateStop(context,tourId,stopId,version,{title,notes}){
  const c=await this.context(context);
  return withTransaction(this.db,async conn=>{
   const snap=await this.w.tourSnapshot(conn,tourId);
   if(!snap||!this.w.policy.canEditTour(snap.tour,c))throw new Error('Tour is not available for editing.');
   if(version!==snap.version)throw new Error('This tour changed. Reload the editor.');
   const stop=snap.stops.find(s=>Number(s.id)===id(stopId));if(!stop)throw new Error('Stop is not available.');
   const house=await this.w.saved.get(stop.saved_house_id,conn);
   if(!this.w.policy.canViewHouse(house,c))throw new Error('That house is not available for editing stop details.');
   const updated=await this.w.tours.updateStop(stopId,{title,notes},conn);
   await conn.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)',[c.guildId,c.userId,'update_tour_stop','tour',String(tourId),JSON.stringify({source:'web',stopId:Number(stopId)})]);return updated;
  });
 }
 async requestAccess(context,kind,reason,names={}){
  const c=await this.context(context),text=String(reason||'').trim();if(!text||text.length>1000)throw new Error('Enter a reason between 1 and 1000 characters.');
  const args={guildId:c.guildId,userId:c.userId,reason:text,names:{...names,guildName:c.guildName}};
  if(kind==='server'){if(c.isServerAdmin)throw new Error('You already have Server administrator access.');return this.w.policy.server.request(args);}
  if(kind==='global')return this.w.policy.global.requestAccess({...args,esoServer:c.esoServer});
  throw new Error('Invalid access request.');
 }
 async operationalSettings(context,{channelId='',timezone=''}){
  const c=await this.w.adminContext(context);
  if(channelId&&!/^\d{1,20}$/.test(String(channelId)))throw new Error('Use a numeric Discord channel ID.');
  if(channelId&&this.w.discord)await this.w.discord.checkChannel(c,channelId);
  const zone=String(timezone||'').trim();if(zone){try{new Intl.DateTimeFormat('en',{timeZone:zone}).format();}catch{throw new Error('Choose a valid IANA timezone, such as America/Chicago.');}}
  await withTransaction(this.db,async conn=>{
   await conn.query('UPDATE guild_settings SET bot_channel_id=?,timezone=? WHERE guild_id=?',[channelId||null,zone||null,c.guildId]);
   await conn.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)',[c.guildId,c.userId,'update_server_settings','guild',c.guildId,JSON.stringify({source:'web',channelId:channelId||null,timezone:zone||null})]);
  });
  this.w.invalidateSettings?.(c.guildId);
 }
 async legacy(context,kind,params={}){
  const c=await this.context(context);
  if(kind==='personal'){const args={userId:c.userId,esoServer:c.esoServer,actorId:c.userId,guildId:c.guildId};return params.confirm?this.environments.confirmPrivateLegacy({...args,expectedFingerprint:params.version}):this.environments.previewPrivateLegacy(args);}
  await this.w.adminContext(c);
  if(kind==='environment'){const args={guildId:c.guildId,toEsoServer:params.toEsoServer,actorId:c.userId};const out=params.confirm?await this.environments.confirmChange({...args,expectedFingerprint:params.version}):await this.environments.previewChange(args);if(params.confirm)this.w.invalidateSettings?.(c.guildId);return out;}
  if(kind==='tour'){const args={guildId:c.guildId,tourId:id(params.tourId),actorId:c.userId};return params.confirm?this.environments.confirmGuildLegacyTour({...args,expectedFingerprint:params.version}):this.environments.previewGuildLegacyTour(args);}
  throw new Error('Invalid recovery action.');
 }
 async shareTarget(context,kind,targetId){const c=await this.context(context);if(kind==='house'){const record=await this.w.getHouse(c,targetId);if(record.status!=='active')throw new Error('House is not available to share.');return {c,record,stops:[]};}if(kind==='tour'){const draft=await this.w.getTourDraft(c,targetId);if(!draft.canView||(draft.tour.visibility==='private'&&draft.tour.creator_id!==c.userId))throw new Error('Tour is not available to share.');return {c,record:draft.tour,stops:draft.stops};}throw new Error('Invalid share type.');}
 async createPass(context,kind,targetId){const {c,record}=await this.shareTarget(context,kind,targetId);if(c.personalWorkspace)throw new Error('Discord sharing requires a connected Discord server.');return this.passes[kind==='house'?'createHousePass':'createTourPass']({[kind==='house'?'savedHouseId':'tourId']:record.id,createdBy:c.userId,originGuildId:c.guildId,esoServer:c.esoServer,names:{originGuildName:c.guildName}});}
 async ownedPass(context,kind,passId){const c=await this.context(context),table=kind==='house'?'house_share_passes':kind==='tour'?'tour_share_passes':null;if(!table)throw new Error('Invalid pass type.');const pass=await one(this.db,`SELECT * FROM ${table} WHERE id=? AND created_by=?`,[id(passId),c.userId]);if(!pass)throw new Error('Pass is not available.');const targetId=pass[kind==='house'?'saved_house_id':'tour_id'];if(targetId){const target=kind==='house'?await this.w.saved.get(targetId):await this.w.tours.get(targetId);if(target?.eso_server!==c.esoServer)throw new Error('Pass is not available in this environment.');}return {c,pass};}
 async revokePass(context,kind,passId){const {c}=await this.ownedPass(context,kind,passId);return this.passes[kind==='house'?'revokeHousePass':'revokeTourPass'](passId,{actorId:c.userId});}
 async resolvePass(context,kind,token){const c=await this.context(context);if(!/^[A-Za-z0-9_-]{32}$/.test(String(token)))throw new Error('Invalid Share Pass.');return this.passes[kind==='house'?'resolveHousePass':'resolveTourPass'](token,{userId:c.userId,guildId:c.guildId,esoServer:c.esoServer});}
 async copyPass(context,kind,token,input={}){
  const c=await this.context(context),resolved=await this.resolvePass(c,kind,token);
  if(kind==='tour')return new TourCopyService(this.db).copy({tourId:resolved.tour.id,passId:resolved.pass.id,userId:c.userId,guildId:c.guildId,esoServer:c.esoServer,name:input.name,description:input.description});
  const copy=new HouseCopyService(this.db,{policy:{registrationOutcome:async({visibility})=>{if(visibility==='private')return {allowed:true,status:'active'};const trusted=c.isServerAdmin||c.isOwner||JSON.parse(c.settings.registration_role_ids||'[]').some(r=>c.memberRoleIds.includes(r));return {allowed:trusted||c.settings.registration_policy!=='roles',status:!trusted&&c.settings.registration_policy==='approval'?'pending':'active'};}}});
  return copy.copy({sourceSavedHouseId:resolved.house.id,userId:c.userId,guildId:c.guildId,passId:resolved.pass.id,targetEsoServer:c.esoServer,visibility:input.visibility||'private',nickname:input.displayName,description:input.description,tags:input.tags});
 }
}
