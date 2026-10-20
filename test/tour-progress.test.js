import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { createHandlers } from '../src/handlers.js';
import { TourProgressService } from '../src/services/tour-progress-service.js';
import { TourSessionService } from '../src/services/tour-session-service.js';
import { progressHistoryPayload, progressRunPayload } from '../src/ui/engagement-ui.js';

async function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-progress-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'progress.sqlite') });
  await migrate(db);
  await db.query("INSERT INTO houses(house_id,name,normalized_name,furnishing_limit,furnishing_limit_plus,special_furnishing_limit,special_furnishing_limit_plus,collectible_limit,collectible_limit_plus,special_collectible_limit,special_collectible_limit_plus,population_limit) VALUES(62,'Villa','villa',350,700,5,10,55,110,5,10,12),(63,'Manor','manor',350,700,5,10,55,110,5,10,24)");
  await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(1,'pc_na','Owner','owner',62),(2,'pc_na','Owner','owner',63)");
  await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(1,'pc_na','global',NULL,62,'Owner','owner',1,'active','u1','u1'),(2,'pc_na','global',NULL,63,'Owner','owner',2,'active','u1','u1')");
  await db.query("INSERT INTO tours(id,eso_server,visibility,guild_id,creator_id,name,house_source) VALUES(1,'pc_na','public','g1','u1','Server Route','global')");
  await db.query("INSERT INTO tour_stops(id,tour_id,position,saved_house_id) VALUES(1,1,1,1),(2,1,2,2)");
  return { db, progress: new TourProgressService(db) };
}

function control(payload,label){return payload.components.flatMap(row=>row.toJSON().components).find(component=>component.label===label);}
function buttonInteraction(customId,{update=()=>{},reply=payload=>payload,showModal=()=>{}}={}){
  return {
    customId,guildId:'g1',channelId:'c1',guild:{name:'Guild One'},channel:{name:'housing'},
    user:{id:'u1',username:'User One',globalName:'User One'},member:{displayName:'User One',roles:{cache:{has:()=>false}}},
    update:payload=>Promise.resolve(update(payload)),showModal:modal=>Promise.resolve(showModal(modal)),
    reply:payload=>Promise.resolve(reply(payload))
  };
}

test('active tour progress summary shows nickname, official house, then owner',()=>{
  const payload=progressRunPayload({item:{id:1,status:'active',stop_position:1,current_house_name:'Villa',current_house_nickname:'Secret Garden',current_house_owner:'Owner'}});
  assert.match(payload.embeds[0].toJSON().description,/Secret Garden \(Villa\)/);
  assert.match(payload.embeds[0].toJSON().description,/Owner: @Owner/);
});

test('completed route and its house selector show nickname and official name',async()=>{
  const {db,progress}=await fixture();
  try{
    await db.query('UPDATE saved_houses SET display_name=? WHERE id=1',['Secret Garden']);
    const run=await progress.startOrResume({userId:'u1',guildId:'g1',esoServer:'pc_na',tourId:1});
    await progress.advance({progressId:run.id,userId:'u1',guildId:'g1',esoServer:'pc_na'});
    const rows=await progress.completedStops({progressId:run.id,userId:'u1',guildId:'g1',esoServer:'pc_na'});
    const payload=progressHistoryPayload({progress:run,stops:rows});
    assert.match(payload.embeds[0].toJSON().description,/Secret Garden \(Villa\) — @Owner/);
    assert.match(JSON.stringify(payload.components.map(row=>row.toJSON())),/Secret Garden \(Villa\)/);
  }finally{await closeDatabase(db);}
});

test('Browse Tours preflight returns to the selected tour with navigation', async () => {
  const {db}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    await db.query("INSERT INTO tours(id,eso_server,visibility,guild_id,creator_id,name,house_source) VALUES(2,'pc_na','public','g1','u1','Second Route','global')");
    await db.query('INSERT INTO tour_stops(id,tour_id,position,saved_house_id) VALUES(3,2,1,1)');
    const handlers=createHandlers(db);let rendered;
    const run=id=>handlers.button(buttonInteraction(id,{update:payload=>{rendered=payload;},reply:payload=>{rendered=payload;}}));
    await run('hu:tours:browse');
    const picker=rendered.components.flatMap(row=>row.toJSON().components).find(c=>c.type===3);
    assert.ok(picker);
    await handlers.select({...buttonInteraction(picker.custom_id,{update:payload=>{rendered=payload;},reply:payload=>{rendered=payload;}}),values:['0']});
    assert.ok(control(rendered,'Next Tour'));
    await run(control(rendered,'Next Tour').custom_id);
    const selectedTitle=rendered.embeds[0].toJSON().title;
    await run(control(rendered,'Start a Tour').custom_id);
    assert.match(rendered.embeds[0].toJSON().title,/Tour Preflight/);
    await run(control(rendered,'Back').custom_id);
    assert.equal(rendered.embeds[0].toJSON().title,selectedTitle);
    assert.ok(control(rendered,'Previous Tour'));
    assert.ok(control(rendered,'Back to Tours'));
  }finally{await closeDatabase(db);}
});

