import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import { SavedHouseService } from '../src/services/saved-house-service.js';
import { SharePassService } from '../src/services/share-pass-service.js';
import { TourReadinessService } from '../src/services/tour-readiness-service.js';
import { TourService } from '../src/services/tour-service.js';
import { TourSessionService } from '../src/services/tour-session-service.js';
import { tourPassInformationPayload, tourShareCardPayload } from '../src/ui/share-pass-ui.js';
import { createHandlers } from '../src/handlers.js';

async function fixture(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-tour-pass-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'pass.sqlite')});
  await migrate(db);
  await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Psijic Villa','grand psijic villa')");
  return {db,houses:new SavedHouseService(db),tours:new TourService(db),passes:new SharePassService(db)};
}

test('only Private tour creator can issue or reissue its Tour Pass',async()=>{
  const {db,houses,tours,passes}=await fixture();
  try{
    const tour=await tours.create({esoServer:'pc_na',originGuildId:'g1',creatorId:'owner',visibility:'private',sourceGuildId:'g1',name:'Secret Route'});
    await db.query("UPDATE tours SET eso_server='pc_na' WHERE id=?",[tour.id]);
    const house=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'Owner',createdBy:'owner'});
    await tours.addStop(tour.id,house.id);
    await assert.rejects(()=>passes.createTourPass({tourId:tour.id,createdBy:'viewer',originGuildId:'g1',esoServer:'pc_na',channelId:'c1'}),/normal access|creator/i);
    const created=await passes.createTourPass({tourId:tour.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na',channelId:'c1'});
    const resolved=await passes.resolveTourPass(created.token,{userId:'viewer',guildId:'g1',esoServer:'pc_na'});
    assert.equal(resolved.tour.id,tour.id);
    assert.equal(resolved.access.passOnly,true);
    await assert.rejects(()=>passes.createTourPass({tourId:tour.id,createdBy:'viewer',originGuildId:'g1',esoServer:'pc_na',channelId:'c1',sourcePassId:created.pass.id}),/normal access|creator/i);
    await assert.rejects(()=>passes.repostTourPass(created.pass.id,{actorId:'viewer',guildId:'g1',channelId:'c2'}),/creator/i);
  }finally{await closeDatabase(db);}
});

test('Tour Pass uses live route rotates on repost and reports deleted tours',async()=>{
  const {db,houses,tours,passes}=await fixture();
  try{
    const house=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'Owner',createdBy:'owner'});
    const tour=await tours.create({esoServer:'pc_na',originGuildId:'g1',creatorId:'owner',visibility:'private',sourceGuildId:'g1',name:'Live Route'});
    await db.query("UPDATE tours SET eso_server='pc_na' WHERE id=?",[tour.id]);
    await tours.addStop(tour.id,house.id,'Original');
    const created=await passes.createTourPass({tourId:tour.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na',channelId:'c1'});
    assert.equal((await passes.resolveTourPass(created.token,{userId:'viewer',guildId:'g1',esoServer:'pc_na'})).stops.length,1);
    await tours.updateStop((await tours.getStops(tour.id))[0].id,{notes:'Updated live note'});
    assert.equal((await passes.resolveTourPass(created.token,{userId:'viewer',guildId:'g1',esoServer:'pc_na'})).stops[0].notes,'Updated live note');
    const reposted=await passes.repostTourPass(created.pass.id,{actorId:'owner',guildId:'g1',channelId:'c2',messageId:'m2'});
    await assert.rejects(()=>passes.resolveTourPass(created.token,{userId:'viewer',guildId:'g1',esoServer:'pc_na'}),/no longer connected|stale/i);
    assert.equal((await passes.resolveTourPass(reposted.token,{userId:'viewer',guildId:'g1',esoServer:'pc_na'})).tour.id,tour.id);
    await tours.remove(tour.id);
    await assert.rejects(()=>passes.resolveTourPass(reposted.token,{userId:'viewer',guildId:'g1',esoServer:'pc_na'}),/tour is no longer available/i);
    assert.equal((await one(db,'SELECT tour_id FROM tour_share_passes WHERE id=?',[created.pass.id])).tour_id,null);
  }finally{await closeDatabase(db);}
});

