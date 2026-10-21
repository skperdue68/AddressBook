import { one, withTransaction } from '../db/database.js';
import { RateLimitService, rateLimitSettings } from './rate-limit-service.js';
import { requireEsoServer } from '../utils/eso-server.js';

export const HOUSING_PROBLEM_TYPES={
  jump_broken:'Jump destination does not work',
  owner_blocks_visitors:'Owner does not allow visitors',
  incorrect_destination:'Incorrect owner or house',
  misleading_information:'Inappropriate or misleading information',
  duplicate_entry:'Duplicate entry',
  other:'Other'
};

const same=(a,b)=>a!=null&&b!=null&&String(a)===String(b);
const clean=value=>String(value??'').trim()||null;

export class HousingReportService{
  constructor(db,{rateLimiter=new RateLimitService(),settings=rateLimitSettings().report}={}){this.db=db;this.rateLimiter=rateLimiter;this.settings=settings;}

  #consume(userId){
    const result=this.rateLimiter.consume({bucket:'housing-report',userId,...this.settings});
    if(!result.allowed){const seconds=Math.ceil(result.retryAfterMs/1000);throw new Error(`Please wait ${seconds} second${seconds===1?'':'s'} before submitting another housing report.`);}
  }

  async submit({esoServer,destinationId,savedHouseId=null,tourId=null,stopId=null,passId=null,passType=null,reporterId,guildId=null,problemType,explanation=null,names={}}){
    if(!Object.hasOwn(HOUSING_PROBLEM_TYPES,problemType))throw new Error('Choose a valid housing problem type.');
    const server=requireEsoServer(esoServer);
    this.#consume(reporterId);
    return withTransaction(this.db,async conn=>{
      const destination=await one(conn,'SELECT * FROM housing_destinations WHERE id=?',[Number(destinationId)]);
      if(!destination)throw new Error('That housing destination is no longer available.');
      if(destination.eso_server!==server)throw new Error('That housing destination belongs to a different environment.');
      if(savedHouseId!=null){const house=await one(conn,'SELECT destination_id,eso_server FROM saved_houses WHERE id=?',[Number(savedHouseId)]);if(!house||Number(house.destination_id)!==Number(destinationId)||house.eso_server!==server)throw new Error('That saved house belongs to a different environment.');}
      if(tourId!=null){const tour=await one(conn,'SELECT eso_server FROM tours WHERE id=?',[Number(tourId)]);if(!tour||tour.eso_server!==server)throw new Error('That tour belongs to a different environment.');}
      const housePassId=passType==='house'||(passId!=null&&savedHouseId!=null&&tourId==null)?passId:null;
      const tourPassId=passType==='tour'||(passId!=null&&tourId!=null)?passId:null;
      const args=[String(reporterId),Number(destinationId),problemType,savedHouseId,savedHouseId,tourId,tourId,stopId,stopId,housePassId,housePassId,tourPassId,tourPassId];
      const existing=await one(conn,`SELECT * FROM housing_reports WHERE reporter_id=? AND destination_id=? AND problem_type=? AND status IN ('open','reviewing')
        AND (saved_house_id=? OR (saved_house_id IS NULL AND ? IS NULL)) AND (tour_id=? OR (tour_id IS NULL AND ? IS NULL))
        AND (stop_id=? OR (stop_id IS NULL AND ? IS NULL)) AND (house_share_pass_id=? OR (house_share_pass_id IS NULL AND ? IS NULL))
        AND (tour_share_pass_id=? OR (tour_share_pass_id IS NULL AND ? IS NULL)) ORDER BY id LIMIT 1`,args);
      if(existing){
        await conn.query('UPDATE housing_reports SET explanation=?,guild_id=coalesce(?,guild_id),guild_name=coalesce(?,guild_name),reporter_global_name=coalesce(?,reporter_global_name),reporter_display_name=coalesce(?,reporter_display_name),updated_at=CURRENT_TIMESTAMP WHERE id=?',[clean(explanation),guildId,names.guildName||null,names.reporterGlobalName||null,names.reporterDisplayName||null,existing.id]);
      await this.#audit(conn,{guildId,actorId:reporterId,action:'housing_report_updated',entityId:existing.id,details:{problemType,esoServer:server},names:{actorGlobalName:names.reporterGlobalName,actorDisplayName:names.reporterDisplayName}});
        return one(conn,'SELECT * FROM housing_reports WHERE id=?',[existing.id]);
      }
      const result=await conn.query(`INSERT INTO housing_reports(destination_id,saved_house_id,tour_id,stop_id,house_share_pass_id,tour_share_pass_id,reporter_id,reporter_global_name,reporter_display_name,guild_id,guild_name,problem_type,explanation)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,[Number(destinationId),savedHouseId,tourId,stopId,housePassId,tourPassId,String(reporterId),names.reporterGlobalName||null,names.reporterDisplayName||null,guildId,names.guildName||null,problemType,clean(explanation)]);
      await this.#audit(conn,{guildId,actorId:reporterId,action:'housing_reported',entityId:result.insertId,details:{destinationId,savedHouseId,tourId,stopId,housePassId,tourPassId,problemType,esoServer:server},names:{actorGlobalName:names.reporterGlobalName,actorDisplayName:names.reporterDisplayName}});
      return one(conn,'SELECT * FROM housing_reports WHERE id=?',[result.insertId]);
    });
  }

  async #rows(conn=this.db){
    return conn.query(`SELECT r.*,d.eso_server destination_eso_server,d.eso_owner,d.house_id,h.name house_name,
      sh.scope house_scope,sh.guild_id house_guild_id,sh.owner_user_id,sh.created_by house_created_by,sh.display_name house_display_name,
      t.eso_server tour_eso_server,t.visibility tour_visibility,t.guild_id tour_guild_id,t.creator_id tour_creator_id,t.name tour_name,
      hp.origin_guild_id house_pass_guild_id,tp.origin_guild_id tour_pass_guild_id
      FROM housing_reports r JOIN housing_destinations d ON d.id=r.destination_id JOIN houses h ON h.house_id=d.house_id
      LEFT JOIN saved_houses sh ON sh.id=r.saved_house_id LEFT JOIN tours t ON t.id=r.tour_id
      LEFT JOIN house_share_passes hp ON hp.id=r.house_share_pass_id LEFT JOIN tour_share_passes tp ON tp.id=r.tour_share_pass_id
      ORDER BY r.created_at DESC,r.id DESC`);
  }

  #authorize(row,{viewerId,guildId,isServerModerator=false,isGlobalModerator=false}){
    const houseOwner=same(row.owner_user_id,viewerId)||same(row.house_created_by,viewerId);
    const tourOwner=same(row.tour_creator_id,viewerId);
    let target=false;
    if(row.house_scope==='private')target=houseOwner;
    else if(row.house_scope==='public')target=isServerModerator&&same(row.house_guild_id,guildId);
    else if(row.house_scope==='global')target=isGlobalModerator;
    if(row.tour_visibility==='private')target=target||tourOwner;
    else if(row.tour_visibility==='public')target=target||(isServerModerator&&same(row.tour_guild_id,guildId));
    else if(row.tour_visibility==='global')target=target||isGlobalModerator;
    const passActivity=isServerModerator&&(same(row.house_pass_guild_id,guildId)||same(row.tour_pass_guild_id,guildId));
    return {allowed:target||passActivity,target,passActivity,privateOwner:houseOwner||tourOwner,houseOwner,tourOwner};
  }

  #present(row,authority){
    const hiddenHouse=row.house_scope==='private'&&!authority.houseOwner;
    const hiddenTour=row.tour_visibility==='private'&&!authority.tourOwner;
    const redacted=hiddenHouse||hiddenTour;
    let targetSummary;
    if(redacted)targetSummary=row.tour_share_pass_id?`Private Tour Share Pass #${row.tour_share_pass_id}`:row.house_share_pass_id?`Private House Share Pass #${row.house_share_pass_id}`:'Private report details';
    else if(row.tour_name)targetSummary=`${row.tour_name} — ${row.house_display_name||row.house_name} — @${row.eso_owner}`;
    else targetSummary=`${row.house_display_name||row.house_name} — @${row.eso_owner}`;
    const safe={...row,targetSummary,problemLabel:HOUSING_PROBLEM_TYPES[row.problem_type]||row.problem_type};
    if(redacted){delete safe.eso_owner;delete safe.house_display_name;delete safe.house_name;delete safe.tour_name;delete safe.explanation;delete safe.tour_id;delete safe.tour_creator_id;delete safe.owner_user_id;delete safe.saved_house_id;}
    if(hiddenHouse){
      for(const key of ['destination_id','house_id','house_created_by','house_guild_id','tour_stop_id','stop_id'])delete safe[key];
    }
    if(hiddenTour){delete safe.tour_stop_id;delete safe.stop_id;}
    return safe;
  }

  async listForModerator(context,{statuses=['open','reviewing']}={}){
    const allEnvironments=!!context.allEnvironments&&!!context.isApprover;
    const server=allEnvironments?null:requireEsoServer(context.esoServer);
    const rows=await this.#rows();
    return rows.filter(row=>statuses.includes(row.status)&&(allEnvironments||row.destination_eso_server===server)&&(row.tour_eso_server==null||allEnvironments||row.tour_eso_server===server)).map(row=>[row,this.#authorize(row,context)]).filter(([,authority])=>authority.allowed).map(([row,authority])=>this.#present(row,authority));
  }

  async getForModerator(id,context){
    const row=(await this.#rows()).find(item=>Number(item.id)===Number(id));
    if(!row)throw new Error('Housing report not found.');
    const allEnvironments=!!context.allEnvironments&&!!context.isApprover;
    const server=allEnvironments?null:requireEsoServer(context.esoServer);
    if(!allEnvironments&&(row.destination_eso_server!==server||row.tour_eso_server!=null&&row.tour_eso_server!==server))throw new Error('You are not authorized to review that housing report.');
    const authority=this.#authorize(row,context);if(!authority.allowed)throw new Error('You are not authorized to review that housing report.');
    return this.#present(row,authority);
  }

  async review(id,{reviewerId,guildId=null,esoServer,isServerModerator=false,isGlobalModerator=false,isApprover=false,allEnvironments=false,names={}}){
    await this.getForModerator(id,{viewerId:reviewerId,guildId,esoServer,isServerModerator,isGlobalModerator,isApprover,allEnvironments});
    await this.db.query("UPDATE housing_reports SET status='reviewing',reviewer_id=?,reviewer_global_name=?,reviewer_display_name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",[String(reviewerId),names.reviewerGlobalName||null,names.reviewerDisplayName||null,Number(id)]);
    await this.#audit(this.db,{guildId,actorId:reviewerId,action:'housing_report_reviewed',entityId:id,names:{actorGlobalName:names.reviewerGlobalName,actorDisplayName:names.reviewerDisplayName}});
    return one(this.db,'SELECT * FROM housing_reports WHERE id=?',[Number(id)]);
  }

  async resolve(id,{reviewerId,guildId=null,esoServer,isServerModerator=false,isGlobalModerator=false,isApprover=false,allEnvironments=false,resolution='resolved',names={}}){
    const status=resolution==='dismissed'?'dismissed':'resolved';
    await this.getForModerator(id,{viewerId:reviewerId,guildId,esoServer,isServerModerator,isGlobalModerator,isApprover,allEnvironments});
    await this.db.query('UPDATE housing_reports SET status=?,reviewer_id=?,reviewer_global_name=?,reviewer_display_name=?,resolved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?',[status,String(reviewerId),names.reviewerGlobalName||null,names.reviewerDisplayName||null,Number(id)]);
    await this.#audit(this.db,{guildId,actorId:reviewerId,action:'housing_report_resolved',entityId:id,details:{resolution,status},names:{actorGlobalName:names.reviewerGlobalName,actorDisplayName:names.reviewerDisplayName}});
    return one(this.db,'SELECT * FROM housing_reports WHERE id=?',[Number(id)]);
  }

  #audit(conn,{guildId,actorId,action,entityId,details={},names={}}){return conn.query('INSERT INTO audit_log(guild_id,actor_id,actor_global_name,actor_display_name,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?,?,?)',[guildId||null,String(actorId),names.actorGlobalName||null,names.actorDisplayName||null,action,'housing_report',String(entityId),JSON.stringify(details)]);}
}
