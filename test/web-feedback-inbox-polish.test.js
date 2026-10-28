import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {feedbackRoute} from '../src/web/feedback-routes.js';
test('feedback status updates preserve notes, return revision and reject stale writes',async()=>{
 const {db,svc,c}=await fixture();try{
  const actor={...c,userId:'1'};const item=await svc.feedback.submit(c,{name:'Member'},{eventKey:randomUUID(),category:'bug',subject:'Problem',message:'Details'});
  await svc.feedback.review(actor,{id:item.id,revision:1,status:'reviewed',notes:'Keep internal notes'});
  const updated=await svc.feedback.review(actor,{id:item.id,revision:2,status:'resolved'});
  assert.equal(updated.revision,3);assert.equal(updated.review_notes,'Keep internal notes');
  await assert.rejects(()=>svc.feedback.review(actor,{id:item.id,revision:2,status:'new'}),/changed/);
  const notes=await svc.feedback.review(actor,{id:item.id,revision:3,notes:'Edited notes'});
  assert.equal(notes.status,'resolved');assert.equal(notes.review_notes,'Edited notes');
 }finally{await closeDatabase(db);}
});
test('feedback inbox exposes status controls separately from notes and preserves filters on JSON save',async()=>{
 let html='',input;const item={id:1,revision:2,status:'new',category:'bug',subject:'Problem',message:'Details',review_notes:'Keep notes'};
 const service={assertOwner(){},list:async()=>({rows:[item],page:2,total:26,hasNext:false}),review:async(c,fields)=>{input=fields;return {...item,status:fields.status,revision:3};}};
 const args={workspace:{feedback:service},context:{userId:'1'},session:{csrf:'token'},request:{headers:{accept:'application/json'}},url:new URL('https://example.test/app/feedback/review?status=new&page=2'),render:(title,body)=>{html=body;},response:{},send:(r,status,body)=>{html=JSON.parse(body);}};
 await feedbackRoute(args);assert.doesNotMatch(html,/>Send feedback</);assert.match(html,/data-feedback-action="status"/);assert.match(html,/<summary>Internal notes<\/summary>/);assert.match(html,/>Save notes<\/button>/);
 await feedbackRoute({...args,form:new URLSearchParams({action:'status',id:1,revision:2,status:'resolved'})});
 assert.equal(input.notes,undefined);assert.equal(html.item.revision,3);assert.equal(html.item.status,'resolved');
});
import vm from 'node:vm';
import fs from 'node:fs';
test('feedback browser saves status, refreshes both revisions and rolls back a stale edit',async()=>{
 const handlers={},badge={textContent:'New'},select={value:'new',options:[{textContent:'New'},{textContent:'Resolved'}],get selectedIndex(){return this.value==='resolved'?1:0;},addEventListener(type,handler){handlers[type]=handler;}};
 const makeForm=action=>{const fields={id:'1',revision:{value:'2'},action},status={textContent:''};return {dataset:{feedbackAction:action},fields,status,action:{value:action},getAttribute(name){return name==='action'?'https://example.test/app/feedback/review?status=new&page=2':null;},querySelector(selector){return selector==='[role="status"]'?status:selector==='[name="revision"]'?fields.revision:null;},setAttribute(){},removeAttribute(){},addEventListener(type,handler){this.submit=handler;}};};
 const statusForm=makeForm('status'),notesForm=makeForm('notes'),button={disabled:false},card={querySelector(selector){return selector==='[name="status"]'?select:badge;},querySelectorAll(selector){return selector==='form[data-feedback-action]'?[statusForm,notesForm]:[select,button];}};
 let calls=0,payload;const context={document:{querySelectorAll(selector){return selector==='[data-feedback-id]'?[card]:[];}},window:{addEventListener(){}},location:{hash:''},FormData:class{constructor(form){return Object.entries({id:1,revision:form.fields.revision.value,action:form.dataset.feedbackAction,status:select.value});}},URLSearchParams,fetch:async(url,options)=>{assert.equal(url,'https://example.test/app/feedback/review?status=new&page=2','hidden action input must not shadow request URL');payload=options.body;calls++;return {ok:calls===1,json:async()=>calls===1?{ok:true,item:{id:1,revision:3,status:'resolved'}}:{error:'This feedback changed. Reload the inbox.'}};}};
 vm.runInNewContext(fs.readFileSync(new URL('../src/web/assets/web-actions.js',import.meta.url),'utf8'),context);
 select.value='resolved';await handlers.change();assert.equal(payload.get('revision'),'2');assert.equal(statusForm.fields.revision.value,'3');assert.equal(notesForm.fields.revision.value,'3');assert.equal(badge.textContent,'Resolved');assert.equal(statusForm.status.textContent,'Saved');
 select.value='new';await handlers.change();assert.equal(select.value,'resolved');assert.equal(badge.textContent,'Resolved');assert.match(statusForm.status.textContent,/changed/);assert.equal(select.disabled,false);
});
