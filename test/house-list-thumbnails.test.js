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
import {tourEditorBody} from '../src/web/editor-forms.js';
import {tourHousePicker} from '../src/web/tour-house-picker.js';
test('tour candidates and existing draft stops display their cover without placeholders for text-only houses',()=>{
 const candidate={...house,house_name:'Garden',guild_id:'g'},stop={saved_house_id:7,display_name:'Garden',house_name:'Garden',eso_owner:'Builder',cover_image_id:9};
 const body=tourEditorBody({isNew:false,id:1,draft:{tour:{creator_id:'u'}},tour:{creator_id:'u',guild_id:'g',name:'Route',visibility:'public'},stops:[stop],candidates:[candidate],session:{csrf:'c'},context:{userId:'u',guildId:'g'},version:'v'});
 assert.match(body.split('id="tour-stops"')[1].split('id="order-status"')[0],/\/app\/houses\/7\/images\/9/);assert.match(tourHousePicker([candidate],[]),/data-cover-image="9"/);assert.match(tourHousePicker([candidate],[]),/\/app\/houses\/7\/images\/9/);assert.doesNotMatch(tourHousePicker([{...candidate,cover_image_id:null}],[]),/<img/);
});
