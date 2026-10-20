import { one, withTransaction } from '../db/database.js';
import { encodeSearchFilters, parseSavedSearchFilters, SEARCH_FILTER_VERSION } from '../utils/search-filters.js';

const clean=value=>{const result=String(value??'').trim();return result||null;};
const searchName=value=>{
  const name=String(value??'').trim().replace(/\s+/g,' ');
  if(!name)throw new Error('A saved-search name is required.');
  if(name.length>80)throw new Error('A saved-search name may contain at most 80 characters.');
  return {name,normalized:name.toLocaleLowerCase()};
};

export class SavedHouseSearchService{
  constructor(db){this.db=db;}

  getOwned(id,userId,connection=this.db){
    return one(connection,'SELECT * FROM saved_house_searches WHERE id=? AND discord_user_id=?',[Number(id),String(userId)]);
  }

  list(userId,{limit=25,offset=0}={}){
    const take=Math.min(100,Math.max(1,Number(limit)||25)),skip=Math.max(0,Number(offset)||0);
    return this.db.query('SELECT * FROM saved_house_searches WHERE discord_user_id=? ORDER BY updated_at DESC,name ASC LIMIT ? OFFSET ?',[String(userId),take,skip]);
  }

  async count(userId){
    const row=await one(this.db,'SELECT COUNT(*) c FROM saved_house_searches WHERE discord_user_id=?',[String(userId)]);
    return Number(row?.c||0);
  }

  filters(row){return parseSavedSearchFilters(row);}

  async save({userId,name,filters,globalName=null,displayName=null,replace=false}){
    const id=String(userId),validated=searchName(name),encoded=encodeSearchFilters(filters);
    return withTransaction(this.db,async connection=>{
      const existing=await one(connection,'SELECT * FROM saved_house_searches WHERE discord_user_id=? AND normalized_name=?',[id,validated.normalized]);
      if(existing&&!replace)return {status:'conflict',search:existing};
      if(existing){
        await connection.query(`UPDATE saved_house_searches SET name=?,filter_version=?,filters_json=?,
          discord_global_name=coalesce(?,discord_global_name),discord_display_name=coalesce(?,discord_display_name),updated_at=CURRENT_TIMESTAMP
          WHERE id=? AND discord_user_id=?`,[validated.name,SEARCH_FILTER_VERSION,encoded,clean(globalName),clean(displayName),existing.id,id]);
        return {status:'replaced',search:await this.getOwned(existing.id,id,connection)};
      }
      const result=await connection.query(`INSERT INTO saved_house_searches(discord_user_id,discord_global_name,discord_display_name,name,normalized_name,filter_version,filters_json)
        VALUES(?,?,?,?,?,?,?)`,[id,clean(globalName),clean(displayName),validated.name,validated.normalized,SEARCH_FILTER_VERSION,encoded]);
      return {status:'created',search:await this.getOwned(result.insertId,id,connection)};
    });
  }

  async rename({id,userId,name,replace=false}){
    const owner=String(userId),validated=searchName(name),searchId=Number(id);
    return withTransaction(this.db,async connection=>{
      const current=await this.getOwned(searchId,owner,connection);
      if(!current)return {status:'not_found',search:null};
      const conflict=await one(connection,'SELECT * FROM saved_house_searches WHERE discord_user_id=? AND normalized_name=? AND id<>?',[owner,validated.normalized,searchId]);
      if(conflict&&!replace)return {status:'conflict',search:conflict};
      if(conflict)await connection.query('DELETE FROM saved_house_searches WHERE id=? AND discord_user_id=?',[conflict.id,owner]);
      await connection.query('UPDATE saved_house_searches SET name=?,normalized_name=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND discord_user_id=?',[validated.name,validated.normalized,searchId,owner]);
      return {status:'renamed',search:await this.getOwned(searchId,owner,connection)};
    });
  }

  async delete({id,userId}){
    const result=await this.db.query('DELETE FROM saved_house_searches WHERE id=? AND discord_user_id=?',[Number(id),String(userId)]);
    return {status:Number(result.affectedRows||0)>0?'deleted':'not_found'};
  }
}
