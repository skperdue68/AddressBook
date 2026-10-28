import {createHash} from 'node:crypto';
import {one,withTransaction} from '../db/database.js';

const fingerprint=data=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
const administrator=c=>!!(c.isOwner||c.isGlobalAdmin||c.isServerAdmin);
export class ServerHouseCopyService{
 constructor(workspace,{memberLookup}={}){this.w=workspace;this.db=workspace.db;this.memberLookup=memberLookup;}
 async attribution(house,target){
  if(!this.memberLookup)throw new Error('Live destination membership lookup is unavailable.');
  const actor=await this.memberLookup({userId:target.userId,guildId:target.guildId});
  if(!actor)throw new Error('You are no longer a member of the destination server.');
  const originalId=String(house.created_by),original=originalId===target.userId?actor:await this.memberLookup({userId:originalId,guildId:target.guildId});
  const member=original||actor,user=member.user||member,submitterId=original?originalId:target.userId;
  const globalName=member.globalName||user.global_name||user.username||null,displayName=member.displayName||member.display_name||user.global_name||user.username||submitterId;
  return {originalId,submitterId,globalName,displayName,reassigned:!original};
 }
 async source(context,id,conn=this.db,refresh=true){
  const c=refresh?await this.w.fresh(context):context,house=await this.w.saved.get(id,conn);
  if(!administrator(c)||!house||!(['active','pending'].includes(house.status))||!(this.w.policy.canViewHouse(house,c)||(house.status==='pending'&&this.w.policy.canEditHouse(house,c))))throw new Error('This house is not available for administrative copying.');
  return {c,house};
 }
 async targets(context,id,contexts){
  const {c}=await this.source(context,id),targets=[];
  for(const candidate of contexts){
   if(candidate.userId!==c.userId||candidate.guildId===c.guildId||candidate.esoServer!==c.esoServer||candidate.setupRequired)continue;
   const target=await this.w.fresh(candidate);if(administrator(target))targets.push(target);
  }
  return targets.sort((a,b)=>String(a.guildName||a.guildId).localeCompare(String(b.guildName||b.guildId)));
 }
 async snapshot(context,id,targetContext,conn=this.db,refresh=true,attribution=null){
  const {c,house}=await this.source(context,id,conn,refresh),target=refresh?await this.w.fresh(targetContext):targetContext;
  if(target.userId!==c.userId||target.guildId===c.guildId||target.esoServer!==house.eso_server||!administrator(target))throw new Error('Choose another authorized server in the same ESO environment.');
  attribution??=await this.attribution(house,target);
  const existing=await this.w.saved.findByDestinationContext({destinationId:house.destination_id,visibility:'public',guildId:target.guildId},conn);
  const version=fingerprint({house,target:{guildId:target.guildId,esoServer:target.esoServer,settings:target.settings,isOwner:target.isOwner,isServerAdmin:target.isServerAdmin,isGlobalAdmin:target.isGlobalAdmin},existing,attribution});
  return {house,target,existing,attribution,version};
 }
 preview(context,id,targetContext){return this.snapshot(context,id,targetContext);}
 async copy(context,id,targetContext,version){
  // Resolve current authorization before holding a pooled connection (also works with a one-connection pool).
  const current=await this.w.fresh(context),target=await this.w.fresh(targetContext);
  const prepared=await this.snapshot(current,id,target);
  return withTransaction(this.db,async conn=>{
   const source=await one(conn,'SELECT id,destination_id FROM saved_houses WHERE id=? FOR UPDATE',[Number(id)]);
   if(!source)throw new Error('This house is no longer available.');
   // Lock before any ordinary read establishes an InnoDB REPEATABLE READ snapshot.
   await one(conn,'SELECT id FROM housing_destinations WHERE id=? FOR UPDATE',[source.destination_id]);
   const preview=await this.snapshot(current,id,target,conn,false,prepared.attribution);
   if(preview.version!==version)throw new Error('The house or destination changed. Review the copy again.');
   const duplicate=await this.w.saved.findByDestinationContext({destinationId:preview.house.destination_id,visibility:'public',guildId:preview.target.guildId},conn);
   if(duplicate)return {house:duplicate,existing:true};
   const h=preview.house,copy=await this.w.saved.createInConnection(conn,{destinationId:h.destination_id,visibility:'public',guildId:preview.target.guildId,esoServer:h.eso_server,createdBy:preview.attribution.submitterId,nickname:h.display_name,description:h.description,tags:JSON.parse(h.tags||'[]'),status:'active'});
   await conn.query('UPDATE saved_houses SET updated_by=?,created_by_global_name=?,created_by_display_name=? WHERE id=?',[context.userId,preview.attribution.globalName,preview.attribution.displayName,copy.id]);
   await conn.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)',[preview.target.guildId,context.userId,'copy_house_between_servers','saved_house',String(copy.id),JSON.stringify({sourceHouseId:h.id,sourceGuildId:context.guildId,targetGuildId:preview.target.guildId,sourceVisibility:h.scope,createdBy:preview.attribution.submitterId,attribution:preview.attribution})]);
   return {house:await this.w.saved.get(copy.id,conn),existing:false};
  });
 }
}