test('My AddressBook reaches all active and completed tour runs', async () => {
  const { db, progress } = await fixture();
  try {
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    for(let n=2;n<=6;n++){
      await db.query("INSERT INTO tours(id,eso_server,visibility,guild_id,creator_id,name,house_source) VALUES(?,'pc_na','public','g1','u1',?,'global')",[n,`Route ${n}`]);
      await db.query('INSERT INTO tour_stops(id,tour_id,position,saved_house_id) VALUES(?,?,1,1)',[100+n,n]);
    }
    for(let n=1;n<=6;n++)await progress.startOrResume({userId:'u1',tourId:n,guildId:'g1',esoServer:'pc_na'});
    const handlers=createHandlers(db);let rendered;
    const run=customId=>handlers.button(buttonInteraction(customId,{update:payload=>{rendered=payload;},reply:payload=>{rendered=payload;}}));
    await run('hu:my:progress');
    assert.ok(control(rendered,'Next'));
    await run(control(rendered,'Next').custom_id);
    const resume=control(rendered,'Resume 6');
    assert.ok(resume);
    await run(resume.custom_id);
    assert.match(rendered.embeds[0].toJSON().title,/Stop 1 of/);
    await run(control(rendered,'More Details').custom_id);
    assert.equal(control(rendered,'Back').custom_id,'hu:my:progress:page:2');
    await run(control(rendered,'Show Tour List').custom_id);
    assert.equal(control(rendered,'Back to Current Stop').custom_id.endsWith(':expanded:2'),true);
    await run(control(rendered,'Back to Current Stop').custom_id);
    assert.equal(control(rendered,'Back').custom_id,'hu:my:progress:page:2');
    await run(control(rendered,'Back').custom_id);
    assert.ok(control(rendered,'Resume 6'));
    await db.query("INSERT INTO tours(id,eso_server,visibility,guild_id,creator_id,name,house_source) VALUES(7,'pc_na','public','g1','u1','Completed Route','global')");
    await db.query('INSERT INTO tour_stops(id,tour_id,position,saved_house_id) VALUES(107,7,1,1)');
    const finished=await progress.startOrResume({userId:'u1',tourId:7,guildId:'g1',esoServer:'pc_na'});
    await progress.advance({progressId:finished.id,userId:'u1',guildId:'g1',esoServer:'pc_na'});
    await run(control(rendered,'Completion History').custom_id);
    assert.equal(control(rendered,'Back').custom_id,'hu:my:progress:page:2');
    await run(control(rendered,'View Route 1').custom_id);
    assert.equal(control(rendered,'Back').custom_id,'hu:progress:completed:page:1:from:2');
    const housePicker=rendered.components.flatMap(row=>row.toJSON().components).find(c=>c.type===3);
    assert.ok(housePicker);
    await handlers.select({...buttonInteraction(housePicker.custom_id,{update:payload=>{rendered=payload;},reply:payload=>{rendered=payload;}}),values:['1']});
    assert.ok(rendered.components,rendered.content);
    assert.equal(control(rendered,'Back').custom_id,`hu:ph:${finished.id}:1:1:2`);
    await run(control(rendered,'Back').custom_id);
    assert.equal(control(rendered,'Back').custom_id,'hu:progress:completed:page:1:from:2');
    await run(control(rendered,'Back').custom_id);
    assert.equal(control(rendered,'Back').custom_id,'hu:my:progress:page:2');
    await run(control(rendered,'Back').custom_id);
    assert.ok(control(rendered,'Resume 6'));
    await db.query("UPDATE tour_progress SET status='completed',current_stop_id=NULL,completion_count=1,last_completed_at=CURRENT_TIMESTAMP WHERE discord_user_id='u1'");
    await run('hu:progress:completed');
    await run(control(rendered,'Next').custom_id);
    assert.ok(control(rendered,'View Route 6'));
    await run(control(rendered,'View Route 6').custom_id);
    assert.ok(rendered.embeds, rendered.content);
    assert.match(rendered.embeds[0].toJSON().title,/Completed Stops/);
    await run(control(rendered,'Back').custom_id);
    assert.ok(control(rendered,'View Route 6'));
  } finally { await closeDatabase(db); }
});

