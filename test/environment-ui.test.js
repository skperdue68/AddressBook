import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import { GuildEnvironmentService } from '../src/services/guild-environment-service.js';
import { SavedHouseService } from '../src/services/saved-house-service.js';
import { SharePassService } from '../src/services/share-pass-service.js';
import { TourService } from '../src/services/tour-service.js';
import { TourSessionService } from '../src/services/tour-session-service.js';
import { createHousingMenu } from '../src/ui/housing-menu.js';
import { adminPayload, environmentChangePreviewPayload, environmentSetupPayload, homePayload, myAddressBookPayload, onboardingPayload, registrationTypePayload, searchFiltersModal, tourVisibilityPayload } from '../src/ui/housing-ui.js';

const componentJson=payload=>(payload.components||[]).map(row=>row.toJSON?.()||row);

test('environment setup and normal screens clearly display the configured environment',()=>{
  const setup=environmentSetupPayload(),rows=componentJson(setup),options=rows[0].components[0].options;
  assert.match(setup.embeds[0].toJSON().description,/setup required|needs this Discord server/i);
  assert.deepEqual(options.map(option=>option.label),['PC NA','PC EU','Xbox NA','Xbox EU','PlayStation NA','PlayStation EU','PTS']);
  assert.match(homePayload({esoServer:'pc_na'}).embeds[0].toJSON().description,/ESO environment:\*\* PC NA/i);
  assert.match(adminPayload({eso_server:'pc_eu',registration_policy:'open',staff_role_ids:[],registration_role_ids:[],tour_role_ids:[]}).embeds[0].toJSON().description,/PC EU/);
});

test('Global UI copy describes exact-environment sharing instead of bot-wide sharing',()=>{
  const payloads=[
    onboardingPayload({page:1}),
    registrationTypePayload(),
    tourVisibilityPayload('draft')
  ];
  const text=[...payloads.flatMap(payload=>[
    ...(payload.embeds||[]).map(embed=>JSON.stringify(embed.toJSON())),
    ...componentJson(payload).map(row=>JSON.stringify(row))
  ]),JSON.stringify(searchFiltersModal('filters').toJSON())].join('\n');
  assert.match(text,/same ESO environment/i);
  assert.doesNotMatch(text,/bot-wide|every server/i);
});

test('/housing gates an unconfigured guild and the first setup selection opens the configured home',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-environment-setup-ui-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'setup.sqlite')});
  try{
    await migrate(db);
    const menu=createHousingMenu(db),replies=[];
    await menu.chat({commandName:'housing',guildId:'g1',channelId:'c1',user:{id:'u1',username:'User'},guild:{name:'Guild'},member:{displayName:'User',roles:{cache:new Map()}},reply:async payload=>replies.push(payload)});
    assert.match(replies[0].embeds[0].toJSON().title,/Setup Required/);
    let edited;
    await menu.select({customId:'hu:environment:setup',values:['pc_na'],guildId:'g1',channelId:'c1',user:{id:'u1',username:'User'},guild:{name:'Guild'},member:{displayName:'User',roles:{cache:new Map()}},deferUpdate:async()=>{},editReply:async payload=>{edited=payload;},update:async payload=>{edited=payload;},reply:async()=>{throw new Error('setup unexpectedly replied');}});
    assert.match(edited.content,/configured for \*\*PC NA\*\*/);
    assert.match(edited.embeds[0].toJSON().description,/ESO environment:\*\* PC NA/);
  }finally{await closeDatabase(db);}
});

test('My Address Book shows legacy assignment only when Unassigned records exist',()=>{
  const labels=payload=>componentJson(payload).flatMap(row=>row.components).map(component=>component.label).filter(Boolean);
  assert.equal(labels(myAddressBookPayload({legacy:{houses:0,tours:0},esoServer:'pc_na'})).some(label=>label.startsWith('Assign to')),false);
  assert.ok(labels(myAddressBookPayload({legacy:{houses:2,tours:1},esoServer:'pc_na'})).includes('Assign to PC NA'));
});

