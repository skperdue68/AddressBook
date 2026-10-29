import {escape} from './render.js';
import {portalPublicUrl} from './portal-url.js';
export function tourWebPath(t){const path=`/app/tours/${Number(t.id)}`,query=new URLSearchParams();if(t.visibility==='public'&&t.guild_id)query.set('guildId',t.guild_id);if(t.eso_server)query.set('esoServer',t.eso_server);return query.size?`${path}?${query}`:path;}
export function tourWebUrl(t,base=portalPublicUrl()){const path=tourWebPath(t);return base?new URL(path,base).href:path;}
export function tourLinkMarkup(t){return `<section class="panel" id="tour-link"><h2>Link to this tour</h2><p class="note">Copy this address to point someone straight to the tour. Sign-in and the tour’s normal viewing permissions still apply.</p><pre data-absolute-url><code>${escape(tourWebUrl(t))}</code></pre></section>`;}
