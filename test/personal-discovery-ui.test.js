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
  assert.deepEqual(labels(payload),['Remove Favorite','Return to House']);
  assert.match(payload.embeds[0].toJSON().description,/Only you/i);
});

test('saved and Non-Player cards expose Personal Actions without crowding component rows',()=>{
  const saved=ui.destinationMenuPayload({id:1,scope:'global',destination_id:44,house_id:62,eso_owner:'Owner',house_name:'Villa',display_name:'Villa',associated_tours:[]});
  const official=ui.officialHousePayload({house_id:62,name:'Villa'});
  assert.ok(labels(saved).includes('Favorite'));
  assert.ok(!labels(saved).includes('Want to Visit'));
  assert.ok(!labels(saved).includes('Visited'));
  assert.ok(labels(official).includes('Favorite'));
  const editable=ui.destinationMenuPayload({id:1,scope:'personal',house_id:62,eso_owner:'Owner',house_name:'Villa'},{canEdit:true,navigation:{stateId:'abc123',index:1,total:3},surpriseToken:'random'});
  for(const payload of [saved,official,editable]){assert.ok(payload.components.length<=5);for(const row of payload.components){assert.ok(row.toJSON().components.length<=5);for(const c of row.toJSON().components)assert.ok((c.custom_id||'').length<=100);}}
});

test('My Address Book exposes personal discovery sections and their counts',()=>{
  const payload=ui.myAddressBookPayload({favorites:3,wantToVisit:2,visited:7,savedSearches:4});
  assert.ok(labels(payload).includes('Favorites'));
  assert.ok(!labels(payload).includes('Want to Visit'));
  assert.ok(!labels(payload).includes('Visited'));
  assert.ok(labels(payload).includes('Saved Searches'));
  const embed=JSON.stringify(payload.embeds[0].toJSON());
  for(const count of ['3','4'])assert.match(embed,new RegExp(`\\*\\*${count}\\*\\*`));
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

    const visited=components(own.calls.updates[0]).find(component=>component.label==='Remove Favorite');
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
    const jump=components(second.calls.updates[0]).find(c=>c.label==='Jump to Page');assert.ok(jump);
    const opened=interaction(jump.custom_id);opened.value.showModal=async p=>opened.calls.modal=p;await menu.button(opened.value);
    assert.ok(opened.calls.modal);const modalId=opened.calls.modal.toJSON().custom_id;
    const bad=interaction(modalId);bad.value.fields={getTextInputValue:()=> '3'};await menu.modal(bad.value);assert.match(bad.calls.replies[0].content,/1.*2/);
    const foreign=interaction(modalId,'u3');foreign.value.fields={getTextInputValue:()=> '1'};await menu.modal(foreign.value);assert.match(foreign.calls.replies[0].content,/another user/);
    const other=interaction(modalId);other.value.guildId='g2';other.value.fields={getTextInputValue:()=> '1'};await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g2','pc_na')");await menu.modal(other.value);assert.match(other.calls.replies[0].content,/another server|environment/);
    const valid=interaction(modalId);valid.value.fields={getTextInputValue:()=> '1'};valid.value.isFromMessage=()=>true;await menu.modal(valid.value);assert.equal(components(valid.calls.updates[0]).find(c=>c.options).options.length,25);
    assert.match(valid.calls.updates[0].embeds[0].toJSON().description,/Page 1 of 2/);
  }finally{await closeDatabase(db);}
});

test('support retains access and removes training links',()=>{
 const payload=ui.helpPayload({requestableKinds:['server','global']});
 assert.ok(labels(payload).includes('Request Elevated Access'));
 assert.ok(!components(payload).some(c=>/learning|onboarding/.test(c.custom_id||'')));
 assert.match(payload.embeds[0].toJSON().title,/Support/);
});