test('legacy Private assignment uses the confirmed owner-scoped snapshot',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-private-legacy-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'legacy.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Psijic Villa','grand psijic villa')");
    await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(1,NULL,'Owner','owner',62)");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,owner_user_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(1,NULL,'private','u1',62,'Owner','owner',1,'active','u1','u1')");
    await db.query("INSERT INTO tours(id,eso_server,visibility,origin_guild_id,creator_id,name,house_source) VALUES(1,NULL,'private','g1','u1','Legacy Tour','all')");
    await db.query('INSERT INTO tour_stops(tour_id,position,saved_house_id) VALUES(1,1,1)');
    const environments=new GuildEnvironmentService(db),preview=await environments.previewPrivateLegacy({userId:'u1',esoServer:'pc_na'});
    assert.deepEqual(preview.counts,{houses:1,tours:1,removedStops:0});
    const result=await environments.confirmPrivateLegacy({userId:'u1',esoServer:'pc_na',actorId:'u1',expectedFingerprint:preview.fingerprint});
    assert.equal(result.houses,1);assert.equal(result.tours,1);
    assert.equal((await one(db,'SELECT eso_server FROM saved_houses WHERE id=1')).eso_server,'pc_na');
    assert.equal((await one(db,'SELECT eso_server FROM tours WHERE id=1')).eso_server,'pc_na');
  }finally{await closeDatabase(db);}
});

