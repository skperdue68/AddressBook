import test from 'node:test';import assert from 'node:assert/strict';
import {houseCards} from '../src/web/workspace-routes.js';import {houseCardCover,guestFavoriteHeart} from '../src/web/house-card-cover.js';
const house={id:7,house_id:1,destination_id:3,scope:'global',status:'active',house_name:'Garden',eso_owner:'Builder'};
test('house cover uses dim original logo only when no photo exists',()=>{
 assert.match(houseCardCover(house),/is-placeholder/);assert.match(houseCardCover(house),/hearthbound-logo.png/);
 const photo=houseCardCover({...house,cover_image_id:9});assert.match(photo,/\/app\/houses\/7\/images\/9/);assert.doesNotMatch(photo,/is-placeholder|hearthbound-logo/);
});
test('house card hearts are accessible reversible controls with SVG and no duplicate favorite button',()=>{
 for(const favorite of [0,1]){const html=houseCards([{...house,personal_state:{is_favorite:favorite}}],{csrf:'token',returnTo:'/app/houses?page=2'});assert.match(html,/data-heart="true"/);assert.match(html,new RegExp('aria-pressed="'+Boolean(favorite)+'"'));assert.match(html,new RegExp('aria-label="'+(favorite?'Remove from favorites':'Add to favorites')+'"'));assert.match(html,/<svg/);assert.match(html,/name="value" value="[01]"/);assert.doesNotMatch(html,/>Favorite<|>Unfavorite</);}
 assert.match(guestFavoriteHeart('/app/houses/7'),/returnTo=%2Fapp%2Fhouses%2F7/);
});

import {handleWebActions} from '../src/web/web-actions-routes.js';import {personalControls} from '../src/web/personal-controls.js';
test('Featured heart native POST fallback retains Featured instead of jumping to house detail',async()=>{
 const html=personalControls('/app/houses/7/actions',{csrf:'token'},{},'/app/featured',{stayOnList:true,heart:true});assert.match(html,/name="returnTo" value="\/app\/featured"/);let location;
 await handleWebActions({request:{headers:{}},url:new URL('https://example.test/app/houses/7/actions'),session:{},context:{},workspace:{actions:{houseAction:async()=>({is_favorite:1})}},form:new URLSearchParams({action:'favorite',value:'1',stayOnList:'1',returnTo:'/app/featured'}),response:{},setUsageKind(){},redirect:(_r,path)=>{location=path;}});assert.equal(location,'/app/featured');
});
