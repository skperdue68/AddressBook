import {houseCapacityBadge} from './house-capacity.js';
import {escape} from './render.js';
import {linkButton,scopeLabel} from './workspace-render.js';
import {houseVisitCommands} from './house-visit.js';
import {renderComments} from './comment-view.js';

export function randomHousePreview(h,comments=[],userId){
 let tags=[];try{tags=Array.isArray(h.tags)?h.tags:JSON.parse(h.tags||'[]');}catch{}
 if(!Array.isArray(tags))tags=[];
 return `<p>A little inspiration from your accessible collection.</p><div class="panel featured-card"><div class="eyebrow">YOUR NEXT OPEN DOOR</div><span class="pill">${scopeLabel(h.scope)}</span><h2>${escape(h.display_name||h.house_name)} ${houseCapacityBadge(h)}</h2>${h.images?.[0]?`<a href="/app/houses/${h.id}#screenshots"><img class="house-cover random-cover" src="/app/houses/${h.id}/images/${h.images[0].id}" alt="${escape(h.images[0].caption||h.display_name||h.house_name)}"></a>`:''}<p><strong>${escape(h.house_name)}</strong> · ${escape(h.eso_owner)}</p><div class="random-house-facts">${[["Zone",h.zone],["Classification",h.classification||h.category],["Style",h.style]].filter(([,value])=>value).map(([label,value])=>`<span class="pill">${label}: ${escape(value)}</span>`).join('')}</div>${tags.length?`<p>${tags.map(tag=>`<span class="pill">${escape(tag)}</span>`).join(' ')}</p>`:''}${h.description?`<p class="user-text">${escape(h.description)}</p>`:''}${houseVisitCommands(h)}<div class="actions">${linkButton('More details',`/app/houses/${h.id}`,true)}${linkButton('Find another','/app/random')}</div></div><section class="panel"><h2>Recent comments</h2>${renderComments(comments.slice(0,3),userId)}<p class="note">Visited this house? Share a detail you loved.</p>${linkButton('Leave a comment / view all',`/app/houses/${h.id}#comments`)}</section>`;
}
