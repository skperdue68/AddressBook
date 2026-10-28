import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase,one} from '../src/db/database.js';

test('tour house candidates include more than 25 records with filter metadata and retain privacy boundaries',async()=>{
 const {db,svc,c}=await fixture();try{
  for(let n=0;n<30;n++)await svc.registerHouse(c,{visibility:'private',houseId:1,esoOwner:`@Member${n}`,displayName:`House ${n}`,tags:['halloween','games']});
  const owner=await svc.authorizeContext({...c,userId:'1'});
  await svc.registerHouse(owner,{visibility:'private',houseId:2,esoOwner:'@Secret',displayName:'Other private'});
  await svc.registerHouse(owner,{houseId:2,esoOwner:'@Shared',visibility:'global'});
  await db.query("INSERT INTO guild_settings(guild_id,eso_server,staff_role_ids) VALUES('other','pc_na','[]')");
  const other=await svc.authorizeContext({...owner,guildId:'other'});await svc.registerHouse(other,{houseId:1,esoOwner:'@Foreign',visibility:'public'});
  const rows=await svc.tourHouseCandidates(c);assert.equal(rows.length,31);assert.ok(rows.some(h=>h.display_name==='House 29'));assert.ok(rows.some(h=>JSON.parse(h.tags||'[]').includes('halloween')));assert.ok(rows.every(h=>h.zone==='Zone'));assert.ok(!rows.some(h=>['@Secret','@Foreign'].includes('@'+h.eso_owner)));
  assert.equal((await svc.listHouses(c)).rows.length,25,'ordinary search remains paginated');
 }finally{await closeDatabase(db);}
});

test('add-to-tour choices include eligible administrator-managed tours while protecting Private ownership',async()=>{
 const {db,svc,c}=await fixture();try{
  const admin=await svc.authorizeContext({...c,userId:'1'}),house=await svc.registerHouse(admin,{houseId:1,esoOwner:'@Shared',visibility:'global'});
  const shared=await svc.saveTourDraft(c,{details:{name:'Member shared route',visibility:'public'},stopIds:[]});
  await svc.saveTourDraft(c,{details:{name:'Hidden private route',visibility:'private'},stopIds:[]});
  assert.deepEqual((await svc.houseTourChoices(admin,house.id)).map(t=>t.id),[shared.id]);
  await svc.addHouseToTour(admin,house.id,shared.id);
  assert.deepEqual(await svc.houseTourChoices(admin,house.id),[]);
  const ownPrivate=await svc.registerHouse(c,{visibility:'private',houseId:2,esoOwner:'@Private'});
  assert.deepEqual((await svc.houseTourChoices(c,ownPrivate.id)).map(t=>t.name),['Hidden private route']);
  await assert.rejects(()=>svc.houseTourChoices(admin,ownPrivate.id),/not available/);
 }finally{await closeDatabase(db);}
});

test('visibility impact includes incompatible source server and Private creator',async()=>{
 const {db,svc,c}=await fixture();try{
  const owner=await svc.authorizeContext({...c,userId:'1'}),h=await svc.registerHouse(owner,{houseId:1,esoOwner:'@Shared',visibility:'global'});
  const own=await svc.saveTourDraft(c,{details:{name:'Member route',visibility:'private'},stopIds:[h.id]});
  const preview=await svc.actions.scopePreview(owner,h.id,'private');assert.equal(preview.impact.stops,1);
  await svc.actions.changeScope(owner,h.id,'private',preview.version);assert.equal(Number((await one(db,'SELECT count(*) n FROM tour_stops WHERE tour_id=?',[own.id])).n),0);
  const shared=await svc.registerHouse(owner,{houseId:2,esoOwner:'@Global',visibility:'global'});
  const route=await svc.saveTourDraft(c,{details:{name:'Server route',visibility:'public'},stopIds:[shared.id]});
  await db.query("INSERT INTO guild_settings(guild_id,eso_server,staff_role_ids) VALUES('b','pc_na','[]')");
  const other=await svc.authorizeContext({...owner,guildId:'b'}),impact=await svc.actions.scopePreview(other,shared.id,'public');assert.equal(impact.impact.stops,1);
  await svc.actions.changeScope(other,shared.id,'public',impact.version);assert.equal(Number((await one(db,'SELECT count(*) n FROM tour_stops WHERE tour_id=?',[route.id])).n),0);
 }finally{await closeDatabase(db);}
});

test('web deletion protects other creators Private records and requires a current impact confirmation',async()=>{
 const {db,svc,c}=await fixture();try{
  const h=await svc.registerHouse(c,{houseId:1,esoOwner:'@Owner',visibility:'private'});
  const t=await svc.saveTourDraft(c,{details:{name:'Route',visibility:'private'},stopIds:[h.id]});
  const owner=await svc.authorizeContext({...c,userId:'1'});
  await assert.rejects(()=>svc.actions.deletePreview(owner,'house',h.id),/not available/);
  await assert.rejects(()=>svc.actions.deletePreview(owner,'tour',t.id),/not available/);
  const preview=await svc.actions.deletePreview(c,'house',h.id);assert.equal(preview.impact.stops,1);
  await svc.updateHouse(c,h.id,{displayName:'Changed'});
  await assert.rejects(()=>svc.actions.deleteConfirmed(c,'house',h.id,preview.version),/changed/);
  const fresh=await svc.actions.deletePreview(c,'house',h.id);
  await svc.actions.deleteConfirmed(c,'house',h.id,fresh.version);
  assert.equal(await svc.saved.get(h.id),null);assert.equal((await svc.getTourDraft(c,t.id)).stops.length,0);
  const tour=await svc.actions.deletePreview(c,'tour',t.id);await svc.actions.deleteConfirmed(c,'tour',t.id,tour.version);
  assert.equal(await svc.tours.get(t.id),null);
 }finally{await closeDatabase(db);}
});

