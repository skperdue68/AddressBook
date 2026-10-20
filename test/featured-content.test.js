import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { FeaturedContentService } from '../src/services/featured-content-service.js';
import { createHandlers } from '../src/handlers.js';

async function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-featured-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'featured.sqlite') });
  await migrate(db);
  await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Villa','villa'),(63,'Manor','manor')");
  await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(1,'pc_na','Owner','owner',62),(2,'pc_na','Owner','owner',63)");
  await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(1,'pc_na','public','g1',62,'Owner','owner',1,'active','u1','u1'),(2,'pc_na','global',NULL,63,'Owner','owner',2,'active','u1','u1')");
  await db.query("INSERT INTO tours(id,eso_server,visibility,guild_id,creator_id,name,house_source) VALUES(1,'pc_na','public','g1','u1','Server Tour','public_global'),(2,'pc_na','global',NULL,'u1','Global Tour','global')");
  return { db, featured: new FeaturedContentService(db) };
}

test('moderators can feature up to five eligible houses and tours in order', async () => {
  const { db, featured } = await fixture();
  try {
    await featured.set({ guildId: 'g1', esoServer: 'pc_na', targetKind: 'house', targetId: 1, position: 1, actorId: 'mod', isModerator: true });
    await featured.set({ guildId: 'g1', esoServer: 'pc_na', targetKind: 'house', targetId: 2, position: 1, actorId: 'mod', isModerator: true });
    await featured.set({ guildId: 'g1', esoServer: 'pc_na', targetKind: 'tour', targetId: 1, position: 1, actorId: 'mod', isModerator: true });
    const rows = await featured.list({ guildId: 'g1', esoServer: 'pc_na' });
    assert.deepEqual(rows.map(row => `${row.target_kind}:${row.position}`), ['house:1', 'house:2', 'tour:1']);
  } finally { await closeDatabase(db); }
});

test('Featured reorder keeps the moved entry selected for further changes', async () => {
  const {db,featured}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    await featured.set({guildId:'g1',esoServer:'pc_na',targetKind:'house',targetId:1,actorId:'mod',isModerator:true});
    await featured.set({guildId:'g1',esoServer:'pc_na',targetKind:'house',targetId:2,actorId:'mod',isModerator:true});
    await featured.set({guildId:'g1',esoServer:'pc_na',targetKind:'tour',targetId:1,actorId:'mod',isModerator:true});
    let rendered;
    await createHandlers(db).button({customId:'hu:featured:move:house:1:2',guildId:'g1',channelId:'c1',guild:{name:'Guild'},user:{id:'mod',username:'Moderator'},member:{displayName:'Moderator',roles:{cache:{has:()=>false}}},update:payload=>{rendered=payload;},reply:payload=>{rendered=payload;}});
    const controls=rendered.components.flatMap(row=>row.toJSON().components);
    assert.ok(controls.some(c=>c.custom_id==='hu:featured:remove:house:1'));
    assert.equal(controls.find(c=>c.label==='↓').disabled,true);
    assert.equal(controls.find(c=>c.label==='↑').disabled,false);
  }finally{await closeDatabase(db);}
});

test('changing a Featured expiration retains its position', async () => {
  const {db,featured}=await fixture();
  try{
    await featured.set({guildId:'g1',esoServer:'pc_na',targetKind:'house',targetId:1,actorId:'mod',isModerator:true});
    await featured.set({guildId:'g1',esoServer:'pc_na',targetKind:'house',targetId:2,actorId:'mod',isModerator:true});
    await featured.set({guildId:'g1',esoServer:'pc_na',targetKind:'house',targetId:1,expiresAt:'2026-10-01T00:00:00.000Z',actorId:'mod',isModerator:true});
    const rows=await featured.list({guildId:'g1',esoServer:'pc_na',targetKind:'house'});
    assert.deepEqual(rows.map(row=>[Number(row.target_id),Number(row.position)]),[[1,1],[2,2]]);
    assert.ok(rows[0].expires_at);
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    let rendered;
    await createHandlers(db).modal({customId:'hu:modal:featured:expiry:house:1',guildId:'g1',channelId:'c1',guild:{name:'Guild'},user:{id:'mod',username:'Moderator'},member:{displayName:'Moderator',roles:{cache:{has:()=>false}}},fields:{getTextInputValue:()=> '0'},isFromMessage:()=>true,update:payload=>{rendered=payload;},reply:payload=>{rendered=payload;}});
    const controls=rendered.components.flatMap(row=>row.toJSON().components);
    assert.ok(controls.some(c=>c.custom_id==='hu:featured:remove:house:1'));
    assert.deepEqual((await featured.list({guildId:'g1',esoServer:'pc_na',targetKind:'house'})).map(row=>Number(row.target_id)),[1,2]);
  }finally{await closeDatabase(db);}
});

