import {escape} from './render.js';
import {houseFlowHref,withHouseReturn} from './flow-navigation.js';
import {houseCapacityBadge} from './house-capacity.js';
import {houseListThumbnail} from './house-thumbnail.js';
import {linkButton,scopeLabel} from './workspace-render.js';
export const houseTable=(rows,{returnTo}={})=>rows.length?`<div class="table-wrap house-results"><table><thead><tr><th>House</th><th>ESO owner</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>${rows.map(h=>{
 const official=h.scope==='official',href=official?withHouseReturn(`/app/official/${Number(h.house_id)}`,returnTo):houseFlowHref(h.id,returnTo),title=h.display_name||h.house_name||h.name;
 return `<tr><td><div class="house-result-identity"><div><a href="${escape(href)}">${escape(title)}</a>${houseCapacityBadge(h)}<small>${escape(h.house_name||h.name)} · ${escape(h.zone)}</small></div>${houseListThumbnail(h,returnTo)}</div></td><td data-label="ESO owner">${official?'Unfurnished preview':escape(h.eso_owner)}</td><td data-label="Visibility"><span class="pill">${official?'Official preview':scopeLabel(h.scope)}</span>${h.status&&h.status!=='active'?`<small>${escape(h.status)}</small>`:''}</td><td><div class="actions result-actions">${linkButton(official?'Preview house':'View house',href)}${!official&&h.status==='active'?linkButton('Add to tour',houseFlowHref(h.id,returnTo,'add-to-tour')):''}</div></td></tr>`;
}).join('')}</tbody></table></div>`:'<p>No houses match this view. Register a house or try another search.</p>';
