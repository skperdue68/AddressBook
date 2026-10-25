import {CAPACITY_FIELDS,CLASSIFICATION_DEFAULTS} from '../utils/house-classification.js';
export const CATALOG_VALUE_FIELDS=Object.freeze(['zone','subzone','house_type','style','purchase_type','availability']);
export const CATALOG_TABLE_COLUMNS=Object.freeze({house_classifications:['name',...CAPACITY_FIELDS,'revision'],house_catalog_values:['field','value'],house_capacity_overrides:['house_id','field','value']});
export function catalogRowsFromHouses(houses,profiles=null){
 const classes=new Map((profiles||Object.entries(CLASSIFICATION_DEFAULTS).map(([name,fields])=>({name,...fields,revision:1}))).map(p=>[p.name,{...p}])),values=new Map(),overrides=[];
 for(const h of houses){if(h.classification&&!classes.has(h.classification))classes.set(h.classification,{name:h.classification,...Object.fromEntries(CAPACITY_FIELDS.map(k=>[k,null])),revision:1});for(const field of CATALOG_VALUE_FIELDS){const value=String(h[field]||'').trim();if(value&&value.length<=255)values.set(`${field}:${value}`,{field,value});}const profile=classes.get(h.classification)||{};for(const field of CAPACITY_FIELDS)if((h[field]??null)!==(profile[field]??null))overrides.push({house_id:h.house_id,field,value:h[field]??null});}
 return {house_classifications:[...classes.values()],house_catalog_values:[...values.values()],house_capacity_overrides:overrides};
}
export function catalogSchema(type){const suffix=type==='mariadb'?' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci':'';return [
 `CREATE TABLE IF NOT EXISTS house_classifications (name VARCHAR(255) PRIMARY KEY,${CAPACITY_FIELDS.map(key=>`${key} INT NULL`).join(',')},revision INT NOT NULL DEFAULT 1)${suffix}`,
 `CREATE TABLE IF NOT EXISTS house_catalog_values (field VARCHAR(32) NOT NULL,value VARCHAR(255) NOT NULL,PRIMARY KEY(field,value))${suffix}`,
 `CREATE TABLE IF NOT EXISTS house_capacity_overrides (house_id INT NOT NULL,field VARCHAR(64) NOT NULL,value INT NULL,PRIMARY KEY(house_id,field),FOREIGN KEY(house_id) REFERENCES houses(house_id))${suffix}`
 ];}
export async function insertCatalogRow(conn,table,row){const keys=Object.keys(row),sql=conn.type==='mariadb'?'INSERT IGNORE':'INSERT OR IGNORE';await conn.query(`${sql} INTO ${table}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`,Object.values(row));}
export async function syncCatalogMetadata(conn,house){
 if(house.classification)await insertCatalogRow(conn,'house_classifications',{name:house.classification});
 for(const field of CATALOG_VALUE_FIELDS){const value=String(house[field]||'').trim();if(value&&value.length<=255)await insertCatalogRow(conn,'house_catalog_values',{field,value});}
 const rows=house.classification?await conn.query('SELECT * FROM house_classifications WHERE name=?',[house.classification]):[],profile=rows[0]||{};
 await conn.query('DELETE FROM house_capacity_overrides WHERE house_id=?',[house.house_id]);
 for(const field of CAPACITY_FIELDS)if((house[field]??null)!==(profile[field]??null))await conn.query('INSERT INTO house_capacity_overrides(house_id,field,value) VALUES(?,?,?)',[house.house_id,field,house[field]??null]);
}
export async function migrateCatalog(db){
 if((await db.query('SELECT version FROM schema_migrations WHERE version=13')).length)return;
 for(const sql of catalogSchema(db.type))await db.query(sql);
 // Only insert missing defaults: restarts must never replace owner-maintained profiles.
 for(const [name,values] of Object.entries(CLASSIFICATION_DEFAULTS))await insertCatalogRow(db,'house_classifications',{name,...values});
 for(const h of await db.query('SELECT * FROM houses'))await syncCatalogMetadata(db,h);
 await db.query('INSERT INTO schema_migrations(version) VALUES (13)');
}
