document.querySelectorAll('.house-gallery').forEach(gallery=>{
 let links=[...gallery.querySelectorAll('[data-gallery-image]')];
 if(typeof HTMLDialogElement!=='undefined'&&HTMLDialogElement.prototype.showModal){
  const dialog=document.createElement('dialog');dialog.className='gallery-viewer';dialog.setAttribute('aria-label','House screenshot viewer');
  dialog.innerHTML='<div class="viewer-toolbar"><strong>House screenshots</strong><button type="button" data-viewer-close aria-label="Close screenshot viewer">Close ×</button></div><img data-viewer-image alt=""><p data-viewer-caption aria-live="polite"></p><div class="actions viewer-navigation"><button type="button" data-viewer-prev>← Previous</button><button type="button" data-viewer-next>Next →</button></div>';
  gallery.append(dialog);let index=0,opener=null;
  const image=dialog.querySelector('[data-viewer-image]'),caption=dialog.querySelector('[data-viewer-caption]'),previous=dialog.querySelector('[data-viewer-prev]'),next=dialog.querySelector('[data-viewer-next]');
  const show=value=>{index=Math.max(0,Math.min(links.length-1,value));const thumbnail=links[index].querySelector('img');image.src=links[index].href;image.alt=thumbnail.alt;caption.textContent=`${index+1} of ${links.length} · ${thumbnail.alt}`;previous.disabled=index===0;next.disabled=index===links.length-1;};
  const close=()=>{dialog.close();opener?.focus({preventScroll:true});};
  gallery.addEventListener('click',event=>{const link=event.target.closest('[data-gallery-image]');if(!link)return;links=[...gallery.querySelectorAll('[data-gallery-image]')];const i=links.indexOf(link);if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();opener=link;show(i);dialog.showModal();dialog.querySelector('[data-viewer-close]').focus();});
  previous.addEventListener('click',()=>show(index-1));next.addEventListener('click',()=>show(index+1));dialog.querySelector('[data-viewer-close]').addEventListener('click',close);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}else if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();show(index+(event.key==='ArrowRight'?1:-1));}});
 }
 const refresh=(data,savedCaption=null)=>{
  const drafts=new Map();for(const row of gallery.querySelectorAll('.gallery-grid form')){const id=row.querySelector('[name=imageId]')?.value,input=row.querySelector('[name=caption]');if(id&&input&&input.value!==input.defaultValue&&!(savedCaption?.id===id&&savedCaption.value===input.value))drafts.set(id,{value:input.value,focused:input===document.activeElement});}
  const anchor=gallery.querySelector('[data-gallery-upload]'),anchorTop=anchor&&!anchor.hidden?anchor.getBoundingClientRect().top:null;
  if(!data.galleryHtml)throw Error('The gallery could not refresh. Reload before retrying to avoid a duplicate upload.');
  const template=document.createElement('template');template.innerHTML=data.galleryHtml;
  const fresh=template.content.querySelector('.house-gallery'),content=fresh?.querySelector('[data-gallery-content]'),count=fresh?.querySelector('[data-gallery-count]');
  if(!content||!count)throw Error('The gallery could not refresh. Reload before retrying to avoid a duplicate upload.');
  gallery.querySelector('[data-gallery-content]').replaceWith(content);for(const row of content.querySelectorAll('form')){const draft=drafts.get(row.querySelector('[name=imageId]')?.value),input=row.querySelector('[name=caption]');if(draft&&input){input.value=draft.value;if(draft.focused)input.focus({preventScroll:true});}}gallery.querySelector('[data-gallery-count]').replaceWith(count);
  const current=gallery.querySelector('[data-gallery-upload]'),replacement=fresh.querySelector('[data-gallery-upload]');
  if(current){current.hidden=!replacement;current.dataset.full=String(!!replacement?.querySelector('[type=file]')?.disabled);}
  const cover=content.querySelector('[data-gallery-image] img'),header=document.querySelector('.house-detail-heading');
  if(header){let link=header.querySelector('.house-detail-cover');if(cover){if(!link){link=document.createElement('a');link.className='house-detail-cover';link.href='#screenshots';link.setAttribute('aria-label','View all house screenshots');link.append(document.createElement('img'));header.append(link);}const img=link.querySelector('img');img.src=cover.src;img.alt=cover.alt;img.width=640;img.height=400;}else link?.remove();}
  if(anchorTop!==null)requestAnimationFrame(()=>{const delta=anchor.getBoundingClientRect().top-anchorTop;if(Math.abs(delta)>1)window.scrollBy({top:delta,behavior:'instant'});});
 };
 gallery.addEventListener('submit',async event=>{
  const actionForm=event.target;if(actionForm.matches('[data-gallery-upload]')||!actionForm.matches('form'))return;
  event.preventDefault();if(actionForm.dataset.saving||gallery.dataset.saving){let note=actionForm.querySelector('[data-gallery-action-status]');if(!note){note=document.createElement('p');note.dataset.galleryActionStatus='';note.setAttribute('role','status');actionForm.append(note);}note.textContent='A gallery change is still saving. Your caption stays here; save it when that finishes.';return;}
  const action=event.submitter?.value;if(!action)return;
  if(action==='remove'&&!window.confirm('Remove this screenshot from the house gallery?'))return;
  const payload=new FormData(actionForm);payload.set('action',action);actionForm.dataset.saving='true';gallery.dataset.saving='true';
  const buttons=[...actionForm.querySelectorAll('button')],disabled=buttons.map(b=>b.disabled);buttons.forEach(b=>b.disabled=true);
  let status=actionForm.querySelector('[data-gallery-action-status]');if(!status){status=document.createElement('p');status.dataset.galleryActionStatus='';status.setAttribute('role','status');actionForm.append(status);}status.textContent='Saving…';
  try{const response=await fetch(actionForm.getAttribute('action'),{method:'POST',headers:{Accept:'application/json'},body:new URLSearchParams(payload)}),data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'The change could not be saved.');refresh(data,action==='caption'?{id:payload.get('imageId'),value:payload.get('caption')}:null);const upload=gallery.querySelector('[data-gallery-upload]');if(upload){const full=upload.dataset.full==='true';upload.querySelectorAll('input:not([type=hidden]),button').forEach(el=>el.disabled=full);upload.querySelector('[data-upload-status]').textContent=full?'Gallery full. Remove an image before adding another.':'Ready for another screenshot.';}}
  catch(error){status.textContent=error.message;status.classList.add('upload-error');buttons.forEach((b,i)=>b.disabled=disabled[i]);delete actionForm.dataset.saving;}finally{delete gallery.dataset.saving;const queued=gallery.querySelector('[data-gallery-upload]');if(queued?.dataset.queued==='true'&&!queued.hidden&&queued.dataset.full!=='true'&&queued.querySelector('[type=file]').files.length){delete queued.dataset.queued;queued.requestSubmit();}}
 });
 const form=gallery.querySelector('[data-gallery-upload]');if(!form)return;
 const input=form.querySelector('[type=file]'),dropzone=form.querySelector('[data-upload-dropzone]'),preview=form.querySelector('[data-upload-preview]'),status=form.querySelector('[data-upload-status]'),progress=form.querySelector('[data-upload-progress]'),button=form.querySelector('button.primary');let previewUrl=null,saving=false;
 const message=(text,error=false)=>{status.textContent=text;status.classList.toggle('upload-error',error);};
 const selected=()=>{
  if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}preview.hidden=true;input.setCustomValidity('');
  if(form.dataset.full==='true'){message('Gallery full. Remove an image before adding another.',true);return;}const file=input.files[0];if(!file){message('');return;}
  const error=file.size>5*1024*1024?'Choose an image no larger than 5 MB.':file.size===0?'The selected file is empty.':file.type&&!['image/png','image/jpeg','image/webp'].includes(file.type)?'Choose a PNG, JPEG or WebP screenshot.':'';
  input.setCustomValidity(error);if(error){message(error,true);return;}
  previewUrl=URL.createObjectURL(file);preview.src=previewUrl;preview.hidden=false;message(`${file.name} · ${(file.size/1024/1024).toFixed(1)} MB selected`);if(gallery.dataset.saving){form.dataset.queued='true';message('Screenshot selected. Upload will start when the current gallery change finishes.');return;}form.requestSubmit();
 };
 input.addEventListener('change',selected);window.addEventListener('pagehide',()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);});
 if(dropzone){for(const name of ['dragenter','dragover'])dropzone.addEventListener(name,event=>{event.preventDefault();dropzone.classList.add('is-dragging');});for(const name of ['dragleave','drop'])dropzone.addEventListener(name,()=>dropzone.classList.remove('is-dragging'));
  dropzone.addEventListener('drop',event=>{event.preventDefault();if(form.dataset.full==='true'){message('Gallery full. Remove an image before adding another.',true);return;}if(saving){message('An upload is in progress. Add the next screenshot when it finishes.');return;}if(event.dataTransfer.files.length!==1){message('Drop one screenshot at a time.',true);return;}input.files=event.dataTransfer.files;selected();});
 }
 form.addEventListener('submit',event=>{
  event.preventDefault();if(saving||gallery.dataset.saving||!form.reportValidity())return;saving=true;gallery.dataset.saving='true';button.disabled=true;form.setAttribute('aria-busy','true');progress.hidden=false;progress.value=0;message('Uploading screenshot…');const payload=new FormData(form),captionInput=form.querySelector('[name=caption]');input.disabled=true;captionInput.disabled=true;
  const xhr=new XMLHttpRequest();xhr.open('POST',form.getAttribute('action'));xhr.setRequestHeader('Accept','application/json');xhr.timeout=120000;
  const recover=text=>{saving=false;delete gallery.dataset.saving;button.disabled=false;input.disabled=false;captionInput.disabled=false;form.removeAttribute('aria-busy');progress.hidden=true;message(text,true);};
  xhr.upload.addEventListener('progress',event=>{if(event.lengthComputable){progress.value=Math.round(event.loaded/event.total*100);if(event.loaded===event.total)message('Processing screenshot…');}});
  xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{return recover('Upload could not finish. Sign in again if your session expired, then retry.');}if(xhr.status>=200&&xhr.status<300&&data.ok){try{refresh(data);}catch(error){return recover(error.message);}saving=false;delete gallery.dataset.saving;const full=form.dataset.full==='true';button.disabled=full;input.disabled=full;captionInput.disabled=full;form.removeAttribute('aria-busy');progress.hidden=true;input.value='';captionInput.value='';if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}preview.hidden=true;message(full?'Screenshot saved. Gallery full — remove an image before adding another.':'Screenshot saved. Drop or choose the next one; captions can be edited below.');}else recover(data.error||'Screenshot could not be uploaded. Try again.');};
  xhr.onerror=()=>recover('Connection lost. Your file and caption are still here—try again.');xhr.ontimeout=()=>recover('The upload took too long. Your file and caption are still here—try again.');xhr.onabort=()=>recover('Upload cancelled. Your file and caption are still here.');
  try{xhr.send(payload);}catch{recover('Screenshot could not be uploaded. Try again.');}
 });
});
