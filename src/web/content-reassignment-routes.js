import {safeActionReturn,actionReturnField} from './flow-navigation.js';
import {ContentReassignmentService} from '../services/content-reassignment-service.js';
import {escape} from './render.js';
import {csrfField,input,linkButton} from './workspace-render.js';

const hidden=(name,value)=>`<input type="hidden" name="${escape(name)}" value="${escape(value)}">`;
export async function contentReassignmentRoute({workspace,context,session,url,form,render,memberLookup,redirect,response}){
 const match=/^\/app\/(houses|tours)\/(\d+)\/reassign$/.exec(url.pathname);if(!match)return null;
 const kind=match[1]==='houses'?'house':'tour',id=match[2],service=new ContentReassignmentService(workspace,{memberLookup}),label=kind==='house'?'Discord submitter':'tour creator',backTo=safeActionReturn(form?.get('backTo')||url.searchParams.get('backTo')),back=backTo||`/app/${match[1]}/${id}`;
 const {record}=await service.record(context,kind,id),title=record.display_name||record.name||`House #${id}`;
 if(form?.get('confirm')==='reassign'){
  const result=await service.confirm(context,kind,id,form.get('memberId'),form.get('version'));
  if(backTo){const location=new URL(backTo,'https://hearthbound.invalid');location.searchParams.set('saved','1');return redirect(response,location.pathname+location.search+location.hash);}
  return render('Reassignment saved',`<div class="panel"><h2>${escape(title)}</h2><p role="status">The ${label} is now ${escape(result.member.displayName||result.member.id)} (${escape(result.member.id)}).</p>${linkButton('Return to record',back)}</div>`,'admin');
 }
 if(form){
  const preview=await service.preview(context,kind,id,form.get('memberId'));
  return render(`Confirm ${label} reassignment`,`<div class="panel"><h2>${escape(title)}</h2><p>New ${label}: <strong>${escape(preview.member.displayName||preview.member.id)}</strong> · Discord ID ${escape(preview.member.id)}</p><p>This member will receive creator editing rights for this shared record. The ESO account owner, visibility and tour stops stay the same.</p><form method="post" action="${escape(url.pathname)}">${csrfField(session.csrf)}${actionReturnField(backTo)}${hidden('confirm','reassign')}${hidden('memberId',preview.member.id)}${hidden('version',preview.version)}<button>Confirm reassignment</button></form>${linkButton('Cancel',back)}</div>`,'admin');
 }
 return render(`Reassign ${label}`,`<div class="panel"><h2>${escape(title)}</h2><p>Select a current member of ${kind==='tour'&&record.visibility==='public'?'the tour’s source Discord server':kind==='house'&&record.scope==='public'?'this registration’s Discord server':'the selected Discord server'}. This changes the ${label} and their shared record editing rights.</p><form method="post" action="${escape(url.pathname)}">${csrfField(session.csrf)}${actionReturnField(backTo)}${input('Discord member ID or mention','memberId','','text',true)}<button>Look up member and preview</button></form>${linkButton('Cancel',back)}</div>`,'admin');
}
