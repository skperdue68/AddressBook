import {botOwnerIds} from '../config/bot-owners.js';
import {one,withTransaction} from '../db/database.js';
import {normalizeText} from '../utils/eso.js';
const numeric=['furnishing_limit','furnishing_limit_plus','special_furnishing_limit','special_furnishing_limit_plus','collectible_limit','collectible_limit_plus','special_collectible_limit','special_collectible_limit_plus','population_limit','population_limit_plus','gold_price','crown_price','crown_price_unfurnished','crown_price_furnished'];
const text=['zone','subzone','classification','house_type','style','purchase_type','requirements','availability','uesp_url','last_verified'];
export class HouseCatalogService{
 constructor(db,env=process.env){this.db=db;this.owners=botOwnerIds(env);}
 isOwner(actor){return this.owners.has(String(actor?.id||actor?.userId||''));}
 assertOwner(actor){if(!this.isOwner(actor))throw new Error('Bot owner access is required to add official houses.');}
 async preview(actor,input){this.assertOwner(actor);const id=Number(input.house_id);if(!Number.isSafeInteger(id)||id<=0||id>2147483647)throw new Error('Use the real positive in-game house ID.');const name=String(input.name||'').trim();if(!name||name.length>255)throw new Error('Official name is required (maximum 255 characters).');const h={house_id:id,name,normalized_name:normalizeText(name)};
  for(const key of text){const value=String(input[key]||'').trim();if(value.length>(['requirements','availability','uesp_url'].includes(key)?2000:255))throw new Error(`${key} is too long.`);h[key]=value||null;}
  h.category=h.classification;
  for(const key of numeric){const value=input[key];if(value==null||value===''){h[key]=null;continue;}const n=Number(value);if(!Number.isSafeInteger(n)||n<0||n>2147483647)throw new Error(`${key} must be a nonnegative whole number.`);h[key]=n;}
  if(h.uesp_url){const u=new URL(h.uesp_url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error('Use a public HTTP or HTTPS source URL.');}
  if(h.last_verified&&!/^\d{4}-\d{2}-\d{2}$/.test(h.last_verified))throw new Error('Verification date must use YYYY-MM-DD.');
  if(await one(this.db,'SELECT house_id FROM houses WHERE house_id=?',[id]))throw new Error('That official house ID already exists.');
  const similar=await this.db.query('SELECT house_id,name FROM houses WHERE normalized_name=?',[h.normalized_name]);return {house:h,warnings:similar.length?['A similar official name already exists; verify the in-game ID before confirming.']:[]};
 }
 async add(actor,input){const {house}=await this.preview(actor,input);return withTransaction(this.db,async conn=>{this.assertOwner(actor);if(await one(conn,'SELECT house_id FROM houses WHERE house_id=? FOR UPDATE',[house.house_id]))throw new Error('That official house ID already exists.');const columns=Object.keys(house);await conn.query(`INSERT INTO houses(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`,Object.values(house));await conn.query('INSERT INTO owner_catalog_houses(house_id,added_by,added_at) VALUES(?,?,?)',[house.house_id,String(actor.id||actor.userId),new Date().toISOString()]);await conn.query('INSERT INTO audit_log(guild_id,actor_id,action,entity_type,entity_id,entity_name,details) VALUES(NULL,?,?,?,?,?,?)',[String(actor.id||actor.userId),'add_catalog_house','catalog_house',String(house.house_id),house.name,JSON.stringify({source:'owner',zone:house.zone})]);return house;});}
}