test('reordering a Featured entry retains its expiration', async () => {
  const {db,featured}=await fixture();
  try{
    const expiresAt='2026-10-05T12:00:00.000Z';
    await featured.set({guildId:'g1',esoServer:'pc_na',targetKind:'house',targetId:1,actorId:'mod',isModerator:true,expiresAt});
    await featured.set({guildId:'g1',esoServer:'pc_na',targetKind:'house',targetId:2,actorId:'mod',isModerator:true});
    await featured.reorder({guildId:'g1',esoServer:'pc_na',targetKind:'house',targetId:1,position:2,actorId:'mod',isModerator:true});
    const rows=await featured.list({guildId:'g1',esoServer:'pc_na',targetKind:'house'});
    assert.deepEqual(rows.map(row=>Number(row.target_id)),[2,1]);
    assert.equal(new Date(rows[1].expires_at).toISOString(),expiresAt);
  }finally{await closeDatabase(db);}
});

test('a Featured tour opens and returns to the Featured list through preflight', async () => {
  const {db,featured}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    await db.query('INSERT INTO tour_stops(id,tour_id,position,saved_house_id) VALUES(1,1,1,1)');
    await featured.set({guildId:'g1',esoServer:'pc_na',targetKind:'tour',targetId:1,actorId:'mod',isModerator:true});
    const handlers=createHandlers(db);let rendered;
    const run=id=>handlers.button({customId:id,guildId:'g1',channelId:'c1',guild:{name:'Guild'},user:{id:'member',username:'Member'},member:{displayName:'Member',roles:{cache:{has:()=>false}}},update:payload=>{rendered=payload;},reply:payload=>{rendered=payload;}});
    const control=label=>rendered.components.flatMap(row=>row.toJSON().components).find(c=>c.label===label);
    await run('hu:tours:featured');
    await run(control('Open Tour 1').custom_id);
    assert.match(rendered.embeds[0].toJSON().title,/Server Tour/);
    assert.equal(control('Back to Featured').custom_id,'hu:tours:featured');
    await run(control('Start a Tour').custom_id);
    assert.match(rendered.embeds[0].toJSON().title,/Preflight/);
    await run(control('Back').custom_id);
    assert.equal(control('Back to Featured').custom_id,'hu:tours:featured');
    await run(control('Back to Featured').custom_id);
    assert.match(rendered.embeds[0].toJSON().title,/Featured Housing/);
  }finally{await closeDatabase(db);}
});

test('a Featured house opens with details and returns to Featured Housing', async () => {
  const {db,featured}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    await featured.set({guildId:'g1',esoServer:'pc_na',targetKind:'house',targetId:1,actorId:'mod',isModerator:true});
    const handlers=createHandlers(db);let rendered;
    const run=id=>handlers.button({customId:id,guildId:'g1',channelId:'c1',guild:{name:'Guild'},user:{id:'member',username:'Member'},member:{displayName:'Member',roles:{cache:{has:()=>false}}},update:payload=>{rendered=payload;},reply:payload=>{rendered=payload;}});
    const control=label=>rendered.components.flatMap(row=>row.toJSON().components).find(c=>c.label===label);
    await run('hu:tours:featured');
    await run(control('Open House 1').custom_id);
    assert.match(rendered.embeds[0].toJSON().title,/Villa/);
    assert.equal(control('Back').custom_id,'hu:tours:featured');
    await run(control('More Details').custom_id);
    assert.equal(control('Back').custom_id,'hu:tours:featured');
    await run(control('Back').custom_id);
    assert.match(rendered.embeds[0].toJSON().title,/Featured Housing/);
  }finally{await closeDatabase(db);}
});

