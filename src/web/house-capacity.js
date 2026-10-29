import {houseCapacity} from '../utils/house-capacity.js';

export function houseCapacityBadge(h){
 const count=houseCapacity(h);if(count===null)return '';
 const label=`Maximum house capacity: ${count} player${count===1?'':'s'}`;
 return `<span class="house-capacity" title="${label}" aria-label="${label}"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="7" r="3"/><circle cx="17" cy="8" r="2.5" opacity=".75"/><path d="M2 21v-3a7 7 0 0 1 14 0v3Z"/><path d="M16 13a6 6 0 0 1 7 6v2h-5v-3a9 9 0 0 0-2-5Z" opacity=".75"/></svg><span aria-hidden="true">${count} max</span></span>`;
}
