import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { createHandlers } from '../src/handlers.js';
import { officialHousePayload } from '../src/ui/housing-ui.js';

test('expanded Non-Player house retains details in Previous/Next controls', () => {
  const payload=officialHousePayload({house_id:62,name:'Villa'},'hu:results:back:state:1',true,{stateId:'state',index:1,total:3});
  const controls=payload.components.flatMap(row=>row.toJSON().components);
  assert.equal(controls.find(c=>c.label==='Previous House').custom_id,'hu:house-nav:state:0:show');
  assert.equal(controls.find(c=>c.label==='Next House').custom_id,'hu:house-nav:state:2:show');
});

test('browse house details survive comments and Previous/Next navigation', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-house-list-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'list.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Villa','villa'),(63,'Manor','manor')");
    await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(1,'pc_na','Owner','owner',62),(2,'pc_na','Owner','owner',63)");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(1,'pc_na','public','g1',62,'Owner','owner',1,'active','u1','u1'),(2,'pc_na','public','g1',63,'Owner','owner',2,'active','u1','u1')");
    const handlers=createHandlers(db);let rendered;
    const interaction=(customId,values)=>({customId,values,guildId:'g1',channelId:'c1',guild:{name:'Guild'},user:{id:'u1',username:'Owner'},member:{displayName:'Owner',roles:{cache:new Map()}},update:payload=>{rendered=payload;},reply:payload=>{rendered=payload;}});
    const button=id=>handlers.button(interaction(id));
    const control=label=>rendered.components.flatMap(row=>row.toJSON().components).find(c=>c.label===label);
    await button('hu:my:houses');
    const picker=rendered.components[0].toJSON().components[0].custom_id;
    await handlers.select(interaction(picker,['0']));
    await button(control('More Details').custom_id);
    await button(control('Comments').custom_id);
    await button(control('Back').custom_id);
    assert.ok(control('Hide Details'));
    assert.ok(control('Next House'));
    await button(control('Next House').custom_id);
    assert.ok(control('Hide Details'));
    assert.ok(control('Previous House'));
    await button(control('Previous House').custom_id);
    assert.ok(control('Hide Details'));
    await button(control('Back').custom_id);
    assert.match(rendered.embeds[0].toJSON().title,/My Houses/);
  }finally{await closeDatabase(db);}
});

test('a saved browse result cannot reopen after becoming another member’s Private house', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-stale-house-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'list.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Villa','villa')");
    await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(1,'pc_na','Owner','owner',62)");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(1,'pc_na','public','g1',62,'Owner','owner',1,'active','u2','u2')");
    const handlers=createHandlers(db);let rendered;
    const interaction=(customId,values)=>({customId,values,guildId:'g1',channelId:'c1',guild:{name:'Guild'},user:{id:'u1',username:'Viewer'},member:{displayName:'Viewer',roles:{cache:new Map()}},update:payload=>{rendered=payload;},reply:payload=>{rendered=payload;}});
    await handlers.button(interaction('hu:find'));
    const picker=rendered.components.find(row=>row.toJSON().components[0].type===3).toJSON().components[0].custom_id;
    await db.query("UPDATE saved_houses SET scope='private',guild_id=NULL,owner_user_id='u2' WHERE id=1");
    await handlers.select(interaction(picker,['0']));
    assert.match(rendered.content,/no longer available/i);
    assert.equal(rendered.embeds?.length||0,0);
  }finally{await closeDatabase(db);}
});
