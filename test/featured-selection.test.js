import test from 'node:test';
import assert from 'node:assert/strict';
import {engagementWeight,weightedOrder} from '../src/services/featured-selection.js';

test('engagement gives a bounded boost while quiet houses retain a chance',()=>{
 assert.equal(engagementWeight({}),1);
 assert.ok(engagementWeight({favorites:1})>1);
 assert.ok(engagementWeight({visitors:1})>1);
 assert.ok(engagementWeight({interested:1})>1);
 assert.equal(engagementWeight({favorites:100000}),2);
 let seed=7;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 let popular=0;for(let i=0;i<6000;i++)if(weightedOrder([{id:1},{id:2,favorites:100}],random)[0].id===2)popular++;
 assert.ok(popular>3600&&popular<4400,`popular selected ${popular}/6000; randomness must remain`);
});
