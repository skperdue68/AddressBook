import { normalizeText } from '../utils/eso.js';
import { one } from '../db/database.js';
export class HouseService{
  constructor(db){this.db=db;}
  get(houseId){return one(this.db,'SELECT * FROM houses WHERE house_id=?',[Number(houseId)]);}
  search(query,limit=25){return this.filter({name:query,limit});}
  async resolve(query){const raw=String(query??'').trim();if(!raw)return{exact:null,matches:[]};if(/^\d+$/.test(raw)){const exact=await this.get(Number(raw));return{exact:exact||null,matches:exact?[exact]:[]};}const matches=await this.search(raw,25),norm=normalizeText(raw),exact=matches.find(h=>h.normalized_name===norm)||null;return{exact,matches};}
  async distinctValues(field,limit=200){const allowed={name:'name',zone:'zone',style:'style',house_type:'house_type',classification:'classification'},col=allowed[field];if(!col)throw new Error('Unsupported house metadata field.');const rows=await this.db.query(`SELECT DISTINCT ${col} value FROM houses WHERE ${col} IS NOT NULL AND trim(${col})<>'' ORDER BY ${col} LIMIT ?`,[Number(limit)]);return rows.map(r=>r.value);}
  filter({name='',zone='',houseType='',classification='',category='',style='',limit=200}={}){const clauses=[],args=[];if(name){const q=normalizeText(name);clauses.push('normalized_name LIKE ?');args.push(`%${q}%`);}if(zone){clauses.push("lower(coalesce(zone,'')) LIKE ?");args.push(`%${zone.toLowerCase()}%`);}if(houseType){clauses.push("lower(coalesce(house_type,'')) LIKE ?");args.push(`%${houseType.toLowerCase()}%`);}const classFilter=classification||category;if(classFilter){clauses.push("lower(coalesce(classification,category,'')) LIKE ?");args.push(`%${classFilter.toLowerCase()}%`);}if(style){clauses.push("lower(coalesce(style,'')) LIKE ?");args.push(`%${style.toLowerCase()}%`);}const where=clauses.length?`WHERE ${clauses.join(' AND ')}`:'';return this.db.query(`SELECT * FROM houses ${where} ORDER BY name LIMIT ?`,[...args,Number(limit)]);}
}
