import { one } from '../db/database.js';
import { esoServerLabel, requireEsoServer } from '../utils/eso-server.js';

const same=(a,b)=>a!=null&&b!=null&&String(a)===String(b);

function houseNormalAccess(house,{userId,guildId}){
  if(!house||house.status!=='active')return false;
  if(house.scope==='global')return true;
  if(house.scope==='public')return same(house.guild_id,guildId);
  return house.scope==='private'&&same(house.owner_user_id,userId);
}

function tourNormalAccess(tour,{userId,guildId}){
  if(!tour)return false;
  if(tour.visibility==='global')return true;
  if(tour.visibility==='public')return same(tour.guild_id,guildId);
  return tour.visibility==='private'&&same(tour.creator_id,userId);
}

export class AccessContextService{
  constructor(db){this.db=db;}

  #denied(record,server){
    const reason=record?.eso_server?'environment_mismatch':'unassigned';
    const message=reason==='environment_mismatch'
      ?`This destination belongs to ${esoServerLabel(record.eso_server)}, but this Discord server uses ${esoServerLabel(server)}.`
      :'This legacy content is Unassigned and must be assigned to an ESO environment before it can be opened.';
    return {normalAccess:false,passOnly:false,canView:false,canShare:false,canEdit:false,canCopy:false,canComment:false,canReport:false,canStart:false,environmentMatch:false,reason,message};
  }

  async forHouse({userId,guildId,esoServer,savedHouseId,passId=null,conn=this.db}){
    const server=requireEsoServer(esoServer);
    const house=await one(conn,'SELECT * FROM saved_houses WHERE id=?',[Number(savedHouseId)]);
    if(!house)return {normalAccess:false,passOnly:false,canView:false,canShare:false,canEdit:false,canCopy:false,canComment:false,canReport:false,environmentMatch:true,reason:'not_found',message:'That saved house is no longer available.'};
    if(!house.eso_server||house.eso_server!==server)return this.#denied(house,server);
    const normalAccess=houseNormalAccess(house,{userId,guildId});
    const pass=passId==null?null:await one(conn,"SELECT * FROM house_share_passes WHERE id=? AND status='active'",[Number(passId)]);
    const passAccess=!!house&&!!pass&&same(pass.saved_house_id,house.id);
    const passOnly=passAccess&&!normalAccess;
    const owner=house?.scope==='private'&&same(house.owner_user_id,userId);
    return {
      record:house,pass,normalAccess,passOnly,canView:normalAccess||passAccess,environmentMatch:true,reason:null,message:null,
      canShare:normalAccess&&(house?.scope!=='private'||owner),
      canEdit:normalAccess&&(owner||same(house?.created_by,userId)),
      canCopy:passOnly&&house?.scope==='private'&&!owner,
      canComment:normalAccess||passAccess,canReport:normalAccess||passAccess
    };
  }

  async forTour({userId,guildId,esoServer,tourId,passId=null,conn=this.db}){
    const server=requireEsoServer(esoServer);
    const tour=await one(conn,'SELECT * FROM tours WHERE id=?',[Number(tourId)]);
    if(!tour)return {normalAccess:false,passOnly:false,canView:false,canShare:false,canEdit:false,canCopy:false,canReport:false,canStart:false,environmentMatch:true,reason:'not_found',message:'That tour is no longer available.'};
    if(!tour.eso_server||tour.eso_server!==server)return this.#denied(tour,server);
    const normalAccess=tourNormalAccess(tour,{userId,guildId});
    const pass=passId==null?null:await one(conn,"SELECT * FROM tour_share_passes WHERE id=? AND status='active'",[Number(passId)]);
    const passAccess=!!tour&&!!pass&&same(pass.tour_id,tour.id);
    const passOnly=passAccess&&!normalAccess;
    const owner=same(tour?.creator_id,userId);
    return {
      record:tour,pass,normalAccess,passOnly,canView:normalAccess||passAccess,environmentMatch:true,reason:null,message:null,
      canShare:normalAccess&&(tour?.visibility!=='private'||owner),
      canEdit:normalAccess&&owner,
      canCopy:passAccess,canReport:normalAccess||passAccess,canStart:normalAccess||passAccess
    };
  }
}
