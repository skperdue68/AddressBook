import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { MyAddressBookService } from '../src/services/my-addressbook-service.js';
import { OnboardingService } from '../src/services/onboarding-service.js';
import { commentsPayload, myAddressBookPayload, myPendingPayload, onboardingPayload, toursPayload } from '../src/ui/housing-ui.js';
import { createHousingMenu } from '../src/ui/housing-menu.js';

const labels=payload=>payload.components.flatMap(row=>row.toJSON().components.map(component=>component.label)).filter(Boolean);

async function fixture(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-onboarding-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'onboarding.sqlite')});
  await migrate(db);return {db,onboarding:new OnboardingService(db),addressBook:new MyAddressBookService(db)};
}

test('first-use introduction has five choices and seven feature-guided screens',()=>{
  assert.deepEqual(labels(onboardingPayload({page:0})),['Find a House','Register a House','Start a Tour','Show Me Around','Skip']);
  for(const page of [1,2,3,4,5,6,7])assert.match(onboardingPayload({page}).embeds[0].toJSON().title,new RegExp(`${page} of 7`));
  assert.ok(labels(onboardingPayload({page:1})).includes('Next'));
  assert.ok(labels(onboardingPayload({page:6})).includes('Next'));
  assert.ok(labels(onboardingPayload({page:7})).includes('Finish'));
  assert.ok(labels(onboardingPayload({page:1})).includes('Try Search'));
  assert.ok(labels(onboardingPayload({page:2})).includes('Register a House'));
  assert.ok(labels(onboardingPayload({page:4})).includes('Open My AddressBook'));
  assert.ok(labels(onboardingPayload({page:5})).includes('Browse Tours'));
  const tour=onboardingPayload({page:5}).embeds[0].toJSON();
  assert.match(JSON.stringify(tour),/Self-Paced/i);
  assert.match(JSON.stringify(tour),/Shared/i);
  const sharing=onboardingPayload({page:6}).embeds[0].toJSON();
  assert.match(JSON.stringify(sharing),/Share Pass/i);
  assert.match(JSON.stringify(sharing),/copy/i);
});

test('contextual onboarding actions complete first use before opening real features',async()=>{
  const {db,onboarding}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const menu=createHousingMenu(db),cases=[
      ['search','Filters'],['register','Global'],['addressbook','My Houses'],['tours','Browse Tours'],['help','Show Introduction Again']
    ];
    for(const [target,expected] of cases){
      const userId=`user-${target}`,updates=[],replies=[];
      const i={customId:`hu:onboarding:go:${target}`,guildId:'g1',channelId:'c1',guild:{id:'g1',name:'Guild'},user:{id:userId,username:userId,globalName:userId},member:{displayName:userId,roles:{cache:new Map()}},update:p=>(updates.push(p),Promise.resolve(p)),reply:p=>(replies.push(p),Promise.resolve(p))};
      await menu.button(i);
      assert.equal((await onboarding.get(userId)).status,'completed');
      const rendered=JSON.stringify({embeds:updates[0].embeds?.map(value=>value.toJSON?.()||value),components:updates[0].components?.map(value=>value.toJSON?.()||value)});
      assert.match(rendered,new RegExp(expected),`${target} should open ${expected}`);
      assert.equal(replies.length,0);
    }

    const click=async(userId,customId)=>{const updates=[];await menu.button({customId,guildId:'g1',channelId:'c1',guild:{id:'g1',name:'Guild'},user:{id:userId,username:userId},member:{displayName:userId,roles:{cache:new Map()}},update:p=>(updates.push(p),Promise.resolve(p)),reply:p=>Promise.resolve(p)});return updates;};
    await click('skip-user','hu:onboarding:skip');assert.equal((await onboarding.get('skip-user')).status,'skipped');
    await click('skip-user','hu:onboarding:1');assert.equal((await onboarding.get('skip-user')).status,'skipped');
    await click('finish-user','hu:onboarding:finish');assert.equal((await onboarding.get('finish-user')).status,'completed');
  }finally{await closeDatabase(db);}
});

