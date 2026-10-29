import {favoriteHeartIcon} from './house-card-cover.js';
import {escape} from './render.js';
import {csrfField} from './workspace-render.js';
import {houseReturnField} from './flow-navigation.js';
const hidden=(name,value)=>`<input type="hidden" name="${escape(name)}" value="${escape(value)}">`;
export const personalControls=(path,session,state={},returnTo,{stayOnList=false,heart=false}={})=>`<div class="${heart?'card-favorite':'actions personal-actions'}" role="group" aria-label="Save house"><form method="post" action="${path}" data-personal-action="favorite"${heart?' data-heart="true"':''}>${csrfField(session.csrf)}${houseReturnField(returnTo)}${stayOnList?hidden('stayOnList','1'):''}${hidden('action','favorite')}${hidden('value',Number(state?.is_favorite)?'0':'1')}<button${heart?` class="favorite-heart" aria-label="${Number(state?.is_favorite)?'Remove from favorites':'Add to favorites'}" title="${Number(state?.is_favorite)?'Remove from favorites':'Add to favorites'}"`:''} aria-pressed="${Boolean(Number(state?.is_favorite))}">${heart?favoriteHeartIcon:Number(state?.is_favorite)?'Unfavorite':'Favorite'}</button><span role="status" aria-live="polite"></span></form></div>`;
