import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {createHousingMenu} from '../src/ui/housing-menu.js';
import {houseTarget} from '../src/utils/house-target.js';
const controls=p=>p.components?.flatMap(r=>r.toJSON().components)||[];
test('Discord saved library filters foreign registrations before deduplicating a visible marked destination',async()=>{
 const {db,svc}=await fixture();try{
  const foreign=await svc.saved.createPublic({esoServer:'pc_na',guildId:'other',houseId:1,esoOwner:'SameBuilder',displayName:'Foreign registration',createdBy:'u'}),global=await svc.saved.createGlobal({esoServer:'pc_na',originGuildId:'g',houseId:1,esoOwner:'SameBuilder',displayName:'Accessible saved destination',createdBy:'someone'});
  await svc.actions.states.setFavorite({userId:'u',target:houseTarget(global),visibleTarget:global,favorite:true});
  await svc.saved.createPublic({esoServer:'pc_na',guildId:'other',houseId:2,esoOwner:'ForeignOnly',displayName:'Foreign only hidden',createdBy:'u'});
  const menu=createHousingMenu(db);let payload;const i={customId:'hu:my:library',guildId:'g',channelId:'c',user:{id:'u'},member:{roles:{cache:new Map()}},update:async p=>payload=p,reply:async p=>payload=p};await menu.button(i);
  const text=JSON.stringify(payload);assert.doesNotMatch(text,/Foreign registration|Foreign only hidden/);assert.match(text,/Accessible saved destination/);const picker=controls(payload).find(b=>b.type===3);if(picker){await menu.select({...i,customId:picker.custom_id,values:['0']});assert.doesNotMatch(JSON.stringify(payload),/no longer available/);assert.match(JSON.stringify(payload),/Accessible saved destination/);}
  assert.ok(foreign.id!==global.id);
 }finally{await closeDatabase(db);}
});
