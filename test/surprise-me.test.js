import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { HouseDiscoveryService } from '../src/services/house-discovery-service.js';
import { createHousingMenu } from '../src/ui/housing-menu.js';
import { houseTarget, houseTargetKey } from '../src/utils/house-target.js';

const flat=payload=>(payload?.components||[]).flatMap(row=>(row.toJSON?.()||row).components||[]);
const labels=payload=>flat(payload).map(component=>component.label).filter(Boolean);
function interaction(customId,userId='u1'){
  const calls={updates:[],replies:[]};
  return {calls,value:{customId,guildId:'g1',channelId:'c1',guild:{id:'g1',name:'Guild'},user:{id:userId,username:userId,globalName:userId},member:{displayName:userId,roles:{cache:new Map()}},update:p=>(calls.updates.push(p),Promise.resolve(p)),reply:p=>(calls.replies.push(p),Promise.resolve(p))}};
}

test('discovery selection stays in the supplied pool and avoids an immediate repeat',()=>{
  const a={id:1,scope:'official',house_id:1},b={id:2,scope:'official',house_id:2};
  const discovery=new HouseDiscoveryService({randomInt:max=>max-1});
  assert.equal(discovery.choose([a,b],{previousTargetKey:houseTargetKey(houseTarget(a))}).id,b.id);
  assert.equal(discovery.choose([a],{previousTargetKey:houseTargetKey(houseTarget(a))}).id,a.id);
  assert.equal(discovery.choose([]),null);
  assert.ok([a,b].includes(discovery.choose([a,b])));
});

test('Random House uses all accessible registered houses and avoids the prior destination',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-surprise-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'surprise.sqlite')});
  try{
    await migrate(db);await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Villa','grand villa')");
    for(let n=0;n<26;n++){
      const id=n+1,owner=`Owner${String(n).padStart(2,'0')}`;
      await db.query('INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(?,?,?,?,62)',[id,'pc_na',owner,owner.toLowerCase()]);
      await db.query("INSERT INTO saved_houses(id,eso_server,scope,origin_guild_id,house_id,eso_owner,normalized_owner,display_name,destination_id,status,created_by,updated_by) VALUES(?,'pc_na','global','g1',62,?,?,?,?,'active','u2','u2')",[id,owner,owner.toLowerCase(),owner,id]);
    }
    const menu=createHousingMenu(db,{discovery:new HouseDiscoveryService({randomInt:max=>max-1})});
    const picked=interaction('hu:random');await menu.button(picked.value);
    assert.match(picked.calls.updates[0].embeds[0].toJSON().title,/Owner25/);
    const another=flat(picked.calls.updates[0]).find(component=>component.label==='Another Random House');assert.ok(another);
    const repeated=interaction(another.custom_id);await menu.button(repeated.value);
    assert.doesNotMatch(repeated.calls.updates[0].embeds[0].toJSON().title,/Owner25/);
    const foreign=interaction(another.custom_id,'u3');await menu.button(foreign.value);
    assert.match(foreign.calls.replies[0].content,/another user|expired/i);
  }finally{await closeDatabase(db);}
});

test('older random-result callbacks skip houses made Private after their list loaded',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-surprise-stale-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'surprise.sqlite')});
  try{
    await migrate(db);await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Villa','villa')");
    for(let id=1;id<=2;id++){
      const owner=`Owner${id}`;
      await db.query('INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(?,?,?,?,62)',[id,'pc_na',owner,owner.toLowerCase()]);
      await db.query("INSERT INTO saved_houses(id,eso_server,scope,origin_guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(?,'pc_na','global','g1',62,?,?,?,'active','u2','u2')",[id,owner,owner.toLowerCase(),id]);
    }
    const menu=createHousingMenu(db,{discovery:new HouseDiscoveryService({randomInt:max=>max-1})});
    const opened=interaction('hu:find');await menu.button(opened.value);
    const stateId=flat(opened.calls.updates[0]).find(component=>component.label==='Create New Tour From Results').custom_id.split(':')[3];
    const surprise={custom_id:`hu:surprise:from:${stateId}`};
    await db.query("UPDATE saved_houses SET scope='private',owner_user_id='u2' WHERE id=2");
    const picked=interaction(surprise.custom_id);await menu.button(picked.value);
    assert.match(JSON.stringify(picked.calls.updates[0].embeds[0].toJSON()),/Owner1/);
    const another=flat(picked.calls.updates[0]).find(component=>component.label==='Another Random House');
    const repeated=interaction(another.custom_id);await menu.button(repeated.value);
    assert.match(JSON.stringify(repeated.calls.updates[0].embeds[0].toJSON()),/Owner1/);
    await db.query("UPDATE saved_houses SET scope='private',owner_user_id='u2' WHERE id=1");
    const empty=interaction(another.custom_id);await menu.button(empty.value);
    assert.match(empty.calls.updates[0].content,/No accessible registered houses/);
  }finally{await closeDatabase(db);}
});

test('empty search results retain Filters and Clear Filters',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-surprise-empty-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'empty.sqlite')});
  try{
    await migrate(db);await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'Only House','only house')");
    const menu=createHousingMenu(db);
    const opened=interaction('hu:find');await menu.button(opened.value);
    const filters=flat(opened.calls.updates[0]).find(component=>component.label==='Filters');
    const click=interaction(filters.custom_id);click.value.showModal=payload=>{click.calls.modal=payload;return Promise.resolve(payload);};await menu.button(click.value);
    const modalId=click.calls.modal.toJSON().custom_id;
    const submitted=interaction(modalId);submitted.value.isFromMessage=()=>true;submitted.value.fields={getTextInputValue:key=>key==='name'?'impossible':'',getStringSelectValues:key=>key==='visibilities'?['global','public','private']:key==='nonplayer'?['exclude']:[]};
    await menu.modal(submitted.value);
    const response=submitted.calls.updates[0]||submitted.calls.replies[0];
    assert.ok(labels(response).includes('Filters'));
    assert.ok(labels(response).includes('Clear Filters'));
  }finally{await closeDatabase(db);}
});
