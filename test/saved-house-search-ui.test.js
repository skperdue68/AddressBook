import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import { SavedHouseSearchService } from '../src/services/saved-house-search-service.js';
import { createHousingMenu } from '../src/ui/housing-menu.js';
import * as ui from '../src/ui/housing-ui.js';

const flat=payload=>(payload?.components||[]).flatMap(row=>(row.toJSON?.()||row).components||[]);
const labels=payload=>flat(payload).map(component=>component.label).filter(Boolean);

function interaction(customId,{userId='u1',guildId='g1',fields={},values=[]}={}){
  const calls={updates:[],replies:[],modals:[]};
  const fieldApi={
    getTextInputValue:key=>fields[key]??'',
    getStringSelectValues:key=>fields[key]??[]
  };
  return {calls,value:{
    customId,guildId,channelId:'c1',guild:{id:guildId,name:`Guild ${guildId}`},values,fields:fieldApi,
    user:{id:userId,username:`User ${userId}`,globalName:`Global ${userId}`},
    member:{displayName:`Display ${userId}`,roles:{cache:new Map()}},
    isFromMessage:()=>true,
    update(payload){calls.updates.push(payload);return Promise.resolve(payload);},
    reply(payload){calls.replies.push(payload);return Promise.resolve(payload);},
    showModal(payload){calls.modals.push(payload);return Promise.resolve(payload);}
  }};
}

async function fixture(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-saved-search-ui-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'ui.sqlite')});
  await migrate(db);
  await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na'),('g2','pc_eu')");
  await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Villa','grand villa')");
  const destinations=[[1,'pc_na','North Match'],[2,'pc_na','Other North'],[3,'pc_eu','Europe Match']];
  for(const [id,server,owner] of destinations){
    await db.query('INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(?,?,?,?,62)',[id,server,owner,owner.toLowerCase()]);
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,origin_guild_id,house_id,eso_owner,normalized_owner,display_name,destination_id,status,created_by,updated_by) VALUES(?,?,\'global\',?,62,?,?,?,?,\'active\',\'u2\',\'u2\')",[id,server,id===3?'g2':'g1',owner,owner.toLowerCase(),owner,id]);
  }
  return {db,menu:createHousingMenu(db),service:new SavedHouseSearchService(db)};
}

test('saved-search payloads expose bounded professional controls',()=>{
  assert.equal(ui.savedSearchNameModal('token',{name:'Castles'}).toJSON().custom_id,'hu:modal:savedsearch:create:token');
  assert.deepEqual(labels(ui.savedSearchConflictPayload({token:'token',name:'Castles'})),['Replace Existing','Cancel']);
  assert.deepEqual(labels(ui.savedSearchDetailPayload({row:{id:7,name:'Castles'},filters:{styles:['Breton']},hasCurrentSearch:true})),['Run Search','Rename','Replace Filters with Current Search','Delete','Back']);
  assert.deepEqual(labels(ui.savedSearchDeleteConfirmPayload({id:7,name:'Castles'})),['Delete','Cancel']);
});

test('filtered results can be saved while the initial all-houses view cannot',async()=>{
  const {db,menu}=await fixture();
  try{
    const opened=interaction('hu:find');await menu.button(opened.value);
    assert.equal(labels(opened.calls.updates[0]).includes('Save Search'),false);
    const filters=flat(opened.calls.updates[0]).find(c=>c.label==='Filters');
    const modal=interaction(filters.custom_id.replace('hu:advanced:','hu:modal:advanced:'),{fields:{name:'',owner:'match',visibilities:['global','public','private'],nonplayer:['exclude'],attribute:[]}});
    await menu.modal(modal.value);
    const save=flat(modal.calls.updates[0]).find(c=>c.label==='Save Search');assert.ok(save);
    const saveButton=interaction(save.custom_id);await menu.button(saveButton.value);
    assert.equal(saveButton.calls.modals[0].toJSON().title,'Save House Search');
    const submit=interaction(saveButton.calls.modals[0].toJSON().custom_id,{fields:{name:'Matches'}});
    await menu.modal(submit.value);
    const row=await one(db,"SELECT * FROM saved_house_searches WHERE discord_user_id='u1'");
    assert.equal(row.name,'Matches');
    assert.match(submit.calls.updates[0].content,/saved/i);
    assert.ok(labels(submit.calls.updates[0]).includes('Save Search'));
  }finally{await closeDatabase(db);}
});

test('duplicate-name cancellation preserves the original saved filters',async()=>{
  const {db,menu,service}=await fixture();
  try{
    const created=await service.save({userId:'u1',name:'Matches',filters:{name:'original'}});
    const opened=interaction('hu:find');await menu.button(opened.value);
    const filters=flat(opened.calls.updates[0]).find(c=>c.label==='Filters');
    const filtered=interaction(filters.custom_id.replace('hu:advanced:','hu:modal:advanced:'),{fields:{name:'grand',owner:'',visibilities:['global','public','private'],nonplayer:['exclude'],attribute:[]}});await menu.modal(filtered.value);
    const save=flat(filtered.calls.updates[0]).find(c=>c.label==='Save Search');
    const begin=interaction(save.custom_id);await menu.button(begin.value);
    const submit=interaction(begin.calls.modals[0].toJSON().custom_id,{fields:{name:' matches '}});await menu.modal(submit.value);
    assert.deepEqual(labels(submit.calls.updates[0]),['Replace Existing','Cancel']);
    const cancelId=flat(submit.calls.updates[0]).find(c=>c.label==='Cancel').custom_id;
    const cancel=interaction(cancelId);await menu.button(cancel.value);
    assert.deepEqual(service.filters(await service.getOwned(created.search.id,'u1')),{name:'original'});
    assert.ok(labels(cancel.calls.updates[0]).includes('Save Search'));
  }finally{await closeDatabase(db);}
});

test('saved-search management paginates and rejects another user',async()=>{
  const {db,menu,service}=await fixture();
  try{
    let first;
    for(let n=0;n<26;n++){const result=await service.save({userId:'u1',name:`Search ${String(n).padStart(2,'0')}`,filters:{name:`house ${n}`}});if(n===0)first=result.search;}
    const page1=interaction('hu:my:searches');await menu.button(page1.value);
    const select1=flat(page1.calls.updates[0]).find(c=>Array.isArray(c.options));assert.equal(select1.options.length,25);
    const next=flat(page1.calls.updates[0]).find(c=>c.label==='Next');assert.ok(next);
    const page2=interaction(next.custom_id);await menu.button(page2.value);
    const select2=flat(page2.calls.updates[0]).find(c=>Array.isArray(c.options));assert.equal(select2.options.length,1);
    const foreign=interaction(`hu:savedsearch:detail:${first.id}`,{userId:'u3'});await menu.button(foreign.value);
    assert.match(foreign.calls.replies[0].content,/another user|no longer available/i);
  }finally{await closeDatabase(db);}
});

test('running a saved search re-evaluates the current guild environment',async()=>{
  const {db,menu,service}=await fixture();
  try{
    const saved=await service.save({userId:'u1',name:'Matches',filters:{owner:'match'}});
    const run=interaction(`hu:savedsearch:run:${saved.search.id}`,{guildId:'g2'});await menu.button(run.value);
    const options=flat(run.calls.updates[0]).find(c=>Array.isArray(c.options)).options;
    assert.equal(options.length,1);
    assert.match(options[0].label,/Europe Match/);
    assert.doesNotMatch(options[0].label,/North Match/);
  }finally{await closeDatabase(db);}
});