test('direct card toggles restore unmarked state in the same message and reject stale context',async()=>{
 const {db,menu}=await fixture();
 try{
 const opened=interaction('hu:context:view:global:1:hu%3Amy');await menu.button(opened.value);
 let payload=opened.calls.updates[0];const original=components(payload).filter(c=>!c.custom_id?.startsWith('hu:mark:'));
 for(const label of ['Favorite','Unfavorite']){
 const button=components(payload).find(c=>c.label===label);assert.ok(button,label);
 const click=interaction(button.custom_id);click.value.message={components:payload.components};await menu.button(click.value);
 payload={...payload,...click.calls.updates[0]};
 assert.deepEqual(components(payload).filter(c=>!c.custom_id?.startsWith('hu:mark:')),original);
 }
 assert.equal(Number((await one(db,'SELECT count(*) c FROM user_house_states')).c),0);
 const button=components(payload).find(c=>c.label==='Favorite');
 const foreign=interaction(button.custom_id,'u3');await menu.button(foreign.value);assert.match(foreign.calls.replies[0].content,/another user/);
 const otherGuild=interaction(button.custom_id);otherGuild.value.guildId='g2';await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g2','pc_na')");await menu.button(otherGuild.value);assert.match(otherGuild.calls.replies[0].content,/another ESO environment/);
 const now=Date.now;try{Date.now=()=>now()+31*60*1000;const expired=interaction(button.custom_id);await menu.button(expired.value);assert.match(expired.calls.replies[0].content,/expired/);}finally{Date.now=now;}
 await db.query("UPDATE saved_houses SET status='archived' WHERE id=1");const stale=interaction(button.custom_id);await menu.button(stale.value);assert.match(stale.calls.replies[0].content,/no longer available/);
 assert.equal(Number((await one(db,'SELECT count(*) c FROM user_house_states')).c),0);
 }finally{await closeDatabase(db);}
});

test('address book library includes intentional marks and user entries but excludes merely viewed homes',async()=>{
 const {db,menu}=await fixture();try{
 await db.query("INSERT INTO recent_house_views(discord_user_id,saved_house_id) VALUES('u1',1)");
 const empty=interaction('hu:my:library');await menu.button(empty.value);assert.match(empty.calls.updates[0].content,/address book is empty/i);
 await db.query("INSERT INTO user_house_states(discord_user_id,target_kind,target_id,is_favorite) VALUES('u1','destination',44,1)");
 const saved=interaction('hu:my:library');await menu.button(saved.value);assert.equal(components(saved.calls.updates[0]).find(c=>c.options)?.options.length,1);
 }finally{await closeDatabase(db);}
});

test('first use opens Home after environment setup without training choices',async()=>{
 const {db,menu}=await fixture();try{const first=interaction('');await menu.chat(first.value);assert.equal(first.calls.replies[0].embeds[0].toJSON().title,'🏠 HearthBound');assert.ok(!components(first.calls.replies[0]).some(c=>/onboarding|learning/.test(c.custom_id||'')));}finally{await closeDatabase(db);}
});

test('generic picker only offers page jump for multiple pages and fits navigation in one row',()=>{
 for(const pages of [1,40]){const payload=ui.pickerPayload({title:'Results',description:'Results',customId:'hu:picker:state1',options:[{label:'Place',value:'0'}],pages});const controls=components(payload);assert.equal(controls.some(c=>c.label==='Jump to Page'),pages>1);for(const row of payload.components){assert.ok(row.toJSON().components.length<=5);for(const c of row.toJSON().components)assert.ok((c.custom_id||'').length<=100);}}
});

test('legacy Add Comment refreshes its count while retaining house card navigation',async()=>{
 const {db,menu}=await fixture();try{const opened=interaction('hu:context:view:global:1:hu%3Amy');await menu.button(opened.value);const original=opened.calls.updates[0],ids=components(original).map(c=>c.custom_id),add={custom_id:components(original).find(c=>c.label==='Favorite').custom_id.replace('hu:mark:favorite:','hu:comment:quick:')};assert.ok(!components(original).some(c=>c.label==='Add Comment'));const click=interaction(add.custom_id);click.value.message={embeds:original.embeds,components:original.components};click.value.showModal=async p=>click.calls.modal=p;await menu.button(click.value);assert.ok(click.calls.modal);assert.equal(click.calls.updates.length,0);const submit=interaction(click.calls.modal.toJSON().custom_id);submit.value.fields={getTextInputValue:()=> 'Wonderful garden'};submit.value.isFromMessage=()=>true;await menu.modal(submit.value);assert.deepEqual(components(submit.calls.updates[0]).map(c=>c.custom_id),ids);assert.equal(submit.calls.updates[0].embeds[0].fields.find(f=>f.name.includes('Comments')).value,'1 comment');assert.equal(Number((await one(db,'SELECT count(*) c FROM house_comments')).c),1);
 const stale=interaction(add.custom_id);stale.value.message={embeds:original.embeds,components:original.components};stale.value.showModal=async p=>stale.calls.modal=p;await menu.button(stale.value);await db.query("UPDATE saved_houses SET scope='private',owner_user_id='other' WHERE id=1");const blocked=interaction(stale.calls.modal.toJSON().custom_id);blocked.value.fields={getTextInputValue:()=> 'Must not post'};await menu.modal(blocked.value);assert.match(blocked.calls.replies[0].content,/no longer available/);assert.equal(Number((await one(db,'SELECT count(*) c FROM house_comments')).c),1);
 }finally{await closeDatabase(db);}
});