test('returning from Featured house comments retains expanded details', async () => {
  const {db,featured}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    await featured.set({guildId:'g1',esoServer:'pc_na',targetKind:'house',targetId:1,actorId:'mod',isModerator:true});
    const handlers=createHandlers(db);let rendered;
    const run=id=>handlers.button({customId:id,guildId:'g1',channelId:'c1',guild:{name:'Guild'},user:{id:'member',username:'Member'},member:{displayName:'Member',roles:{cache:{has:()=>false}}},update:payload=>{rendered=payload;},reply:payload=>{rendered=payload;}});
    const control=label=>rendered.components.flatMap(row=>row.toJSON().components).find(c=>c.label===label);
    await run('hu:tours:featured');
    await run(control('Open House 1').custom_id);
    await run(control('More Details').custom_id);
    assert.ok(control('Hide Details'));
    await run(control('Comments').custom_id);
    await run(control('Back').custom_id);
    assert.ok(control('Hide Details'));
    assert.equal(control('Back').custom_id,'hu:tours:featured');
  }finally{await closeDatabase(db);}
});

test('rejects private or wrong-environment Featured targets and expires rows', async () => {
  const { db, featured } = await fixture();
  try {
    await assert.rejects(featured.set({ guildId: 'g1', esoServer: 'pc_na', targetKind: 'house', targetId: 1, actorId: 'u1' }), /moderator/i);
    await db.query("UPDATE saved_houses SET scope='private',guild_id=NULL,owner_user_id='u1' WHERE id=1");
    await assert.rejects(featured.set({ guildId: 'g1', esoServer: 'pc_na', targetKind: 'house', targetId: 1, actorId: 'mod', isModerator: true }), /private|eligible/i);
    await db.query("UPDATE saved_houses SET scope='public',guild_id='g1',owner_user_id=NULL,eso_server='pc_eu' WHERE id=1");
    await assert.rejects(featured.set({ guildId: 'g1', esoServer: 'pc_na', targetKind: 'house', targetId: 1, actorId: 'mod', isModerator: true }), /environment/i);
    await db.query("UPDATE saved_houses SET eso_server='pc_na' WHERE id=1");
    await featured.set({ guildId: 'g1', esoServer: 'pc_na', targetKind: 'house', targetId: 1, position: 1, actorId: 'mod', isModerator: true, expiresAt: '2026-09-20T00:00:00.000Z' });
    assert.equal(await featured.expireDue({ now: new Date('2026-09-21T00:00:00.000Z') }), 1);
    assert.equal((await featured.list({ guildId: 'g1', esoServer: 'pc_na' })).length, 0);
  } finally { await closeDatabase(db); }
});

test('automatically fills an empty Featured house list from eligible Public and Global houses', async () => {
  const { db, featured } = await fixture();
  try {
    const selected = await featured.autoSelectEmpty({ guildId: 'g1', esoServer: 'pc_na', actorId: 'system:auto-featured', random: () => 0 });
    assert.deepEqual(selected.map(row => row.target_id).sort((a, b) => a - b), [1, 2]);
    assert.deepEqual((await featured.list({ guildId: 'g1', esoServer: 'pc_na', targetKind: 'house' })).map(row => row.target_id).sort((a, b) => a - b), [1, 2]);
    assert.equal((await db.query("SELECT selected_by FROM featured_items WHERE guild_id='g1' AND target_kind='house' ORDER BY position"))[0].selected_by, 'system:auto-featured');
  } finally { await closeDatabase(db); }
});

test('failed automatic Featured refill rolls back every selected house', async () => {
  const { db, featured } = await fixture();
  try {
    await db.query("CREATE TRIGGER fail_second_featured BEFORE INSERT ON featured_items WHEN (SELECT count(*) FROM featured_items WHERE guild_id='g1' AND target_kind='house') >= 1 BEGIN SELECT RAISE(ABORT, 'injected refill failure'); END");
    await assert.rejects(featured.autoSelectEmpty({ guildId: 'g1', esoServer: 'pc_na', random: () => 0 }), /injected refill failure/);
    assert.equal((await db.query("SELECT count(*) c FROM featured_items WHERE guild_id='g1' AND target_kind='house'"))[0].c, 0);
  } finally { await closeDatabase(db); }
});

