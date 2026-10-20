import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { seedHouses } from '../src/db/seed-houses.js';
import { HouseService } from '../src/services/house-service.js';
import { RegistrationDraftService } from '../src/services/registration-draft-service.js';
import { resolveDestinationInput } from '../src/utils/destination-input.js';
import { registrationDestinationReviewPayload, registrationFinalReviewPayload } from '../src/ui/housing-ui.js';

test('destination resolution requires an explicit choice when entered and parsed owners conflict',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-registration-review-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'review.sqlite')});
  try{
    await migrate(db); await seedHouses(db);
    const houses=new HouseService(db);
    const conflict=await resolveDestinationInput({input:'("@Alpha", 62)',owner:'@Beta'},houses);
    assert.equal(conflict.house.house_id,62);
    assert.deepEqual(conflict.ownerConflict,{parsed:'Alpha',entered:'Beta'});
    const matching=await resolveDestinationInput({input:'@Alpha, 62',owner:'alpha'},houses);
    assert.equal(matching.esoOwner,'Alpha');
    await assert.rejects(()=>resolveDestinationInput({input:'@Alpha, 999999',owner:''},houses),/not found/i);
  }finally{await closeDatabase(db);}
});

test('registration destination review shows ordered visibility matches status and conflict choices',()=>{
  const payload=registrationDestinationReviewPayload({
    id:'draft1',house:{house_id:62,name:'Grand Psijic Villa'},visibility:'public',expectedStatus:'pending',
    ownerConflict:{parsed:'Alpha',entered:'Beta'},existingEntries:[
      {scope:'private',display_name:'Private'}, {scope:'global',display_name:'Global'}, {scope:'public',display_name:'Server'}
    ]
  });
  const json=payload.embeds[0].toJSON(),description=json.description;
  assert.match(description,/Grand Psijic Villa/);
  assert.match(description,/House ID:\*\* \*\*62\*\*/);
  assert.ok(description.indexOf('• **Global:**')<description.indexOf('• **Server:**'));
  assert.ok(description.indexOf('• **Server:**')<description.indexOf('• **Private:**'));
  assert.match(description,/awaiting.*approval/i);
  const labels=payload.components.flatMap(row=>row.toJSON().components.map(component=>component.label));
  assert.deepEqual(labels.slice(0,3),['Use @Alpha','Use @Beta','Cancel']);
});

test('registration final review contains editable metadata result and save action',()=>{
  const payload=registrationFinalReviewPayload({
    id:'draft1',house:{house_id:62,name:'Grand Psijic Villa'},esoOwner:'Alpha',visibility:'private',
    nickname:'My Villa',description:'A bright build',tags:['bright','guild'],expectedStatus:'active'
  });
  const description=payload.embeds[0].toJSON().description;
  for(const value of ['@Alpha','Grand Psijic Villa','Private','My Villa','A bright build','bright','guild','Active'])assert.match(description,new RegExp(value,'i'));
  const labels=payload.components.flatMap(row=>row.toJSON().components.map(component=>component.label));
  assert.deepEqual(labels,['Save House','Edit Details','Cancel']);
});

test('duplicate assistance offers view private copy update request and cancel without overwriting',()=>{
  const payload=registrationDestinationReviewPayload({
    id:'duplicate-draft',house:{house_id:62,name:'Grand Psijic Villa'},esoOwner:'Alpha',visibility:'public',expectedStatus:'active',
    existingEntries:[{id:9,scope:'global',display_name:'Existing Global'}]
  });
  const labels=payload.components.flatMap(row=>row.toJSON().components.map(component=>component.label));
  assert.deepEqual(labels,['View Existing','Save Separate Private Copy','Request an Update','Continue with New Visibility','Cancel']);
  assert.equal(labels.some(label=>/overwrite/i.test(label)),false);
});

test('registration drafts are owner-bound expire and are removable',()=>{
  let now=1000;
  const drafts=new RegistrationDraftService({clock:()=>now,tokenFactory:()=> 'draft-token'});
  drafts.create({userId:'u1',esoServer:'pc_na',visibility:'global'});
  assert.equal(drafts.get('draft-token','u2'),null);
  assert.equal(drafts.get('draft-token','u1').visibility,'global');
  drafts.update('draft-token','u1',{nickname:'Villa'});
  assert.equal(drafts.get('draft-token','u1').nickname,'Villa');
  now+=30*60*1000+1;
  assert.equal(drafts.get('draft-token','u1'),null);
  drafts.create({userId:'u1',esoServer:'pc_na'});
  assert.equal(drafts.remove('draft-token','u1'),true);
  assert.equal(drafts.get('draft-token','u1'),null);
});
