import {ServerModeratorService} from './server-moderator-service.js';
import {GlobalModeratorService} from './global-moderator-service.js';
import {one} from '../db/database.js';
import {requireEsoServer} from '../utils/eso-server.js';
export class ContentPolicyService {
 constructor(db,env=process.env){this.db=db;this.server=new ServerModeratorService(db,env);this.global=new GlobalModeratorService(db,env);}
 async context({userId,guildId,esoServer,memberRoleIds=[],guildName=null}){
  const server=requireEsoServer(esoServer);if(!userId||!guildId)throw new Error('A signed-in member and server are required.');
  const settings=await one(this.db,'SELECT * FROM guild_settings WHERE guild_id=?',[String(guildId)]);
  if(!settings||settings.eso_server!==server)throw new Error('This server environment is unavailable.');
  const isOwner=this.server.isOwner(userId),access=await this.server.access({guildId,userId,roleIds:memberRoleIds.map(String)}),isGlobalAdmin=await this.global.isGlobalModerator(userId,server),isServerAdmin=access.isModerator;
  const roles=[];if(isOwner)roles.push({kind:'owner',label:'Bot Owner'});if(isGlobalAdmin)roles.push({kind:'global',label:'Global Administrator',esoServer:server});if(isServerAdmin)roles.push({kind:'server',label:'Server Administrator',guildId:String(guildId),guildName});if(!roles.length)roles.push({kind:'member',label:'Member'});
  return {userId:String(userId),guildId:String(guildId),guildName,esoServer:server,memberRoleIds:memberRoleIds.map(String),isOwner,isServerAdmin,isGlobalAdmin,bootstrap:access.bootstrap,roles,settings};
 }
 canViewHouse(h,c){return !!h&&h.eso_server===c.esoServer&&h.status==='active'&&(h.scope==='global'||(h.scope==='public'&&h.guild_id===c.guildId)||(h.scope==='private'&&h.owner_user_id===c.userId));}
 canEditHouse(h,c){if(!h||h.eso_server!==c.esoServer)return false;if(h.scope==='private')return h.owner_user_id===c.userId;if(h.scope==='global')return h.created_by===c.userId||c.isGlobalAdmin;return h.scope==='public'&&h.guild_id===c.guildId&&(h.created_by===c.userId||c.isServerAdmin);}
 canViewTour(t,c){return !!t&&t.eso_server===c.esoServer&&(t.visibility==='global'||(t.visibility==='public'&&t.guild_id===c.guildId)||(t.visibility==='private'&&t.creator_id===c.userId));}
 canEditTour(t,c){if(!t||t.eso_server!==c.esoServer)return false;if(t.visibility==='private')return t.creator_id===c.userId;return ['public','global'].includes(t.visibility)&&(t.creator_id===c.userId||c.isGlobalAdmin||(t.visibility==='public'&&t.guild_id===c.guildId&&c.isServerAdmin));}
}
