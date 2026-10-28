document.querySelectorAll('.house-gallery').forEach(gallery=>{
 const links=[...gallery.querySelectorAll('[data-gallery-image]')];
 if(links.length&&typeof HTMLDialogElement!=='undefined'&&HTMLDialogElement.prototype.showModal){
  const dialog=document.createElement('dialog');dialog.className='gallery-viewer';dialog.setAttribute('aria-label','House screenshot viewer');
  dialog.innerHTML='<div class="viewer-toolbar"><strong>House screenshots</strong><button type="button" data-viewer-close aria-label="Close screenshot viewer">Close ×</button></div><img data-viewer-image alt=""><p data-viewer-caption aria-live="polite"></p><div class="actions viewer-navigation"><button type="button" data-viewer-prev>← Previous</button><button type="button" data-viewer-next>Next →</button></div>';
  gallery.append(dialog);let index=0,opener=null;
  const image=dialog.querySelector('[data-viewer-image]'),caption=dialog.querySelector('[data-viewer-caption]'),previous=dialog.querySelector('[data-viewer-prev]'),next=dialog.querySelector('[data-viewer-next]');
  const show=value=>{index=Math.max(0,Math.min(links.length-1,value));const thumbnail=links[index].querySelector('img');image.src=links[index].href;image.alt=thumbnail.alt;caption.textContent=`${index+1} of ${links.length} · ${thumbnail.alt}`;previous.disabled=index===0;next.disabled=index===links.length-1;};
  const close=()=>{dialog.close();opener?.focus({preventScroll:true});};
  links.forEach((link,i)=>link.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();opener=link;show(i);dialog.showModal();dialog.querySelector('[data-viewer-close]').focus();}));
  previous.addEventListener('click',()=>show(index-1));next.addEventListener('click',()=>show(index+1));dialog.querySelector('[data-viewer-close]').addEventListener('click',close);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}else if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();show(index+(event.key==='ArrowRight'?1:-1));}});
 }
 gallery.querySelectorAll('[data-gallery-remove]').forEach(button=>button.addEventListener('click',event=>{if(!window.confirm('Remove this screenshot from the house gallery?'))event.preventDefault();}));
 const form=gallery.querySelector('[data-gallery-upload]');if(!form)return;
 const input=form.querySelector('[type=file]'),dropzone=form.querySelector('[data-upload-dropzone]'),preview=form.querySelector('[data-upload-preview]'),status=form.querySelector('[data-upload-status]'),progress=form.querySelector('[data-upload-progress]'),button=form.querySelector('button.primary');let previewUrl=null,saving=false;
 const message=(text,error=false)=>{status.textContent=text;status.classList.toggle('upload-error',error);};
 const selected=()=>{
  if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}preview.hidden=true;input.setCustomValidity('');
  const file=input.files[0];if(!file){message('');return;}
  const error=file.size>5*1024*1024?'Choose an image no larger than 5 MB.':file.size===0?'The selected file is empty.':file.type&&!['image/png','image/jpeg','image/webp'].includes(file.type)?'Choose a PNG, JPEG or WebP screenshot.':'';
  input.setCustomValidity(error);if(error){message(error,true);return;}
  previewUrl=URL.createObjectURL(file);preview.src=previewUrl;preview.hidden=false;message(`${file.name} · ${(file.size/1024/1024).toFixed(1)} MB selected`);
 };
 input.addEventListener('change',selected);window.addEventListener('pagehide',()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);});
 if(dropzone){for(const name of ['dragenter','dragover'])dropzone.addEventListener(name,event=>{event.preventDefault();dropzone.classList.add('is-dragging');});for(const name of ['dragleave','drop'])dropzone.addEventListener(name,()=>dropzone.classList.remove('is-dragging'));
  dropzone.addEventListener('drop',event=>{event.preventDefault();if(saving)return;if(event.dataTransfer.files.length!==1){message('Drop one screenshot at a time.',true);return;}input.files=event.dataTransfer.files;selected();});
 }
 form.addEventListener('submit',event=>{
  event.preventDefault();if(saving||!form.reportValidity())return;saving=true;button.disabled=true;form.setAttribute('aria-busy','true');progress.hidden=false;progress.value=0;message('Uploading screenshot…');const payload=new FormData(form),captionInput=form.querySelector('[name=caption]');input.disabled=true;captionInput.disabled=true;
  const xhr=new XMLHttpRequest();xhr.open('POST',form.getAttribute('action'));xhr.setRequestHeader('Accept','application/json');xhr.timeout=120000;
  const recover=text=>{saving=false;button.disabled=false;input.disabled=false;captionInput.disabled=false;form.removeAttribute('aria-busy');progress.hidden=true;message(text,true);};
  xhr.upload.addEventListener('progress',event=>{if(event.lengthComputable){progress.value=Math.round(event.loaded/event.total*100);if(event.loaded===event.total)message('Processing screenshot…');}});
  xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{return recover('Upload could not finish. Sign in again if your session expired, then retry.');}if(xhr.status>=200&&xhr.status<300&&data.ok&&String(data.nextUrl||'').startsWith('/app/houses/')){message('Screenshot saved.');window.location.assign(data.nextUrl);}else recover(data.error||'Screenshot could not be uploaded. Try again.');};
  xhr.onerror=()=>recover('Connection lost. Your file and caption are still here—try again.');xhr.ontimeout=()=>recover('The upload took too long. Your file and caption are still here—try again.');xhr.onabort=()=>recover('Upload cancelled. Your file and caption are still here.');
  try{xhr.send(payload);}catch{recover('Screenshot could not be uploaded. Try again.');}
 });
});
