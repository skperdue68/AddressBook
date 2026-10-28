import {safeActionReturn,actionReturnField,withActionReturn} from './flow-navigation.js';
import {ServerHouseCopyService} from '../services/server-house-copy-service.js';
import {escape} from './render.js';
import {csrfField,linkButton,scopeLabel} from './workspace-render.js';
import {esoServerLabel} from '../utils/eso-server.js';

export async function serverHouseCopyRoute({workspace:w,context:c,session,url,form,render,serverContexts=[],memberLookup,redirect,response}){
 const match=/^\/app\/houses\/(\d+)\/copy-server$/.exec(url.pathname);if(!match)return null;
 const service=new ServerHouseCopyService(w,{memberLookup}),id=Number(match[1]),backTo=safeActionReturn(form?.get('backTo')||url.searchParams.get('backTo')),back=backTo||`/app/houses/${id}?guildId=${encodeURIComponent(c.guildId)}`;
 let targets;try{targets=await service.targets(c,id,serverContexts);}catch{return render('Access unavailable','<p>You do not have access to copy this house between servers.</p>','houses',403);}
 if(form){
  const target=targets.find(t=>t.guildId===form.get('targetGuildId'));if(!target)return render('Destination unavailable','<p>Choose a currently authorized server in this ESO environment.</p>','houses',403);
  try{
   const preview=await service.preview(c,id,target);
   if(form.get('confirm')==='copy'){
    const result=await service.copy(c,id,target,form.get('version'));
    if(backTo){const location=new URL(backTo,'https://hearthbound.invalid');location.searchParams.set('copied','1');return redirect(response,location.pathname+location.search+location.hash);}
    const canOpen=w.policy.canViewHouse(result.house,target)||(result.house.status==='pending'&&w.policy.canEditHouse(result.house,target));
    return render(result.existing?'House already registered':'House copied',`<div class="notice" role="status">${result.existing?'An existing registration was found and retained.':'The house was copied successfully.'} The original registration and tour stops were kept.</div><div class="actions">${canOpen?linkButton('Open destination house',`/app/houses/${result.house.id}?guildId=${encodeURIComponent(target.guildId)}`,true):'<p>The existing destination registration requires review by its creator or a Server administrator.</p>'}${linkButton('Back to source house',back)}${w.policy.canEditHouse(preview.house,c)?linkButton('Review deleting original',`/app/houses/${id}/delete?guildId=${encodeURIComponent(c.guildId)}`):''}</div>`,'houses');
   }
   const h=preview.house;
   return render('Confirm server copy',`<section class="panel"><h2>${escape(h.display_name||h.house_name)}</h2><p>${escape(h.eso_owner)} · ${escape(h.house_name)}</p><p>From <strong>${escape(c.guildName||c.guildId)}</strong> (${scopeLabel(h.scope)}) to <strong>${escape(target.guildName||target.guildId)}</strong> (Server).</p><p>${escape(esoServerLabel(c.esoServer))} · The source registration and tour stops stay in place. The new registration keeps the house details. Comments follow the same ESO destination; tour stops are not copied.</p><p>Destination submitter: <strong>${escape(preview.attribution.displayName)}</strong> (${escape(preview.attribution.submitterId)}). ${preview.attribution.reassigned?'The original submitter is not a member of this server, so you will be listed as submitter.':'The original submitter is a current member and will be retained.'}</p>${h.scope==='private'?'<div class="notice">This is your Private house. Confirming will make a Server registration visible to members of the destination server.</div>':''}${preview.existing?'<div class="notice">This house is already registered at Server level there. Its details will be kept.</div>':''}<form method="post">${csrfField(session.csrf)}${actionReturnField(backTo)}<input type="hidden" name="targetGuildId" value="${escape(target.guildId)}"><input type="hidden" name="version" value="${preview.version}"><button class="primary" name="confirm" value="copy">Confirm copy to ${escape(target.guildName||target.guildId)}</button> ${linkButton('Cancel',back)}</form></section>`,'houses');
  }catch(e){return render('Copy not completed',`<div class="notice error" role="alert">${escape(e.message)}</div>${linkButton('Review copy again',withActionReturn(url.pathname,backTo))}`,'houses',409);}
 }
 return render('Copy house to another server',`<p>Create a Server registration in another community you administer. Bot owners and Global administrators can also copy within their authorized ESO environment. Only servers where you are a current member and HearthBound is installed are listed.</p><div class="panel">${targets.length?`<form method="post">${csrfField(session.csrf)}${actionReturnField(backTo)}<label>Destination server<select name="targetGuildId">${targets.map(t=>`<option value="${escape(t.guildId)}">${escape(t.guildName||t.guildId)}</option>`).join('')}</select></label><button class="primary">Preview copy</button> ${linkButton('Cancel',back)}</form>`:'<p>No other authorized servers in this ESO environment are available.</p>'+linkButton('Back to house',back)}</div>`,'houses');
}
