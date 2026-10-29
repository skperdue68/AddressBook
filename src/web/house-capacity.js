import {houseCapacity} from '../utils/house-capacity.js';

export function houseCapacityBadge(h){
 const count=houseCapacity(h);if(count===null)return '';
 const label=`Maximum house capacity: ${count} player${count===1?'':'s'}`;
 return `<span class="house-capacity" title="${label}" aria-label="${label}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 13a5 5 0 0 1 3 5v3"/></svg><span aria-hidden="true">${count}</span></span>`;
}
