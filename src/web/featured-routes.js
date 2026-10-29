import {houseCapacityBadge} from './house-capacity.js';
import {escape} from './render.js';
import {linkButton,scopeLabel} from './workspace-render.js';

const paragraphs=value=>String(value||'').slice(0,500).split(/\n\s*\n/).filter(Boolean).map(text=>`<p class="user-text">${escape(text)}</p>`).join('');
const shared=(record,c,scope)=>record.eso_server===c.esoServer&&['public','global'].includes(scope)&&(scope==='global'||String(record.guild_id)===String(c.guildId));
const tags=value=>{try{return (Array.isArray(value)?value:JSON.parse(value||'[]')).slice(0,8);}catch{return [];}};

export async function featuredRoute({workspace:w,context:c,render}){
 const items=await w.featured(c),cards=[];
 for(const item of items){
  try{
   if(item.target_kind==='house'){
    const h=await w.getHouse(c,item.target_id);
    if(h.status!=='active'||!shared(h,c,h.scope))continue;
    const images=await w.images?.list(c,h.id)||[];
    const metadata=[h.zone,h.subzone,h.style].filter(Boolean);
    cards.push(`<article class="panel featured-card"><div class="eyebrow">FEATURED HOUSE · ${escape(scopeLabel(h.scope))}</div>${images[0]?`<a href="/app/houses/${h.id}#screenshots"><img class="house-cover" src="/app/houses/${h.id}/images/${images[0].id}" alt="${escape(images[0].caption||h.display_name||h.house_name)}" loading="lazy"></a>`:''}<h2>${escape(h.display_name||h.house_name)} ${houseCapacityBadge(h)}</h2><p><strong>ESO owner:</strong> ${escape(h.eso_owner)}${h.house_name?` · ${escape(h.house_name)}`:''}</p>${metadata.length?`<p class="note">${metadata.map(escape).join(' · ')}</p>`:''}${paragraphs(h.description)}${tags(h.tags).length?`<p>${tags(h.tags).map(tag=>`<span class="pill">${escape(tag)}</span>`).join(' ')}</p>`:''}<div class="actions">${linkButton('View house',`/app/houses/${Number(h.id)}`,'primary')}${linkButton('Add to tour',`/app/houses/${Number(h.id)}#add-to-tour`)}</div></article>`);
   }else if(item.target_kind==='tour'){
    const draft=await w.getTourDraft(c,item.target_id),t=draft.tour;
    if(!draft.canView||!shared(t,c,t.visibility))continue;
    cards.push(`<article class="panel featured-card"><div class="eyebrow">FEATURED TOUR · ${escape(scopeLabel(t.visibility))}</div><h2>${escape(t.name)}</h2><p>${draft.stops.length} stop${draft.stops.length===1?'':'s'}</p>${paragraphs(t.description)}<div class="actions">${linkButton('View tour',`/app/tours/${Number(item.target_id)}`,'primary')}</div></article>`);
   }
  }catch{/* A selection may become unavailable between listing and opening. */}
 }
 return render('Featured Housing',`<p>This server’s featured destinations and tours.</p><div class="featured-grid">${cards.join('')||'<div class="panel"><p>No featured content is available yet. Check back after the next rotation.</p></div>'}</div>`,'featured');
}