test('trying a feature returns to the same Show Me Around page using Back',async()=>{
  const {db}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const menu=createHousingMenu(db);
    const buttons=payload=>payload.components.flatMap(row=>row.toJSON().components);
    for(const page of [1,2,3,4,5,6,7]){
      const step=onboardingPayload({page});
      const tryId=buttons(step).find(component=>/hu:onboarding:go:/.test(component.custom_id))?.custom_id;
      const click=async customId=>{
        const updates=[];
        await menu.button({customId,guildId:'g1',channelId:'c1',guild:{id:'g1',name:'Guild'},user:{id:`user-${page}`,username:'Guest'},member:{displayName:'Guest',roles:{cache:new Map()}},update:payload=>(updates.push(payload),Promise.resolve(payload)),reply:payload=>Promise.resolve(payload)});
        assert.equal(updates.length,1,`page ${page} must update the existing message`);
        return updates[0];
      };
      const feature=await click(tryId);
      const backId=buttons(feature).find(component=>component.label==='Back')?.custom_id;
      assert.equal(backId,`hu:onboarding:${page}`,`page ${page} must keep its return destination`);
      if(page===3){
        const clearId=buttons(feature).find(component=>component.label==='Clear Filters')?.custom_id;
        const cleared=await click(clearId);
        assert.equal(buttons(cleared).find(component=>component.label==='Back')?.custom_id,backId,'search actions must preserve the introduction return');
      }
      const returned=await click(backId);
      assert.match(returned.embeds[0].toJSON().title,new RegExp(`${page} of 7`));
    }
  }finally{await closeDatabase(db);}
});

test('ordinary feature navigation still returns to the housing menu',()=>{
  const buttons=payload=>payload.components.flatMap(row=>row.toJSON().components);
  for(const payload of [myAddressBookPayload(),toursPayload(),onboardingPayload({page:0})]){
    if(payload.embeds[0].toJSON().title.includes('Welcome'))continue;
    assert.equal(buttons(payload).find(component=>component.label==='Back')?.custom_id,'hu:home');
  }
});

test('completion and skip persist idempotently while replay does not clear status',async()=>{
  const {db,onboarding}=await fixture();
  try{
    assert.equal(await onboarding.get('u1'),null);
    assert.equal((await onboarding.complete('u1',{globalName:'User One',displayName:'One'})).status,'completed');
    assert.equal((await onboarding.complete('u1')).status,'completed');
    assert.equal((await onboarding.get('u1')).discord_global_name,'User One');
    assert.equal((await onboarding.skip('u2')).status,'skipped');
    assert.equal((await onboarding.get('u2')).status,'skipped');
  }finally{await closeDatabase(db);}
});

test('MariaDB onboarding completion binds a native date instead of an ISO timestamp string',async()=>{
  const writes=[];
  const db={type:'mariadb',query:async(sql,params=[])=>{
    if(/^SELECT /i.test(sql.trim()))return [{discord_user_id:'u1',status:'completed'}];
    writes.push({sql,params});
    return [];
  }};

  await new OnboardingService(db).complete('u1',{globalName:'User One',displayName:'One'});

  assert.equal(writes.length,1);
  assert.ok(writes[0].params[4] instanceof Date,'completed_at must be bound as a Date for MariaDB');
  assert.equal(writes[0].params[5],null);
});

test('continue items include only accessible active work',async()=>{
  const {db,addressBook}=await fixture();
  try{
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'House','house')");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES(1,'pc_na','public','g1',1,'Owner','owner','active','u2','u2')");
    await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES(2,'pc_na','public','g2',1,'Hidden','hidden','active','u2','u2')");
    await db.query("INSERT INTO tours(id,eso_server,visibility,creator_id,name,house_source) VALUES(1,'pc_na','private','u1','My Tour','all')");
    await db.query("INSERT INTO tours(id,eso_server,visibility,creator_id,name,house_source) VALUES(2,'pc_na','private','u2','Not Mine','all')");
    await db.query("INSERT INTO tour_sessions(tour_id,guild_id,channel_id,mode,started_by,current_position) VALUES(1,'g1','c1','self_paced','u1',1)");
    await addressBook.recordView('u1',2);await addressBook.recordView('u1',1);
    const result=await addressBook.continueItems('u1','g1','pc_na');
    assert.equal(result.activeTour.tour_name,'My Tour');
    assert.equal(result.recentHouse.id,1);
    assert.equal(result.editedTour.id,1);
    const payload=myAddressBookPayload({houses:0,tours:1,pending:0,recent:1,continueItems:result});
    assert.ok(labels(payload).includes('Resume Tour'));
    assert.ok(labels(payload).includes('Open Recent House'));
  }finally{await closeDatabase(db);}
});

test('empty states explain what to do and always provide a useful action plus Back',()=>{
  const payloads=[
    myPendingPayload(),
    toursPayload(0),
    commentsPayload({label:'House',owner:'Owner',rows:[],scope:'private',id:1,backId:'hu:home'}),
    myAddressBookPayload()
  ];
  for(const payload of payloads){
    const actionLabels=labels(payload);
    assert.ok(actionLabels.some(label=>!/^Back/.test(label)),actionLabels.join(','));
    assert.ok(actionLabels.some(label=>/^Back/.test(label)),actionLabels.join(','));
    assert.ok((payload.content||payload.embeds?.[0]?.toJSON().description||'').length>10);
  }
});
