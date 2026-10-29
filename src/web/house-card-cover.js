import {escape} from './render.js';
export const favoriteHeartIcon='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"/></svg>';
export function guestFavoriteHeart(returnTo){return `<a class="favorite-heart guest-favorite" href="/auth/discord?returnTo=${escape(encodeURIComponent(returnTo))}" aria-label="Sign in to add to favorites" title="Sign in to add to favorites">${favoriteHeartIcon}</a>`;}
export function houseCardCover(h,{href=`/app/houses/${Number(h.id)}`,guest=false,caption}={}){
 const image=Number(h.cover_image_id),hasImage=Number.isSafeInteger(image)&&image>0,title=String(h.display_name||h.house_name||h.name||'House');
 const src=hasImage?`${guest?'/browse':'/app'}/houses/${Number(h.id)}/images/${image}`:'/assets/hearthbound-logo.png';
 return `<a class="house-card-cover${hasImage?'':' is-placeholder'}" href="${escape(href)}" aria-label="View ${escape(title)}"><img src="${src}" alt="${hasImage?escape(caption||`Screenshot of ${title}`):''}" loading="lazy" width="640" height="360">${hasImage?'':'<span>No screenshot yet</span>'}</a>`;
}