test('readiness blocks empty and duplicate-destination tours',async()=>{
  const {db,houses,tours}=await fixture();
  try{
    const empty=await tours.create({esoServer:'pc_na',originGuildId:'g1',creatorId:'owner',visibility:'private',sourceGuildId:'g1',name:'Empty'});
    await db.query("UPDATE tours SET eso_server='pc_na' WHERE id=?",[empty.id]);
    const readiness=new TourReadinessService(db);
    assert.ok((await readiness.check(empty.id,{viewerId:'owner',guildId:'g1',esoServer:'pc_na'})).blocking.some(issue=>issue.code==='no_stops'));
    const first=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'Owner',displayName:'One',createdBy:'owner'});
    const second=await houses.createGlobal({esoServer:'pc_na',originGuildId:'g1',houseId:62,esoOwner:'owner',displayName:'Two',createdBy:'owner'});
    await tours.addStop(empty.id,first.id);
    await db.query('INSERT INTO tour_stops(tour_id,position,saved_house_id) VALUES(?,?,?)',[empty.id,2,second.id]);
    const result=await readiness.check(empty.id,{viewerId:'owner',guildId:'g1',esoServer:'pc_na'});
    assert.ok(result.blocking.some(issue=>issue.code==='duplicate_destination'));
  }finally{await closeDatabase(db);}
});

test('Tour Pass card exposes only independent self-paced start information copy and report actions',()=>{
  const payload=tourShareCardPayload({id:4,name:'Secret Route',description:'Hidden gems',visibility:'private'},{token:'opaque-token',sharerName:'Stephanie',stopCount:3});
  const embed=payload.embeds[0].toJSON();
  assert.match(embed.description,/Private destinations/i);
  const labels=payload.components.flatMap(row=>row.toJSON().components.map(component=>component.label));
  assert.deepEqual(labels,['Start Self-Paced Tour','Tour Information','Copy Tour to My AddressBook','Report a Problem']);
});

test('Tour Information responds with an accessible private route', async () => {
  const { db, houses, tours, passes } = await fixture();
  try {
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const house = await houses.createPrivate({ esoServer:'pc_na', originGuildId:'g1', userId:'owner', houseId:62, esoOwner:'Owner', createdBy:'owner' });
    const tour = await tours.create({ esoServer:'pc_na', originGuildId:'g1', creatorId:'owner', visibility:'private', sourceGuildId:'g1', name:'Secret Route' });
    await tours.addStop(tour.id,house.id);
    const { token } = await passes.createTourPass({ tourId:tour.id, createdBy:'owner', originGuildId:'g1', esoServer:'pc_na' });
    let response;
    await createHandlers(db).button({customId:`hu:pass:tour:info:${token}`,guildId:'g1',channelId:'c1',guild:{name:'Guild'},user:{id:'viewer',username:'Viewer'},member:{displayName:'Viewer',roles:{cache:{has:()=>false}}},reply:p=>{response=p;},update:p=>{response=p;}});
    assert.match(JSON.stringify(response?.embeds),/Secret Route/);
    assert.match(JSON.stringify(response?.embeds),/Grand Psijic Villa/);
  } finally { await closeDatabase(db); }
});

test('Tour Pass Information lists nickname, official house, then owner',async()=>{
  const {db,houses,tours,passes}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const house=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'Owner',createdBy:'owner'});
    await db.query('UPDATE saved_houses SET display_name=? WHERE id=?',['Secret Garden',house.id]);
    const tour=await tours.create({esoServer:'pc_na',originGuildId:'g1',creatorId:'owner',visibility:'private',sourceGuildId:'g1',name:'Nicknamed Route'});
    await tours.addStop(tour.id,house.id);
    const {token}=await passes.createTourPass({tourId:tour.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na'});
    let response;
    await createHandlers(db).button({customId:`hu:pass:tour:info:${token}`,guildId:'g1',user:{id:'viewer'},member:{roles:{cache:{has:()=>false}}},reply:p=>{response=p;}});
    assert.match(response.embeds[0].toJSON().description,/Secret Garden \(Grand Psijic Villa\) — @Owner/);
  }finally{await closeDatabase(db);}
});

