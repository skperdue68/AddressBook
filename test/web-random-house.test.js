import test from 'node:test';
import assert from 'node:assert/strict';
import {randomHousePreview} from '../src/web/random-house.js';
test('random discovery shows destination facts and escaped recent comments without another click',()=>{
 const html=randomHousePreview({id:7,house_id:47,house_name:'Official Cottage',display_name:'My Build',eso_owner:'Builder',zone:'Glenumbra',classification:'Classic',scope:'public',tags:'["garden"]',description:'First\n\nSecond <script>'},Array.from({length:4},(_,i)=>({comment_text:`Comment ${i}`,author_name:'Visitor',created_at:'2026-10-28 12:00:00'})),'u');
 for(const text of ['Official Cottage','My Build','Glenumbra','Classic','garden','First\n\nSecond &lt;script&gt;','JumpToSpecificHouse','More details','Comment 2'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('Comment 3'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('/app/houses/7#comments'));
});
