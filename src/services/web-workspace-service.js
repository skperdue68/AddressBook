import {applyPermissionPreview} from './permission-preview.js';
import {TourCoverService} from './tour-cover-service.js';
import {pageWindow} from '../utils/pagination.js';
import {HouseImageService} from './house-image-service.js';
import {FeedbackService} from './feedback-service.js';
import {UsageActivityService} from './usage-activity-service.js';
import {WebActionsService} from './web-actions-service.js';
import {HouseCatalogService} from './house-catalog-service.js';
import {CommunityStatisticsService} from './community-statistics-service.js';
import {normalizeAccount} from '../utils/eso.js';
import {createHash} from 'node:crypto';
import {TourService} from './tour-service.js';
import {TourProgressService} from './tour-progress-service.js';
import {withTransaction} from '../db/database.js';
import {boundedRequired,boundedOptional,TOUR_NAME_MAX,TOUR_DESCRIPTION_MAX} from '../utils/text-limits.js';
import {ContentPolicyService} from './content-policy-service.js';
import {SavedHouseService,tourAllowsHouseScope} from './saved-house-service.js';
import {HouseService} from './house-service.js';
import {FeaturedContentService} from './featured-content-service.js';
import {withCatalogHouseNames} from '../utils/query-results.js';
import {one} from '../db/database.js';
const tourNameOrder=new Intl.Collator('en',{sensitivity:'base'});
export class WebWorkspaceService{
 constructor(db,{env=process.env}={}){this.db=db;this.feedback=new FeedbackService(db,env);this.policy=new ContentPolicyService(db,env);this.statistics=new CommunityStatisticsService(db);this.usage=new UsageActivityService(db);this.ownerCatalog=new HouseCatalogService(db,env);this.saved=new SavedHouseService(db);this.tours=new TourService(db);this.progress=new TourProgressService(db);this.catalog=new HouseService(db);this.featuredService=new FeaturedContentService(db);this.actions=new WebActionsService(this);this.images=new HouseImageService(this,{directory:env.HOUSE_IMAGE_DIR});this.tourCovers=new TourCoverService(this,{directory:env.TOUR_COVER_DIR});}
 async authorizeContext(input){return applyPermissionPreview(await this.policy.context({...input,memberRoleIds:input.previewMemberRoleIds||input.memberRoleIds}),input.permissionPreview);}
 fresh(c){return this.authorizeContext(c);}
 houseScopes(c){if(c.personalWorkspace)return ['global','private'];return c.settings.registration_policy!=='roles'||c.isServerAdmin||c.isOwner||JSON.parse(c.settings.registration_role_ids||'[]').some(r=>c.memberRoleIds.includes(r))?['public','private','global']:['private'];}
 async tourHouseCandidates(context){
  const c=await this.fresh(context);
  const rows=await this.db.query(`SELECT s.id,s.house_id,s.scope,s.guild_id,s.owner_user_id,s.display_name,s.eso_owner,s.tags,h.name catalog_house_name,h.zone,h.classification,h.house_type,h.style,h.population_limit,h.population_limit_plus FROM saved_houses s JOIN houses h ON h.house_id=s.house_id WHERE s.eso_server=? AND s.status='active' AND (s.scope='global' OR (s.scope='public' AND s.guild_id=?) OR (s.scope='private' AND s.owner_user_id=?))`,[c.esoServer,c.guildId,c.userId]);
  return (await this.withHouseCovers(withCatalogHouseNames(rows))).sort((a,b)=>tourNameOrder.compare(a.display_name||a.house_name,b.display_name||b.house_name)||Number(a.id)-Number(b.id));
 }
 async listHouses(c,{q='',scope='',page=1,personal=false,houseId='',ownerExact='',sort='az',zone='',style='',classification='',tag=''}={}){
  const clauses=['s.eso_server=?'],args=[c.esoServer];
  if(personal){clauses.push("s.status='active' AND ((s.scope='private' AND s.owner_user_id=?) OR (s.scope<>'private' AND s.created_by=? AND (s.scope='global' OR s.guild_id=?)))");args.push(c.userId,c.userId,c.guildId);}
  else{clauses.push("s.status='active' AND (s.scope='global' OR (s.scope='public' AND s.guild_id=?) OR (s.scope='private' AND s.owner_user_id=?))");args.push(c.guildId,c.userId);}
  if(['private','public','global'].includes(scope)){clauses.push('s.scope=?');args.push(scope);}
  if(scope==='shared'){clauses.push("s.scope IN ('public','global')");}
  if(houseId!==''){clauses.push('s.house_id=?');args.push(Number(houseId)||0);}
  if(ownerExact!==''){clauses.push('s.normalized_owner=?');args.push(normalizeAccount(ownerExact));}
  for(const [column,value] of [['zone',zone],['style',style],['classification',classification]])if(value){clauses.push(`lower(coalesce(h.${column},''))=?`);args.push(String(value).trim().toLowerCase());}
  if(tag){clauses.push("lower(coalesce(s.tags,'')) LIKE ? ESCAPE '!'");const token=JSON.stringify(String(tag).trim()).toLowerCase().replace(/[!%_]/g,c=>'!'+c);args.push('%'+token+'%');}
  if(q){clauses.push("(lower(h.name) LIKE ? OR lower(coalesce(s.display_name,'')) LIKE ? OR lower(s.eso_owner) LIKE ? OR lower(coalesce(h.zone,'')) LIKE ?)");const term=`%${String(q).slice(0,200).toLowerCase()}%`;args.push(term,term,term,term);}
  const where=clauses.join(' AND '),total=Number((await one(this.db,`SELECT count(*) c FROM saved_houses s JOIN houses h ON h.house_id=s.house_id WHERE ${where}`,args)).c),p=pageWindow(page,total).page;
  const rows=await this.db.query(`SELECT s.*,h.name catalog_house_name,h.zone,h.classification,h.house_type,h.style,h.population_limit,h.population_limit_plus FROM saved_houses s JOIN houses h ON h.house_id=s.house_id WHERE ${where} ORDER BY ${sort==='newest'?'s.created_at DESC,':sort==='favorites'?"(SELECT count(*) FROM user_house_states us WHERE us.target_kind='destination' AND us.target_id=s.destination_id AND us.is_favorite=1) DESC,":''}lower(coalesce(s.display_name,h.name)),s.id LIMIT 25 OFFSET ?`,[...args,(p-1)*25]);
  return {rows:withCatalogHouseNames(rows).map(h=>({...h,canEdit:this.policy.canEditHouse(h,c)})),total,page:p,hasNext:p*25<total};
 }
 async houseFilterChoices(c,{globalOnly=false}={}){
  const rows=await this.db.query(`SELECT h.zone,h.style,h.classification,s.tags FROM saved_houses s JOIN houses h ON h.house_id=s.house_id WHERE s.eso_server=? AND s.status='active' AND ${globalOnly?"s.scope='global'":"(s.scope='global' OR (s.scope='public' AND s.guild_id=?) OR (s.scope='private' AND s.owner_user_id=?))"}`,globalOnly?[c.esoServer]:[c.esoServer,c.guildId,c.userId]);
  const sets={zone:new Set(),style:new Set(),classification:new Set(),tag:new Set()};for(const row of rows){for(const key of ['zone','style','classification'])if(row[key])sets[key].add(String(row[key]));try{const tags=JSON.parse(row.tags||'[]');if(Array.isArray(tags))for(const tag of tags)sets.tag.add(String(tag));}catch{}}
  return Object.fromEntries(Object.entries(sets).map(([key,values])=>[key,[...values].sort((a,b)=>tourNameOrder.compare(a,b))]));
 }
 async sortHouseResults(rows,sort='az'){
  const ranked=rows.map(h=>({...h}));
  if(sort==='favorites'&&rows.length){const destinations=[...new Set(rows.filter(h=>h.scope!=='official').map(h=>Number(h.destination_id)).filter(Boolean))],official=[...new Set(rows.filter(h=>h.scope==='official').map(h=>Number(h.house_id)).filter(Boolean))],counts=new Map();
   for(const [kind,ids] of [['destination',destinations],['official',official]])if(ids.length){const totals=await this.db.query(`SELECT target_id,count(*) c FROM user_house_states WHERE target_kind=? AND is_favorite=1 AND target_id IN (${ids.map(()=>'?').join(',')}) GROUP BY target_id`,[kind,...ids]);for(const total of totals)counts.set(`${kind}:${Number(total.target_id)}`,Number(total.c));}
   for(const h of ranked)h.favorite_count=counts.get(`${h.scope==='official'?'official':'destination'}:${Number(h.scope==='official'?h.house_id:h.destination_id)}`)||0;
  }
  return ranked.sort((a,b)=>(sort==='favorites'?Number(b.favorite_count||0)-Number(a.favorite_count||0):sort==='newest'?(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0):0)||tourNameOrder.compare(a.display_name||a.house_name||a.name,b.display_name||b.house_name||b.name)||Number(a.id)-Number(b.id));
 }
 async withHouseCovers(rows){
  const ids=[...new Set(rows.filter(h=>h.scope!=='official'&&Number(h.id)>0).map(h=>Number(h.id)))];
  const covers=ids.length?await this.db.query(`SELECT id,saved_house_id FROM house_images WHERE saved_house_id IN (${ids.map(()=>'?').join(',')}) ORDER BY position,id`,ids):[];
  const coverMap=new Map();for(const image of covers)if(!coverMap.has(Number(image.saved_house_id)))coverMap.set(Number(image.saved_house_id),image.id);
  return rows.map(h=>({...h,cover_image_id:h.scope==='official'?null:coverMap.get(Number(h.id))||null}));
 }
 async decorateHouses(c,rows){
  if(!rows.length)return rows;
  const targets=[...new Set(rows.map(h=>Number(h.scope==='official'?h.house_id:h.destination_id)).filter(id=>id>0))];
  const covered=await this.withHouseCovers(rows);
  const states=targets.length?await this.db.query(`SELECT * FROM user_house_states WHERE discord_user_id=? AND target_id IN (${targets.map(()=>'?').join(',')})`,[c.userId,...targets]):[];
  const stateMap=new Map(states.map(state=>[`${state.target_kind}:${Number(state.target_id)}`,state]));
  return covered.map(h=>({...h,personal_state:stateMap.get(`${h.scope==='official'?'official':'destination'}:${Number(h.scope==='official'?h.house_id:h.destination_id)}`)||{is_favorite:0,visit_state:'none'}}));
 }
 async getHouse(c,id){const h=await this.saved.get(id);if(!h||(!this.policy.canViewHouse(h,c)&&!(this.policy.canEditHouse(h,c)&&h.status==='pending')))throw new Error('House is not available.');return {...h,canEdit:this.policy.canEditHouse(h,c)};}
 async registerHouse(context,{houseId,esoOwner,visibility,displayName=null,description=null,tags=[]}){
  const c=await this.fresh(context);visibility??=this.houseScopes(c)[0];if(!['private','public','global'].includes(visibility))throw new Error('Choose Private, Server or Global visibility.');if(c.personalWorkspace&&visibility==='public')throw new Error('Server visibility requires a connected Discord server.');
  if(!await one(this.db,'SELECT house_id FROM houses WHERE house_id=?',[Number(houseId)||0]))throw new Error('That official house does not exist in the catalog. Check the selection or ask a bot owner to add a newly released house.');
  const trusted=c.isOwner||JSON.parse(c.settings.registration_role_ids||'[]').some(r=>c.memberRoleIds.includes(r));
  if(visibility!=='private'&&!c.isServerAdmin&&c.settings.registration_policy==='roles'&&!trusted)throw new Error('Your server requires a registration role to register shared houses.');
  const status=visibility!=='private'&&!c.isServerAdmin&&c.settings.registration_policy==='approval'&&!trusted?'pending':'active';
  const data={esoServer:c.esoServer,houseId:Number(houseId),esoOwner,displayName,description,tags,createdBy:c.userId,status};
  if(visibility==='private')return this.saved.createPrivate({...data,userId:c.userId,originGuildId:c.guildId});
  if(visibility==='public')return this.saved.createPublic({...data,guildId:c.guildId});
  return this.saved.createGlobal({...data,originGuildId:c.guildId});
 }
 async updateHouse(context,id,fields){const c=await this.fresh(context),h=await this.getHouse(c,id);if(!this.policy.canEditHouse(h,c))throw new Error('House is not available for editing.');return this.saved.update(id,{houseId:fields.houseId?Number(fields.houseId):undefined,esoOwner:fields.esoOwner,displayName:fields.displayName,description:fields.description,tags:fields.tags},c.userId);}
 async personalCollection(c,{page=1}={}){const result=await this.listHouses(c,{personal:true,page});return {...result,houses:result.rows};}
 async houseTourChoices(context,houseId){
  const c=await this.fresh(context),h=await this.getHouse(c,houseId);if(h.status!=='active')return [];
  const unavailable=await this.db.query('SELECT ts.tour_id FROM tour_stops ts JOIN saved_houses s ON s.id=ts.saved_house_id WHERE s.destination_id=? UNION SELECT tour_id FROM tour_stops GROUP BY tour_id HAVING count(*)>=250',[h.destination_id]);
  const excluded=new Set(unavailable.map(r=>Number(r.tour_id)));
  return (await this.listTours(c)).filter(t=>t.canEdit&&!excluded.has(Number(t.id))&&tourAllowsHouseScope(t,h.scope)&&(h.scope!=='private'||h.owner_user_id===t.creator_id)&&(h.scope!=='public'||h.guild_id===(t.source_guild_id||t.guild_id||t.origin_guild_id)));
 }
 async randomHouse(c){const rows=await this.db.query("SELECT id FROM saved_houses WHERE eso_server=? AND status='active' AND (scope='global' OR (scope='public' AND guild_id=?) OR (scope='private' AND owner_user_id=?))",[c.esoServer,c.guildId,c.userId]);return rows.length?this.getHouse(c,rows[Math.floor(Math.random()*rows.length)].id):null;}
 featured(c){if(c.personalWorkspace)return Promise.resolve([]);return this.featuredService.list({guildId:c.guildId,esoServer:c.esoServer});}
 async decorateTours(c,rows){const ids=rows.filter(t=>t.canView).map(t=>Number(t.id));const covers=ids.length?await this.db.query(`SELECT tour_id FROM tour_covers WHERE tour_id IN (${ids.map(()=>'?').join(',')})`,ids):[],available=new Set(covers.map(row=>Number(row.tour_id)));return rows.map(t=>({...t,cover:t.canView&&available.has(Number(t.id))}));}
 async listTours(c,{mine=false,q='',scope='',houseId=''}={}){
  const rows=await this.tours.list({creatorId:c.userId,guildId:c.guildId,esoServer:c.esoServer,includeOtherServers:c.isGlobalAdmin});
  let matching=null;
  if(houseId!==''){
   const stops=await this.db.query(`SELECT DISTINCT ts.tour_id FROM tour_stops ts JOIN saved_houses s ON s.id=ts.saved_house_id WHERE s.house_id=? AND s.eso_server=? AND s.status='active' AND (s.scope='global' OR (s.scope='public' AND s.guild_id=?)${scope==='shared'?"":" OR (s.scope='private' AND s.owner_user_id=?)"})`,scope==='shared'?[Number(houseId)||0,c.esoServer,c.guildId]:[Number(houseId)||0,c.esoServer,c.guildId,c.userId]);
   matching=new Set(stops.map(s=>Number(s.tour_id)));
  }
  return this.decorateTours(c,rows.filter(t=>(scope?this.policy.canViewTour(t,c):(this.policy.canViewTour(t,c)||this.policy.canEditTour(t,c)))&&(!mine||t.creator_id===c.userId)&&(!scope||(scope==='shared'?(t.visibility==='global'||(t.visibility==='public'&&t.guild_id===c.guildId)):t.visibility===scope))&&(!matching||matching.has(Number(t.id)))&&(!q||t.name.toLowerCase().includes(String(q).toLowerCase()))).sort((a,b)=>tourNameOrder.compare(a.name.trim(),b.name.trim())||Number(a.id)-Number(b.id)).map(t=>({...t,canEdit:this.policy.canEditTour(t,c),canView:this.policy.canViewTour(t,c)})));
 }
 async tourSnapshot(conn,id){const tour=await one(conn,'SELECT * FROM tours WHERE id=? FOR UPDATE',[Number(id)]);if(!tour)return null;const stops=await conn.query('SELECT * FROM tour_stops WHERE tour_id=? ORDER BY position,id',[Number(id)]);return {tour,stops,version:createHash('sha256').update(JSON.stringify({tour,stops})).digest('hex')};}
 async getTourDraft(c,id){const snap=await this.tourSnapshot(this.db,id);if(!snap||(!this.policy.canViewTour(snap.tour,c)&&!this.policy.canEditTour(snap.tour,c)))throw new Error('Tour is not available.');const stops=[];for(const stop of snap.stops){const h=await this.saved.get(stop.saved_house_id);const visible=this.policy.canViewHouse(h,c);stops.push({...stop,display_name:visible?(stop.custom_title||h.display_name||h.house_name):'Restricted or unavailable stop',eso_owner:visible?h.eso_owner:null,house_name:visible?h.house_name:null,source_scope:visible?h.scope:null,population_limit:visible?h.population_limit:null,population_limit_plus:visible?h.population_limit_plus:null});}const covers=await this.withHouseCovers(stops.filter(s=>s.house_name).map(s=>({id:s.saved_house_id})));const byId=new Map(covers.map(h=>[Number(h.id),h.cover_image_id]));for(const s of stops)s.cover_image_id=byId.get(Number(s.saved_house_id))||null;return {...snap,stops,cover:this.policy.canViewTour(snap.tour,c)?await this.tourCovers.get(c,id):null,canEdit:this.policy.canEditTour(snap.tour,c),canView:this.policy.canViewTour(snap.tour,c)};}
 async saveTourDraft(context,{id=null,version=null,details={},stopIds=[],stopNotes={}}){
  const c=await this.fresh(context);if(!Array.isArray(stopIds)||stopIds.length>250)throw new Error('A tour supports at most 250 stops per save.');const ids=stopIds.map(Number);if(ids.some(n=>!Number.isSafeInteger(n)||n<=0))throw new Error('Invalid house selection.');if(new Set(ids).size!==ids.length)throw new Error('Duplicate house selection.');
  return withTransaction(this.db,async conn=>{
   const snap=id?await this.tourSnapshot(conn,id):null;if(id&&(!snap||!this.policy.canEditTour(snap.tour,c)))throw new Error('Tour is not available for editing.');if(id&&version!==snap.version)throw new Error('This tour changed since you opened it. Reload and reapply your changes.');
   const name=boundedRequired(details.name??snap?.tour.name,TOUR_NAME_MAX,'Tour name'),description=boundedOptional(details.description??snap?.tour.description,TOUR_DESCRIPTION_MAX,'Tour description'),visibility=details.visibility||snap?.tour.visibility||'public';if(!['private','public','global'].includes(visibility))throw new Error('Invalid tour visibility.');if(c.personalWorkspace&&visibility==='public')throw new Error('Server visibility requires a connected Discord server.');
   if(snap&&visibility==='global'&&snap.tour.creator_id!==c.userId&&!c.isGlobalAdmin)throw new Error('Only the creator or a Global administrator can make this tour Global.');
   if(snap&&visibility==='private'&&snap.tour.creator_id!==c.userId)throw new Error('You cannot make another creator’s tour Private.');
   const guildId=snap?.tour.guild_id||snap?.tour.source_guild_id||c.guildId;
   let tour=snap?.tour;if(!tour)tour=await this.tours.createInConnection(conn,{creatorId:c.userId,guildId:c.guildId,esoServer:c.esoServer,visibility,name,description});
   else{await conn.query('UPDATE tours SET name=?,description=?,visibility=?,guild_id=?,source_guild_id=?,house_source=? WHERE id=?',[name,description,visibility,visibility==='public'?guildId:null,visibility==='global'?null:guildId,visibility==='global'?'global':visibility==='public'?'public_global':!guildId?'private_global':'all',Number(id)]);tour={...tour,visibility};}
   const previous=new Map((snap?.stops||[]).map(x=>[Number(x.saved_house_id),x]));
   const effective=await this.tours.get(tour.id,conn),destinations=new Set();
   for(const houseId of ids){await one(conn,'SELECT id FROM saved_houses WHERE id=? FOR UPDATE',[houseId]);const h=await this.saved.get(houseId,conn),old=previous.get(houseId);if(!h||h.status!=='active'||h.eso_server!==c.esoServer||(!this.policy.canViewHouse(h,c)&&!(old&&h.scope!=='private'&&c.isGlobalAdmin)))throw new Error('A selected house is no longer available or compatible.');if(!tourAllowsHouseScope(effective,h.scope)||(h.scope==='private'&&h.owner_user_id!==effective.creator_id)||(h.scope==='public'&&h.guild_id!==(effective.source_guild_id||effective.guild_id||effective.origin_guild_id)))throw new Error('A selected house is not eligible for this tour visibility.');if(destinations.has(h.destination_id))throw new Error('Duplicate destination on this tour.');destinations.add(h.destination_id);}
   for(const old of snap?.stops||[]){if(!ids.includes(Number(old.saved_house_id)))await conn.query('DELETE FROM tour_stops WHERE id=?',[old.id]);else await conn.query('UPDATE tour_stops SET position=? WHERE id=?',[-Number(old.id),old.id]);}
   for(let i=0;i<ids.length;i++){const old=previous.get(ids[i]);if(old){await conn.query('UPDATE tour_stops SET position=? WHERE id=?',[i+1,old.id]);if(Object.hasOwn(stopNotes,ids[i]))await this.tours.updateStop(old.id,{notes:stopNotes[ids[i]]},conn);}else await this.tours.addStopInConnection(conn,{tourId:tour.id,savedHouseId:ids[i],position:i+1,notes:stopNotes[ids[i]]});}
   // Any edit invalidates shared live sessions; personal progress resolves its current stop on resume.
   if(id)await conn.query("DELETE FROM tour_sessions WHERE tour_id=? AND mode='shared'",[Number(id)]);
   await conn.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)',[c.guildId,c.userId,id?'update_tour':'create_tour','tour',String(tour.id),JSON.stringify({source:'web',stopCount:ids.length})]);return this.tours.get(tour.id,conn);
  });
 }
 async addHouseToTour(c,houseId,tourId,notes){const draft=await this.getTourDraft(c,tourId);return this.saveTourDraft(c,{id:tourId,version:draft.version,stopIds:[...draft.stops.map(s=>s.saved_house_id),Number(houseId)],stopNotes:notes===undefined?{}:{[Number(houseId)]:notes}});}
 async startTour(c,id){const draft=await this.getTourDraft(c,id);if(!draft.canView)throw new Error('Tour is not available for playback.');const item=await this.progress.startOrResume({userId:c.userId,guildId:c.guildId,esoServer:c.esoServer,tourId:Number(id)});if(item.status==='completed')throw new Error('This tour is completed. Use Restart to begin again.');const current=await this.progress.reconcile({progressId:item.id,userId:c.userId,guildId:c.guildId,esoServer:c.esoServer});if(current.status==='completed')throw new Error('This tour is completed. Use Restart to begin again.');return {...current,_startedNew:item._startedNew};}
 async restartTour(c,id){const draft=await this.getTourDraft(c,id);if(!draft.canView)throw new Error('Tour is not available for playback.');const item=await this.progress.startOrResume({userId:c.userId,guildId:c.guildId,esoServer:c.esoServer,tourId:Number(id)});return {...await this.progress.restart({progressId:item.id,userId:c.userId,guildId:c.guildId,esoServer:c.esoServer}),_startedNew:true};}

 async adminContext(context){const c=await this.fresh(context);if(!c.isServerAdmin&&!c.bootstrap)throw new Error('Current Server administrator access is required.');return c;}
 async updateSettings(context,{policy,staffRoles='',trustedRoles='',tourRoles=''}){const c=await this.adminContext(context);if(!['open','approval','roles'].includes(policy))throw new Error('Invalid registration policy.');const parse=value=>{const roles=[...new Set(String(value).split(/[,\s]+/).filter(Boolean))];if(roles.length>25||roles.some(id=>!/^\d{1,20}$/.test(id)))throw new Error('Enter at most 25 numeric Discord role IDs.');return JSON.stringify(roles);};const roles=[parse(staffRoles),parse(trustedRoles),parse(tourRoles)];await withTransaction(this.db,async conn=>{await conn.query('UPDATE guild_settings SET registration_policy=?,staff_role_ids=?,registration_role_ids=?,tour_role_ids=? WHERE guild_id=?',[policy,...roles,c.guildId]);await conn.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)',[c.guildId,c.userId,'update_server_settings','guild',c.guildId,JSON.stringify({source:'web',policy})]);});this.invalidateSettings?.(c.guildId);}
 async manageAccess(context,input){const c=await this.adminContext(context),reviewer={userId:c.userId,roleIds:c.memberRoleIds};if(input.action==='approve'||input.action==='deny')return this.policy.server.review({guildId:c.guildId,requestId:Number(input.requestId),revision:Number(input.revision),reviewer,decision:input.action});if(input.action==='revoke')return this.policy.server.revoke({guildId:c.guildId,userId:input.userId,reviewer});if(input.action?.startsWith('global_')){this.ownerCatalog.assertOwner({id:c.userId});if(input.action==='global_approve')return this.policy.global.approve(Number(input.requestId),c.userId);if(input.action==='global_deny')return this.policy.global.deny(Number(input.requestId),c.userId);if(input.action==='global_revoke')return this.policy.global.revoke(input.userId,input.esoServer,c.userId);}throw new Error('Invalid access action.');}
 async manageFeatured(context,input){const c=await this.adminContext(context);if(!c.isServerAdmin)throw new Error('Current Server administrator access is required.');if(input.expiryDays!==undefined&&input.expiryDays!==''&&(!/^\d+$/.test(String(input.expiryDays))||Number(input.expiryDays)>3650))throw new Error('Expiration must be 0 to 3650 whole days.');const args={guildId:c.guildId,esoServer:c.esoServer,targetKind:input.targetKind,targetId:Number(input.targetId),actorId:c.userId,isModerator:true};return input.action==='remove'?this.featuredService.remove(args):this.featuredService.set({...args,position:input.position?Number(input.position):null,expiresAt:input.expiryDays===undefined||input.expiryDays===''?undefined:(Number(input.expiryDays)===0?null:new Date(Date.now()+Number(input.expiryDays)*86400000))});}

}
