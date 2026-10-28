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

// A disclosure keeps all permitted routes reachable on small screens. Without
// this enhancement, the same navigation remains visible as ordinary links.
document.querySelectorAll('[data-mobile-navigation]').forEach(sidebar=>{
 const button=sidebar.querySelector('[data-mobile-nav-toggle]'),nav=sidebar.querySelector('#main-navigation'),label=button?.querySelector('[data-menu-label]');if(!button||!nav)return;
 const media=window.matchMedia('(max-width:700px)');let open=false;
 const show=(value,restoreFocus=false)=>{open=value;sidebar.dataset.navOpen=String(open);button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Close main navigation':'Open main navigation');if(label)label.textContent=open?'Close':'Menu';if(restoreFocus)button.focus();};
 sidebar.classList.add('nav-enhanced');button.hidden=false;show(false);
 button.addEventListener('click',()=>show(!open));
 sidebar.addEventListener('keydown',event=>{if(!media.matches)return;if(event.key==='Escape'&&open){event.preventDefault();show(false,true);}else if(event.key==='ArrowDown'&&event.target===button){event.preventDefault();show(true);nav.querySelector('a')?.focus();}});
 sidebar.addEventListener('focusout',event=>{if(media.matches&&open&&!sidebar.contains(event.relatedTarget))show(false);});
 document.addEventListener('click',event=>{if(media.matches&&open&&!sidebar.contains(event.target))show(false);});
 media.addEventListener?.('change',()=>{show(media.matches&&nav.contains(document.activeElement));});
});

// Keep failed-save feedback reachable for keyboard and screen-reader users.
document.querySelector('[data-form-error]')?.focus();

// Absolute activity timestamps use the viewer's browser zone, including DST.
// The server's labeled UTC text remains readable if localization is unavailable.
{
 let localized=0;
 try{
  const formatter=new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit',timeZoneName:'short'});
  document.querySelectorAll('[data-local-datetime]').forEach(element=>{
   const date=new Date(element.getAttribute('datetime'));
   if(!Number.isFinite(date.getTime()))return;
   const text=formatter.format(date);element.textContent=text;element.title=`${text} (${formatter.resolvedOptions().timeZone})`;localized++;
  });
  const note=document.querySelector('[data-local-time-zone]');
  if(localized&&note)note.textContent=`Times shown in your local time zone (${formatter.resolvedOptions().timeZone}).`;
 }catch{/* Keep the explicit UTC fallback without guessing the viewer's zone. */}
}

// These are independent rankings; synchronize their geometry, never their data.
document.querySelectorAll('[data-server-rankings]').forEach(group=>{
 const sections=[...group.children],tables=sections.map(section=>section.querySelector('table'));
 if(tables.length!==2||tables.some(table=>!table))return;
 const headings=sections.map(section=>section.querySelector('h3'));
 const managed=[...headings,...tables.flatMap(table=>[...table.rows])].filter(Boolean);
 let pending=false,lastWidth=-1;
 const align=()=>{
  pending=false;
  managed.forEach(element=>element.style.removeProperty('height'));
  if(getComputedStyle(group).gridTemplateColumns.split(' ').length<2)return;
  const match=elements=>{
   const present=elements.filter(Boolean);if(present.length<2)return;
   const height=Math.ceil(Math.max(...present.map(element=>element.getBoundingClientRect().height)));
   present.forEach(element=>element.style.height=`${height}px`);
  };
  match(headings);match(tables.map(table=>table.tHead?.rows[0]));
  const bodies=tables.map(table=>[...table.tBodies[0].rows]);
  for(let i=0;i<Math.min(...bodies.map(rows=>rows.length));i++)match(bodies.map(rows=>rows[i]));
 };
 const schedule=()=>{if(!pending){pending=true;requestAnimationFrame(align);}};
 // Only width changes trigger another measurement, avoiding row-height feedback.
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(entries=>{
  const width=entries[0].contentRect.width;
  if(width!==lastWidth){lastWidth=width;schedule();}
 }).observe(group);
 window.addEventListener('resize',schedule);
 document.fonts?.ready.then(schedule);schedule();
});
