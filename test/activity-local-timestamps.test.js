import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {activityRoute} from '../src/web/activity-routes.js';
test('each activity action exposes a complete unambiguous timestamp before browser localization',async()=>{
 const usage={listActivity:async()=>({items:[{id:2,actorName:'A',action:'Registered a house',serverName:'Guild',source:'web',occurredAt:'2026-10-28T18:04:05.000Z'},{id:1,actorName:'B',action:'Started a tour',serverName:'Guild',source:'discord',occurredAt:'2026-10-27T12:00:00.000Z'}]}),usageTotals:async()=>({actions:2,members:2,servers:1}),activityServers:async()=>[],activityMembers:async()=>({members:[]})};
 const html=await activityRoute({workspace:{usage},context:{},render:(_t,body)=>body});assert.equal((html.match(/data-local-datetime/g)||[]).length,2);assert.match(html,/2026-10-28 18:04:05 UTC/);assert.match(html,/datetime="2026-10-28T18:04:05.000Z"/);assert.ok(html.indexOf('Registered a house')<html.indexOf('Started a tour'));
});
test('browser displays full local dates and times with correct daylight saving zones',async()=>{
 const script=await readFile(new URL('../src/web/assets/interface.js',import.meta.url),'utf8'),times=['2026-01-15T18:04:05.000Z','2026-07-15T18:04:05.000Z'].map(dateTime=>({dateTime,textContent:'UTC fallback',title:'',getAttribute:key=>key==='datetime'?dateTime:null})),note={textContent:''};
 class LocalFormatter extends Intl.DateTimeFormat{constructor(locale,options){super('en-US',{...options,timeZone:'America/Chicago'});}}
 const document={querySelectorAll:selector=>selector==='[data-local-datetime]'?times:[],querySelector:selector=>selector==='[data-local-time-zone]'?note:null};vm.runInNewContext(script,{document,Intl:{DateTimeFormat:LocalFormatter},Date});
 assert.match(times[0].textContent,/Jan 15, 2026/);assert.match(times[0].textContent,/12:04:05 PM CST/);assert.match(times[1].textContent,/Jul 15, 2026/);assert.match(times[1].textContent,/1:04:05 PM CDT/);assert.match(note.textContent,/America\/Chicago/);
});
import {homeRoute} from '../src/web/home-route.js';
test('Overview recent activity includes a full localizable date and time for each newest-first action',async()=>{
 const items=[{actorName:'Newest',action:'registered a house',serverName:'Guild',source:'web',occurredAt:'2026-10-28T18:04:05.000Z'},{actorName:'Older',action:'started a tour',serverName:'Guild',source:'discord',occurredAt:'2026-10-27T12:00:00.000Z'}];
 const html=await homeRoute({workspace:{statistics:{snapshot:async()=>({})},usage:{listActivity:async()=>({items})}},context:{guildName:'Guild'},render:(_title,body)=>body});
 assert.equal((html.match(/data-local-datetime/g)||[]).length,2);assert.match(html,/datetime="2026-10-28T18:04:05.000Z"/);assert.match(html,/2026-10-28 18:04:05 UTC/);assert.ok(html.indexOf('Newest')<html.indexOf('Older'));assert.match(html,/data-local-time-zone/);
});
