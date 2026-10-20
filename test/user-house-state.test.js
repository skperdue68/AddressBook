import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import { UserHouseStateService } from '../src/services/user-house-state-service.js';
import { VisitService } from '../src/services/visit-service.js';
import { houseTarget, houseTargetKey } from '../src/utils/house-target.js';

async function fixture(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-user-house-state-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'state.sqlite')});
  await migrate(db);
  await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Villa','grand villa')");
  await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(44,'pc_na','HouseOwner','houseowner',62)");
  await db.query("INSERT INTO saved_houses(id,eso_server,scope,origin_guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(1,'pc_na','global','g1',62,'HouseOwner','houseowner',44,'active','u2','u2')");
  await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,origin_guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(2,'pc_na','public','g1','g1',62,'HouseOwner','houseowner',44,'active','u2','u2')");
  await db.query("INSERT INTO saved_houses(id,eso_server,scope,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(3,'pc_na','private','g1','u1',62,'HouseOwner','houseowner',44,'active','u1','u1')");
  const visits=new VisitService(db);
  return {db,visits,states:new UserHouseStateService(db,{visitService:visits})};
}

test('house targets distinguish player destinations from Non-Player Houses',()=>{
  assert.deepEqual(houseTarget({scope:'global',destination_id:44}),{kind:'destination',id:44});
  assert.deepEqual(houseTarget({scope:'official',house_id:62}),{kind:'official',id:62});
  assert.equal(houseTargetKey({kind:'destination',id:44}),'destination:44');
  assert.throws(()=>houseTarget({scope:'global'}),/stable destination/i);
});

test('Favorite remains independent while Want to Visit and Visited replace each other',async()=>{
  const {db,visits,states}=await fixture();
  try{
    const row=(await visits.search({userId:'u1',guildId:'g1',esoServer:'pc_na',includeNonPlayer:true,limit:null})).find(item=>item.scope==='global');
    const target=houseTarget(row),when=new Date('2026-09-20T12:34:56.000Z');
    await states.setFavorite({userId:'u1',target,favorite:true,globalName:'User One',displayName:'One',visibleTarget:row});
    await states.setVisitState({userId:'u1',target,visitState:'want_to_visit',visibleTarget:row});
    let stored=await states.get('u1',target);
    assert.equal(Number(stored.is_favorite),1);
    assert.equal(stored.visit_state,'want_to_visit');
    assert.equal(stored.last_visited_at,null);

    await states.setVisitState({userId:'u1',target,visitState:'visited',visibleTarget:row,visitedAt:when});
    stored=await states.get('u1',target);
    assert.equal(Number(stored.is_favorite),1);
    assert.equal(stored.visit_state,'visited');
    assert.equal(Date.parse(stored.last_visited_at),when.getTime());

    await states.setFavorite({userId:'u1',target,favorite:false,visibleTarget:row});
    stored=await states.get('u1',target);
    assert.equal(Number(stored.is_favorite),0);
    assert.equal(stored.visit_state,'visited');

    await states.setVisitState({userId:'u1',target,visitState:'none',visibleTarget:row});
    assert.equal(await states.get('u1',target),null);
  }finally{await closeDatabase(db);}
});

test('repeated simultaneous Favorite actions retain one state row',async()=>{
  const {db,visits,states}=await fixture();
  try{
    const row=(await visits.search({userId:'u1',guildId:'g1',esoServer:'pc_na',limit:null}))[0],target=houseTarget(row);
    await Promise.all(Array.from({length:5},()=>states.setFavorite({userId:'u1',target,favorite:true,visibleTarget:row})));
    assert.equal(Number((await one(db,'SELECT count(*) c FROM user_house_states WHERE discord_user_id=?',['u1'])).c),1);
  }finally{await closeDatabase(db);}
});

test('personal lists deduplicate destinations prefer Global Server Private and hide inaccessible state',async()=>{
  const {db,visits,states}=await fixture();
  try{
    const rows=await visits.search({userId:'u1',guildId:'g1',esoServer:'pc_na',includeNonPlayer:true,limit:null});
    const global=rows.find(row=>row.scope==='global');
    await states.setFavorite({userId:'u1',target:houseTarget(global),favorite:true,visibleTarget:global});
    let list=await states.list({userId:'u1',guildId:'g1',esoServer:'pc_na',kind:'favorites'});
    assert.deepEqual(list.map(row=>[row.id,row.scope]),[[1,'global']]);

    await db.query("UPDATE saved_houses SET status='archived' WHERE id=1");
    list=await states.list({userId:'u1',guildId:'g1',esoServer:'pc_na',kind:'favorites'});
    assert.deepEqual(list.map(row=>[row.id,row.scope]),[[2,'server']]);

    await db.query("UPDATE saved_houses SET status='archived' WHERE id=2");
    list=await states.list({userId:'u1',guildId:'g1',esoServer:'pc_na',kind:'favorites'});
    assert.deepEqual(list.map(row=>[row.id,row.scope]),[[3,'personal']]);

    await db.query("UPDATE saved_houses SET status='archived' WHERE id=3");
    assert.deepEqual(await states.list({userId:'u1',guildId:'g1',esoServer:'pc_na',kind:'favorites'}),[]);
    assert.ok(await states.get('u1',{kind:'destination',id:44}),'hidden state must be retained');
    assert.deepEqual(await states.list({userId:'u2',guildId:'g1',esoServer:'pc_na',kind:'favorites'}),[]);
  }finally{await closeDatabase(db);}
});

test('Non-Player House states appear through the catalog and counts remain access filtered',async()=>{
  const {db,visits,states}=await fixture();
  try{
    const official=(await visits.search({userId:'u1',guildId:'g1',esoServer:'pc_na',includeNonPlayer:true,limit:null})).find(row=>row.scope==='official');
    await states.setFavorite({userId:'u1',target:houseTarget(official),favorite:true,visibleTarget:official});
    await states.setVisitState({userId:'u1',target:houseTarget(official),visitState:'want_to_visit',visibleTarget:official});
    assert.deepEqual((await states.list({userId:'u1',guildId:'g1',esoServer:'pc_na',kind:'wantToVisit'})).map(row=>row.scope),['official']);
    assert.deepEqual(await states.counts({userId:'u1',guildId:'g1',esoServer:'pc_na'}),{favorites:1,wantToVisit:1,visited:0});
  }finally{await closeDatabase(db);}
});

test('MariaDB visited timestamps are bound as native Date values',async()=>{
  const writes=[];
  const db={type:'mariadb',query:async(sql,params=[])=>{
    if(/^SELECT .* FROM housing_destinations/i.test(sql.trim()))return [{id:44,house_name:'Grand Villa',eso_owner:'HouseOwner'}];
    if(/^SELECT .* FROM user_house_states/i.test(sql.trim()))return [{id:1,discord_user_id:'u1',target_kind:'destination',target_id:44,is_favorite:0,visit_state:'visited'}];
    writes.push({sql,params});return {affectedRows:1,insertId:1};
  }};
  const when=new Date('2026-09-20T12:34:56.000Z');
  await new UserHouseStateService(db,{visitService:{search:async()=>[]}}).setVisitState({
    userId:'u1',target:{kind:'destination',id:44},visitState:'visited',visitedAt:when,
    visibleTarget:{scope:'global',destination_id:44,house_name:'Grand Villa',eso_owner:'HouseOwner'}
  });
  assert.ok(writes.some(write=>write.params.includes(when)),'last_visited_at must be a native Date');
  assert.equal(writes.some(write=>write.params.some(value=>typeof value==='string'&&value.endsWith('Z'))),false);
});
