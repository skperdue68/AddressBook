import crypto from 'node:crypto';
import { requireEsoServer } from '../utils/eso-server.js';

export class RegistrationDraftService{
  constructor({clock=()=>Date.now(),tokenFactory=()=>crypto.randomBytes(10).toString('hex'),ttlMs=30*60*1000}={}){
    this.clock=clock;
    this.tokenFactory=tokenFactory;
    this.ttlMs=ttlMs;
    this.drafts=new Map();
  }

  create(data){
    const id=this.tokenFactory();
    const draft={...data,esoServer:requireEsoServer(data.esoServer),id,createdAt:this.clock(),updatedAt:this.clock()};
    this.drafts.set(id,draft);
    return draft;
  }

  get(id,userId){
    const draft=this.drafts.get(String(id));
    if(!draft||String(draft.userId)!==String(userId))return null;
    if(this.clock()-draft.updatedAt>this.ttlMs){this.drafts.delete(String(id));return null;}
    return draft;
  }

  update(id,userId,patch){
    const draft=this.get(id,userId);
    if(!draft)return null;
    if(patch.esoServer!==undefined&&requireEsoServer(patch.esoServer)!==draft.esoServer)throw new Error('A registration draft cannot move to a different ESO environment.');
    Object.assign(draft,patch,{updatedAt:this.clock()});
    return draft;
  }

  remove(id,userId){
    if(!this.get(id,userId))return false;
    return this.drafts.delete(String(id));
  }
}
