import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { TourService } from '../src/services/tour-service.js';
import { cleanDestinationEmbed, officialHousePayload } from '../src/ui/housing-ui.js';

const fieldsByName=embed=>Object.fromEntries((embed.toJSON().fields||[]).map(field=>[field.name,field.value]));

test('selected saved-house cards show submitter visibility and associated tour names',()=>{
  const fields=fieldsByName(cleanDestinationEmbed({
    id:7,scope:'global',house_id:74,eso_owner:'@DecorByLuna',house_name:'Moon-Sugar Meadow',
    created_by:'1234',created_by_display_name:'Consigliere Luna',comment_count:0,
    associated_tours:[{name:'Worldwide Wonders'},{name:'Pride Parade'}]
  }));
  assert.equal(fields['📝 Submitted By'],'Consigliere Luna • <@1234>');
  assert.equal(fields['👁️ Visibility'],'Global');
  assert.equal(fields['🗺️ Associated Tours'],'• Worldwide Wonders\n• Pride Parade');
});

test('selected saved-house cards show None when no visible tour uses the house',()=>{
  const fields=fieldsByName(cleanDestinationEmbed({
    id:8,scope:'personal',house_id:74,eso_owner:'@DecorByLuna',house_name:'Moon-Sugar Meadow',
    created_by:'1234',created_by_global_name:'Luna',associated_tours:[]
  }));
  assert.equal(fields['👁️ Visibility'],'Private');
  assert.equal(fields['🗺️ Associated Tours'],'None');
});

test('Non-Player Home cards identify their catalog source and lack of tour associations',()=>{
  const fields=fieldsByName(officialHousePayload({house_id:74,name:'Moon-Sugar Meadow'}).embeds[0]);
  assert.equal(fields['📝 Submitted By'],'ESO Housing Catalog');
  assert.equal(fields['👁️ Visibility'],'Non-Player Home');
  assert.equal(fields['🗺️ Associated Tours'],'None');
});

test('house tour associations include only tours visible to the requesting user in Global Server Private order',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-house-tours-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'house-tours.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'House','house')");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES(1,'pc_na','global',NULL,'g1',NULL,1,'Owner','owner','active','u1','u1')");
    const rows=[
      [1,'private',null,null,'u1','My Private Tour','all'],
      [2,'private',null,null,'u2','Someone Else Private','all'],
      [3,'public','g1','g1','u2','My Server Tour','public_global'],
      [4,'public','g2','g2','u2','Other Server Tour','public_global'],
      [5,'global',null,null,'u2','Global Tour','global']
    ];
    for(const row of rows){
      await db.query("INSERT INTO tours(id,eso_server,visibility,guild_id,source_guild_id,creator_id,name,house_source) VALUES(?,'pc_na',?,?,?,?,?,?)",row);
      await db.query('INSERT INTO tour_stops(tour_id,position,saved_house_id) VALUES(?,1,1)',[row[0]]);
    }
    await db.query("INSERT INTO tours(id,eso_server,visibility,creator_id,name,house_source) VALUES(6,'pc_eu','global','u2','Wrong Environment','global')");
    await db.query('INSERT INTO tour_stops(tour_id,position,saved_house_id) VALUES(6,1,1)');
    const visible=await new TourService(db).visibleForHouse(1,{creatorId:'u1',guildId:'g1',esoServer:'pc_na'});
    assert.deepEqual(visible.map(row=>row.name),['Global Tour','My Server Tour','My Private Tour']);
  }finally{await closeDatabase(db);}
});
