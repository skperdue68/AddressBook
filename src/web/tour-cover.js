import {escape} from './render.js';
import {csrfField,linkButton,renderWorkspace} from './workspace-render.js';
import {csrfMatches} from './session.js';
import {readUpload} from './house-gallery.js';

export const tourCoverUrl=id=>`/app/tours/${Number(id)}/cover`;
export function tourCoverThumbnail(t){return t.cover?`<a class="house-list-thumbnail" href="/app/tours/${Number(t.id)}"><img src="${tourCoverUrl(t.id)}" alt="Cover for ${escape(t.name)}" width="96" height="64" loading="lazy"></a>`:'';}
export function tourCoverMarkup(draft,csrf){
 const t=draft.tour;if(!draft.cover&&!draft.canEdit)return '';
 return `<section class="panel tour-cover-panel" id="tour-cover">${draft.cover?`<img class="tour-cover-image" src="${tourCoverUrl(t.id)}" alt="Cover for ${escape(t.name)}" width="1200" height="675">`:''}${draft.canEdit?`<h2>Tour cover</h2><p class="note">Add a graphic, photograph or collage to introduce your tour. PNG, JPEG or WebP · up to 5 MB.</p><form action="${tourCoverUrl(t.id)}" method="post" enctype="multipart/form-data">${csrfField(csrf)}<input type="hidden" name="action" value="upload"><label>${draft.cover?'Replace':'Add'} tour image<input type="file" name="image" accept="image/png,image/jpeg,image/webp" required></label><div class="actions"><button class="primary">${draft.cover?'Replace':'Upload'} tour image</button></div></form>${draft.cover?`<form action="${tourCoverUrl(t.id)}" method="post">${csrfField(csrf)}<button class="danger" name="action" value="remove">Remove tour image</button></form>`:''}`:''}</section>`;
}
export async function tourCoverRoute({request,response,url,workspace:w,context:c,session,send,redirect,readBody}){
 const match=/^\/app\/tours\/(\d+)\/cover$/.exec(url.pathname);if(!match)return null;const id=Number(match[1]);
 try{
  if(request.method==='GET'){const bytes=await w.tourCovers.read(c,id);return send(response,200,bytes,{'content-type':'image/webp','cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'"});}
  if(request.method!=='POST')return send(response,405,'Use the tour image form.');
  await w.tourCovers.access(c,id,true);
  const multipart=String(request.headers['content-type']||'').startsWith('multipart/form-data'),form=multipart?await readUpload(request):await readBody(request,8192);
  if(!csrfMatches(session.csrf,form.get('csrf'))||form.get('contextGuildId')!==c.guildId||form.get('contextEsoServer')!==c.esoServer)return send(response,403,'The form expired or server context changed. Reload and try again.');
  if(form.get('action')==='remove')await w.tourCovers.remove(c,id);
  else if(form.get('action')==='upload'){const file=form.get('image');if(!file||typeof file.arrayBuffer!=='function')throw Error('Choose a tour image.');await w.tourCovers.save(c,id,Buffer.from(await file.arrayBuffer()));}
  else throw Error('Choose a tour image action.');
  return redirect(response,`/app/tours/${id}#tour-cover`);
 }catch(error){if(request.method==='GET')return send(response,404,'Tour image unavailable.',{'cache-control':'private, no-store'});return send(response,400,renderWorkspace({title:'Tour image not saved',body:`<p class="notice error">${escape(error.message)}</p>${linkButton('Back to tour',`/app/tours/${id}#tour-cover`)}`,user:session,context:c}));}
}
