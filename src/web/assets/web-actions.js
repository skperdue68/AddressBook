document.querySelectorAll('pre code').forEach(code => {
  const button=document.createElement('button');button.type='button';button.textContent='Copy';button.className='copy-code';
  button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(code.textContent);button.textContent='Copied';}catch{const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(code);selection.removeAllRanges();selection.addRange(range);button.textContent='Text selected — copy now';}});
  code.parentElement.before(button);
});
document.querySelectorAll('[data-ordered-selection]').forEach(form=>{
  const field=form.querySelector('[name="orderedSelection"]');let order=[];
  form.querySelectorAll('[name="houseIds"]').forEach(check=>check.addEventListener('change',()=>{order=order.filter(id=>id!==check.value);if(check.checked)order.push(check.value);field.value=order.join(',');}));
});

// A visit shortcut should reveal its copy-ready commands, not just scroll to a closed panel.
const revealVisitCommands=()=>{if(location.hash==='#visit-house'){const details=document.getElementById('visit-house');if(details?.tagName==='DETAILS')details.open=true;}};
window.addEventListener('hashchange',revealVisitCommands);revealVisitCommands();
// Personal state changes stay on this page; each form retains the normal POST fallback.
document.querySelectorAll('form[data-personal-action]').forEach(form=>{
 const status=form.querySelector('[role="status"]'),select=form.querySelector('select'),button=form.querySelector('button');
 let savedValue=select?.value;
 const save=async()=>{
  if(form.dataset.saving==='true')return;
  form.dataset.saving='true';form.setAttribute('aria-busy','true');status.textContent='Saving…';
  const payload=new URLSearchParams(new FormData(form));
  if(select)select.disabled=true;if(button)button.disabled=true;
  try{
   const response=await fetch(form.getAttribute('action')||location.href,{method:'POST',body:payload,headers:{Accept:'application/json'},credentials:'same-origin'});
   const data=await response.json().catch(()=>({}));
   if(!response.ok||!data.ok)throw new Error(data.error||'Could not save. Please try again.');
   if(select){savedValue=data.state?.visit_state||'none';select.value=savedValue;}
   if(button){const favorite=Boolean(Number(data.state?.is_favorite));button.textContent=favorite?'Unfavorite':'Favorite';button.setAttribute('aria-pressed',String(favorite));form.querySelector('[name="value"]').value=favorite?'0':'1';}
   // Attribute each completed action to its own usage event.
   const eventKey=form.querySelector('[name="eventKey"]');if(eventKey&&crypto.randomUUID)eventKey.value=crypto.randomUUID();
   status.textContent='Saved';
  }catch(error){if(select)select.value=savedValue;status.textContent=error.message;}
  finally{form.dataset.saving='false';form.removeAttribute('aria-busy');if(select)select.disabled=false;if(button)button.disabled=false;}
 };
 form.addEventListener('submit',event=>{event.preventDefault();save();});
 select?.addEventListener('change',save);
});

// Inbox status and internal notes are independent edits with one shared revision per card.
document.querySelectorAll('[data-feedback-id]').forEach(card=>{
 const forms=[...card.querySelectorAll('form[data-feedback-action]')],select=card.querySelector('[name="status"]'),badge=card.querySelector('[data-feedback-status]');
 let savedStatus=select.value,saving=false;
 forms.forEach(form=>{
  const status=form.querySelector('[role="status"]');
  const save=async()=>{
   if(saving)return;
   saving=true;status.textContent='Saving…';form.setAttribute('aria-busy','true');
   const payload=new URLSearchParams(new FormData(form)),controls=[...card.querySelectorAll('button,select')];
   controls.forEach(control=>{control.disabled=true;});
   try{
    const response=await fetch(form.getAttribute('action')||location.href,{method:'POST',body:payload,headers:{Accept:'application/json'},credentials:'same-origin'}),data=await response.json().catch(()=>({}));
    if(!response.ok||!data.ok)throw new Error(data.error||'Could not save. Please try again.');
    savedStatus=data.item.status;select.value=savedStatus;
    badge.textContent=select.options[select.selectedIndex]?.textContent||savedStatus;
    forms.forEach(review=>{review.querySelector('[name="revision"]').value=String(data.item.revision);const key=review.querySelector('[name="eventKey"]');if(key&&crypto.randomUUID)key.value=crypto.randomUUID();});
    status.textContent='Saved';
   }catch(error){select.value=savedStatus;status.textContent=error.message;}
   finally{saving=false;form.removeAttribute('aria-busy');controls.forEach(control=>{control.disabled=false;});}
  };
  form.addEventListener('submit',event=>{event.preventDefault();save();});
  if(form.dataset.feedbackAction==='status')select.addEventListener('change',save);
 });
});