test('stale direct self-paced start cannot bypass route blockers', async () => {
  const { db, progress } = await fixture();
  try {
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(3,'pc_na','global',NULL,63,'Owner','owner',2,'active','u1','u1')");
    await db.query('UPDATE tour_stops SET saved_house_id=3 WHERE id=1');
    await assert.rejects(
      () => progress.startOrResume({ userId: 'u1', tourId: 1, guildId: 'g1', esoServer: 'pc_na' }),
      /same ESO destination more than once|duplicate/i
    );
  } finally { await closeDatabase(db); }
});

test('self paced progress does not advance into a stop made ineligible',async()=>{
  const {db,progress}=await fixture();
  try{
    const run=await progress.startOrResume({userId:'u1',tourId:1,guildId:'g1',esoServer:'pc_na'});
    await db.query("UPDATE saved_houses SET scope='private',owner_user_id='other' WHERE id=2");
    await assert.rejects(()=>progress.advance({progressId:run.id,userId:'u1',guildId:'g1',esoServer:'pc_na'}),/no longer eligible|Private|creator/i);
    const [row]=await db.query('SELECT current_stop_id FROM tour_progress WHERE id=?',[run.id]);
    assert.equal(Number(row.current_stop_id),1);
  }finally{await closeDatabase(db);}
});

test('self paced details hide a route after a stop becomes inaccessible',async()=>{
  const {db}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const handlers=createHandlers(db);let rendered;
    const run=id=>handlers.button(buttonInteraction(id,{update:p=>{rendered=p;},reply:p=>{rendered=p;}}));
    await run('hu:tour:startprivate:1');
    await db.query("UPDATE saved_houses SET scope='private',owner_user_id='other' WHERE id=2");
    await run(control(rendered,'More Details').custom_id);
    assert.match(rendered.content,/route changed|no longer eligible/i);
    assert.doesNotMatch(JSON.stringify(rendered),/Grand Psijic|Manor/);
  }finally{await closeDatabase(db);}
});

test('tour subviews return to the stop they opened from if another card advances', async () => {
  const { db } = await fixture();
  try {
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const handlers=createHandlers(db); let rendered,subview;
    const update=payload=>{rendered=payload;};
    await handlers.button(buttonInteraction('hu:tour:startprivate:1',{update}));
    await handlers.button(buttonInteraction(control(rendered,'Show Tour List').custom_id,{reply:payload=>{subview=payload;}}));
    const returnId=control(subview,'Back to Current Stop').custom_id;
    await handlers.button(buttonInteraction(control(rendered,'Next').custom_id,{update}));
    assert.match(rendered.embeds[0].toJSON().title,/Stop 2 of 2/);
    await handlers.button(buttonInteraction(returnId,{update}));
    assert.match(rendered.embeds[0].toJSON().title,/Stop 1 of 2/);
    assert.ok(control(rendered,'View Current Stop'));
  } finally { await closeDatabase(db); }
});

test('starting a self-paced tour immediately renders the complete first house card', async () => {
  const { db } = await fixture();
  try {
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const handlers=createHandlers(db); let rendered;
    await handlers.button(buttonInteraction('hu:tour:startprivate:1',{update:payload=>{rendered=payload;}}));
    const card=rendered.embeds[0].toJSON();
    assert.match(card.title,/Stop 1 of 2.*Villa.*12 Players/);
    assert.ok(card.fields.some(field=>field.name==='🔗 Jump in ESO'));
    assert.equal(control(rendered,'Open House'),undefined);
    assert.ok(control(rendered,'Previous'));
    assert.ok(control(rendered,'Next'));
    assert.equal(control(rendered,'Back').emoji.name,'↩️');
  } finally { await closeDatabase(db); }
});

test('self-paced next preserves expanded house details', async () => {
  const { db } = await fixture();
  try {
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const handlers=createHandlers(db); let rendered;
    const update=payload=>{rendered=payload;};
    await handlers.button(buttonInteraction('hu:tour:startprivate:1',{update}));
    await handlers.button(buttonInteraction(control(rendered,'More Details').custom_id,{update}));
    assert.equal(control(rendered,'Next').custom_id.endsWith(':expanded'),true);
    await handlers.button(buttonInteraction(control(rendered,'Next').custom_id,{update}));
    const card=rendered.embeds[0].toJSON();
    assert.match(card.title,/Stop 2 of 2.*Manor.*24 Players/);
    assert.equal(card.fields.find(field=>field.name==='🪑 Traditional Furnishings*').value,'350 • 700 with ESO+');
    assert.ok(control(rendered,'Hide Details'));
  } finally { await closeDatabase(db); }
});

