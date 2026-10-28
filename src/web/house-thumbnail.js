import {escape} from './render.js';
import {houseFlowHref} from './flow-navigation.js';

export function houseListThumbnail(h,returnTo){
 const houseId=Number(h.id),imageId=Number(h.cover_image_id);
 if(h.scope==='official'||!Number.isSafeInteger(houseId)||houseId<1||!Number.isSafeInteger(imageId)||imageId<1)return '';
 const title=String(h.display_name||h.house_name||h.name||'House');
 return `<a class="house-list-thumbnail" href="${escape(houseFlowHref(houseId,returnTo,'screenshots'))}" aria-label="View screenshots of ${escape(title)}"><img src="/app/houses/${houseId}/images/${imageId}" alt="Screenshot of ${escape(title)}" loading="lazy" width="96" height="64"></a>`;
}
