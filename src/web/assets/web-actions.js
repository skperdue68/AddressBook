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
