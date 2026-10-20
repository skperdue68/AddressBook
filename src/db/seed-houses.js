import { openDatabase, migrate, closeDatabase, withTransaction, ensureMariaDatabase } from './database.js';
import { normalizeText } from '../utils/eso.js';
import { HOUSE_CATALOG } from './house-catalog.js';

export async function seedHouses(db){
  const upsert=db.type==='sqlite' ? ` ON CONFLICT(house_id) DO UPDATE SET name=excluded.name,normalized_name=excluded.normalized_name,zone=excluded.zone,category=excluded.category,classification=excluded.classification,house_type=excluded.house_type,style=excluded.style,furnishing_limit=excluded.furnishing_limit,furnishing_limit_plus=excluded.furnishing_limit_plus,special_furnishing_limit=excluded.special_furnishing_limit,special_furnishing_limit_plus=excluded.special_furnishing_limit_plus,collectible_limit=excluded.collectible_limit,collectible_limit_plus=excluded.collectible_limit_plus,special_collectible_limit=excluded.special_collectible_limit,special_collectible_limit_plus=excluded.special_collectible_limit_plus,population_limit=excluded.population_limit,population_limit_plus=excluded.population_limit_plus,purchase_type=excluded.purchase_type,gold_price=excluded.gold_price,crown_price=excluded.crown_price,crown_price_unfurnished=excluded.crown_price_unfurnished,crown_price_furnished=excluded.crown_price_furnished,requirements=excluded.requirements,availability=excluded.availability,uesp_url=excluded.uesp_url,last_verified=excluded.last_verified` : ` ON DUPLICATE KEY UPDATE name=VALUES(name),normalized_name=VALUES(normalized_name),zone=VALUES(zone),category=VALUES(category),classification=VALUES(classification),house_type=VALUES(house_type),style=VALUES(style),furnishing_limit=VALUES(furnishing_limit),furnishing_limit_plus=VALUES(furnishing_limit_plus),special_furnishing_limit=VALUES(special_furnishing_limit),special_furnishing_limit_plus=VALUES(special_furnishing_limit_plus),collectible_limit=VALUES(collectible_limit),collectible_limit_plus=VALUES(collectible_limit_plus),special_collectible_limit=VALUES(special_collectible_limit),special_collectible_limit_plus=VALUES(special_collectible_limit_plus),population_limit=VALUES(population_limit),population_limit_plus=VALUES(population_limit_plus),purchase_type=VALUES(purchase_type),gold_price=VALUES(gold_price),crown_price=VALUES(crown_price),crown_price_unfurnished=VALUES(crown_price_unfurnished),crown_price_furnished=VALUES(crown_price_furnished),requirements=VALUES(requirements),availability=VALUES(availability),uesp_url=VALUES(uesp_url),last_verified=VALUES(last_verified)`;
  const sql=`INSERT INTO houses(
    house_id,name,normalized_name,zone,category,classification,house_type,style,
    furnishing_limit,furnishing_limit_plus,special_furnishing_limit,special_furnishing_limit_plus,
    collectible_limit,collectible_limit_plus,special_collectible_limit,special_collectible_limit_plus,
    population_limit,population_limit_plus,purchase_type,gold_price,crown_price,crown_price_unfurnished,
    crown_price_furnished,requirements,availability,uesp_url,last_verified
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)${upsert}`;
  await withTransaction(db,async conn=>{
    for(const h of HOUSE_CATALOG){
      await conn.query(sql,[
        h.house_id,h.name,normalizeText(h.name),h.zone||null,h.classification||h.category||null,h.classification||h.category||null,h.house_type||null,h.style||null,
        h.furnishing_limit??null,h.furnishing_limit_plus??null,h.special_furnishing_limit??null,h.special_furnishing_limit_plus??null,
        h.collectible_limit??null,h.collectible_limit_plus??null,h.special_collectible_limit??null,h.special_collectible_limit_plus??null,
        h.population_limit??null,h.population_limit_plus??null,h.purchase_type||null,h.gold_price??null,h.crown_price??null,h.crown_price_unfurnished??null,
        h.crown_price_furnished??null,h.requirements||null,h.availability||null,h.uesp_url||null,h.last_verified||'2026-09-07'
      ]);
    }
  });
}

if(import.meta.url===`file://${process.argv[1]}`){
  await import('dotenv/config');
  if(String(process.env.DB_TYPE||'sqlite').toLowerCase()==='mariadb')await ensureMariaDatabase();
  const db=openDatabase();
  try{
    await migrate(db); await seedHouses(db);
    console.log(`Seeded ${HOUSE_CATALOG.length} houses with house type, classification, limits, pricing, and acquisition metadata.`);
  }finally{ await closeDatabase(db); }
}
