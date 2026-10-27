import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {openDatabase,migrate,closeDatabase,one} from '../src/db/database.js';
import {seedHouses} from '../src/db/seed-houses.js';
import {HOUSE_CATALOG} from '../src/db/house-catalog.js';
import {catalogUpdateSql} from '../src/db/catalog-update-sql.js';

test('verified catalog includes131/132 and fills known metadata without inventing prices',()=>{
 assert.equal(HOUSE_CATALOG.length,122);
 const grotto=HOUSE_CATALOG.find(h=>h.house_id===131),chateau=HOUSE_CATALOG.find(h=>h.house_id===132);
 assert.equal(grotto.name,'Grotto of Desires');assert.equal(grotto.furnishing_limit,350);assert.equal(grotto.crown_price??null,null);
 assert.match(grotto.availability,/pre-release/);assert.equal(chateau.crown_price_furnished,13000);
 assert.equal(HOUSE_CATALOG.find(h=>h.house_id===123).crown_price_unfurnished,8000);
 assert.equal(HOUSE_CATALOG.find(h=>h.house_id===118).gold_price,3000);
 assert.equal(HOUSE_CATALOG.find(h=>h.house_id===111).house_type,'Medium Home');
 assert.equal(HOUSE_CATALOG.find(h=>h.house_id===1).subzone,'Iluvamir');
 assert.equal(HOUSE_CATALOG.find(h=>h.house_id===119).classification,'Notable Home');
 assert.ok(!HOUSE_CATALOG.some(h=>[126,127,130].includes(h.house_id)));
});

test('SQL fills incomplete owner house131, preserves custom values and references, and survives restart seeding',async()=>{
 const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:':memory:'});
 try{
  await migrate(db);await seedHouses(db);await db.query('DELETE FROM houses WHERE house_id IN (131,132)');
  await db.query("INSERT INTO houses(house_id,name,normalized_name,style) VALUES(131,'Grotto of Desires','grotto of desires','Owner custom style')");
  await db.query("INSERT INTO owner_catalog_houses(house_id,added_by,added_at) VALUES(131,'1','2026-10-20')");
  await db.query("INSERT INTO house_capacity_overrides(house_id,field,value) VALUES(131,'furnishing_limit',NULL)");
  await db.query("UPDATE houses SET subzone=NULL,gold_price=12345 WHERE house_id=1");
  await db.query("UPDATE houses SET purchase_type='Gold' WHERE house_id=47");
  await db.query("INSERT INTO owner_catalog_houses(house_id,added_by,added_at) VALUES(81,'1','2026-10-20')");
  await db.query("UPDATE houses SET purchase_type='Quest, event, promotion, or special acquisition' WHERE house_id=81");
  await db.query("INSERT INTO saved_houses(scope,owner_user_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES('private','u',131,'Builder','builder','active','u','u')");
  const sql=catalogUpdateSql('sqlite');db.raw.exec(sql);db.raw.exec(sql);
  const h=await one(db,'SELECT * FROM houses WHERE house_id=131');assert.equal(h.classification,'Notable Home');assert.equal(h.zone,'Blackwood');assert.equal(h.style,'Owner custom style');assert.equal(h.furnishing_limit,null);assert.equal(h.furnishing_limit_plus,700);
  assert.equal((await one(db,'SELECT * FROM houses WHERE house_id=1')).gold_price,12345);
  assert.equal((await one(db,'SELECT purchase_type FROM houses WHERE house_id=47')).purchase_type,'Gold or Crowns');
  assert.equal((await one(db,'SELECT purchase_type FROM houses WHERE house_id=81')).purchase_type,'Quest, event, promotion, or special acquisition');
  assert.equal((await one(db,'SELECT house_id FROM saved_houses')).house_id,131);
  assert.equal(Number((await one(db,'SELECT count(*) n FROM houses WHERE house_id=132')).n),1);
  await seedHouses(db,{logger:{warn(){}}});assert.equal((await one(db,'SELECT style FROM houses WHERE house_id=131')).style,'Owner custom style');
  assert.equal((await one(db,'SELECT subzone FROM houses WHERE house_id=1')).subzone,'Iluvamir');
  assert.ok(await one(db,"SELECT value FROM house_catalog_values WHERE field='style' AND value='Owner custom style'"));
 }finally{await closeDatabase(db);}
});

test('SQL refuses ID collisions and generated dialect files match the reviewed generator',async()=>{
 const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:':memory:'});try{
  await migrate(db);await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(131,'Different house','different house')");
  assert.throws(()=>db.raw.exec(catalogUpdateSql('sqlite')),/CHECK/);db.raw.exec('ROLLBACK');assert.equal(Number((await one(db,'SELECT count(*) n FROM houses')).n),1);
 }finally{await closeDatabase(db);}
 for(const type of ['sqlite','mariadb'])assert.equal((await readFile(new URL(`../docs/sql/catalog-2026-10-27-${type}.sql`,import.meta.url),'utf8')).replace(/\r\n/g,'\n'),catalogUpdateSql(type));
 assert.match(catalogUpdateSql('mariadb'),/START TRANSACTION/);assert.match(catalogUpdateSql('mariadb'),/INSERT IGNORE/);assert.doesNotMatch(catalogUpdateSql('mariadb'),/ON CONFLICT|INSERT OR IGNORE/);
});
