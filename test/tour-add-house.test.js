import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, migrate, closeDatabase } from '../src/db/database.js';
import { createHandlers } from '../src/handlers.js';
import { TourService } from '../src/services/tour-service.js';

test('Add House resolves the eligible-house payload before updating Discord', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ab-tour-add-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'tour-add.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('guild-1','pc_na')");
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'Test House','test house')");
    await db.query("INSERT INTO saved_houses(eso_server,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES('pc_na','private',NULL,'guild-1','user-1',1,'Owner','owner','active','user-1','user-1')");
    const tour=await new TourService(db).create({esoServer:'pc_na',originGuildId:'g1',creatorId:'user-1',guildId:'guild-1',visibility:'private',sourceGuildId:'guild-1',name:'Test Tour'});
    const handlers=createHandlers(db);
    let updated;
    const interaction={
      customId:`hu:tour:add:${tour.id}`,
      guildId:'guild-1',channelId:'channel-1',user:{id:'user-1'},
      member:{roles:{cache:new Map()}},
      update(payload){
        assert.equal(typeof payload?.then,'undefined','interaction.update received an unresolved Promise');
        updated=payload;
        return Promise.resolve(payload);
      },
      reply(){throw new Error('The Add House interaction unexpectedly replied instead of updating.');}
    };
    await handlers.button(interaction);
    assert.match(updated.embeds[0].data.title,/Add House/);
    assert.equal(updated.components[0].toJSON().components[0].options[0].label,'Test House — @Owner');
  }finally{await closeDatabase(db);}
});

test('new tour creation resolves the initial Add House payload before updating Discord', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ab-tour-create-add-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'tour-create-add.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('guild-1','pc_na')");
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'Test House','test house')");
    await db.query("INSERT INTO saved_houses(eso_server,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES('pc_na','private',NULL,'guild-1','user-1',1,'Owner','owner','active','user-1','user-1')");
    const handlers=createHandlers(db);
    let visibilityPayload;
    const base={guildId:'guild-1',channelId:'channel-1',user:{id:'user-1'},member:{roles:{cache:new Map()}}};
    await handlers.modal({
      ...base,customId:'hu:modal:tour:create',isFromMessage:()=>true,
      fields:{getTextInputValue:id=>id==='name'?'New Tour':''},
      update(payload){visibilityPayload=payload;return Promise.resolve(payload);},
      reply(){throw new Error('Tour creation unexpectedly replied instead of updating.');}
    });
    const visibilityButtons=visibilityPayload.components.flatMap(row=>row.toJSON().components);
    const privateButton=visibilityButtons.find(component=>component.label==='Private Tour');
    assert.ok(privateButton,'Private Tour visibility button was not rendered.');
    let updated;
    await handlers.button({
      ...base,customId:privateButton.custom_id,
      update(payload){
        assert.equal(typeof payload?.then,'undefined','interaction.update received an unresolved Promise');
        updated=payload;
        return Promise.resolve(payload);
      },
      reply(){throw new Error('The initial Add House interaction unexpectedly replied.');}
    });
    assert.match(updated.embeds[0].data.title,/Add House/);
  }finally{await closeDatabase(db);}
});

test('tour stops reject another member’s Private house and another guild’s Server house', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ab-tour-stop-boundary-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'tour.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'Test House','test house')");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES(1,'pc_na','private','g1','other',1,'Owner','owner','active','other','other'),(2,'pc_na','private','g1','creator',1,'Owner2','owner2','active','creator','creator')");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,origin_guild_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES(3,'pc_na','public','g2','g2',1,'Owner3','owner3','active','other','other'),(4,'pc_na','public','g1','g1',1,'Owner4','owner4','active','creator','creator')");
    const tours=new TourService(db);
    const tour=await tours.create({esoServer:'pc_na',originGuildId:'g1',creatorId:'creator',sourceGuildId:'g1',visibility:'private',name:'My Route'});
    await assert.rejects(tours.addStop(tour.id,1),/private|owner/i);
    await assert.rejects(tours.addStop(tour.id,3),/guild|server/i);
    assert.equal((await tours.getStops(tour.id)).length,0);
    await tours.addStop(tour.id,2);
    await tours.addStop(tour.id,4);
    assert.equal((await tours.getStops(tour.id)).length,2);
  }finally{await closeDatabase(db);}
});

