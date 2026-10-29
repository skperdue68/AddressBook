import {houseCardCover} from './house-card-cover.js';
import {houseCapacityBadge} from './house-capacity.js';
import {escape} from './render.js';
import {linkButton,scopeLabel} from './workspace-render.js';
import {houseFlowHref,withHouseReturn} from './flow-navigation.js';
import {personalControls} from './personal-controls.js';

const tagsOf=value=>{try{const tags=Array.isArray(value)?value:JSON.parse(value||'[]');return Array.isArray(tags)?tags.map(String):[];}catch{return [];}};
const scopeOf=h=>h.scope==='server'?'public':h.scope==='personal'?'private':h.scope;
const emptyLists={
 '/app/personal':['Your address book starts here','Favorite a house or register a home to keep it here.'],
 '/app/personal/favorites':['No favorites yet','Choose the heart on any house card to save a place that stands out to you.'],
 '/app/personal/wantToVisit':['Your next visit starts here','Set a house’s visit status to Want to Visit to plan your next stop.'],
 '/app/personal/visited':['No visited houses yet','After exploring a house, set its visit status to Visited to keep track of your adventures.'],
 '/app/personal/submitted':['Share your first house','Houses you register appear here, with their current visibility and review status.'],
 '/app/personal/pending':['Nothing waiting for review','Any house submissions awaiting approval will appear here.'],
 '/app/personal/recent':['No recently viewed houses','Open a house to explore its details, and find it here again later.']
};
export function discoveryCards(rows,{csrf,returnTo}={}){
 if(!rows.length){const [title,text]=emptyLists[String(returnTo||'').split('?')[0]]||['No houses match this view','Try a broader search, register a house, or save a place that catches your eye.'];return `<div class="empty-collection"><h2>${title}</h2><p>${text}</p><div class="actions">${linkButton('Search houses','/app/houses')}${linkButton('Register New House','/app/register','primary')}</div></div>`;}
 return `<div class="discovery-grid">${rows.map(h=>{
  const official=h.scope==='official',href=official?withHouseReturn(`/app/official/${Number(h.house_id)}`,returnTo):houseFlowHref(h.id,returnTo),title=h.display_name||h.house_name||h.name||'House',tags=tagsOf(h.tags),description=String(h.description||'');
  const active=official||h.status==='active',canMark=active&&(official||Number(h.destination_id)>0);
  return `<article class="panel discovery-card">${houseCardCover(h,{href})}${csrf&&canMark?personalControls(official?`/app/official/${Number(h.house_id)}`:`/app/houses/${Number(h.id)}/actions`,{csrf},h.personal_state||{},returnTo,{stayOnList:true,heart:true}):''}<div class="discovery-badges"><span class="pill">${official?'Official preview':scopeLabel(scopeOf(h))}</span>${houseCapacityBadge(h)}${h.status&&h.status!=='active'?`<span class="pill">${escape(h.status)}</span>`:''}</div><div class="house-card-heading"><div><h2><a href="${escape(href)}">${escape(title)}</a></h2><p class="house-base-name">${escape(h.house_name||h.name||title)}</p></div></div><p class="house-owner">${h.eso_owner?`<strong>ESO owner</strong> @${escape(String(h.eso_owner).replace(/^@+/,''))}`:'Unfurnished official house'}</p><dl class="discovery-facts">${[['Zone',h.zone],['Classification',h.classification||h.category],['Style',h.style]].filter(([,value])=>value).map(([label,value])=>`<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>${description?`<p class="user-text discovery-description">${escape(description.slice(0,220))}${description.length>220?'…':''}</p>`:''}${tags.length?`<p class="house-tags">${tags.slice(0,4).map(tag=>`<a class="pill" href="/app/search?tag=${escape(encodeURIComponent(tag))}" title="Find houses with this tag">${escape(tag.slice(0,40))}</a>`).join(' ')}${tags.length>4?`<span class="note">+${tags.length-4} tags</span>`:''}</p>`:''}<div class="discovery-bottom"><div class="actions result-actions">${linkButton(official?'Preview house':'View house',href,'primary')}${active&&!official?linkButton('Add to tour',houseFlowHref(h.id,returnTo,'add-to-tour')):''}</div></div></article>`;
 }).join('')}</div>`;
}
export function personalNavigation(current='/app/personal',{hasLegacy=false}={}){
 const nav=(label,items)=>`<nav class="library-navigation" aria-label="${label}">${items.map(([text,url])=>`<a ${current===url?'aria-current="page"':''} href="${url}">${text}</a>`).join('')}</nav>`;
 return `<section class="library-views">${nav('My saved houses',[['All saved','/app/personal'],['Favorites','/app/personal/favorites'],['Submitted','/app/personal/submitted'],['Recently viewed','/app/personal/recent']])}<div class="library-tools"><span class="note">Organize</span>${nav('My routes and tools',[['Your tours','/app/tours?mine=1'],['Tour progress','/app/progress'],['Saved searches','/app/searches'],['Share Passes','/app/passes'],...(hasLegacy?[['Legacy records','/app/recovery/personal']]:[])])}</div></section>`;
}