test('editing a tour house returns to the same expanded self-paced stop', async () => {
  const { db } = await fixture();
  try {
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const handlers=createHandlers(db); let rendered,modal;
    const update=payload=>{rendered=payload;};
    await handlers.button(buttonInteraction('hu:tour:startprivate:1',{update}));
    await handlers.button(buttonInteraction(control(rendered,'More Details').custom_id,{update}));
    await handlers.button(buttonInteraction(control(rendered,'Edit House').custom_id,{showModal:value=>{modal=value;}}));
    assert.ok(modal,'Edit House did not open a modal.');
    await handlers.modal({
      ...buttonInteraction(modal.toJSON().custom_id,{update}),isFromMessage:()=>true,
      fields:{getTextInputValue:id=>({house:'62',owner:'Owner',nickname:'Updated Villa',description:'Updated during tour',tags:'updated'}[id]||'')}
    });
    const card=rendered.embeds[0].toJSON();
    assert.match(card.title,/Stop 1 of 2.*Updated Villa/);
    assert.ok(control(rendered,'Hide Details'));
    assert.equal(control(rendered,'Next').custom_id.endsWith(':expanded'),true);
  } finally { await closeDatabase(db); }
});

test('starts, resumes, advances, and completes a self-paced tour', async () => {
  const { db, progress } = await fixture();
  try {
    const first = await progress.startOrResume({ userId: 'u2', tourId: 1, guildId: 'g1', esoServer: 'pc_na' });
    assert.equal(first.status, 'active');
    assert.equal(first.current_stop_id, 1);
    assert.equal((await progress.startOrResume({ userId: 'u2', tourId: 1, guildId: 'g1', esoServer: 'pc_na' })).id, first.id);
    assert.equal((await progress.advance({ progressId: first.id, userId: 'u2' })).current_stop_id, 2);
    const completed = await progress.advance({ progressId: first.id, userId: 'u2' });
    assert.equal(completed.status, 'completed');
    assert.equal(completed.completion_count, 1);
    assert.ok(completed.last_completed_at);
  } finally { await closeDatabase(db); }
});

test('simultaneous Self Paced starts return the same run', async () => {
  const { db, progress } = await fixture();
  try {
    const input = { userId: 'u2', tourId: 1, guildId: 'g1', esoServer: 'pc_na' };
    const [first, second] = await Promise.all([progress.startOrResume(input), progress.startOrResume(input)]);
    assert.equal(first.id, second.id);
    assert.equal((await db.query("SELECT count(*) c FROM tour_progress WHERE discord_user_id='u2'"))[0].c, 1);
  } finally { await closeDatabase(db); }
});

test('a saved tour cannot be resumed from another Discord server', async () => {
  const { db } = await fixture();
  try {
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na'),('g2','pc_na')");
    const session = await new TourSessionService(db).startSelfPaced({ tourId: 1, guildId: 'g1', channelId: 'c1', userId: 'u1', esoServer: 'pc_na' });
    let response;
    await createHandlers(db).button({ ...buttonInteraction(`hu:my:resume:${session.id}`, { reply: p => { response = p; }, update: p => { response = p; } }), guildId: 'g2' });
    assert.match(response.content, /closed|unavailable|server/i);
    assert.equal(response.embeds?.length || 0, 0);
  } finally { await closeDatabase(db); }
});

test('a saved tour cannot be resumed from another channel', async () => {
  const { db } = await fixture();
  try {
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const session = await new TourSessionService(db).startSelfPaced({ tourId: 1, guildId: 'g1', channelId: 'c1', userId: 'u1', esoServer: 'pc_na' });
    let response;
    await createHandlers(db).button({ ...buttonInteraction(`hu:my:resume:${session.id}`, { reply: p => { response = p; }, update: p => { response = p; } }), channelId: 'c2' });
    assert.match(response.content, /closed|unavailable|channel/i);
    assert.equal(response.embeds?.length || 0, 0);
  } finally { await closeDatabase(db); }
});

test('a saved tour cannot be ended from another Discord server', async () => {
  const { db } = await fixture();
  try {
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na'),('g2','pc_na')");
    const session = await new TourSessionService(db).startSelfPaced({ tourId: 1, guildId: 'g1', channelId: 'c1', userId: 'u1', esoServer: 'pc_na' });
    let response;
    await createHandlers(db).button({ ...buttonInteraction(`hu:my:end:${session.id}`, { reply: p => { response = p; }, update: p => { response = p; } }), guildId: 'g2' });
    assert.match(response.content, /closed|unavailable|server/i);
    assert.ok(await new TourSessionService(db).get(session.id));
  } finally { await closeDatabase(db); }
});

