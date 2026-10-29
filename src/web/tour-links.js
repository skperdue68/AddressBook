import {escape} from './render.js';
import {portalPublicUrl} from './portal-url.js';
export function tourWebPath(t){return `/app/tours/${Number(t.id)}`;}
export function tourWebUrl(t,base=portalPublicUrl()){const path=tourWebPath(t);return base?new URL(path,base).href:path;}
export function tourLinkMarkup(t){return `<section class="panel" id="tour-link"><h2>Link to this tour</h2><p class="note">Copy this address to point someone straight to the tour. Sign-in and the tour’s normal viewing permissions still apply.</p><pre data-absolute-url><code>${escape(tourWebUrl(t))}</code></pre></section>`;}