test('environment change preview is stale-safe and confirmation moves only provenance-linked data',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-environment-change-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'change.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Psijic Villa','grand psijic villa'),(63,'Hall of the Lunar Champion','hall of the lunar champion')");
    await db.query("INSERT INTO guild_settings(guild_id,guild_name,eso_server) VALUES('g1','Guild One','pc_na')");
    const houses=new SavedHouseService(db),tours=new TourService(db),passes=new SharePassService(db),sessions=new TourSessionService(db),environments=new GuildEnvironmentService(db);
    const serverHouse=await houses.createPublic({esoServer:'pc_na',guildId:'g1',houseId:62,esoOwner:'ServerOwner',createdBy:'owner'});
    const globalHouse=await houses.createGlobal({esoServer:'pc_na',originGuildId:'g1',houseId:63,esoOwner:'GlobalOwner',createdBy:'owner'});
    const privateHouse=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'PrivateOwner',createdBy:'owner'});
    const unrelatedPrivateHouse=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g2',userId:'owner',houseId:63,esoOwner:'OtherPrivateOwner',createdBy:'owner'});
    const unrelated=await houses.createGlobal({esoServer:'pc_na',originGuildId:'g2',houseId:63,esoOwner:'OtherOwner',createdBy:'other'});
    await db.query("INSERT INTO house_comments(destination_id,saved_house_id,legacy_saved_house_id,discord_user_id,comment_text) VALUES(?,?,?,'commenter','Keep this comment')",[serverHouse.destination_id,serverHouse.id,serverHouse.id]);

    const serverTour=await tours.create({creatorId:'owner',guildId:'g1',originGuildId:'g1',sourceGuildId:'g1',esoServer:'pc_na',visibility:'public',name:'Server Route'});
    await tours.addStop(serverTour.id,serverHouse.id);
    await tours.addStop(serverTour.id,unrelated.id);
    const globalTour=await tours.create({creatorId:'owner',originGuildId:'g1',esoServer:'pc_na',visibility:'global',name:'Global Route'});
    await tours.addStop(globalTour.id,globalHouse.id);
    await tours.addStop(globalTour.id,unrelated.id);
    const privateTour=await tours.create({creatorId:'owner',originGuildId:'g1',sourceGuildId:'g1',esoServer:'pc_na',visibility:'private',name:'Private Route'});
    await tours.addStop(privateTour.id,serverHouse.id);
    const unrelatedPrivateTour=await tours.create({creatorId:'owner',originGuildId:'g2',sourceGuildId:'g2',esoServer:'pc_na',visibility:'private',name:'Other Private Route'});
    await tours.addStop(unrelatedPrivateTour.id,unrelatedPrivateHouse.id);

    const housePass=await passes.createHousePass({savedHouseId:serverHouse.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na'});
    const tourPass=await passes.createTourPass({tourId:globalTour.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na'});
    const passSession=await sessions.startFromPass({passId:tourPass.pass.id,tourId:globalTour.id,guildId:'g1',channelId:'c1',userId:'viewer',esoServer:'pc_na'});

    const stale=await environments.previewChange({guildId:'g1',toEsoServer:'pc_eu'});
    await db.query("UPDATE saved_houses SET origin_guild_id='g2' WHERE id=?",[globalHouse.id]);
    await assert.rejects(()=>environments.confirmChange({guildId:'g1',toEsoServer:'pc_eu',actorId:'admin',expectedFingerprint:stale.fingerprint}),/impact changed/i);
    assert.equal((await one(db,"SELECT eso_server FROM guild_settings WHERE guild_id='g1'")).eso_server,'pc_na');
    assert.equal((await one(db,'SELECT eso_server FROM saved_houses WHERE id=?',[serverHouse.id])).eso_server,'pc_na');

    await db.query("UPDATE saved_houses SET origin_guild_id='g1' WHERE id=?",[globalHouse.id]);
    const preview=await environments.previewChange({guildId:'g1',toEsoServer:'pc_eu'});
    assert.ok(preview.houseIds.includes(privateHouse.id));
    assert.equal(preview.houseIds.includes(unrelatedPrivateHouse.id),false);
    assert.equal(preview.counts.privateHouses,1);
    assert.ok(preview.tourIds.includes(privateTour.id));
    assert.equal(preview.tourIds.includes(unrelatedPrivateTour.id),false);
    assert.equal(preview.counts.privateTours,1);
    const payload=environmentChangePreviewPayload(preview),rendered=payload.embeds[0].toJSON();
    assert.match(rendered.description,/PC NA/);assert.match(rendered.description,/PC EU/);
    assert.deepEqual(rendered.fields.map(field=>field.name),['Houses','Tours','Destinations','Route Changes','Share Passes','Remain Unassigned']);
    assert.match(rendered.fields.find(field=>field.name==='Houses').value,/Origin-linked Private: \*\*1\*\*/);
    assert.match(rendered.fields.find(field=>field.name==='Tours').value,/Origin-linked Private: \*\*1\*\*/);
    const result=await environments.confirmChange({guildId:'g1',toEsoServer:'pc_eu',actorId:'admin',expectedFingerprint:preview.fingerprint,names:{guildName:'Guild One',actorDisplayName:'Admin'}});

    assert.equal(result.fromEsoServer,'pc_na');
    assert.equal((await one(db,"SELECT eso_server FROM guild_settings WHERE guild_id='g1'")).eso_server,'pc_eu');
    assert.equal((await one(db,'SELECT eso_server FROM saved_houses WHERE id=?',[serverHouse.id])).eso_server,'pc_eu');
    assert.equal((await one(db,'SELECT eso_server FROM saved_houses WHERE id=?',[globalHouse.id])).eso_server,'pc_eu');
    assert.equal((await one(db,'SELECT eso_server FROM saved_houses WHERE id=?',[privateHouse.id])).eso_server,'pc_eu');
    assert.equal((await one(db,'SELECT eso_server FROM saved_houses WHERE id=?',[unrelatedPrivateHouse.id])).eso_server,'pc_na');
    assert.equal((await one(db,'SELECT eso_server FROM saved_houses WHERE id=?',[unrelated.id])).eso_server,'pc_na');
    assert.deepEqual((await tours.getStops(serverTour.id)).map(stop=>stop.saved_house_id),[serverHouse.id]);
    assert.deepEqual((await tours.getStops(globalTour.id)).map(stop=>stop.saved_house_id),[globalHouse.id]);
    assert.deepEqual((await tours.getStops(privateTour.id)).map(stop=>stop.saved_house_id),[serverHouse.id]);
    assert.deepEqual((await tours.getStops(unrelatedPrivateTour.id)).map(stop=>stop.saved_house_id),[unrelatedPrivateHouse.id]);
    assert.equal((await one(db,'SELECT eso_server FROM tours WHERE id=?',[privateTour.id])).eso_server,'pc_eu');
    assert.equal((await one(db,'SELECT eso_server FROM tours WHERE id=?',[unrelatedPrivateTour.id])).eso_server,'pc_na');
    assert.equal((await one(db,'SELECT status FROM house_share_passes WHERE id=?',[housePass.pass.id])).status,'revoked');
    assert.equal((await one(db,'SELECT status FROM tour_share_passes WHERE id=?',[tourPass.pass.id])).status,'revoked');
    assert.equal(await sessions.get(passSession.id),null);
    const comment=await one(db,"SELECT d.eso_server,c.comment_text FROM house_comments c JOIN housing_destinations d ON d.id=c.destination_id WHERE c.comment_text='Keep this comment'");
    assert.equal(comment.eso_server,'pc_eu');
    assert.equal(comment.comment_text,'Keep this comment');
    const audit=await one(db,"SELECT details FROM audit_log WHERE action='change_guild_eso_server'");
    assert.equal(JSON.parse(audit.details).toEsoServer,'pc_eu');
  }finally{await closeDatabase(db);}
});