test('a saved tour cannot be restarted from another channel', async () => {
  const { db } = await fixture();
  try {
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const session = await new TourSessionService(db).startSelfPaced({ tourId: 1, guildId: 'g1', channelId: 'c1', userId: 'u1', esoServer: 'pc_na' });
    await db.query('UPDATE tour_sessions SET current_position=2 WHERE id=?', [session.id]);
    let response;
    await createHandlers(db).button({ ...buttonInteraction(`hu:my:restart:${session.id}`, { reply: p => { response = p; }, update: p => { response = p; } }), channelId: 'c2' });
    assert.match(response.content, /closed|unavailable|channel/i);
    assert.equal((await new TourSessionService(db).get(session.id)).current_position, 2);
  } finally { await closeDatabase(db); }
});

test('a saved tour cannot be restarted after its first house becomes ineligible', async () => {
  const { db } = await fixture();
  try {
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const session = await new TourSessionService(db).startSelfPaced({ tourId: 1, guildId: 'g1', channelId: 'c1', userId: 'u1', esoServer: 'pc_na' });
    await db.query('UPDATE tour_sessions SET current_position=2 WHERE id=?', [session.id]);
    await db.query("UPDATE saved_houses SET scope='private',owner_user_id='u2' WHERE id=1");
    let response;
    await createHandlers(db).button(buttonInteraction(`hu:my:restart:${session.id}`, { reply: p => { response = p; }, update: p => { response = p; } }));
    assert.match(response.content, /no longer|not eligible|route|stop/i);
    assert.equal((await new TourSessionService(db).get(session.id)).current_position, 2);
  } finally { await closeDatabase(db); }
});

for (const [action, customId] of [
  ['List', id => `tour:list:${id}:compact`],
  ['Details', id => `tour:details:${id}`],
  ['Comments', id => `tour:comments:${id}:compact`],
  ['Edit', id => `tour:edit:${id}:1:compact`],
  ['Return', id => `tour:return:${id}:1:compact`]
]) {
  test(`another member cannot open a Self Paced tour's ${action} control`, async () => {
    const { db } = await fixture();
    try {
      await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
      const session = await new TourSessionService(db).startSelfPaced({ tourId: 1, guildId: 'g1', channelId: 'c1', userId: 'u1', esoServer: 'pc_na' });
      let response;
      const interaction = buttonInteraction(customId(session.id), { reply: p => { response = p; }, update: p => { response = p; }, showModal: p => { response = p; } });
      await createHandlers(db).button({ ...interaction, user: { id: 'u2', username: 'Other' }, member: { displayName: 'Other', roles: { cache: { has: () => false } } } });
      assert.match(response.content, /Self Paced|private|leader|closed/i);
      assert.equal(response.embeds?.length || 0, 0);
      assert.ok(await new TourSessionService(db).get(session.id));
    } finally { await closeDatabase(db); }
  });
}

test('another member can still view the list of a Shared tour', async () => {
  const { db } = await fixture();
  try {
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const session = await new TourSessionService(db).startShared({ tourId: 1, guildId: 'g1', channelId: 'c1', userId: 'u1', esoServer: 'pc_na' });
    let response;
    await createHandlers(db).button({ ...buttonInteraction(`tour:list:${session.id}:compact`, { reply: p => { response = p; }, update: p => { response = p; } }), user: { id: 'u2', username: 'Other' } });
    assert.match(JSON.stringify(response.embeds), /Server Route/);
  } finally { await closeDatabase(db); }
});

for (const action of ['list', 'details', 'comments', 'return', 'next', 'prev']) {
  test(`a Shared tour ${action} control closes after the tour becomes Private`, async () => {
    const { db } = await fixture();
    try {
      await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
      const session = await new TourSessionService(db).startShared({ tourId: 1, guildId: 'g1', channelId: 'c1', userId: 'u1', esoServer: 'pc_na' });
      await db.query("UPDATE tours SET visibility='private',guild_id=NULL WHERE id=1");
      const suffix = action === 'list' || action === 'comments' ? ':compact' : action === 'return' ? ':1:compact' : '';
      let response;
      await createHandlers(db).button(buttonInteraction(`tour:${action}:${session.id}${suffix}`, { reply: p => { response = p; }, update: p => { response = p; } }));
      assert.match(response.content, /closed|private|no longer available/i);
      assert.equal(response.embeds?.length || 0, 0);
      assert.equal(await new TourSessionService(db).get(session.id), null);
    } finally { await closeDatabase(db); }
  });
}

test('legacy oversized tour progress text is bounded for Discord', () => {
  const long = 'x'.repeat(5000);
  const active = progressRunPayload({ item: { id: 1, status: 'active', tour_name: long, stop_position: 1, current_house_name: long, current_house_nickname: long, current_house_owner: long, stop_notes: long } });
  assert.doesNotThrow(() => active.embeds[0].toJSON());
  assert.ok(active.embeds[0].toJSON().description.length <= 4096);
  const history = progressHistoryPayload({ progress: { id: 1, tour_name: long }, stops: [{ position: 1, saved_house_id: 1, display_name: long, house_name: long, eso_owner: long }] });
  assert.doesNotThrow(() => history.embeds[0].toJSON());
  assert.ok(history.embeds[0].toJSON().title.length <= 256);
});