test('automatic Featured selection excludes base-like rows without a player owner and returns access data', async () => {
  const { db, featured } = await fixture();
  try {
    await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(3,'pc_na','','',62)");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(3,'pc_na','public','g1',62,'','',3,'active','u1','u1')");
    const selected=await featured.autoSelectEmpty({guildId:'g1',esoServer:'pc_na',random:()=>0});
    assert.deepEqual(selected.map(row=>row.target_id).sort((a,b)=>a-b),[1,2]);
    const rows=await featured.list({guildId:'g1',esoServer:'pc_na',targetKind:'house'});
    assert.ok(rows.every(row=>row.eso_owner&&row.house_id));
  } finally { await closeDatabase(db); }
});

test('automatic Featured selection excludes whitespace-only legacy owners', async () => {
  const { db, featured } = await fixture();
  try {
    await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(4,'pc_na','   ','',62)");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(4,'pc_na','public','g1',62,'   ','',4,'active','u1','u1')");
    const selected=await featured.autoSelectEmpty({guildId:'g1',esoServer:'pc_na',random:()=>0});
    assert.ok(selected.every(row=>Number(row.target_id)!==4));
  } finally { await closeDatabase(db); }
});

test('automatic filling never replaces an existing Featured house', async () => {
  const { db, featured } = await fixture();
  try {
    await featured.set({ guildId: 'g1', esoServer: 'pc_na', targetKind: 'house', targetId: 1, actorId: 'mod', isModerator: true });
    assert.deepEqual(await featured.autoSelectEmpty({ guildId: 'g1', esoServer: 'pc_na', actorId: 'system:auto-featured', random: () => 0 }), []);
    assert.deepEqual((await featured.list({ guildId: 'g1', esoServer: 'pc_na', targetKind: 'house' })).map(row => row.target_id), [1]);
  } finally { await closeDatabase(db); }
});

test('Featured entries stop displaying after their Server house or tour moves to another guild', async () => {
  const { db, featured } = await fixture();
  try {
    await featured.set({ guildId: 'g1', esoServer: 'pc_na', targetKind: 'house', targetId: 1, actorId: 'mod', isModerator: true });
    await featured.set({ guildId: 'g1', esoServer: 'pc_na', targetKind: 'tour', targetId: 1, actorId: 'mod', isModerator: true });
    await db.query("UPDATE saved_houses SET guild_id='g2' WHERE id=1");
    await db.query("UPDATE tours SET guild_id='g2' WHERE id=1");
    assert.deepEqual(await featured.list({ guildId: 'g1', esoServer: 'pc_na' }), []);
    const refill = await featured.autoSelectEmpty({ guildId: 'g1', esoServer: 'pc_na', random: () => 0 });
    assert.deepEqual(refill.map(row => row.target_id), [2]);
    assert.deepEqual((await featured.list({ guildId: 'g1', esoServer: 'pc_na' })).map(row => row.target_id), [2]);
  } finally { await closeDatabase(db); }
});

test('expired and newly Private Featured houses are replaced with eligible houses',async()=>{
  const {db,featured}=await fixture();
  try{
    await featured.set({guildId:'g1',esoServer:'pc_na',targetKind:'house',targetId:1,actorId:'mod',isModerator:true,expiresAt:'2026-01-01T00:00:00.000Z'});
    assert.deepEqual(await featured.list({guildId:'g1',esoServer:'pc_na',targetKind:'house'}),[]);
    await db.query("UPDATE saved_houses SET scope='private',guild_id=NULL,owner_user_id='u1' WHERE id=1");
    const selected=await featured.autoSelectEmpty({guildId:'g1',esoServer:'pc_na',random:()=>0});
    assert.deepEqual(selected.map(r=>Number(r.target_id)),[2]);
    assert.deepEqual((await featured.list({guildId:'g1',esoServer:'pc_na',targetKind:'house'})).map(r=>Number(r.target_id)),[2]);
  }finally{await closeDatabase(db);}
});
