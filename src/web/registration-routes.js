import {parseDestinationInput} from '../utils/destination-input.js';
import {escape} from './render.js';
import {csrfField,input,scopeLabel} from './workspace-render.js';

export async function registerHousePage({workspace:w,context:c,session,form,query,render,redirect,response}){
 const action=form?.get('registrationAction')||'save';
 if(form&&action==='save'){const house=await w.registerHouse(c,Object.fromEntries(form));return redirect(response,`/app/houses/${house.id}?saved=1`);}
 let selectedId=query.houseId||'',owner='',source='',error='',resolved=null;
 if(form){
  source=String(form.get('destinationInput')||'');
  try{
   if(action!=='resolve')throw new Error('Choose Read link or script, or Register house.');
   if(source.length>2000)throw new Error('The pasted link or script must be 2000 characters or fewer.');
   const parsed=parseDestinationInput(source);
   if(parsed.kind!=='destination')throw new Error('Paste a Housing Link or Jump Command here. To choose by name or ID, use the official catalog below.');
   resolved=await w.catalog.get(parsed.houseId);
   if(!resolved)throw new Error('No matching ESO house found. The house ID in this link or script is not in the official catalog. Check the value, or ask a bot owner to add a newly released house.');
   selectedId=String(resolved.house_id);owner=parsed.esoOwner;
  }catch(e){error=e.message;}
 }
 const catalog=await w.catalog.filter({name:query.q||'',limit:200});
 if(selectedId&&!catalog.some(h=>String(h.house_id)===selectedId)){const requested=await w.catalog.get(Number(selectedId));if(requested)catalog.unshift(requested);}
 const options=catalog.map(h=>`<option value="${Number(h.house_id)}" ${String(h.house_id)===selectedId?'selected':''}>${escape(h.name)}${h.zone?` · ${escape(h.zone)}`:''}</option>`).join('');
 const paste=`<section class="panel"><h2>Paste a Housing Link or Jump Command</h2><p>Use the same ESO link or script you use in Discord. Read it first, then review the house and owner below before registering.</p>${error?`<div class="notice error" role="alert">${escape(error)} Try again below; no house was registered.</div>`:''}<form method="post">${csrfField(session.csrf)}<input type="hidden" name="registrationAction" value="resolve"><label>Housing Link or Jump Command<textarea name="destinationInput" maxlength="2000" rows="3" required placeholder="Paste your ESO Housing Link or /script JumpToSpecificHouse(...) here">${escape(source)}</textarea></label><button class="primary">Read link or script</button></form><details><summary>Supported examples</summary><p>ESO Housing Link</p><pre><code>|H1:housing:47:@AccountName|h|h</code></pre><p>ESO Jump Command</p><pre><code>/script JumpToSpecificHouse("@AccountName", 47)</code></pre><p class="note">The script is read as text and is never executed.</p></details></section>`;
 const review=resolved?`<div class="notice" role="status"><strong>Review the destination</strong><p>${escape(resolved.name)} · @${escape(owner)}</p><p class="note">Nothing has been saved yet. You can adjust the fields below before choosing Register house.</p></div>`:'';
 const catalogForm=`<section class="panel"><h2>${resolved?'Review and register':'Or choose from the official catalog'}</h2>${review}<form method="get"><div class="filters">${input('Find official house','q',query.q||'')}<button>Find house</button></div></form>${options?`<form method="post">${csrfField(session.csrf)}<input type="hidden" name="registrationAction" value="save"><label>Official house<select name="houseId" required>${options}</select></label>${input('ESO account owner','esoOwner',owner,'text',true)}<label>Visibility<select name="visibility">${w.houseScopes(c).map(scope=>`<option value="${scope}">${scopeLabel(scope)}</option>`).join('')}</select></label>${input('Nickname (optional)','displayName')}<label>Description<textarea name="description" maxlength="4000"></textarea></label>${input('Tags (comma separated)','tags')}<button class="primary">Register house</button></form>`:'<p>No matching official house exists in the catalog. Try a different spelling, or ask a bot owner to add a new release.</p>'}<p class="note">Shared registrations follow this server’s approval policy. Private records stay yours.</p></section>`;
 return render('Register a house',`<p>Add your furnished destination to your collection or share it with others.</p>${paste}${catalogForm}`,'register',error?400:200);
}