test('restart clears current stops but retains completion history', async () => {
  const { db, progress } = await fixture();
  try {
    const run = await progress.startOrResume({ userId: 'u2', tourId: 1, guildId: 'g1', esoServer: 'pc_na' });
    await progress.advance({ progressId: run.id, userId: 'u2' });
    await progress.advance({ progressId: run.id, userId: 'u2' });
    const restarted = await progress.restart({ progressId: run.id, userId: 'u2' });
    assert.equal(restarted.status, 'active');
    assert.equal(restarted.current_stop_id, 1);
    assert.equal(restarted.completion_count, 1);
    assert.equal(Number((await db.query('SELECT count(*) c FROM tour_progress_stops WHERE progress_id=?', [run.id]))[0].c), 0);
  } finally { await closeDatabase(db); }
});

test('mutations recheck live tour access when request context is supplied', async () => {
  const { db, progress } = await fixture();
  try {
    const run = await progress.startOrResume({ userId: 'u2', tourId: 1, guildId: 'g1', esoServer: 'pc_na' });
    await assert.rejects(() => progress.advance({ progressId: run.id, userId: 'u2', guildId: 'g1', esoServer: 'pc_eu' }), /different ESO environment/);
    await assert.rejects(() => progress.restart({ progressId: run.id, userId: 'u2', guildId: 'g2', esoServer: 'pc_na' }), /cannot access/);
  } finally { await closeDatabase(db); }
});

test('start rejects a revoked or unrelated tour share pass', async () => {
  const { db, progress } = await fixture();
  try {
    await db.query("INSERT INTO tour_share_passes(token_hash,tour_id,created_by,status) VALUES('hash',1,'u1','revoked')");
    await assert.rejects(() => progress.startOrResume({ userId: 'u2', tourId: 1, guildId: 'g1', esoServer: 'pc_na', sharePassId: 1 }), /invalid or has been revoked/);
  } finally { await closeDatabase(db); }
});

test('progress lists hide runs that lose current tour access', async () => {
  const { db, progress } = await fixture();
  try {
    const run = await progress.startOrResume({ userId: 'u2', tourId: 1, guildId: 'g1', esoServer: 'pc_na' });
    assert.equal((await progress.listInProgress({ userId: 'u2', guildId: 'g2', esoServer: 'pc_na' })).length, 0);
    assert.equal((await progress.listInProgress({ userId: 'u2', guildId: 'g1', esoServer: 'pc_na' })).length, 1);
    assert.ok(run.id);
  } finally { await closeDatabase(db); }
});

test('completed route history hides a house made Private for another owner', async () => {
  const { db, progress } = await fixture();
  try {
    const run = await progress.startOrResume({ userId: 'u2', tourId: 1, guildId: 'g1', esoServer: 'pc_na' });
    await progress.advance({ progressId: run.id, userId: 'u2' });
    await db.query("UPDATE saved_houses SET scope='private',owner_user_id='u1' WHERE id=1");
    assert.deepEqual(await progress.completedStops({ progressId: run.id, userId: 'u2', guildId: 'g1', esoServer: 'pc_na' }), []);
  } finally { await closeDatabase(db); }
});

test('completed route history hides a house moved to another ESO environment', async () => {
  const { db, progress } = await fixture();
  try {
    const run = await progress.startOrResume({ userId: 'u2', tourId: 1, guildId: 'g1', esoServer: 'pc_na' });
    await progress.advance({ progressId: run.id, userId: 'u2' });
    await db.query("UPDATE saved_houses SET eso_server='pc_eu' WHERE id=1");
    assert.deepEqual(await progress.completedStops({ progressId: run.id, userId: 'u2', guildId: 'g1', esoServer: 'pc_na' }), []);
  } finally { await closeDatabase(db); }
});

test('reconcile repairs a deleted current stop or completes an exhausted run', async () => {
  const { db, progress } = await fixture();
  try {
    const run = await progress.startOrResume({ userId: 'u2', tourId: 1, guildId: 'g1', esoServer: 'pc_na' });
    await db.query('DELETE FROM tour_stops WHERE id=1');
    const repaired = await progress.reconcile({ progressId: run.id, userId: 'u2', guildId: 'g1', esoServer: 'pc_na' });
    assert.equal(repaired.status, 'active');
    assert.equal(repaired.current_stop_id, 2);
    await db.query('DELETE FROM tour_stops WHERE id=2');
    const completed = await progress.reconcile({ progressId: run.id, userId: 'u2', guildId: 'g1', esoServer: 'pc_na' });
    assert.equal(completed.status, 'completed');
    assert.equal(completed.current_stop_id, null);
    assert.equal(completed.completion_count, 1);
  } finally { await closeDatabase(db); }
});

