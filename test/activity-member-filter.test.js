import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {UsageActivityService} from '../src/services/usage-activity-service.js';

test('activity combines exact person server and kind filters with stable newest-first tied cursors',async()=>{
 const {db,c,svc}=await fixture();try{
 const usage=new UsageActivityService(db,{clock:()=>Date.parse('2026-10-28T12:00:00Z')});
 const record=(eventKey,id,kind='searched_houses',originGuildId='g')=>usage.recordUsage({eventKey,kind,actor:{id,name:id==='u'?'Alice':'Bob'},originGuildId,originGuildName:originGuildId,esoServer:'pc_na',source:'web'});
 await record('1','u');await record('2','other');await record('3','u','searched_tours');await record('4','u','searched_houses','foreign');await record('5','u');await record('6','u');
 const page=await usage.listActivity(c,{server:'g',kind:'searched_houses',member:'u',limit:2});
 assert.deepEqual(page.items.map(x=>x.actorName),['Alice','Alice']);assert.ok(page.items[0].id>page.items[1].id);
 const older=await usage.listActivity(c,{server:'g',kind:'searched_houses',member:'u',limit:2,cursor:page.nextCursor});assert.equal(older.items.length,1);assert.ok(older.items[0].id<page.items[1].id);
 assert.equal((await usage.listActivity(c,{member:"u' OR 1=1 --"})).items.length,0);
 const secret=await svc.saved.createPrivate({userId:'u',esoServer:'pc_na',houseId:1,esoOwner:'SecretName'});
 await usage.recordUsage({eventKey:'secret',kind:'viewed_house',actor:{id:'u',name:'Alice'},originGuildId:'g',source:'discord',esoServer:'pc_na',target:{kind:'house',id:secret.id}});
 const personal=await usage.listActivity(c,{member:'u',kind:'used_personal'});assert.equal(personal.items.length,1);assert.equal(personal.items[0].targetUrl,null);assert.ok(!JSON.stringify(personal).includes('SecretName'));
 }finally{await closeDatabase(db);}
});

test('activity member suggestions are bounded and scoped and route preserves person filters',async()=>{
 const {db,c}=await fixture();try{
 const usage=new UsageActivityService(db,{clock:()=>Date.parse('2026-10-28T12:00:00Z')});
 for(const [eventKey,id,name,guild,kind] of [['1','u','Old Alice','g','searched_houses'],['2','u','Alice','g','searched_houses'],['3','b','Bob','g','searched_houses'],['4','foreign','Foreign','other','searched_houses'],['5','tour-only','Tour Person','g','searched_tours']])await usage.recordUsage({eventKey,kind,actor:{id,name},originGuildId:guild,source:'web',esoServer:'pc_na'});
 const options=await usage.activityMembers({server:'g',kind:'searched_houses',limit:1});assert.equal(options.members.length,1);assert.equal(options.hasMore,true);
 const all=await usage.activityMembers({server:'g',kind:'searched_houses'});assert.deepEqual(all.members.map(m=>[m.id,m.name]),[['u','Alice'],['b','Bob']]);
 for(let i=0;i<25;i++)await usage.recordUsage({eventKey:`extra-${i}`,kind:'searched_houses',actor:{id:'u',name:'Alice'},originGuildId:'g',source:'web',esoServer:'pc_na'});
 const {activityRoute}=await import('../src/web/activity-routes.js');
 const html=await activityRoute({workspace:{usage},context:c,query:{server:'g',kind:'searched_houses',member:'u'},render:(_t,body)=>body});
 assert.match(html,/People using HearthBound/);assert.match(html,/distinct Discord accounts/i);assert.match(html,/id="filter-member"/);assert.match(html,/name="member"[^>]+value="u"/);assert.doesNotMatch(html,/Active members/);assert.match(html,/server=g&amp;kind=searched_houses&amp;member=u&amp;cursor=/);
 }finally{await closeDatabase(db);}
});
