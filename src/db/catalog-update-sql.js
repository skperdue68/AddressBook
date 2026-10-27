import {writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {CATALOG_REVIEW as review} from './catalog-review.js';
import {CAPACITY_FIELDS} from '../utils/house-classification.js';
import {normalizeText} from '../utils/eso.js';

const quote=value=>value==null?'NULL':typeof value==='number'?String(value):`'${String(value).replace(/'/g,"''")}'`;
const numeric=new Set([...CAPACITY_FIELDS,'gold_price','crown_price','crown_price_unfurnished','crown_price_furnished']);
const empty=field=>numeric.has(field)?`${field} IS NULL`:`(${field} IS NULL OR TRIM(${field})='')`;
const entries=patch=>Object.entries({...patch.values,...Object.fromEntries(Object.entries(patch.replacements).map(([key,c])=>[key,c.after]))});
const needs=(patch,field)=>patch.replacements[field]?`(${empty(field)} OR (${field}=${quote(patch.replacements[field].before)} AND NOT EXISTS (SELECT 1 FROM owner_catalog_houses o WHERE o.house_id=houses.house_id)))`:empty(field);

export function catalogUpdateSql(type){
 if(!['sqlite','mariadb'].includes(type))throw new Error('Choose sqlite or mariadb.');
 const maria=type==='mariadb',insert=maria?'INSERT IGNORE':'INSERT OR IGNORE',newHouses=review.patches.filter(p=>p.new_house),ids=review.patches.map(p=>p.house_id).join(','),newIds=newHouses.map(p=>p.house_id).join(',');
 const lines=[`-- HearthBound catalog review ${review.checked_on}. Source: ${review.main_source}`,
 '-- Requires migrated schema >=13. Back up the actual Linux database first.',
 '-- Fills missing fields. Known packaged purchase labels are corrected only for non-owner-managed houses.',
 '-- Existing nonblank custom values, registrations, tours and explicit capacity overrides are retained.',
 '-- Stop on errors (sqlite3 -bail; do not use mariadb --force). A conflicting new house ID aborts before updates.',
 maria?'START TRANSACTION;':'BEGIN IMMEDIATE;',
 `CREATE ${maria?'TEMPORARY':'TEMP'} TABLE _hearthbound_catalog_guard_20261027 (ok INTEGER NOT NULL CHECK(ok=1));`,
 `INSERT INTO _hearthbound_catalog_guard_20261027(ok) SELECT CASE WHEN EXISTS (SELECT 1 FROM houses WHERE ${newHouses.map(p=>`(house_id=${p.house_id} AND LOWER(TRIM(name))<>LOWER(${quote(p.name)}))`).join(' OR ')}) THEN 0 ELSE 1 END;`];
 for(const patch of review.patches){
  lines.push('',`-- #${patch.house_id} ${patch.name}. Evidence: ${patch.source_revision_url}`);
  if(patch.new_house){
   const fields={house_id:patch.house_id,name:patch.name,normalized_name:normalizeText(patch.name),...patch.values,last_verified:review.checked_on};
   const columns=[...Object.keys(fields),...CAPACITY_FIELDS],values=[...Object.values(fields).map(quote),...CAPACITY_FIELDS.map(key=>`(SELECT ${key} FROM house_classifications WHERE name=${quote(fields.classification)})`)];
   lines.push(`INSERT INTO houses(${columns.join(',')}) SELECT ${values.join(',')} WHERE NOT EXISTS (SELECT 1 FROM houses WHERE house_id=${patch.house_id});`);
  }
  const changes=entries(patch),conditions=changes.map(([field])=>needs(patch,field));
  lines.push(`UPDATE houses SET last_verified=${quote(review.checked_on)},${changes.map(([field,value])=>`${field}=CASE WHEN ${needs(patch,field)} THEN ${quote(value)} ELSE ${field} END`).join(',')} WHERE house_id=${patch.house_id} AND (${conditions.join(' OR ')});`);
 }
 for(const field of CAPACITY_FIELDS){
  lines.push(`UPDATE houses SET ${field}=(SELECT p.${field} FROM house_classifications p WHERE p.name=houses.classification) WHERE house_id IN (${newIds}) AND ${field} IS NULL AND NOT EXISTS (SELECT 1 FROM house_capacity_overrides o WHERE o.house_id=houses.house_id AND o.field=${quote(field)});`);
  const different=maria?`NOT(h.${field} <=> p.${field})`:`h.${field} IS NOT p.${field}`;
  lines.push(`${insert} INTO house_capacity_overrides(house_id,field,value) SELECT h.house_id,${quote(field)},h.${field} FROM houses h JOIN house_classifications p ON p.name=h.classification WHERE h.house_id IN (${newIds}) AND ${different};`);
 }
 for(const field of ['zone','subzone','house_type','style','purchase_type','availability'])lines.push(`${insert} INTO house_catalog_values(field,value) SELECT DISTINCT ${quote(field)},${field} FROM houses WHERE house_id IN (${ids}) AND ${field} IS NOT NULL AND TRIM(${field})<>'';`);
 lines.push('DROP TABLE _hearthbound_catalog_guard_20261027;','COMMIT;',`SELECT house_id,name,classification,zone,subzone,house_type,gold_price,crown_price_unfurnished,crown_price_furnished FROM houses WHERE house_id IN (${ids}) ORDER BY house_id;`,'');
 return lines.join('\n');
}

export function catalogReviewSql(){
 const conditions=review.patches.map(p=>`(house_id=${p.house_id} AND (${entries(p).map(([field])=>needs(p,field)).join(' OR ')}))`);
 const newIds=review.patches.filter(p=>p.new_house).map(p=>p.house_id).join(',');
 return [`-- Read-only preflight: ${review.checked_on}. No production data is changed.`,
 ...review.patches.filter(p=>p.new_house).map(p=>`SELECT ${p.house_id} AS expected_house_id,${quote(p.name)} AS expected_name,(SELECT name FROM houses WHERE house_id=${p.house_id}) AS existing_name;`),
 `SELECT house_id,name,classification,category,zone,style,${CAPACITY_FIELDS.join(',')} FROM houses WHERE house_id IN (${newIds}) ORDER BY house_id;`,
 `SELECT house_id,name,subzone,house_type,purchase_type,gold_price,crown_price_unfurnished,crown_price_furnished FROM houses WHERE ${conditions.join('\n OR ')} ORDER BY house_id;`,''].join('\n');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv[2]==='--write'){
  const directory=new URL('../../docs/sql/',import.meta.url);await mkdir(directory,{recursive:true});
  for(const type of ['sqlite','mariadb'])await writeFile(new URL(`catalog-${review.checked_on}-${type}.sql`,directory),catalogUpdateSql(type));
  await writeFile(new URL(`catalog-${review.checked_on}-review.sql`,directory),catalogReviewSql());
  console.log('Wrote review and SQLite/MariaDB update statements; no database was opened or modified.');
 }else{console.log(catalogUpdateSql(process.argv[2]||'sqlite'));}
}
