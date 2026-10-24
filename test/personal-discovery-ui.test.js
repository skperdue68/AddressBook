import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import { createHousingMenu } from '../src/ui/housing-menu.js';
import * as ui from '../src/ui/housing-ui.js';

const labels=payload=>(payload.components||[]).flatMap(row=>(row.toJSON?.()||row).components||[]).map(component=>component.label).filter(Boolean);
const components=payload=>(payload.components||[]).flatMap(row=>(row.toJSON?.()||row).components||[]);

async function fixture(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-personal-ui-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'ui.sqlite')});
  await migrate(db);
  await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
  await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Villa','grand villa')");
  await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(44,'pc_na','HouseOwner','houseowner',62)");
  await db.query("INSERT INTO saved_houses(id,eso_server,scope,origin_guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(1,'pc_na','global','g1',62,'HouseOwner','houseowner',44,'active','u2','u2')");
  return {db,menu:createHousingMenu(db)};
}

function interaction(customId,userId='u1'){
  const calls={updates:[],replies:[]};
  return {calls,value:{
    customId,guildId:'g1',channelId:'c1',guild:{id:'g1',name:'Guild One'},
    user:{id:userId,username:`User ${userId}`,globalName:`Global ${userId}`},
    member:{displayName:`Display ${userId}`,roles:{cache:new Map()}},
    update(payload){calls.updates.push(payload);return Promise.resolve(payload);},
    reply(payload){calls.replies.push(payload);return Promise.resolve(payload);}
  }};
}

test('Personal Actions panel reflects Favorite and visit state',()=>{
  assert.equal(typeof ui.personalActionsPayload,'function');
  const payload=ui.personalActionsPayload({token:'state1',target:{kind:'destination',id:7},state:{is_favorite:1,visit_state:'want_to_visit'},backId:'hu:home'});
  assert.deepEqual(labels(payload),['Remove Favorite','Want to Visit','Mark Visited','Clear Visit Status','Return to House']);
  assert.match(payload.embeds[0].toJSON().description,/Only you/i);
});

test('saved and Non-Player cards expose Personal Actions without crowding component rows',()=>{
  const saved=ui.destinationMenuPayload({id:1,scope:'global',destination_id:44,house_id:62,eso_owner:'Owner',house_name:'Villa',display_name:'Villa',associated_tours:[]});
  const official=ui.officialHousePayload({house_id:62,name:'Villa'});
  assert.ok(labels(saved).includes('Personal Actions'));
  assert.ok(labels(official).includes('Personal Actions'));
  for(const payload of [saved,official])for(const row of payload.components)assert.ok(row.toJSON().components.length<=5);
});

test('My Address Book exposes personal discovery sections and their counts',()=>{
  const payload=ui.myAddressBookPayload({favorites:3,wantToVisit:2,visited:7,savedSearches:4});
  assert.ok(labels(payload).includes('Favorites'));
  assert.ok(labels(payload).includes('Want to Visit'));
  assert.ok(labels(payload).includes('Visited'));
  assert.ok(labels(payload).includes('Saved Searches'));
  const embed=JSON.stringify(payload.embeds[0].toJSON());
  for(const count of ['3','2','7','4'])assert.match(embed,new RegExp(`\\*\\*${count}\\*\\*`));
});

test('personal action tokens are owner-bound and stale houses do not mutate state',async()=>{
  const {db,menu}=await fixture();
  try{
    const opened=interaction('hu:personal:open:saved:1','u1');
    await menu.button(opened.value);
    const favorite=components(opened.calls.updates[0]).find(component=>component.label==='Add Favorite');
    assert.ok(favorite);

    const foreign=interaction(favorite.custom_id,'u3');
    await menu.button(foreign.value);
    assert.match(foreign.calls.replies[0].content,/belongs to another user/i);
    assert.equal(Number((await one(db,'SELECT count(*) c FROM user_house_states')).c),0);

    const own=interaction(favorite.custom_id,'u1');
    await menu.button(own.value);
    assert.match(own.calls.updates[0].content,/favorite/i);
    assert.equal(Number((await one(db,"SELECT is_favorite FROM user_house_states WHERE discord_user_id='u1'")).is_favorite),1);

    const visited=components(own.calls.updates[0]).find(component=>component.label==='Mark Visited');
    await db.query("UPDATE saved_houses SET status='archived' WHERE id=1");
    const stale=interaction(visited.custom_id,'u1');
    await menu.button(stale.value);
    assert.match(stale.calls.replies[0].content,/no longer available/i);
    assert.equal((await one(db,"SELECT visit_state FROM user_house_states WHERE discord_user_id='u1'")).visit_state,'none');
  }finally{await closeDatabase(db);}
});

test('26 Favorites paginate as 25 options then one',async()=>{
  const {db,menu}=await fixture();
  try{
    for(let n=0;n<26;n++){
      const id=100+n,owner=`Owner${n}`;
      await db.query('INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(?,?,?,?,62)',[id,'pc_na',owner,owner.toLowerCase()]);
      await db.query("INSERT INTO saved_houses(id,eso_server,scope,origin_guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(?,'pc_na','global','g1',62,?,?,?,'active','u2','u2')",[id,owner,owner.toLowerCase(),id]);
      await db.query("INSERT INTO user_house_states(discord_user_id,target_kind,target_id,house_name,eso_owner,is_favorite) VALUES('u1','destination',?,'Grand Villa',?,1)",[id,owner]);
    }
    const first=interaction('hu:my:favorites','u1');
    await menu.button(first.value);
    const firstSelect=components(first.calls.updates[0]).find(component=>Array.isArray(component.options));
    assert.equal(firstSelect.options.length,25);
    const next=components(first.calls.updates[0]).find(component=>component.label==='Next');
    assert.ok(next);

    const second=interaction(next.custom_id,'u1');
    await menu.button(second.value);
    const secondSelect=components(second.calls.updates[0]).find(component=>Array.isArray(component.options));
    assert.equal(secondSelect.options.length,1);
  }finally{await closeDatabase(db);}
});
