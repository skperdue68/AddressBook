import test from 'node:test';
import assert from 'node:assert/strict';
import {houseCards} from '../src/web/workspace-routes.js';
const house={id:7,house_id:47,destination_id:3,house_name:'Official Cottage',display_name:'Garden <home>',eso_owner:'Builder',zone:'Glenumbra',scope:'public',status:'active',cover_image_id:9};
test('compact and card house lists place an available cover thumbnail beside the name and hide routine Active status',()=>{
 for(const view of ['list','cards']){
 const html=houseCards([house],{view,returnTo:'/app/personal/favorites'});assert.match(html,/class="house-list-thumbnail"/);assert.match(html,/width="96" height="64"/);assert.ok(html.indexOf('Garden &lt;home&gt;')<html.indexOf('<img'));assert.match(html,/\/app\/houses\/7\/images\/9/);assert.match(html,/#screenshots/);assert.match(html,/returnTo=/);assert.doesNotMatch(html,/>active<|>Active</);
 }
});
test('text-only houses keep their names without placeholders and actionable Pending status remains',()=>{
 for(const view of ['list','cards']){
 const html=houseCards([{...house,cover_image_id:null,status:'pending'}],{view});assert.doesNotMatch(html,/<img|house-list-thumbnail/);assert.match(html,/Garden &lt;home&gt;/);assert.match(html,/>pending</);
 }
});
import {featuredRoute} from '../src/web/featured-routes.js';
test('Featured cards show the available gallery cover and stay text-only when no screenshot exists',async()=>{
 const context={guildId:'g',esoServer:'pc_na'},base={...house,guild_id:'g',eso_server:'pc_na'},workspace={featured:async()=>[{target_kind:'house',target_id:7}],getHouse:async()=>base,images:{list:async()=>[{id:9,caption:'Garden screenshot'}]}};
 const first=await featuredRoute({workspace,context,render:(_title,body)=>body});assert.match(first,/class="house-cover"/);assert.match(first,/\/app\/houses\/7\/images\/9/);assert.match(first,/Garden screenshot/);
 workspace.images.list=async()=>[];const empty=await featuredRoute({workspace,context,render:(_title,body)=>body});assert.doesNotMatch(empty,/<img/);assert.match(empty,/Garden &lt;home&gt;/);
});
