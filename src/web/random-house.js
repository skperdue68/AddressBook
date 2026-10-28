import {escape} from './render.js';
import {linkButton,scopeLabel} from './workspace-render.js';
import {houseVisitCommands} from './house-visit.js';
import {renderComments} from './comment-view.js';

export function randomHousePreview(h,comments=[],userId){
 let tags=[];try{tags=Array.isArray(h.tags)?h.tags:JSON.parse(h.tags||'[]');}catch{}
 if(!Array.isArray(tags))tags=[];
 return `<p>A little inspiration from your accessible collection.</p><div class="panel"><span class="pill">${scopeLabel(h.scope)}</span><h2>${escape(h.display_name||h.house_name)}</h2><p><strong>${escape(h.house_name)}</strong> · ${escape(h.eso_owner)}</p><p>${[h.zone,h.classification||h.category,h.style].filter(Boolean).map(escape).join(' · ')}</p>${tags.length?`<p>${tags.map(tag=>`<span class="pill">${escape(tag)}</span>`).join(' ')}</p>`:''}${h.description?`<p class="user-text">${escape(h.description)}</p>`:''}${houseVisitCommands(h)}<div class="actions">${linkButton('More details',`/app/houses/${h.id}`,true)}${linkButton('Find another','/app/random')}</div></div><section class="panel"><h2>Recent comments</h2>${renderComments(comments.slice(0,3),userId)}<p class="note">Visited this house? Share a detail you loved.</p>${linkButton('Leave a comment / view all',`/app/houses/${h.id}#comments`)}</section>`;
}
