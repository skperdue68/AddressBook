import test from 'node:test';import assert from 'node:assert/strict';
import {statisticsRoute} from '../src/web/statistics-routes.js';
const rows=Array.from({length:36},(_,i)=>({name:`House ${i+1}`,zone:'Zone',house_id:i+1,registrations:50-i,members:2,owners:1,tours:1,eso_owner:`Owner ${i+1}`,normalized_owner:`owner${i+1}`,houseTypes:1}));
const workspace={statistics:{snapshot:async()=>({}),popularity:async()=>rows,serverRankings:async()=>({houses:rows,owners:rows})}};
test('statistics ranks paginate independently in groups of 15 with numbered links and preserved metric',async()=>{
 const html=await statisticsRoute({workspace,context:{esoServer:'pc_na'},query:{housesPage:'2',ownersPage:'3',metric:'tours'},render:(_title,body)=>body});
 const tables=[...html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)].map(m=>m[1]);assert.deepEqual(tables.map(t=>(t.match(/<tr>/g)||[]).length),[15,6,15]);assert.match(tables[0],/>House 16</);assert.doesNotMatch(tables[0],/>House 1</);assert.match(tables[1],/>Owner 31</);assert.match(html,/housesPage=1/);assert.match(html,/ownersPage=2/);assert.match(html,/metric=tours/);assert.match(html,/>Next</);assert.match(html,/aria-current="page"[^>]*>2</);assert.match(html,/name="housesPage"/);
});