test('Tour Information preserves a tour-specific stop title before the official house and owner',()=>{
  const result=tourPassInformationPayload({tour:{name:'Route'},stops:[{custom_title:'Moonlit Garden',display_name:'Saved Nickname',house_name:'Grand Psijic Villa',eso_owner:'Owner'}]},{token:'opaque'});
  assert.match(result.embeds[0].toJSON().description,/Moonlit Garden \(Grand Psijic Villa\) — @Owner/);
});

test('Tour Information does not duplicate the official name without a distinct nickname',()=>{
  const result=tourPassInformationPayload({tour:{name:'Route'},stops:[{display_name:'Grand Psijic Villa',house_name:'Grand Psijic Villa',eso_owner:'Owner'}]},{token:'opaque'});
  assert.match(result.embeds[0].toJSON().description,/Grand Psijic Villa — @Owner/);
  assert.doesNotMatch(result.embeds[0].toJSON().description,/Grand Psijic Villa \(Grand Psijic Villa\)/);
});

test('tour and stop text limits are enforced before persistence', async () => {
  const { db, houses, tours } = await fixture();
  try {
    await assert.rejects(() => tours.create({ esoServer:'pc_na', originGuildId:'g1', creatorId:'owner', visibility:'private', sourceGuildId:'g1', name:'x'.repeat(256) }), /200 characters or fewer/i);
    await assert.rejects(() => houses.createPrivate({ esoServer:'pc_na', originGuildId:'g1', userId:'owner', houseId:62, esoOwner:'Owner', displayName:'x'.repeat(256), createdBy:'owner' }), /255 characters or fewer/i);
    const house = await houses.createPrivate({ esoServer:'pc_na', originGuildId:'g1', userId:'owner', houseId:62, esoOwner:'Owner', createdBy:'owner' });
    const tour = await tours.create({ esoServer:'pc_na', originGuildId:'g1', creatorId:'owner', visibility:'private', sourceGuildId:'g1', name:'Safe Route' });
    const stop = await tours.addStop(tour.id, house.id);
    await assert.rejects(() => tours.updateStop(stop.id, { title:'x'.repeat(256) }), /180 characters or fewer/i);
    await assert.rejects(() => tours.updateStop(stop.id, { notes:'x'.repeat(1001) }), /1000 characters or fewer/i);
  } finally { await closeDatabase(db); }
});

test('legacy oversized Tour Pass information remains within Discord limits', () => {
  const long = 'x'.repeat(5000);
  const payload = tourPassInformationPayload({ tour:{ name:long, description:long }, stops:[{ custom_title:long, house_name:long, eso_owner:long }] }, { token:'opaque' });
  const embed = payload.embeds[0].toJSON();
  assert.ok(embed.title.length <= 256);
  assert.ok(embed.description.length <= 4096);
});

test('Tour Pass Information acknowledges before a slow database lookup', async () => {
  const { db, houses, tours, passes } = await fixture();
  try {
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const house = await houses.createPrivate({ esoServer:'pc_na', originGuildId:'g1', userId:'owner', houseId:62, esoOwner:'Owner', createdBy:'owner' });
    const tour = await tours.create({ esoServer:'pc_na', originGuildId:'g1', creatorId:'owner', visibility:'private', sourceGuildId:'g1', name:'Slow Route' });
    await tours.addStop(tour.id, house.id);
    const { token } = await passes.createTourPass({ tourId:tour.id, createdBy:'owner', originGuildId:'g1', esoServer:'pc_na' });
    const original = db.query.bind(db); let release;
    const gate = new Promise(resolve => { release = resolve; }); let blocked = false;
    db.query = async (sql, args) => {
      if (!blocked && /FROM tour_share_passes WHERE token_hash/i.test(sql)) { blocked = true; await gate; }
      return original(sql, args);
    };
    let deferred = false, edited;
    const pending = createHandlers(db).button({ customId:`hu:pass:tour:info:${token}`, guildId:'g1', channelId:'c1', user:{id:'viewer',username:'Viewer'}, member:{roles:{cache:{has:()=>false}}}, message:{flags:{has:()=>true}}, deferUpdate:async()=>{deferred=true;}, editReply:async payload=>{edited=payload;}, reply:async()=>{}, update:async()=>{} });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(deferred, true);
    release(); await pending;
    assert.match(JSON.stringify(edited?.embeds), /Slow Route/);
  } finally { await closeDatabase(db); }
});