for (const action of ['list','details','return','next','prev']) {
  test(`an intentionally shared Private tour supports ${action}`,async()=>{
    const {db}=await fixture();
    try{
      await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
      await db.query("UPDATE tours SET visibility='private',guild_id=NULL,source_guild_id='g1' WHERE id=1");
      await db.query("UPDATE saved_houses SET scope='private',owner_user_id='u1' WHERE id=1");
      const sessions=new TourSessionService(db);
      const session=await sessions.startShared({tourId:1,guildId:'g1',channelId:'c1',userId:'u1',esoServer:'pc_na'});
      const suffix=action==='list'?':compact':action==='return'?':1:compact':'';
      let response;
      await createHandlers(db).button(buttonInteraction(`tour:${action}:${session.id}${suffix}`,{reply:p=>response=p,update:p=>response=p}));
      assert.ok(response.embeds?.length,JSON.stringify(response));
      assert.ok(await sessions.get(session.id));
    }finally{await closeDatabase(db);}
  });
}

test('a spectator can return from an intentionally shared Private route but cannot advance it',async()=>{
  const {db}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    await db.query("UPDATE tours SET visibility='private',guild_id=NULL,source_guild_id='g1' WHERE id=1");
    const sessions=new TourSessionService(db),session=await sessions.startShared({tourId:1,guildId:'g1',channelId:'c1',userId:'u1',esoServer:'pc_na'});
    const handlers=createHandlers(db);let response;
    const run=action=>handlers.button({...buttonInteraction(`tour:${action}:${session.id}${action==='return'?':1:compact':''}`,{reply:p=>response=p,update:p=>response=p}),user:{id:'u2',username:'Spectator'}});
    await run('return');assert.ok(response.embeds?.length,JSON.stringify(response));
    await run('next');assert.match(response.content,/Only .*leader/);
    assert.equal((await sessions.get(session.id)).current_position,1);
  }finally{await closeDatabase(db);}
});

test('only the creator can authorize a Shared Private session',async()=>{
  const {db}=await fixture();
  try{
    await db.query("UPDATE tours SET visibility='private',guild_id=NULL WHERE id=1");
    await assert.rejects(()=>new TourSessionService(db).startShared({tourId:1,guildId:'g1',channelId:'c1',userId:'u2',esoServer:'pc_na'}),/creator|access/i);
  }finally{await closeDatabase(db);}
});

test('direct Shared advancement rejects a tour made Private after launch',async()=>{
  const {db}=await fixture();
  try{
    const sessions=new TourSessionService(db),session=await sessions.startShared({tourId:1,guildId:'g1',channelId:'c1',userId:'u1',esoServer:'pc_na'});
    await db.query("UPDATE tours SET visibility='private',guild_id=NULL WHERE id=1");
    await assert.rejects(()=>sessions.advance(session.id,1,2,{esoServer:'pc_na'}),/shared|closed|visibility/i);
    assert.equal((await sessions.get(session.id)).current_position,1);
  }finally{await closeDatabase(db);}
});

test('changing tour visibility closes Shared sessions; ordinary edits keep them',async()=>{
  const {db}=await fixture();
  try{
    const {TourService}=await import('../src/services/tour-service.js');
    const tours=new TourService(db),sessions=new TourSessionService(db);
    const session=await sessions.startShared({tourId:1,guildId:'g1',channelId:'c1',userId:'u1',esoServer:'pc_na'});
    await tours.update(1,{name:'Renamed Route'});
    assert.ok(await sessions.get(session.id));
    await tours.update(1,{visibility:'private',sourceGuildId:'g1'});
    assert.equal(await sessions.get(session.id),null);
    const privateSession=await sessions.startShared({tourId:1,guildId:'g1',channelId:'c1',userId:'u1',esoServer:'pc_na'});
    await tours.update(1,{visibility:'public',guildId:'g1'});
    assert.equal(await sessions.get(privateSession.id),null);
  }finally{await closeDatabase(db);}
});

