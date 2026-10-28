import {escape} from './render.js';
import {csrfField,linkButton,renderWorkspace} from './workspace-render.js';
import {csrfMatches} from './session.js';

export const imageUrl=(houseId,imageId)=>`/app/houses/${Number(houseId)}/images/${Number(imageId)}`;
export function galleryMarkup(h,images,csrf){
 return `<section class="panel house-gallery" id="screenshots"><div class="section-heading"><h2>House screenshots</h2><span class="note">${images.length} / 8 images</span></div>${images.length?`<div class="gallery-grid">${images.map((image,index)=>`<figure><a href="${imageUrl(h.id,image.id)}" target="_blank" rel="noopener" aria-label="Open screenshot ${index+1} full size"><img src="${imageUrl(h.id,image.id)}" alt="${escape(image.caption||`${h.display_name||h.house_name} screenshot ${index+1}`)}" loading="lazy" width="640" height="400"></a><figcaption>${index===0?'<span class="pill">Cover image</span> ':''}${escape(image.caption)}</figcaption>${h.canEdit?`<form method="post" action="/app/houses/${h.id}/gallery">${csrfField(csrf)}<input type="hidden" name="imageId" value="${image.id}"><div class="actions">${index?'<button name="action" value="cover">Use as cover</button>':''}<button name="action" value="remove" class="danger">Remove screenshot</button></div></form>`:''}</figure>`).join('')}</div>`:'<p>No screenshots yet.</p>'}${h.canEdit&&images.length<8?`<form method="post" action="/app/houses/${h.id}/gallery" enctype="multipart/form-data">${csrfField(csrf)}<input type="hidden" name="action" value="upload"><label>Add a screenshot<input type="file" name="image" accept="image/png,image/jpeg,image/webp" required></label><label>Caption (optional)<input name="caption" maxlength="250" placeholder="Show visitors what makes this view special"></label><p class="note">PNG, JPEG or WebP · up to 5 MB each. The first image becomes the cover. Add more images to build a gallery.</p><button class="primary">Upload screenshot</button></form>`:''}</section>`;
}
async function readUpload(request){
 if(Number(request.headers['content-length'])>6*1024*1024){request.resume();throw new Error('Choose an image no larger than 5 MB.');}
 const chunks=[];let bytes=0;
 for await(const chunk of request){bytes+=chunk.length;if(bytes>6*1024*1024)throw new Error('Choose an image no larger than 5 MB.');chunks.push(chunk);}
 return new Request('http://localhost/upload',{method:'POST',headers:{'content-type':request.headers['content-type']||''},body:Buffer.concat(chunks)}).formData();
}
export async function houseGalleryRoute({request,response,url,workspace:w,context:c,session,send,redirect,readBody}){
 const match=/^\/app\/houses\/(\d+)\/(gallery|images\/(\d+))$/.exec(url.pathname);if(!match)return null;
 const houseId=Number(match[1]),imageId=Number(match[3]);
 try{
  const {h}=await w.images.access(c,houseId,request.method==='POST');
  if(imageId){if(request.method!=='GET')return send(response,405,'Use GET.');const bytes=await w.images.read(c,houseId,imageId);return send(response,200,bytes,{'content-type':'image/webp','cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'"});}
  if(request.method==='POST'){
   const multipart=String(request.headers['content-type']||'').startsWith('multipart/form-data'),form=multipart?await readUpload(request):await readBody(request,8192);
   if(!csrfMatches(session.csrf,form.get('csrf'))||form.get('contextGuildId')!==c.guildId||form.get('contextEsoServer')!==c.esoServer)return send(response,403,'The form expired or server context changed. Reload and try again.');
   const action=form.get('action');if(action==='upload'){const file=form.get('image');if(!file||typeof file.arrayBuffer!=='function')throw new Error('Choose a screenshot to upload.');await w.images.add(c,houseId,Buffer.from(await file.arrayBuffer()),form.get('caption'));}
   else if(action==='cover')await w.images.setCover(c,houseId,form.get('imageId'));
   else if(action==='remove')await w.images.remove(c,houseId,form.get('imageId'));
   else throw new Error('Choose a gallery action.');
   return redirect(response,`/app/houses/${houseId}?saved=1#screenshots`);
  }
  if(request.method!=='GET')return send(response,405,'Use the gallery forms.');
  return send(response,200,renderWorkspace({title:'House screenshots',body:linkButton('Back to house',`/app/houses/${houseId}`)+galleryMarkup({...h,canEdit:w.policy.canEditHouse(h,c)},await w.images.list(c,houseId),session.csrf),user:session,context:c}));
 }catch(error){return send(response,400,renderWorkspace({title:'Screenshot not saved',body:`<p class="notice error">${escape(error.message)}</p>${linkButton('Back to house',`/app/houses/${houseId}#screenshots`)}`,user:session,context:c}));}
}