test('bulk tour creation rejects a result that became inaccessible before creating a tour', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ab-bulk-stale-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'bulk.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'Test House','test house')");
    await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(1,'pc_na','Owner','owner',1)");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,origin_guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(1,'pc_na','global','g1',1,'Owner','owner',1,'active','u2','u2')");
    const handlers=createHandlers(db);let rendered,shownModal;
    const base={guildId:'g1',channelId:'c1',guild:{name:'Guild'},user:{id:'u1',username:'Viewer'},member:{displayName:'Viewer',roles:{cache:new Map()}},update:p=>{rendered=p;},reply:p=>{rendered=p;},showModal:p=>{shownModal=p;}};
    const button=id=>handlers.button({...base,customId:id});
    const control=label=>rendered.components.flatMap(row=>row.toJSON().components).find(c=>c.label===label);
    await button('hu:find');
    await button(control('Create New Tour From Results').custom_id);
    await button(control('Use All Saved Results').custom_id);
    await button(control('Confirm Order').custom_id);
    await handlers.modal({...base,customId:shownModal.toJSON().custom_id,isFromMessage:()=>true,fields:{getTextInputValue:key=>key==='name'?'Stale Route':''}});
    await db.query("UPDATE saved_houses SET scope='private',owner_user_id='u2' WHERE id=1");
    await button(control('Private Tour').custom_id);
    assert.match(rendered.content,/results changed|search again/i);
    assert.equal((await db.query("SELECT count(*) total FROM tours WHERE name='Stale Route'"))[0].total,0);
  }finally{await closeDatabase(db);}
});

test('adding multiple stops is atomic when a later house became inaccessible', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ab-bulk-atomic-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'atomic.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'Villa','villa'),(2,'Manor','manor')");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES(1,'pc_na','private','g1','owner',1,'Owner','owner','active','owner','owner'),(2,'pc_na','private','g1','other',2,'Other','other','active','other','other')");
    const tours=new TourService(db);
    const tour=await tours.create({esoServer:'pc_na',originGuildId:'g1',creatorId:'owner',sourceGuildId:'g1',visibility:'private',name:'Route'});
    await assert.rejects(tours.addStops(tour.id,[{id:1,scope:'personal'},{id:2,scope:'personal'}]),/private|owner/i);
    assert.equal((await tours.getStops(tour.id)).length,0);
  }finally{await closeDatabase(db);}
});

test('single Add House picker rejects a house made Private by another member', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ab-single-stale-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'single.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'Villa','villa')");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,origin_guild_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES(1,'pc_na','public','g1','g1',1,'Owner','owner','active','other','other')");
    const tours=new TourService(db);
    const tour=await tours.create({esoServer:'pc_na',originGuildId:'g1',creatorId:'creator',sourceGuildId:'g1',visibility:'private',name:'Route'});
    const handlers=createHandlers(db);let payload;
    const base={guildId:'g1',channelId:'c1',guild:{name:'Guild'},user:{id:'creator'},member:{roles:{cache:new Map()}},update:p=>{payload=p;},reply:p=>{payload=p;}};
    await handlers.button({...base,customId:`hu:tour:add:${tour.id}`});
    const picker=payload.components[0].toJSON().components[0].custom_id;
    await db.query("UPDATE saved_houses SET scope='private',guild_id=NULL,owner_user_id='other' WHERE id=1");
    await handlers.select({...base,customId:picker,values:['0']});
    assert.match(payload.content,/no longer (available|eligible)|changed/i);
    assert.equal((await tours.getStops(tour.id)).length,0);
  }finally{await closeDatabase(db);}
});

test('Start Tour picker rejects a tour made Private after the list opened', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ab-tour-picker-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'picker.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const tours=new TourService(db);
    const tour=await tours.create({esoServer:'pc_na',originGuildId:'g1',creatorId:'other',sourceGuildId:'g1',visibility:'global',name:'Former Public Tour'});
    const handlers=createHandlers(db);let payload;
    const base={guildId:'g1',channelId:'c1',guild:{name:'Guild'},user:{id:'viewer'},member:{roles:{cache:new Map()}},update:p=>{payload=p;},reply:p=>{payload=p;}};
    await handlers.button({...base,customId:'hu:tours:start'});
    const picker=payload.components[0].toJSON().components[0].custom_id;
    await db.query("UPDATE tours SET visibility='private' WHERE id=?",[tour.id]);
    await handlers.select({...base,customId:picker,values:['0']});
    assert.match(payload.content,/no longer available/i);
    assert.equal(payload.embeds?.length||0,0);
  }finally{await closeDatabase(db);}
});

test('stop management picker rechecks tour permission and stop existence', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ab-stop-picker-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'picker.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'Villa','villa')");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES(1,'pc_na','private','g1','creator',1,'Owner','owner','active','creator','creator')");
    const tours=new TourService(db),tour=await tours.create({esoServer:'pc_na',originGuildId:'g1',creatorId:'creator',sourceGuildId:'g1',visibility:'private',name:'Route'});
    await tours.addStop(tour.id,1);
    const handlers=createHandlers(db);let payload,modalShown=false;
    const base={guildId:'g1',channelId:'c1',guild:{name:'Guild'},user:{id:'creator'},member:{roles:{cache:new Map()}},update:p=>{payload=p;},reply:p=>{payload=p;},showModal:()=>{modalShown=true;}};
    await handlers.button({...base,customId:`hu:tour:editstop:${tour.id}`});
    const picker=payload.components[0].toJSON().components[0].custom_id;
    await db.query("UPDATE tours SET creator_id='other' WHERE id=?",[tour.id]);
    await handlers.select({...base,customId:picker,values:['0']});
    assert.equal(modalShown,false);
    assert.match(payload.content,/cannot manage|no longer available/i);
  }finally{await closeDatabase(db);}
});