test('Shared Private authorization survives reconnect but is absent on legacy sessions',async()=>{
  const {db}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    await db.query("UPDATE tours SET visibility='private',guild_id=NULL,source_guild_id='g1' WHERE id=1");
    const sessions=new TourSessionService(db),session=await sessions.startShared({tourId:1,guildId:'g1',channelId:'c1',userId:'u1',esoServer:'pc_na'});
    assert.equal((await new TourSessionService(db).get(session.id)).launch_visibility,'private');
    await db.query('UPDATE tour_sessions SET launch_visibility=NULL WHERE id=?',[session.id]);
    let response;
    await createHandlers(db).button(buttonInteraction(`tour:list:${session.id}:compact`,{reply:p=>response=p}));
    assert.match(response.content,/closed/);
    assert.equal(await sessions.get(session.id),null);
  }finally{await closeDatabase(db);}
});

test('Shared launch rejects Server tours and source houses from another guild',async()=>{
  const {db}=await fixture();
  try{
    const sessions=new TourSessionService(db);
    await assert.rejects(()=>sessions.startShared({tourId:1,guildId:'g2',channelId:'c1',userId:'u1',esoServer:'pc_na'}),/server/i);
    await db.query("UPDATE tours SET visibility='private',guild_id=NULL,source_guild_id='g1' WHERE id=1");
    await assert.rejects(()=>sessions.startShared({tourId:1,guildId:'g2',channelId:'c1',userId:'u1',esoServer:'pc_na'}),/server/i);
  }finally{await closeDatabase(db);}
});

test('Shared Private spectators can comment on the current stop and revoked sessions reject submission',async()=>{
  const {db}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    await db.query("UPDATE tours SET visibility='private',guild_id=NULL,source_guild_id='g1' WHERE id=1");
    await db.query("UPDATE saved_houses SET scope='private',owner_user_id='u1' WHERE id=1");
    const sessions=new TourSessionService(db),session=await sessions.startShared({tourId:1,guildId:'g1',channelId:'c1',userId:'u1',esoServer:'pc_na'});
    const handlers=createHandlers(db);let response,modal;
    const base={...buttonInteraction('',{reply:p=>response=p,update:p=>response=p,showModal:m=>modal=m}),user:{id:'u2',username:'Spectator'}};
    await handlers.button({...base,customId:`tour:comments:${session.id}:expanded`});
    assert.ok(response.embeds?.length,JSON.stringify(response));
    const add=control(response,'Add Comment');assert.ok(add);
    await handlers.button({...base,customId:add.custom_id});
    assert.ok(modal);
    const submit={...base,customId:modal.toJSON().custom_id,fields:{getTextInputValue:()=> 'Lovely private garden'}};
    await handlers.modal(submit);
    assert.equal((await db.query("SELECT * FROM house_comments WHERE discord_user_id='u2'")).length,1);
    await sessions.end(session.id);
    await handlers.modal(submit);
    assert.match(response.content,/closed/i);
    assert.equal((await db.query("SELECT * FROM house_comments WHERE discord_user_id='u2'")).length,1);
  }finally{await closeDatabase(db);}
});

for(const action of ['resume','restart'])test(`My AddressBook ${action} rejects Shared visibility changes`,async()=>{
  const {db}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const sessions=new TourSessionService(db),session=await sessions.startShared({tourId:1,guildId:'g1',channelId:'c1',userId:'u1',esoServer:'pc_na'});
    await db.query("UPDATE tours SET visibility='private',guild_id=NULL WHERE id=1");
    let response;
    await createHandlers(db).button(buttonInteraction(`hu:my:${action}:${session.id}`,{reply:p=>response=p,update:p=>response=p}));
    assert.match(response.content,/closed/i);
    assert.equal(response.embeds?.length||0,0);
    assert.equal(await sessions.get(session.id),null);
  }finally{await closeDatabase(db);}
});

// Regression: shared launch must work when Discord has no cached channel.
for (const visibility of ['public','private']) test(`Shared ${visibility} launch posts the first stop with a null channel`, async () => {
  const {db}=await fixture();
  try {
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    if(visibility==='private') await db.query("UPDATE tours SET visibility='private',guild_id=NULL,source_guild_id='g1' WHERE id=1");
    let posted,acknowledged=false;
    const i={...buttonInteraction('hu:tour:startpublic:1',{update:()=>{acknowledged=true;}}),channel:null,
      followUp:async payload=>{assert.ok(acknowledged);posted=payload;return {id:'message-1'};}};
    await createHandlers(db).button(i);
    assert.ok(posted.embeds.length);
    assert.equal((posted.flags||0)&64,0,'shared card must be public');
    assert.match(JSON.stringify(posted.embeds),/Villa/);
    const rows=await db.query("SELECT * FROM tour_sessions WHERE guild_id='g1' AND channel_id='c1'");
    assert.equal(rows.length,1);
    assert.equal(rows[0].mode,'shared');
    assert.equal(rows[0].started_by,'u1');
    assert.ok(posted.components.length);
  } finally {await closeDatabase(db);}
});
