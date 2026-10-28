import {pagination,correctedPageLocation} from './pagination.js';
import {escape} from './render.js';
import {csrfField,linkButton} from './workspace-render.js';
import {feedbackCategories,feedbackStatuses} from '../services/feedback-service.js';
const options=(values,selected)=>Object.entries(values).map(([value,label])=>`<option value="${value}" ${value===selected?'selected':''}>${label}</option>`).join('');
const stamp=value=>`<time datetime="${escape(value)}">${escape(String(value||'').replace('T',' ').replace(/\.\d+Z$/,' UTC'))}</time>`;

export async function feedbackRoute({workspace:w,context:c,session,url,form,render,redirect,response,request,send}){
 const path=url.pathname;if(path!=='/app/feedback'&&path!=='/app/feedback/review')return null;
 const service=w.feedback,wantsJson=String(request?.headers?.accept||'').includes('application/json');
 const json=async(status,payload)=>{const body=JSON.stringify(payload),headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};if(send)return send(response,status,body,headers);response.writeHead(status,headers);response.end(body);return true;};
 if(path==='/app/feedback/review'){
  try{service.assertOwner(c);}catch{if(wantsJson)return json(403,{error:'Feedback review is restricted to bot owners.'});return render('Access unavailable','<p>Feedback review is restricted to bot owners.</p>','help',403);}
  if(form){
   try{
    const action=form.get('action'),input={id:form.get('id'),revision:form.get('revision')};
    if(action!=='notes')input.status=form.get('status');
    if(action!=='status')input.notes=form.get('notes')||'';
    const item=await service.review(c,input);
    if(wantsJson)return json(200,{ok:true,item:{id:Number(item.id),revision:Number(item.revision),status:item.status}});
   }catch(e){if(wantsJson)return json(409,{error:e.message});return render('Review not saved',`<div class="notice error" role="alert">${escape(e.message)}</div>${linkButton('Reload feedback inbox',url.pathname+url.search)}`,'feedback',409);}
   const location=new URL(url.pathname+url.search,'https://hearthbound.invalid');location.searchParams.set('saved','1');return redirect(response,location.pathname+location.search);

  }
  const status=url.searchParams.get('status')||'';if(status&&!Object.hasOwn(feedbackStatuses,status))return render('Invalid filter','<p>Choose a listed feedback status.</p>','feedback',400);
  const result=await service.list(c,{status,page:url.searchParams.get('page')});
  const corrected=correctedPageLocation(url,result.page);if(corrected)return redirect(response,corrected);
  const reviewFields=item=>`${csrfField(session.csrf)}<input type="hidden" name="id" value="${Number(item.id)}"><input type="hidden" name="revision" value="${Number(item.revision)}">`;
  const cards=result.rows.map(item=>`<article class="panel feedback-item" data-feedback-id="${Number(item.id)}"><div class="feedback-heading"><div><span class="pill">${feedbackCategories[item.category]||escape(item.category)}</span><span class="pill" data-feedback-status>${feedbackStatuses[item.status]||escape(item.status)}</span><h2>#${Number(item.id)} · ${escape(item.subject)}</h2></div>${stamp(item.created_at)}</div><p class="note">From ${escape(item.author_name)} (${escape(item.author_id)}) · ${escape(item.guild_name)} · ${escape(item.eso_server)}</p><p class="user-text">${escape(item.message)}</p><form method="post" action="${escape(url.pathname+url.search)}" data-feedback-action="status">${reviewFields(item)}<input type="hidden" name="action" value="status"><label>Status<select name="status">${options(feedbackStatuses,item.status)}</select></label><noscript><button>Save status</button></noscript><span role="status" aria-live="polite"></span></form><details><summary>Internal notes</summary><form method="post" action="${escape(url.pathname+url.search)}" data-feedback-action="notes">${reviewFields(item)}<input type="hidden" name="action" value="notes"><label>Internal notes<textarea name="notes" maxlength="1000">${escape(item.review_notes||'')}</textarea></label><p class="note">Internal notes are visible only to bot owners.${item.reviewed_by?` Last updated by ${escape(item.reviewed_by)} · ${stamp(item.reviewed_at)}`:''}</p><div class="actions"><button class="primary">Save notes</button><span role="status" aria-live="polite"></span></div></form></details></article>`).join('');

  return render('Feedback inbox',`<p>Ideas, bug reports, and general feedback from across HearthBound. Newest first. This inbox and internal notes are visible only to bot owners.</p>${url.searchParams.has('saved')?'<div class="notice" role="status">Review saved.</div>':''}<form method="get" class="filters"><label>Status<select name="status"><option value="">All statuses</option>${options(feedbackStatuses,status)}</select></label><button>Apply filter</button></form>${cards||'<div class="panel"><p>No feedback matches this status.</p></div>'}${pagination({...result,path,params:{status}})}`,'feedback');
 }
 let error='';
 if(form){try{await service.submit(c,{name:session.global_name||session.username||c.userId},Object.fromEntries(form));return redirect(response,'/app/feedback?sent=1');}catch(e){error=e.message;}}
 const rows=await service.mine(c.userId);
 return render('Send feedback',`<p>Help shape HearthBound. Tell us what feels confusing, report a problem, or suggest an improvement.</p><p class="note">Your feedback, Discord name, selected server and ESO environment are stored for bot owners to review. Other members cannot see your submissions. Please leave out passwords, tokens and other secrets.</p>${url.searchParams.has('sent')?'<div class="notice" role="status">Thank you! Your feedback has been saved for review.</div>':''}${error?`<div class="notice error" role="alert">${escape(error)}</div>`:''}<div class="panel"><form method="post">${csrfField(session.csrf)}<label>Category<select name="category">${options(feedbackCategories,form?.get('category')||'general')}</select></label><label>Subject<input name="subject" maxlength="120" required value="${escape(form?.get('subject')||'')}" placeholder="What would you like us to know?"></label><label>Feedback<textarea name="message" maxlength="4000" required placeholder="What happened, what did you expect, or what would make HearthBound easier to use?">${escape(form?.get('message')||'')}</textarea></label><div class="actions"><button class="primary">Send feedback</button>${linkButton('Back to Support','/app/support')}${c.isOwner?linkButton('Review feedback','/app/feedback/review'):''}</div></form></div><section><h2>Your recent feedback</h2>${rows.map(item=>`<article class="panel"><span class="pill">${feedbackStatuses[item.status]||escape(item.status)}</span><h3>#${Number(item.id)} · ${escape(item.subject)}</h3><p class="note">${stamp(item.created_at)} · ${feedbackCategories[item.category]||escape(item.category)}</p><p class="user-text">${escape(item.message)}</p></article>`).join('')||'<p>Your last ten submissions and their review status will appear here.</p>'}</section>`,'help',error?400:200);
}
