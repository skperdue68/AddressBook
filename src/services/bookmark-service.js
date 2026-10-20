import { SavedHouseService } from './saved-house-service.js';
export class BookmarkService{
  constructor(db){this.db=db;this.saved=new SavedHouseService(db);}
  adapt(r){return r?{...r,discord_user_id:r.owner_user_id,nickname:r.display_name,notes:r.description,scope:'personal'}:null;}
  async create({userId,originGuildId=null,esoServer,houseId,esoOwner,nickname=null,notes=null,tags=[]}){return this.adapt(await this.saved.createPrivate({userId,originGuildId,esoServer,houseId,esoOwner,displayName:nickname,description:notes,tags,createdBy:userId}));}
  async get(id,userId,esoServer){const r=await this.saved.getVisible(id,{userId,guildId:null,esoServer});return r&&r.scope==='private'&&r.owner_user_id===userId?this.adapt(r):null;}
  async list(userId,{esoServer}={}){return (await this.saved.listPrivate(userId,{esoServer})).map(r=>this.adapt(r));}
  async update(id,userId,{esoServer,houseId,esoOwner,nickname=null,notes=null,tags=[]}){const current=await this.get(id,userId,esoServer);if(!current)return null;return this.adapt(await this.saved.update(id,{houseId,esoOwner,displayName:nickname,description:notes,tags},userId));}
  async remove(id,userId,esoServer){const current=await this.get(id,userId,esoServer);if(!current)return false;return this.saved.delete(id,userId);}
}
