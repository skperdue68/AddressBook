import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import { SavedHouseService } from '../src/services/saved-house-service.js';
import { SharePassService } from '../src/services/share-pass-service.js';
import { HouseCopyService } from '../src/services/house-copy-service.js';
import { houseCopyMetadataModal, houseCopyVisibilityPayload, sharedPrivateHousePayload } from '../src/ui/share-pass-ui.js';

async function fixture(policy={registrationOutcome:async()=>({allowed:true,status:'active'})}){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-house-copy-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'copy.sqlite')});
  await migrate(db);
  await db.query("INSERT INTO houses(house_id,name,normalized_name,zone) VALUES(62,'Grand Psijic Villa','grand psijic villa','Artaeum')");
  await db.query("INSERT INTO discord_users(discord_user_id,global_name) VALUES('recipient','Recipient Name')");
  await db.query("INSERT INTO discord_guilds(guild_id,guild_name) VALUES('g1','Housing Guild')");
  const houses=new SavedHouseService(db),passes=new SharePassService(db),copies=new HouseCopyService(db,{policy});
  const source=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'HouseOwner',displayName:'Villa Nights',description:'Bring a torch.',tags:['magic','night'],createdBy:'owner'});
  const issued=await passes.createHousePass({savedHouseId:source.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na'});
  return {db,houses,passes,copies,source,issued};
}

const labels=payload=>payload.components.flatMap(row=>row.toJSON().components.map(component=>component.label));

test('Copy appears only for another user pass-only Private entry',async()=>{
  const {db,passes,source,issued}=await fixture();
  try{
    const recipient=await passes.resolveHousePass(issued.token,{userId:'recipient',guildId:'g1',esoServer:'pc_na'});
    assert.equal(recipient.access.passOnly,true);
    assert.ok(labels(sharedPrivateHousePayload(source,{token:issued.token,canCopy:recipient.access.canCopy})).includes('Copy to My Address Book'));
    const owner=await passes.resolveHousePass(issued.token,{userId:'owner',guildId:'g1',esoServer:'pc_na'});
    assert.equal(owner.access.canCopy,false);
    assert.equal(labels(sharedPrivateHousePayload(source,{token:issued.token,canCopy:owner.access.canCopy})).includes('Copy to My Address Book'),false);
    await passes.revokeHousePass(issued.pass.id,{actorId:'owner'});
    await assert.rejects(()=>passes.resolveHousePass(issued.token,{userId:'recipient',guildId:'g1',esoServer:'pc_na'}),/revoked/i);
  }finally{await closeDatabase(db);}
});

test('copy preview orders Global Server Private and prepopulates editable metadata',async()=>{
  const policy={registrationOutcome:async({visibility})=>visibility==='global'?{allowed:false,status:null,reason:'Global submission access is required.'}:{allowed:true,status:visibility==='public'?'pending':'active'}};
  const {db,copies,source,issued}=await fixture(policy);
  try{
    const preview=await copies.preview({sourceSavedHouseId:source.id,userId:'recipient',guildId:'g1',passId:issued.pass.id,targetEsoServer:'pc_na'});
    assert.deepEqual(preview.choices.map(choice=>choice.visibility),['global','public','private']);
    assert.equal(preview.choices[0].enabled,false);
    assert.match(preview.choices[0].reason,/Global submission/i);
    assert.equal(preview.choices[1].status,'pending');
    assert.equal(preview.choices[2].enabled,true);
    assert.equal(preview.metadata.nickname,'Villa Nights');
    assert.equal(preview.metadata.description,'Bring a torch.');
    assert.deepEqual(preview.metadata.tags,['magic','night']);
    assert.equal(preview.destination.esoOwner,'HouseOwner');
    assert.equal(preview.destination.houseName,'Grand Psijic Villa');

    const payload=houseCopyVisibilityPayload(preview,{token:'opaque'});
    assert.deepEqual(labels(payload).slice(0,3),['Global','Server','Private']);
    assert.equal(payload.components[0].toJSON().components[0].disabled,true);
    const modal=houseCopyMetadataModal(preview,{token:'opaque',visibility:'private'}).toJSON();
    const fields=modal.components.flatMap(row=>row.components||[]).map(component=>component.component||component);
    assert.deepEqual(fields.map(field=>field.custom_id),['nickname','description','tags']);
    assert.equal(JSON.stringify(modal).includes('HouseOwner'),false);
  }finally{await closeDatabase(db);}
});

test('transactional copy reuses destination, does not copy tours, and audits readable identities',async()=>{
  const {db,copies,source,issued}=await fixture();
  try{
    await db.query("INSERT INTO tours(visibility,creator_id,name,house_source) VALUES('private','owner','Source Tour','all')");
    const tour=await one(db,"SELECT * FROM tours WHERE name='Source Tour'");
    await db.query('INSERT INTO tour_stops(tour_id,position,saved_house_id) VALUES(?,?,?)',[tour.id,1,source.id]);
    const result=await copies.copy({sourceSavedHouseId:source.id,userId:'recipient',guildId:'g1',passId:issued.pass.id,targetEsoServer:'pc_na',visibility:'private',nickname:'My Villa',description:'Edited description',tags:['copied']});
    assert.equal(result.existing,false);
    assert.equal(result.house.destination_id,source.destination_id);
    assert.equal(result.house.owner_user_id,'recipient');
    assert.equal(result.house.display_name,'My Villa');
    assert.equal((await one(db,'SELECT count(*) c FROM tour_stops WHERE saved_house_id=?',[result.house.id])).c,0);
    const audit=await one(db,"SELECT * FROM audit_log WHERE action='house_copied'");
    assert.equal(audit.actor_global_name,'Recipient Name');
    assert.equal(audit.guild_name,'Housing Guild');
    const details=JSON.parse(audit.details);
    assert.equal(details.sourceSavedHouseId,source.id);
    assert.equal(details.destinationId,source.destination_id);
    assert.equal(details.passId,issued.pass.id);
    assert.equal(details.requestedVisibility,'private');
  }finally{await closeDatabase(db);}
});

test('existing contexts are returned and simultaneous copies create only one entry',async()=>{
  const {db,copies,source,issued}=await fixture();
  try{
    const args={sourceSavedHouseId:source.id,userId:'recipient',guildId:'g1',passId:issued.pass.id,targetEsoServer:'pc_na',visibility:'private',nickname:'Copy',description:null,tags:[]};
    const [first,second]=await Promise.all([copies.copy(args),copies.copy(args)]);
    assert.deepEqual([first.existing,second.existing].sort(),[false,true]);
    assert.equal((await one(db,"SELECT count(*) c FROM saved_houses WHERE destination_id=? AND scope='private' AND owner_user_id='recipient'",[source.destination_id])).c,1);
    const third=await copies.copy(args);
    assert.equal(third.existing,true);
    assert.equal(third.house.id,first.house.id||second.house.id);
  }finally{await closeDatabase(db);}
});

test('pending policy is preserved and failures leave source and target unchanged',async()=>{
  let fail=false;
  const policy={registrationOutcome:async()=>fail?Promise.reject(new Error('policy unavailable')):{allowed:true,status:'pending'}};
  const {db,copies,source,issued}=await fixture(policy);
  try{
    const server=await copies.copy({sourceSavedHouseId:source.id,userId:'recipient',guildId:'g1',passId:issued.pass.id,targetEsoServer:'pc_na',visibility:'public',nickname:'Pending Villa',description:null,tags:[]});
    assert.equal(server.house.status,'pending');
    fail=true;
    await assert.rejects(()=>copies.copy({sourceSavedHouseId:source.id,userId:'recipient',guildId:'g1',passId:issued.pass.id,targetEsoServer:'pc_na',visibility:'global',nickname:'No Copy',description:null,tags:[]}),/nothing was copied|policy unavailable/i);
    assert.equal((await one(db,"SELECT count(*) c FROM saved_houses WHERE scope='global'")).c,0);
    assert.equal((await one(db,'SELECT display_name FROM saved_houses WHERE id=?',[source.id])).display_name,'Villa Nights');
  }finally{await closeDatabase(db);}
});
