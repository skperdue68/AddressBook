import test from 'node:test';
import assert from 'node:assert/strict';
import {personalLibrary} from '../src/services/personal-library-service.js';
test('address book unions submitted and saved destinations, deduplicates and paginates',async()=>{
 const own={id:2,destination_id:4,scope:'private',display_name:'Mine'};
 const saved={id:1,destination_id:4,scope:'global',display_name:'Shared'};
 const official={house_id:8,scope:'official',display_name:'Catalog'};
 const workspace={personalCollection:async()=>({rows:[own],hasNext:false}),actions:{personal:async(c,kind)=>kind==='favorites'?[saved,official]:[]}};
 const result=await personalLibrary(workspace,{},{});
 assert.deepEqual(result.rows.map(r=>r.scope),['official','private']);
 assert.equal(result.total,2);
});
import {houseTools,houseQuickActions,handleWebActions} from '../src/web/web-actions-routes.js';
test('personal controls expose auto-save forms, selected visit state and reversible favorite',async()=>{
 const html=await houseQuickActions({workspace:{actions:{states:{get:async()=>({is_favorite:1,visit_state:'visited'})}}},context:{},session:{csrf:'token'},house:{id:1,destination_id:1,status:'active',canEdit:false},returnTo:'/app/personal'});
 assert.match(html,/data-personal-action="favorite"/);
 assert.match(html,/aria-label="Remove from favorites"/);
 assert.doesNotMatch(html,/data-personal-action="visit"/);
 assert.match(html,/role="status"/);
});
test('personal action responds with JSON state without redirecting when requested',async()=>{
 let body;const response={writeHead(){},end(value){body=JSON.parse(value);}};
 const form=new URLSearchParams({action:'favorite',value:'1'});
 await handleWebActions({request:{headers:{accept:'application/json'}},url:new URL('https://example.test/app/houses/1/actions'),session:{},context:{},workspace:{actions:{houseAction:async()=>({is_favorite:1,visit_state:'none'})}},form,response,setUsageKind(){},redirect(){throw Error('unexpected redirect');}});
 assert.equal(body.state.is_favorite,1);
});
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
test('library includes saved official houses but excludes viewed-only and inaccessible private destinations',async()=>{
 const {db,svc,c}=await fixture();
 try{
  const mine=await svc.saved.createPrivate({userId:c.userId,originGuildId:c.guildId,esoServer:c.esoServer,houseId:1,esoOwner:'Mine',createdBy:c.userId});
  const viewed=await svc.saved.createPublic({guildId:c.guildId,esoServer:c.esoServer,houseId:1,esoOwner:'Viewed',createdBy:'other'});
  const hidden=await svc.saved.createPrivate({userId:'other',originGuildId:c.guildId,esoServer:c.esoServer,houseId:1,esoOwner:'Hidden',createdBy:'other'});
  await svc.actions.book.recordView(c.userId,viewed.id);
  const official={scope:'official',house_id:1};
  await svc.actions.states.setFavorite({userId:c.userId,target:{kind:'official',id:1},favorite:true,visibleTarget:official});
  await svc.actions.states.setFavorite({userId:c.userId,target:{kind:'destination',id:hidden.destination_id},favorite:true,visibleTarget:hidden});
  const result=await personalLibrary(svc,c,{});
  assert.ok(result.rows.some(row=>row.id===mine.id&&row.scope!=='official'));
  assert.ok(result.rows.some(row=>row.house_id===1&&row.scope==='official'));
  assert.ok(!result.rows.some(row=>row.id===viewed.id&&row.scope!=='official'));
  assert.ok(!result.rows.some(row=>row.id===hidden.id&&row.scope!=='official'));
 }finally{await closeDatabase(db);}
});
import vm from 'node:vm';
import fs from 'node:fs';
test('browser visit select autosaves without navigation and restores saved value on failure',async()=>{
 const handlers={},status={textContent:''},select={value:'none',addEventListener(event,handler){handlers[event]=handler;}},fields={action:'visit',value:'none',csrf:'token'};
 const form={dataset:{},action:{value:'visit'},getAttribute(name){return name==='action'?'https://example.test/app/houses/1/actions':null;},querySelector(selector){return selector==='[role="status"]'?status:selector==='select'?select:null;},setAttribute(){},removeAttribute(){},addEventListener(){}};
 let calls=0;
 const context={document:{querySelectorAll(selector){return selector==='form[data-personal-action]'?[form]:[];}},window:{addEventListener(){}},location:{hash:''},FormData:class{constructor(){return Object.entries({...fields,value:select.value});}},URLSearchParams,fetch:async(url)=>{assert.equal(url,'https://example.test/app/houses/1/actions','use action attribute even when hidden input shadows form.action');calls++;return {ok:calls===1,json:async()=>calls===1?{ok:true,state:{visit_state:'visited'}}:{error:'Try again'}};}};
 vm.runInNewContext(fs.readFileSync(new URL('../src/web/assets/web-actions.js',import.meta.url),'utf8'),context);
 select.value='visited';await handlers.change();assert.equal(calls,1);assert.equal(status.textContent,'Saved');assert.equal(select.value,'visited');
 select.value='want_to_visit';await handlers.change();assert.equal(calls,2);assert.equal(status.textContent,'Try again');assert.equal(select.value,'visited');assert.equal(select.disabled,false);
});
test('stop editor saves and cancels back to originating tour editor in one action row',async()=>{
 const workspace={getTourDraft:async()=>({canEdit:true,version:'v',stops:[{id:3,house_name:'House',display_name:'Stop'}]}),actions:{updateStop:async()=>{}}};let html='',location='';
 const args={request:{headers:{}},url:new URL('https://example.test/app/tours/1/stops/3?backTo=%2Fapp%2Ftours%2F1%2Fedit'),session:{csrf:'token'},context:{},workspace,render:(title,body)=>{html=body;},redirect:(r,url)=>{location=url;},response:{},setUsageKind(){}};
 await handleWebActions(args);assert.match(html,/<div class="actions"><button[^>]*>Save stop details<\/button><a[^>]*href="\/app\/tours\/1\/edit"[^>]*>Cancel<\/a><\/div>/);
 await handleWebActions({...args,form:new URLSearchParams({backTo:'/app/tours/1/edit',version:'v'})});assert.equal(location,'/app/tours/1/edit');
});
test('library preserves personal state when its submitted registration represents a saved destination',async()=>{
 const own={id:2,destination_id:4,scope:'private',display_name:'Mine'},saved={id:1,destination_id:4,scope:'global',personal_state:{is_favorite:1,visit_state:'visited'}};
 const workspace={personalCollection:async()=>({rows:[own],hasNext:false}),actions:{personal:async(c,kind)=>kind==='favorites'?[saved]:[]}};
 const result=await personalLibrary(workspace,{},{});assert.equal(result.rows[0].id,2);assert.equal(result.rows[0].personal_state.visit_state,'visited');
});
test('requested access kind selects the intended permission request without defaulting to Global',async()=>{
 let html='';const args={request:{headers:{}},url:new URL('https://example.test/app/request-access?kind=server'),session:{csrf:'token'},context:{userId:'u',guildId:'g',esoServer:'pc_na'},workspace:{actions:{},policy:{server:{status:async()=>({})},global:{statusForUser:async()=>({requests:[]})}}},render:(title,body)=>{html=body;}};
 await handleWebActions(args);assert.match(html,/name="kind" value="server"/);assert.doesNotMatch(html,/name="kind" value="global"/);
});
test('house editors get a visible top edit action for active and pending houses while readers do not',async()=>{
 const args={workspace:{actions:{states:{get:async()=>({})}}},context:{userId:'u'},session:{csrf:'x'},returnTo:'/app/houses?scope=public&view=cards'};
 for(const status of ['active','pending']){
  const editable=await houseQuickActions({...args,house:{id:158,destination_id:2,status,canEdit:true}});assert.match(editable,/>Edit house<\/a>/);assert.match(editable,/\/app\/houses\/158\/edit\?returnTo=/);assert.doesNotMatch(editable,/name="action" value="delete"/);
  const reader=await houseQuickActions({...args,house:{id:158,destination_id:2,status,canEdit:false}});assert.doesNotMatch(reader,/>Edit house<\/a>|\/158\/edit/);
 }
});

import './house-detail-player-hearts.test.js';
