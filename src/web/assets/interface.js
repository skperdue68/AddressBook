// The access explanation works with a pointer, keyboard, and touch.
document.querySelectorAll('.access-info').forEach(info=>{
 const trigger=info.querySelector('button'),tip=info.querySelector('[role="tooltip"]');let pinned=false;
 const show=value=>{tip.hidden=!value;trigger.setAttribute('aria-expanded',String(value));};
 info.addEventListener('mouseenter',()=>show(true));info.addEventListener('mouseleave',()=>{if(!pinned&&!info.contains(document.activeElement))show(false);});
 trigger.addEventListener('focus',()=>show(true));info.addEventListener('focusout',e=>{if(!info.contains(e.relatedTarget)&&!pinned)show(false);});
 trigger.addEventListener('click',()=>{pinned=!pinned;show(pinned);});
 document.addEventListener('click',e=>{if(!info.contains(e.target)){pinned=false;show(false);}});
 trigger.addEventListener('keydown',e=>{if(e.key==='Escape'){pinned=false;show(false);}});
});
// Filter selections change a view; they never submit a mutation implicitly.
document.querySelectorAll('form.filters').forEach(form=>{
 if(form.method.toLowerCase()!=='get')return;
 form.querySelectorAll('select').forEach(select=>select.addEventListener('change',()=>form.requestSubmit()));
});
