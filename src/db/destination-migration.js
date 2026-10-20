import { normalizeAccount, stripLeadingAt } from '../utils/eso.js';

async function first(conn,sql,params=[]){
  const rows=await conn.query(sql,params);
  return rows[0]||null;
}

async function insertDestinationIfMissing(conn,dialect,{esoOwner,normalizedOwner,houseId}){
  const existing=await first(conn,'SELECT id FROM housing_destinations WHERE eso_server IS NULL AND normalized_owner=? AND house_id=?',[normalizedOwner,houseId]);
  if(!existing)await conn.query('INSERT INTO housing_destinations(eso_server,eso_owner,normalized_owner,house_id) VALUES(NULL,?,?,?)',[esoOwner,normalizedOwner,houseId]);
}

async function sqliteColumns(conn,table){
  return new Set((await conn.query(`PRAGMA table_info(${table})`)).map(row=>String(row.name)));
}

async function rebuildSqliteComments(conn){
  const columns=await sqliteColumns(conn,'house_comments');
  if(columns.has('destination_id')){
    const rows=await conn.query('SELECT id,saved_house_id,destination_id FROM house_comments ORDER BY id');
    for(const row of rows){
      if(row.destination_id!=null)continue;
      const house=await first(conn,'SELECT destination_id FROM saved_houses WHERE id=?',[row.saved_house_id]);
      if(!house?.destination_id)throw new Error(`Comment ${row.id} references a saved house without a destination.`);
      await conn.query('UPDATE house_comments SET destination_id=?,legacy_saved_house_id=coalesce(legacy_saved_house_id,saved_house_id) WHERE id=?',[house.destination_id,row.id]);
    }
    return rows.length;
  }

  const rows=await conn.query('SELECT * FROM house_comments ORDER BY created_at,id');
  await conn.query('ALTER TABLE house_comments RENAME TO house_comments_v3_backup');
  await conn.query(`CREATE TABLE house_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    destination_id INTEGER NOT NULL,
    saved_house_id INTEGER,
    legacy_saved_house_id INTEGER,
    saved_house_name TEXT,
    discord_user_id TEXT NOT NULL,
    discord_global_name TEXT,
    discord_display_name TEXT,
    comment_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','removed')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    edited_at TEXT,
    FOREIGN KEY(destination_id) REFERENCES housing_destinations(id),
    FOREIGN KEY(saved_house_id) REFERENCES saved_houses(id) ON DELETE SET NULL
  )`);
  for(const row of rows){
    const house=await first(conn,'SELECT destination_id FROM saved_houses WHERE id=?',[row.saved_house_id]);
    if(!house?.destination_id)throw new Error(`Comment ${row.id} references a saved house without a destination.`);
    await conn.query(`INSERT INTO house_comments(
      id,destination_id,saved_house_id,legacy_saved_house_id,saved_house_name,
      discord_user_id,discord_global_name,discord_display_name,comment_text,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?)`,[
      row.id,house.destination_id,row.saved_house_id,row.saved_house_id,row.saved_house_name??null,
      row.discord_user_id,row.discord_global_name??null,row.discord_display_name??null,row.comment_text,row.created_at
    ]);
  }
  await conn.query('DROP TABLE house_comments_v3_backup');
  await conn.query('CREATE INDEX idx_house_comments_target ON house_comments(destination_id,created_at)');
  await conn.query('CREATE INDEX idx_house_comments_legacy ON house_comments(legacy_saved_house_id)');
  return rows.length;
}

async function repointMariaComments(conn){
  const rows=await conn.query('SELECT id,saved_house_id,destination_id FROM house_comments ORDER BY created_at,id');
  for(const row of rows){
    if(row.destination_id!=null)continue;
    const house=await first(conn,'SELECT destination_id FROM saved_houses WHERE id=?',[row.saved_house_id]);
    if(!house?.destination_id)throw new Error(`Comment ${row.id} references a saved house without a destination.`);
    await conn.query('UPDATE house_comments SET destination_id=?,legacy_saved_house_id=coalesce(legacy_saved_house_id,saved_house_id) WHERE id=?',[house.destination_id,row.id]);
  }
  return rows.length;
}

export async function backfillDestinations(conn,dialect=conn.type){
  const houses=await conn.query('SELECT id,eso_owner,normalized_owner,house_id FROM saved_houses ORDER BY id');
  for(const house of houses){
    const owner=stripLeadingAt(house.eso_owner);
    const normalizedOwner=normalizeAccount(owner);
    const houseId=Number(house.house_id);
    if(!normalizedOwner||!Number.isInteger(houseId)||houseId<=0)throw new Error(`Saved house ${house.id} has an invalid destination.`);
    await insertDestinationIfMissing(conn,dialect,{esoOwner:owner,normalizedOwner,houseId});
    const destination=await first(conn,'SELECT id FROM housing_destinations WHERE normalized_owner=? AND house_id=?',[normalizedOwner,houseId]);
    if(!destination)throw new Error(`Could not resolve destination for saved house ${house.id}.`);
    await conn.query('UPDATE saved_houses SET destination_id=?,normalized_owner=? WHERE id=?',[destination.id,normalizedOwner,house.id]);
  }
  const comments=dialect==='sqlite'?await rebuildSqliteComments(conn):await repointMariaComments(conn);
  const count=await first(conn,'SELECT count(*) c FROM housing_destinations');
  return {destinations:Number(count?.c||0),houses:houses.length,comments};
}

export async function verifyDestinationBackfill(conn,dialect=conn.type,{expectedHouses=null,expectedComments=null}={}){
  const missing=await first(conn,'SELECT count(*) c FROM saved_houses WHERE destination_id IS NULL');
  if(Number(missing?.c||0)!==0)throw new Error('Destination migration left saved houses unlinked.');
  const orphanComments=await first(conn,'SELECT count(*) c FROM house_comments c LEFT JOIN housing_destinations d ON d.id=c.destination_id WHERE d.id IS NULL');
  if(Number(orphanComments?.c||0)!==0)throw new Error('Destination migration left orphan comments.');
  const houseCount=Number((await first(conn,'SELECT count(*) c FROM saved_houses'))?.c||0);
  const commentCount=Number((await first(conn,'SELECT count(*) c FROM house_comments'))?.c||0);
  if(expectedHouses!=null&&houseCount!==Number(expectedHouses))throw new Error(`Destination migration changed saved-house count from ${expectedHouses} to ${houseCount}.`);
  if(expectedComments!=null&&commentCount!==Number(expectedComments))throw new Error(`Destination migration changed comment count from ${expectedComments} to ${commentCount}.`);
  if(dialect==='sqlite'){
    const violations=await conn.query('PRAGMA foreign_key_check');
    if(violations.length)throw new Error(`Destination migration left ${violations.length} foreign-key violation(s).`);
  }
}
