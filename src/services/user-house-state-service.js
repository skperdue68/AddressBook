import { one } from '../db/database.js';
import { VisitService } from './visit-service.js';
import { houseTarget,houseTargetKey } from '../utils/house-target.js';

const clean=value=>{const result=String(value??'').trim();return result||null;};
const sqliteDate=value=>value instanceof Date?value.toISOString():value;

export class UserHouseStateService{
  constructor(db,{visitService=new VisitService(db)}={}){this.db=db;this.visitService=visitService;}

  get(userId,target){
    houseTargetKey(target);
    return one(this.db,'SELECT * FROM user_house_states WHERE discord_user_id=? AND target_kind=? AND target_id=?',[String(userId),target.kind,Number(target.id)]);
  }

  async targetMetadata(target){
    houseTargetKey(target);
    if(target.kind==='destination')return one(this.db,`SELECT d.id,h.name house_name,d.eso_owner FROM housing_destinations d JOIN houses h ON h.house_id=d.house_id WHERE d.id=?`,[Number(target.id)]);
    return one(this.db,'SELECT house_id id,name house_name,NULL eso_owner FROM houses WHERE house_id=?',[Number(target.id)]);
  }

  async validateTarget(target,visibleTarget){
    if(!visibleTarget||houseTargetKey(houseTarget(visibleTarget))!==houseTargetKey(target))throw new Error('That house is no longer available.');
    const metadata=await this.targetMetadata(target);
    if(!metadata)throw new Error('That house is no longer available.');
    return metadata;
  }

  async setFavorite({userId,target,favorite,globalName=null,displayName=null,visibleTarget}){
    const metadata=await this.validateTarget(target,visibleTarget),params=[String(userId),clean(globalName),clean(displayName),target.kind,Number(target.id),metadata.house_name,metadata.eso_owner,favorite?1:0];
    if(this.db.type==='sqlite')await this.db.query(`INSERT INTO user_house_states(discord_user_id,discord_global_name,discord_display_name,target_kind,target_id,house_name,eso_owner,is_favorite)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(discord_user_id,target_kind,target_id) DO UPDATE SET
      discord_global_name=coalesce(excluded.discord_global_name,user_house_states.discord_global_name),discord_display_name=coalesce(excluded.discord_display_name,user_house_states.discord_display_name),
      house_name=excluded.house_name,eso_owner=excluded.eso_owner,is_favorite=excluded.is_favorite,updated_at=CURRENT_TIMESTAMP`,params);
    else await this.db.query(`INSERT INTO user_house_states(discord_user_id,discord_global_name,discord_display_name,target_kind,target_id,house_name,eso_owner,is_favorite)
      VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE
      discord_global_name=coalesce(VALUES(discord_global_name),discord_global_name),discord_display_name=coalesce(VALUES(discord_display_name),discord_display_name),
      house_name=VALUES(house_name),eso_owner=VALUES(eso_owner),is_favorite=VALUES(is_favorite),updated_at=CURRENT_TIMESTAMP`,params);
    await this.removeEmpty(userId,target);
    return this.get(userId,target);
  }

  async setVisitState({userId,target,visitState,globalName=null,displayName=null,visibleTarget,visitedAt=new Date()}){
    if(!['none','want_to_visit','visited'].includes(visitState))throw new Error('Invalid visit state.');
    const metadata=await this.validateTarget(target,visibleTarget);
    const lastVisited=visitState==='visited'?(this.db.type==='mariadb'?visitedAt:sqliteDate(visitedAt)):null;
    const params=[String(userId),clean(globalName),clean(displayName),target.kind,Number(target.id),metadata.house_name,metadata.eso_owner,visitState,lastVisited];
    if(this.db.type==='sqlite')await this.db.query(`INSERT INTO user_house_states(discord_user_id,discord_global_name,discord_display_name,target_kind,target_id,house_name,eso_owner,visit_state,last_visited_at)
      VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(discord_user_id,target_kind,target_id) DO UPDATE SET
      discord_global_name=coalesce(excluded.discord_global_name,user_house_states.discord_global_name),discord_display_name=coalesce(excluded.discord_display_name,user_house_states.discord_display_name),
      house_name=excluded.house_name,eso_owner=excluded.eso_owner,visit_state=excluded.visit_state,last_visited_at=excluded.last_visited_at,updated_at=CURRENT_TIMESTAMP`,params);
    else await this.db.query(`INSERT INTO user_house_states(discord_user_id,discord_global_name,discord_display_name,target_kind,target_id,house_name,eso_owner,visit_state,last_visited_at)
      VALUES(?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE
      discord_global_name=coalesce(VALUES(discord_global_name),discord_global_name),discord_display_name=coalesce(VALUES(discord_display_name),discord_display_name),
      house_name=VALUES(house_name),eso_owner=VALUES(eso_owner),visit_state=VALUES(visit_state),last_visited_at=VALUES(last_visited_at),updated_at=CURRENT_TIMESTAMP`,params);
    await this.removeEmpty(userId,target);
    return this.get(userId,target);
  }

  removeEmpty(userId,target){
    return this.db.query("DELETE FROM user_house_states WHERE discord_user_id=? AND target_kind=? AND target_id=? AND is_favorite=0 AND visit_state='none'",[String(userId),target.kind,Number(target.id)]);
  }

  async list({userId,guildId,esoServer,kind}){
    const clauses={favorites:'is_favorite=1',wantToVisit:"visit_state='want_to_visit'",visited:"visit_state='visited'"};
    const clause=clauses[kind];if(!clause)throw new Error('Invalid personal list.');
    const states=await this.db.query(`SELECT * FROM user_house_states WHERE discord_user_id=? AND ${clause}`,[String(userId)]);
    if(!states.length)return [];
    const visible=await this.visitService.search({userId:String(userId),guildId:String(guildId||''),esoServer,includeNonPlayer:true,limit:null}),access=new Map();
    for(const row of visible){const key=houseTargetKey(houseTarget(row));if(!access.has(key))access.set(key,row);}
    const rows=[];
    for(const state of states){const row=access.get(`${state.target_kind}:${Number(state.target_id)}`);if(row)rows.push({...row,personal_state:state,is_favorite:Number(state.is_favorite),visit_state:state.visit_state,last_visited_at:state.last_visited_at});}
    if(kind==='visited')rows.sort((a,b)=>Date.parse(b.last_visited_at||0)-Date.parse(a.last_visited_at||0)||String(a.display_name||a.house_name||'').localeCompare(String(b.display_name||b.house_name||'')));
    else rows.sort((a,b)=>String(a.display_name||a.house_name||'').localeCompare(String(b.display_name||b.house_name||'')));
    return rows;
  }

  async counts(context){
    const [favorites,wantToVisit,visited]=await Promise.all(['favorites','wantToVisit','visited'].map(kind=>this.list({...context,kind})));
    return {favorites:favorites.length,wantToVisit:wantToVisit.length,visited:visited.length};
  }
}
