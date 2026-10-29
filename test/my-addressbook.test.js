import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { MyAddressBookService } from '../src/services/my-addressbook-service.js';
import { homePayload, myAddressBookPayload } from '../src/ui/housing-ui.js';

const labels=payload=>payload.components.flatMap(row=>row.components).map(component=>component.data.label).filter(Boolean);

test('home includes My Address Book without replacing the established entry points',()=>{
  assert.deepEqual(labels(homePayload()),[
    'Search Houses','Search Housing Tours','Register New House','Random House','Featured Housing','My Address Book','Support & Access'
  ]);
});

test('My Address Book renders personal counts and dashboard actions',()=>{
  const payload=myAddressBookPayload({houses:18,tours:4,pending:2,recent:3});
  const json=payload.embeds[0].toJSON();
  assert.match(json.title,/My Address Book/);
  assert.deepEqual(json.fields.map(field=>[field.name,field.value]),[
    ['🏠 My Houses','**18**'],['🗺️ My Tours','**4**'],
    ['⏳ Access requests','**2**'],['🕘 Recently Viewed','**3**'],
    ['⭐ Favorites','**0**'],['🔎 Saved Searches','**0**']
  ]);
  assert.deepEqual(labels(payload),[
    'All Saved Places','Favorites','Submitted Houses',
    'My Tours','Tour Progress','Recently Viewed','Saved Searches','Access requests','Main Menu'
  ]);
});

test('MariaDB continue-items query avoids a duplicate tour_name result field',async()=>{
  const db={type:'mariadb',query:async sql=>{
    if(/FROM tour_sessions ts/i.test(sql)){
      if(/t\.name\s+tour_name/i.test(sql))throw new Error('duplicate field name `tour_name`');
      return [{id:7,tour_name:'Cached Name',current_tour_name:'Current Name',visibility:'private'}];
    }
    return [];
  }};

  const result=await new MyAddressBookService(db).continueItems('u1','g1','pc_na');

  assert.equal(result.activeTour.tour_name,'Current Name');
  assert.equal(result.activeTour.current_tour_name,undefined);
});

test('MariaDB recent houses avoid duplicate house_name and use the current catalog name',async()=>{
  const db={type:'mariadb',query:async sql=>{
    if(/FROM recent_house_views/i.test(sql)){
      if(/SELECT\s+s\.\*[\s\S]*?h\.name\s+house_name/i.test(sql))throw new Error('duplicate field name `house_name`');
      return [{id:4,house_name:'Cached Name',catalog_house_name:'Current Catalog Name'}];
    }
    return [];
  }};

  const rows=await new MyAddressBookService(db).recent('u1','g1','pc_na');

  assert.equal(rows[0].house_name,'Current Catalog Name');
  assert.equal(rows[0].catalog_house_name,undefined);
});

test('dashboard counts user-owned work and recent views without exposing another user',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-dashboard-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'dashboard.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'House','house')");
    const rows=[
      [1,'private',null,null,'u1','active','u1'],
      [2,'public','g1',null,null,'active','u1'],
      [3,'global',null,'g1',null,'pending','u1'],
      [4,'global',null,'g1',null,'active','u2'],
      [5,'private',null,null,'u2','active','u2']
    ];
    for(const [id,scope,guildId,originGuildId,ownerUserId,status,createdBy] of rows)
      await db.query('INSERT INTO saved_houses(id,eso_server,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES(?,\'pc_na\',?,?,?,?,1,?,?,?, ?,?)',[id,scope,guildId,originGuildId,ownerUserId|| (scope==='private'?createdBy:null),`Owner${id}`,`owner${id}`,status,createdBy,createdBy]);
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,owner_user_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES(6,NULL,'private','u1',1,'Legacy','legacy','active','u1','u1')");
    await db.query("INSERT INTO tours(id,eso_server,visibility,creator_id,name,house_source) VALUES(1,'pc_na','private','u1','Mine','all')");
    await db.query("INSERT INTO tours(id,eso_server,visibility,creator_id,name,house_source) VALUES(2,'pc_na','global','u2','Not Mine','global')");
    await db.query("INSERT INTO tours(id,eso_server,visibility,creator_id,name,house_source) VALUES(3,NULL,'private','u1','Legacy Tour','all')");
    await db.query("INSERT INTO global_moderator_requests(discord_user_id,eso_server,origin_guild_id,reason,status) VALUES('u1','pc_na','g1','help','pending')");
    const service=new MyAddressBookService(db);
    await service.recordView('u1',1);
    await service.recordView('u1',2);
    await service.recordView('u1',5);
    await service.recordView('u2',4);
    const summary=await service.summary('u1','g1','pc_na');
    assert.deepEqual(summary,{houses:2,tours:1,pending:1,recent:2,favorites:0,wantToVisit:0,visited:0,savedSearches:0});
    assert.deepEqual((await service.recent('u1','g1','pc_na')).map(row=>row.id),[2,1]);
    assert.deepEqual(await service.legacyUnassigned('u1'),{houses:1,tours:1});
  }finally{await closeDatabase(db);}
});
