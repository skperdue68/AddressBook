import { one } from '../db/database.js';

export class OnboardingService{
  constructor(db){this.db=db;}
  get(userId){return one(this.db,'SELECT * FROM user_onboarding WHERE discord_user_id=?',[String(userId)]);}
  getLearningState(userId){
    return this.get(userId).then(row=>({
      walkthroughVersion: row?.last_seen_tour_version || null,
      acknowledgedFeatures: this.#features(row?.acknowledged_features)
    }));
  }
  #features(value){
    try{const parsed=Array.isArray(value)?value:JSON.parse(value||'[]');return [...new Set(parsed.map(String).filter(Boolean))];}catch{return [];}
  }
  async #learningUpdate(userId,updates,names={}){
    const id=String(userId),row=await this.get(id),features=updates.features??this.#features(row?.acknowledged_features),version=updates.version??row?.last_seen_tour_version??null;
    if(!row){
      await this.#set(id,'skipped',{...names,learningOnly:true,features,version});
    }else{
      const timestamp=this.db.type==='sqlite'?'CURRENT_TIMESTAMP':'CURRENT_TIMESTAMP';
      await this.db.query(`UPDATE user_onboarding SET discord_global_name=coalesce(?,discord_global_name),discord_display_name=coalesce(?,discord_display_name),last_seen_tour_version=?,acknowledged_features=?,updated_at=${timestamp} WHERE discord_user_id=?`,[names.globalName??null,names.displayName??null,version,JSON.stringify(features),id]);
    }
    return this.get(id);
  }
  acknowledgeFeature(userId,featureKey,names={}){
    return this.getLearningState(userId).then(state=>this.#learningUpdate(userId,{features:[...new Set([...state.acknowledgedFeatures,String(featureKey)])]},names));
  }
  markWalkthroughSeen(userId,version,names={}){return this.#learningUpdate(userId,{version:String(version)},names);}
  async #set(userId,status,{globalName=null,displayName=null,learningOnly=false,features=null,version=null}={}){
    const now=new Date(),timestamp=this.db.type==='sqlite'?now.toISOString():now;
    const id=String(userId),completed=status==='completed'?timestamp:null,skipped=status==='skipped'?timestamp:null;
    if(this.db.type==='sqlite')await this.db.query(`INSERT INTO user_onboarding(discord_user_id,discord_global_name,discord_display_name,status,completed_at,skipped_at,last_seen_tour_version,acknowledged_features)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(discord_user_id) DO UPDATE SET
      discord_global_name=coalesce(excluded.discord_global_name,user_onboarding.discord_global_name),discord_display_name=coalesce(excluded.discord_display_name,user_onboarding.discord_display_name),
      status=excluded.status,completed_at=coalesce(excluded.completed_at,user_onboarding.completed_at),skipped_at=coalesce(excluded.skipped_at,user_onboarding.skipped_at),last_seen_tour_version=coalesce(excluded.last_seen_tour_version,user_onboarding.last_seen_tour_version),acknowledged_features=CASE WHEN excluded.acknowledged_features<>'[]' THEN excluded.acknowledged_features ELSE user_onboarding.acknowledged_features END,updated_at=CURRENT_TIMESTAMP`,[id,globalName,displayName,status,completed,skipped,version,JSON.stringify(features||[])]);
    else await this.db.query(`INSERT INTO user_onboarding(discord_user_id,discord_global_name,discord_display_name,status,completed_at,skipped_at,last_seen_tour_version,acknowledged_features)
      VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE discord_global_name=coalesce(VALUES(discord_global_name),discord_global_name),discord_display_name=coalesce(VALUES(discord_display_name),discord_display_name),status=VALUES(status),completed_at=coalesce(VALUES(completed_at),completed_at),skipped_at=coalesce(VALUES(skipped_at),skipped_at),last_seen_tour_version=coalesce(VALUES(last_seen_tour_version),last_seen_tour_version),acknowledged_features=CASE WHEN VALUES(acknowledged_features)<>'[]' THEN VALUES(acknowledged_features) ELSE acknowledged_features END,updated_at=CURRENT_TIMESTAMP`,[id,globalName,displayName,status,completed,skipped,version,JSON.stringify(features||[])]);
    return this.get(id);
  }
  complete(userId,names){return this.#set(userId,'completed',names);}
  skip(userId,names){return this.#set(userId,'skipped',names);}
}
