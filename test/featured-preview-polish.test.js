import test from 'node:test';import assert from 'node:assert/strict';
import {featuredRoute} from '../src/web/featured-routes.js';
import {renderComments} from '../src/web/comment-view.js';
import {featuredPayload} from '../src/ui/engagement-ui.js';
test('featured previews expose safe rich house and tour metadata while excluding private foreign and stale records',async()=>{
 const c={guildId:'g',esoServer:'pc_na'},houses={1:{id:1,house_name:'Villa',display_name:'Garden',eso_owner:'Builder',zone:'Auridon',subzone:'Coast',style:'Altmer',tags:'["Garden"]',description:'First paragraph.\n\nSecond <script> paragraph.',scope:'public',guild_id:'g',eso_server:'pc_na',status:'active'},2:{id:2,display_name:'Secret',scope:'private',eso_server:'pc_na'},3:{id:3,display_name:'Foreign',scope:'global',eso_server:'pc_eu'}};
 const w={featured:async()=>[1,2,3,4].map(id=>({target_kind:'house',target_id:id})).concat({target_kind:'tour',target_id:9}),getHouse:async(c,id)=>{if(!houses[id])throw new Error('Gone');return houses[id];},getTourDraft:async()=>({canView:true,tour:{name:'Route',description:'A sunny walk',visibility:'global',eso_server:'pc_na'},stops:[{},{}]})};
 const html=await featuredRoute({workspace:w,context:c,render:(title,body)=>body});for(const text of ['Builder','Auridon','Coast','Altmer','Garden','First paragraph','Second &lt;script&gt;','A sunny walk','2 stops','View house','Add to tour'])assert.ok(html.includes(text),text);assert.doesNotMatch(html,/Secret|Foreign|<script>/);
});
test('comments put escaped real author and date above text and separate entries',()=>{
 const html=renderComments([{discord_user_id:'42',author_name:'A <B>',created_at:'2026-10-28 16:20:00',comment_text:'Hello <script>\nNext'},{discord_user_id:'99',created_at:'invalid',comment_text:'Second'}],'42');assert.ok(html.indexOf('A &lt;B&gt;')<html.indexOf('Hello &lt;script&gt;'));assert.match(html,/<time datetime="2026-10-28T16:20:00.000Z"/);assert.match(html,/99/);assert.doesNotMatch(html,/<script>|Unknown user|Invalid Date/);assert.equal((html.match(/class="comment-entry"/g)||[]).length,2);
});
test('Discord Featured rich fields remain within embed limits',()=>{
 const p=featuredPayload({items:[{position:1,target_kind:'house',target_id:1,target_name:'Garden',house_id:1,eso_owner:'Builder',description:'Rich description',zone:'Auridon',style:'Altmer'}]});const json=p.embeds[0].toJSON();assert.match(JSON.stringify(json),/Rich description/);assert.match(JSON.stringify(json),/Auridon/);for(const field of json.fields)assert.ok(field.value.length<=1024);
});
