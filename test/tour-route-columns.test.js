import test from 'node:test';import assert from 'node:assert/strict';import {tourStopList} from '../src/web/tour-stop-list.js';
test('tour rows align nickname owner official house description and capacity, with separate tour notes',()=>{
 const html=tourStopList([{id:1,position:1,saved_house_id:7,display_name:'Tour title',registration_nickname:'Moon Garden',house_name:'Snugpod',eso_owner:'Builder',registration_description:'A quiet <garden> with lovely views',notes:'Look upstairs',population_limit:6,cover_image_id:3}],{tourId:4,canEdit:true,currentStopId:1});
 for(const label of ['House / nickname','ESO owner','Official house','Description','Maximum visitors','Moon Garden','Snugpod','Builder','A quiet &lt;garden&gt;','Tour note','Look upstairs'])assert.ok(html.includes(label),label);assert.match(html,/aria-current="step"/);assert.match(html,/\/app\/houses\/7\/images\/3/);assert.match(html,/\/app\/tours\/4\/stops\/1/);
});
test('restricted stops expose no house metadata or screenshot even if raw fields remain',()=>{
 const html=tourStopList([{id:1,position:1,saved_house_id:7,display_name:'Restricted or unavailable stop',house_name:null,registration_nickname:'Secret',eso_owner:'HiddenOwner',registration_description:'Confidential',cover_image_id:3,population_limit:24,notes:'Private notes'}]);assert.doesNotMatch(html,/Secret|HiddenOwner|Confidential|Private notes|images\/3|24/);assert.match(html,/Restricted or unavailable stop/);
});

import {tourDetailPayload,tourManagePayload} from '../src/ui/housing-ui.js';import {tourSelectionReviewPayload} from '../src/ui/tour-selection-ui.js';
test('Discord compact route retains house owner and capacity and shows descriptions when space permits',()=>{
 const stop={id:1,position:1,display_name:'Moon Garden',house_name:'Snugpod',eso_owner:'Builder',registration_description:'A quiet garden to explore.',population_limit:6};
 for(const payload of [tourDetailPayload({id:1,name:'Route'},[stop]),tourManagePayload({id:1,name:'Route'},[stop])]){const fields=payload.embeds[0].toJSON().fields,text=fields.map(f=>f.value).join(' ');for(const value of ['Moon Garden','Snugpod','Builder','A quiet garden','👥 6'])assert.ok(text.includes(value),value);assert.ok(fields.every(f=>f.value.length<=1024));}
 const review=tourSelectionReviewPayload({token:'t',rows:[stop],backId:'back'});assert.equal(review.components[0].toJSON().components[0].options[0].description,'A quiet garden to explore.');
 const large=tourManagePayload({id:1,name:'Long route'},Array.from({length:250},(_,i)=>({...stop,position:i+1})));assert.ok(large.embeds[0].toJSON().fields[0].value.length<=1024);
});

import {fixture} from './workspace-fixture.js';import {closeDatabase} from '../src/db/database.js';
test('tour drafts supply house description and nickname only while the house remains visible',async t=>{
 const {db,svc,c}=await fixture();t.after(()=>closeDatabase(db));const owner=await svc.fresh({...c,userId:'1'}),house=await svc.registerHouse(owner,{houseId:1,esoOwner:'SecretBuilder',displayName:'Secret nickname',description:'Secret description',visibility:'global'}),tour=await svc.saveTourDraft(owner,{details:{name:'Route',visibility:'global'},stopIds:[house.id]});let draft=await svc.getTourDraft(c,tour.id);assert.equal(draft.stops[0].registration_description,'Secret description');assert.equal(draft.stops[0].registration_nickname,'Secret nickname');await db.query("UPDATE saved_houses SET scope='private',owner_user_id='other' WHERE id=?",[house.id]);draft=await svc.getTourDraft(c,tour.id);assert.equal(draft.stops[0].registration_description,null);assert.equal(draft.stops[0].registration_nickname,null);assert.doesNotMatch(tourStopList(draft.stops),/SecretBuilder|Secret nickname|Secret description/);
});
