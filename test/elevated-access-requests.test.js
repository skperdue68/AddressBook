import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './workspace-fixture.js';import {closeDatabase} from '../src/db/database.js';import {requestableAccessKinds} from '../src/services/access-request-options.js';
test('elevated access choices exclude held, pending and unavailable scopes',async t=>{
 const {db,svc,c}=await fixture();t.after(()=>closeDatabase(db));assert.deepEqual(await requestableAccessKinds(svc.policy,c),['server','global']);const owner=await svc.fresh({...c,userId:'1'});assert.deepEqual(await requestableAccessKinds(svc.policy,owner),[]);const staff=await svc.fresh({...c,memberRoleIds:['staff']});assert.deepEqual(await requestableAccessKinds(svc.policy,staff),['global']);
 await svc.policy.server.request({guildId:c.guildId,userId:c.userId,reason:'Help the community'});assert.deepEqual(await requestableAccessKinds(svc.policy,c),['global']);await svc.policy.global.requestAccess({guildId:c.guildId,userId:c.userId,esoServer:c.esoServer,reason:'Help more communities'});assert.deepEqual(await requestableAccessKinds(svc.policy,c),[]);
 const personal=await svc.authorizeContext({userId:'personal',guildId:'',personalWorkspace:true,esoServer:'pc_na'});assert.deepEqual(await requestableAccessKinds(svc.policy,personal),['global']);
});

import {helpPayload} from '../src/ui/housing-ui.js';
import {moderatorAccessPayload,serverAccessPayload} from '../src/ui/moderator-access-ui.js';
const components=p=>p.components.flatMap(r=>r.toJSON().components);
test('Discord separates eligible requests from setup and review tools',()=>{
 assert.ok(!components(helpPayload()).some(c=>c.label==='Request Elevated Access'));
 const support=components(helpPayload({requestableKinds:['server'],canSetUpServer:true,canReviewGlobal:true}));
 for(const label of ['Request Elevated Access','Set Up Server Administration','Review Global Access'])assert.ok(support.some(c=>c.label===label));
 const choices=components(moderatorAccessPayload(['server','global'])).find(c=>c.options);assert.deepEqual(choices.options.map(o=>o.value),['server','global']);
 assert.ok(!components(serverAccessPayload({access:{isModerator:true},request:null,hasReviewers:true})).some(c=>c.custom_id==='hu:servermod:request'));
 assert.ok(!components(serverAccessPayload({access:{},request:{status:'pending'},hasReviewers:true})).some(c=>c.custom_id==='hu:servermod:request'));
});

import {handleWebActions} from '../src/web/web-actions-routes.js';
import {renderAccountMenu} from '../src/web/account-menu.js';
test('request pages hide held or pending choices and profile links target the only eligible kind',async()=>{
 const {db,svc,c}=await fixture();try{
 let html='';const args={request:{headers:{}},url:new URL('https://example.test/app/request-access'),session:{csrf:'token'},context:c,workspace:{actions:{},policy:svc.policy},render:(title,body)=>{html=body;}};
 await handleWebActions(args);assert.match(html,/name="kind" value="server"/);assert.match(html,/name="kind" value="global"/);
 await svc.policy.server.request({guildId:c.guildId,userId:c.userId,reason:'Help review submissions'});await handleWebActions(args);assert.doesNotMatch(html,/name="kind" value="server"/);assert.match(html,/name="kind" value="global"/);
 const menu=renderAccountMenu({id:c.userId,username:'Tester'},{...c,requestableAccess:['global']});assert.match(menu,/request-access\?kind=global/);assert.match(menu,/Request Elevated Access/);
 assert.doesNotMatch(renderAccountMenu({id:'1',username:'Owner'},{...c,isOwner:true}),/Request Elevated Access/);
 args.url=new URL('https://example.test/app/request-access?kind=server');await handleWebActions(args);assert.doesNotMatch(html,/<form/);assert.match(html,/No additional elevated access/);
 }finally{await closeDatabase(db);}
});
