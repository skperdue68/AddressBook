document.querySelectorAll('[data-tour-cover]').forEach(panel=>{
 if(!panel.querySelector('[data-tour-cover-upload]'))return;
 let saving=false;
 const message=(text,error=false)=>{const el=panel.querySelector('[data-tour-cover-status]');el.textContent=text;el.classList.toggle('upload-error',error);};
 const enhance=()=>{const button=panel.querySelector('[data-tour-cover-submit]');if(button)button.hidden=true;};enhance();
 async function save(form,action){
  if(saving)return;
  const input=form.querySelector('[type=file]');
  if(action==='upload'){
   const file=input.files[0];if(!file)return;
   const error=file.size>5*1024*1024?'Choose an image no larger than 5 MB.':file.size===0?'The selected file is empty.':file.type&&!['image/png','image/jpeg','image/webp'].includes(file.type)?'Choose a PNG, JPEG or WebP image.':'';
   if(error){message(error,true);return;}
  }
  const payload=new FormData(form);payload.set('action',action);
  const top=panel.querySelector('[data-tour-cover-dropzone]').getBoundingClientRect().top,controls=[...panel.querySelectorAll('input,button')],disabled=controls.map(el=>el.disabled);
  saving=true;panel.setAttribute('aria-busy','true');controls.forEach(el=>el.disabled=true);message(action==='remove'?'Removing tour image…':'Uploading tour image…');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),120000);
  try{
   const response=await fetch(form.getAttribute('action'),{method:'POST',headers:{Accept:'application/json'},body:payload,signal:controller.signal});
   let data;try{data=await response.json();}catch{throw Error('The upload could not finish. Sign in again if your session expired, then retry.');}
   if(!response.ok||!data.ok)throw Error(data.error||'The tour image could not be saved.');
   const template=document.createElement('template');template.innerHTML=data.coverHtml||'';const updated=template.content.querySelector('[data-tour-cover]');
   if(!updated?.querySelector('[data-tour-cover-upload]'))throw Error('The image was saved, but this page could not refresh. Reload before retrying.');
   const hero=document.querySelector('[data-tour-cover-hero]');if(hero&&data.heroHtml){const imageTemplate=document.createElement('template');imageTemplate.innerHTML=data.heroHtml;const freshHero=imageTemplate.content.querySelector('[data-tour-cover-hero]');if(freshHero)hero.replaceWith(freshHero);}
   panel.replaceChildren(...updated.childNodes);enhance();message(action==='remove'?'Tour image removed.':'Tour image saved. Drop or choose another image to change it.');
   requestAnimationFrame(()=>{const delta=panel.querySelector('[data-tour-cover-dropzone]').getBoundingClientRect().top-top;if(Math.abs(delta)>1)window.scrollBy({top:delta,behavior:'instant'});});
  }catch(error){
   controls.forEach((el,i)=>el.disabled=disabled[i]);message(error.name==='AbortError'?'Upload timed out. Your file is still selected; try again.':error.message,true);
   if(action==='upload'){const retry=panel.querySelector('[data-tour-cover-submit]');retry.hidden=false;retry.textContent='Retry upload';}
  }finally{clearTimeout(timeout);saving=false;panel.removeAttribute('aria-busy');}
 }
 panel.addEventListener('change',event=>{if(event.target.matches('[data-tour-cover-upload] [type=file]'))save(event.target.closest('form'),'upload');});
 panel.addEventListener('submit',event=>{const form=event.target;if(!form.matches('[data-tour-cover-upload],[data-tour-cover-remove]'))return;event.preventDefault();const remove=form.matches('[data-tour-cover-remove]');if(remove&&!window.confirm('Remove this tour image?'))return;save(form,remove?'remove':'upload');});
 for(const name of ['dragenter','dragover'])panel.addEventListener(name,event=>{const zone=event.target.closest('[data-tour-cover-dropzone]');if(zone){event.preventDefault();zone.classList.add('is-dragging');}});
 for(const name of ['dragleave','drop'])panel.addEventListener(name,event=>event.target.closest('[data-tour-cover-dropzone]')?.classList.remove('is-dragging'));
 panel.addEventListener('drop',event=>{const zone=event.target.closest('[data-tour-cover-dropzone]');if(!zone)return;event.preventDefault();if(saving){message('An upload is in progress. Drop the next image when it finishes.');return;}if(event.dataTransfer.files.length!==1){message('Drop one image at a time.',true);return;}const form=zone.closest('form');form.querySelector('[type=file]').files=event.dataTransfer.files;save(form,'upload');});
});