test('Copy Tour Cancel responds with Tour Information without copying', async () => {
  const { db, houses, tours, passes } = await fixture();
  try {
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const house = await houses.createPrivate({ esoServer:'pc_na', originGuildId:'g1', userId:'owner', houseId:62, esoOwner:'Owner', createdBy:'owner' });
    const tour = await tours.create({ esoServer:'pc_na', originGuildId:'g1', creatorId:'owner', visibility:'private', sourceGuildId:'g1', name:'Secret Route' });
    await tours.addStop(tour.id,house.id);
    const { token } = await passes.createTourPass({ tourId:tour.id, createdBy:'owner', originGuildId:'g1', esoServer:'pc_na' });
    let response, updated = false;
    await createHandlers(db).button({customId:`hu:pass:tour:info:${token}`,guildId:'g1',channelId:'c1',guild:{name:'Guild'},user:{id:'viewer',username:'Viewer'},member:{displayName:'Viewer',roles:{cache:{has:()=>false}}},message:{flags:{has:()=>true}},reply:p=>{response=p;},update:p=>{response=p;updated=true;}});
    assert.equal(updated,true);
    assert.match(JSON.stringify(response?.embeds),/Secret Route/);
    assert.equal((await db.query("SELECT count(*) c FROM tours WHERE creator_id='viewer'"))[0].c,0);
  } finally { await closeDatabase(db); }
});

test('Tour Pass information and copy preview stay available while navigating repeatedly',async()=>{
  const {db,houses,tours,passes}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const house=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'Owner',createdBy:'owner'});
    const tour=await tours.create({esoServer:'pc_na',originGuildId:'g1',creatorId:'owner',visibility:'private',sourceGuildId:'g1',name:'Repeat Route'});
    await tours.addStop(tour.id,house.id);
    const {token}=await passes.createTourPass({tourId:tour.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na'});
    const handlers=createHandlers(db);
    for(let attempt=0;attempt<8;attempt++){
      let response;
      const action=attempt%2?'copy':'info';
      await handlers.button({customId:`hu:pass:tour:${action}:${token}`,guildId:'g1',user:{id:'viewer',username:'Viewer'},member:{roles:{cache:{has:()=>false}}},message:{flags:{has:()=>true}},update:p=>{response=p;},reply:p=>{response=p;}});
      assert.ok(response?.embeds?.length,`attempt ${attempt+1}: ${response?.content}`);
    }
  }finally{await closeDatabase(db);}
});

