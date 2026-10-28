import {houseReturnField} from './flow-navigation.js';
import {escape} from './render.js';
import {csrfField,linkButton,scopeLabel} from './workspace-render.js';

const paths={home:'m3 10 9-7 9 7v10H3Zm6 10v-7h6v7',location:'M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0ZM9 10a3 3 0 1 0 6 0 3 3 0 1 0-6 0',capacity:'M4 12V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5M3 11h3v5h12v-5h3v8H3Zm3 8v2m12-2v2',coins:'M20 7c0 3-16 3-16 0s16-3 16 0ZM4 7v10c0 3 16 3 16 0V7M4 12c0 3 16 3 16 0',tour:'M5 5h14v14H5ZM8 9h8m-8 4h8m-8 4h4'};
const icon=name=>`<svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.home}"/></svg>`;
const present=value=>value!==null&&value!==undefined&&value!=='';
const number=value=>/^\d+$/.test(String(value))?new Intl.NumberFormat('en-US').format(Number(value)):escape(value);

export function houseMetadata(h){
 const groups=[
  ['home','Home & location',[['Classification','classification'],['House type','house_type'],['Architecture / style','style'],['Zone','zone'],['Subzone','subzone']]],
  ['capacity','Furnishing capacity',[['Furnishings','furnishing_limit'],['Furnishings · ESO Plus','furnishing_limit_plus'],['Special furnishings','special_furnishing_limit'],['Special furnishings · ESO Plus','special_furnishing_limit_plus'],['Collectibles','collectible_limit'],['Collectibles · ESO Plus','collectible_limit_plus'],['Special collectibles','special_collectible_limit'],['Special collectibles · ESO Plus','special_collectible_limit_plus'],['Visitors','population_limit'],['Visitors · ESO Plus','population_limit_plus']]],
  ['coins','Purchase & availability',[['Purchase type','purchase_type'],['Gold price','gold_price'],['Crowns · unfurnished','crown_price_unfurnished'],['Crowns · furnished','crown_price_furnished'],['Requirements','requirements'],['Availability','availability'],['Last verified','last_verified']]]
 ];
 const cards=groups.map(([symbol,title,fields])=>{const rows=fields.filter(([,key])=>present(h[key]));return rows.length?`<section class="house-detail-group"><h3>${icon(symbol)}${escape(title)}</h3><dl>${rows.map(([label,key])=>`<div class="house-detail-field"><dt>${escape(label)}</dt><dd>${number(h[key])}</dd></div>`).join('')}</dl></section>`:'';}).join('');
 return `<details class="panel house-metadata" open><summary>${icon('home')}<span>Official house details<small>Location, capacity and purchase information</small></span></summary><div class="house-detail-grid">${cards||'<p>No additional official details are available yet.</p>'}</div></details>`;
}

export function houseTourSection(h,tours,csrf,{returnTo}={}){
 if(h.status!=='active')return '';
 const explanation=h.scope==='private'?'This is a Private house. Only your own Private tours can contain it.':h.scope==='public'?'Choose a Server tour from this house’s server, or an eligible Private tour. Global tours require Global houses.':'Choose a tour you can edit in this ESO environment.';
 return `<section class="panel house-tour-section" id="add-to-tour" tabindex="-1"><h2>${icon('tour')}Add to existing tour</h2><p>${explanation}</p>${tours.length?`<form action="/app/houses/${Number(h.id)}/add-to-tour" method="post">${csrfField(csrf)}${houseReturnField(returnTo)}<label>Choose an existing tour<select name="tourId" required>${tours.map(t=>`<option value="${Number(t.id)}">${escape(t.name)} · ${scopeLabel(t.visibility)}</option>`).join('')}</select></label><label>Tour-specific notes (optional)<textarea name="notes" maxlength="1000" placeholder="What should visitors look for at this stop?"></textarea></label><p class="note">These notes appear only in this tour, alongside the house description.</p><button class="primary">Add house to tour</button><p class="note">The house is appended to the route. You can reorder it in the tour editor.</p></form>`:`<p class="note">No eligible existing tours are available. Tours that already contain this destination, or have 250 stops, are omitted.</p>${linkButton('Create an eligible tour with this house',`/app/tours/new?houseId=${Number(h.id)}`)}`}</section>`;
}