test('web player advances one intended stop, supports back and completion without a Discord session',async()=>{
 const {db,svc,c}=await fixture();try{
  const a=await svc.registerHouse(c,{visibility:'private',houseId:1,esoOwner:'@A'}),b=await svc.registerHouse(c,{visibility:'private',houseId:2,esoOwner:'@B'});
  const t=await svc.saveTourDraft(c,{details:{name:'Walk',visibility:'private'},stopIds:[a.id,b.id]});
  await svc.startTour(c,t.id);let view=await svc.actions.player(c,t.id);assert.equal(view.current.saved_house_id,a.id);
  await svc.actions.playAction(c,t.id,'next',view.progress.current_stop_id);
  await assert.rejects(()=>svc.actions.playAction(c,t.id,'next',view.progress.current_stop_id),/changed|already/);
  view=await svc.actions.player(c,t.id);assert.equal(view.current.saved_house_id,b.id);
  await svc.actions.playAction(c,t.id,'back',view.progress.current_stop_id);
  view=await svc.actions.player(c,t.id);assert.equal(view.current.saved_house_id,a.id);
  await svc.actions.playAction(c,t.id,'next',view.progress.current_stop_id);
  view=await svc.actions.player(c,t.id);await svc.actions.playAction(c,t.id,'next',view.progress.current_stop_id);
  assert.equal((await svc.actions.player(c,t.id)).progress.status,'completed');
  assert.equal(Number((await one(db,'SELECT count(*) c FROM tour_sessions')).c),0);
 }finally{await closeDatabase(db);}
});

test('personal states, comments and saved searches reuse ownership boundaries',async()=>{
 const {db,svc,c}=await fixture();try{
  const h=await svc.registerHouse(c,{visibility:'private',houseId:1,esoOwner:'@Owner'});
  await svc.actions.houseAction(c,h.id,'favorite',{value:'1'});
  await svc.actions.houseAction(c,h.id,'visit',{value:'want_to_visit'});
  assert.equal((await svc.actions.personal(c,'favorites')).length,1);
  await svc.actions.houseAction(c,h.id,'comment',{text:'A lovely room'});
  assert.equal((await svc.actions.houseExtras(c,h.id)).comments[0].comment_text,'A lovely room');
  const other=await svc.authorizeContext({...c,userId:'other'});
  await assert.rejects(()=>svc.actions.houseAction(other,h.id,'comment',{text:'No'}),/not available/);
  const saved=await svc.actions.saveSearch(c,{name:'Rooms',filters:{name:'House'}});
  assert.equal(saved.status,'created');
  await assert.rejects(()=>svc.actions.runSearch(other,saved.search.id),/not available/);
  assert.equal((await svc.actions.runSearch(c,saved.search.id)).rows.length,1);
 }finally{await closeDatabase(db);}
});

test('web deletion follows Server and Global scope independently and never grants Private access',async()=>{
 const {db,svc,c}=await fixture();try{
  await db.query("INSERT INTO guild_settings(guild_id,eso_server,staff_role_ids) VALUES('g2','pc_na','[\"staff\"]')");
  await db.query("INSERT INTO global_moderators(discord_user_id,eso_server,approved_by) VALUES('ga','pc_na','1')");
  const owner=await svc.authorizeContext({...c,userId:'1'}),staff=await svc.authorizeContext({...c,userId:'staff',memberRoleIds:['staff']}),global=await svc.authorizeContext({...c,userId:'ga'}),foreign=await svc.authorizeContext({...c,guildId:'g2',userId:'1'});
  const publicHouse=await svc.registerHouse(owner,{houseId:1,esoOwner:'@Public',visibility:'public'}),globalHouse=await svc.registerHouse(owner,{houseId:1,esoOwner:'@Global',visibility:'global'}),privateHouse=await svc.registerHouse(owner,{visibility:'private',houseId:2,esoOwner:'@Private'}),foreignHouse=await svc.registerHouse(foreign,{houseId:2,esoOwner:'@Foreign',visibility:'public'});
  const publicTour=await svc.saveTourDraft(owner,{details:{name:'Server',visibility:'public'},stopIds:[publicHouse.id]}),globalTour=await svc.saveTourDraft(owner,{details:{name:'Global',visibility:'global'},stopIds:[globalHouse.id]}),privateTour=await svc.saveTourDraft(owner,{details:{name:'Private',visibility:'private'},stopIds:[privateHouse.id]}),foreignTour=await svc.saveTourDraft(foreign,{details:{name:'Foreign',visibility:'public'},stopIds:[foreignHouse.id]});
  assert.ok(await svc.actions.deletePreview(staff,'house',publicHouse.id));
  await assert.rejects(()=>svc.actions.deletePreview(global,'house',publicHouse.id),/not available/);
  assert.ok(await svc.actions.deletePreview(global,'house',globalHouse.id));
  assert.ok(await svc.actions.deletePreview(global,'tour',publicTour.id));
  assert.ok(await svc.actions.deletePreview(global,'tour',globalTour.id));
  assert.ok(await svc.actions.deletePreview(global,'tour',foreignTour.id));
  for(const actor of [staff,global]){await assert.rejects(()=>svc.actions.deletePreview(actor,'house',privateHouse.id),/not available/);await assert.rejects(()=>svc.actions.deletePreview(actor,'tour',privateTour.id),/not available/);}
  await assert.rejects(()=>svc.actions.deletePreview(staff,'tour',globalTour.id),/not available/);
  await assert.rejects(()=>svc.actions.deletePreview(staff,'tour',foreignTour.id),/not available/);
 }finally{await closeDatabase(db);}
});