async function privatePassRun(){
  const setup=await fixture(),{db,houses,tours,passes}=setup;
  await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
  const house=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'Owner',createdBy:'owner'});
  const tour=await tours.create({esoServer:'pc_na',originGuildId:'g1',creatorId:'owner',visibility:'private',sourceGuildId:'g1',name:'Private Pass Route'});
  const stop=await tours.addStop(tour.id,house.id);
  const created=await passes.createTourPass({tourId:tour.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na'});
  const session=await new TourSessionService(db).startFromPass({passId:created.pass.id,tourId:tour.id,guildId:'g1',channelId:'c1',userId:'viewer',esoServer:'pc_na'});
  const base={guildId:'g1',channelId:'c1',user:{id:'viewer',username:'Viewer'},member:{roles:{cache:{has:()=>false}}},message:{flags:{has:()=>true}}};
  return {...setup,house,tour,stop,created,session,base,handlers:createHandlers(db)};
}

test('Tour Pass copy preview updates an existing private information screen',async()=>{
  const {db,created,base,handlers}=await privatePassRun();
  try{
    let method,response;
    await handlers.button({...base,customId:`hu:pass:tour:copy:${created.token}`,reply:p=>{method='reply';response=p;},update:p=>{method='update';response=p;}});
    assert.equal(method,'update');
    assert.match(JSON.stringify(response?.embeds),/Copy Tour to My AddressBook/);
  }finally{await closeDatabase(db);}
});

test('Tour Pass visitor returns from tour list to the private stop',async()=>{
  const {db,session,stop,base,handlers}=await privatePassRun();
  try{
    let response;
    await handlers.button({...base,customId:`tour:return:${session.id}:${stop.id}:compact`,update:p=>{response=p;},reply:p=>{response=p;}});
    assert.match(JSON.stringify(response?.embeds),/Stop 1 of 1/);
  }finally{await closeDatabase(db);}
});

test('Tour Pass visitor opens comments on a private stop',async()=>{
  const {db,session,base,handlers}=await privatePassRun();
  try{
    let response;
    await handlers.button({...base,customId:`tour:comments:${session.id}:compact`,reply:p=>{response=p;}});
    assert.match(JSON.stringify(response?.embeds),/Comments/);
    assert.match(JSON.stringify(response?.components),/Add Comment/);
  }finally{await closeDatabase(db);}
});

test('Tour Pass visitor opens an Add Comment form for the private stop',async()=>{
  const {db,session,stop,base,handlers}=await privatePassRun();
  try{
    let modal;
    await handlers.button({...base,customId:`hu:pass:tour:comment:add:${session.id}:${stop.id}:compact`,showModal:m=>{modal=m;},reply:()=>{}});
    assert.equal(modal?.toJSON().custom_id,`hu:modal:pass:tour:comment:${session.id}:${stop.id}:compact`);
  }finally{await closeDatabase(db);}
});

test('Tour Pass visitor submits a private stop comment while the pass is active',async()=>{
  const {db,session,stop,created,passes,base,handlers}=await privatePassRun();
  try{
    let response;
    const interaction={...base,customId:`hu:modal:pass:tour:comment:${session.id}:${stop.id}:compact`,fields:{getTextInputValue:()=> 'A lovely stop'},reply:p=>{response=p;}};
    await handlers.modal(interaction);
    assert.match(JSON.stringify(response?.embeds),/A lovely stop/);
    assert.equal((await db.query("SELECT count(*) c FROM house_comments WHERE discord_user_id='viewer'"))[0].c,1);
    await passes.revokeTourPass(created.pass.id,{actorId:'owner'});
    response=null;
    await handlers.modal(interaction);
    assert.equal((await db.query("SELECT count(*) c FROM house_comments WHERE discord_user_id='viewer'"))[0].c,1);
    assert.match(response?.content,/closed|revoked/i);
  }finally{await closeDatabase(db);}
});

for(const action of ['list','details','comments','next','prev'])test(`closed Tour Pass link blocks stale ${action} button`,async()=>{
  const {db,session,created,base,handlers}=await privatePassRun();
  try{
    // Simulate an interrupted pass cleanup that left the old Discord session row behind.
    await db.query("UPDATE share_pass_sessions SET closed_at=CURRENT_TIMESTAMP WHERE tour_session_id=?",[session.id]);
    await db.query("UPDATE tour_share_passes SET status='revoked' WHERE id=?",[created.pass.id]);
    if(action==='next')await assert.rejects(()=>new TourSessionService(db).advance(session.id,1,1,{esoServer:'pc_na'}),/revoked/i);
    let response;
    await handlers.button({...base,customId:`tour:${action}:${session.id}:compact`,reply:p=>{response=p;},update:p=>{response=p;}});
    assert.match(response?.content,/closed|revoked/i);
    assert.equal(response?.embeds?.length||0,0);
    assert.equal(await new TourSessionService(db).get(session.id),null);
  }finally{await closeDatabase(db);}
});
