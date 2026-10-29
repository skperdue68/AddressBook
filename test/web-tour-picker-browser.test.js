import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {tourHousePicker} from '../src/web/tour-house-picker.js';
const browser=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';

test('browser tour picker filters house and owner terms, applies facets, and keeps selected stop order',async t=>{
 try{await access(browser);}catch{t.skip('Chrome unavailable; set CHROME_PATH to run browser regression');return;}
 const temp=await mkdtemp(join(tmpdir(),'hearthbound-picker-'));
 try{
 const rows=[{id:1,population_limit:6,house_name:'Grand Psijic Villa',eso_owner:'@Alpha',scope:'public',guild_id:'g',tags:'["garden","games"]',zone:'Artaeum',style:'Altmer',house_type:'Manor',classification:'Notable'},{id:2,house_name:'Autumn Cottage',eso_owner:'Bravo',scope:'global',tags:'["garden"]',zone:'Glenumbra',style:'Breton',house_type:'Small',classification:'Staple'},{id:3,house_name:'Hidden Home',eso_owner:'Member',scope:'private',owner_user_id:'u',tags:'[]'}];
 const source=await readFile(new URL('../src/web/assets/tour-editor.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/web/assets/workspace.css',import.meta.url),'utf8');
 const checks=`const report=[];const check=(value,message)=>{if(!value)throw Error(message);report.push(message);};const set=(id,value)=>{const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));};const visible=()=>[...document.querySelectorAll('[data-candidate-label]')].filter(el=>getComputedStyle(el).display!=='none').map(el=>el.querySelector('input').dataset.addHouse).join(',');
 check(visible()==='1,2','initial eligibility hides private houses');
 set('candidate-filter','Villa');check(visible()==='1','plain live text filter works');
 set('candidate-filter','@alpha villa');check(visible()==='1','house and ESO owner terms work together');
 document.querySelector('[data-add-house="1"]').click();check(document.getElementById('stopIds').value==='1','adding visible house updates draft');check(document.querySelector('#tour-stops .house-capacity').textContent.trim()==='6 max','new stop keeps capacity badge');
 document.getElementById('candidate-clear').click();set('candidate-tags','garden');set('candidate-style','Breton');check(visible()==='2','tags and style combine');
 document.querySelector('[data-add-house="2"]').click();check(document.getElementById('stopIds').value==='1,2','adding filtered house preserves selection order');
 set('candidate-filter','no match');check(visible()==='','no matches are hidden visually');check(!document.getElementById('candidate-empty').hidden,'empty state shown');
 document.getElementById('candidate-clear').click();check(visible()==='1,2','clear restores eligible houses');check(document.getElementById('stopIds').value==='1,2','clear preserves draft stops');
 check(document.getElementById('candidate-apply').type==='button','apply filters never submits tour');document.getElementById('candidate-apply').click();
 const before=document.getElementById('stopIds').value;document.getElementById('candidate-filter').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));check(document.getElementById('stopIds').value===before,'Enter filters without changing stops');
 document.querySelector('[name="visibility"]').value='global';document.querySelector('[name="visibility"]').dispatchEvent(new Event('change'));check(visible()==='2','visibility change narrows candidates');
 document.getElementById('result').textContent=JSON.stringify({ok:true,checks:report});`;
 const html=`<!doctype html><style>${css}</style><form id="tour-editor" data-tour-creator="u" data-source-guild="g"><select name="visibility"><option value="public">Server</option><option value="global">Global</option></select><input id="stopIds"><div id="tour-stops"></div><p id="order-status"></p>${tourHousePicker(rows,[])}</form><pre id="result">not run</pre><script>${source}</script><script>try{${checks}}catch(error){document.getElementById('result').textContent=JSON.stringify({ok:false,error:error.message})}</script>`;
 const file=join(temp,'picker.html');await writeFile(file,html);
 const output=execFileSync(browser,['--headless','--no-sandbox','--disable-gpu',`--user-data-dir=${join(temp,'profile')}`,'--dump-dom',pathToFileURL(file).href],{encoding:'utf8',timeout:30000,stdio:['ignore','pipe','ignore']});
 const match=output.match(/<pre id="result">([^<]+)<\/pre>/);assert.ok(match,'browser produced a result');const result=JSON.parse(match[1].replaceAll('&quot;','"').replaceAll('&amp;','&'));assert.equal(result.ok,true,result.error);assert.ok(result.checks.length>=12);
 }finally{await rm(temp,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});


import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {handleWorkspaceRoute} from '../src/web/workspace-routes.js';

test('existing tour editor provides find/add and review anchors plus a route back to its tour',async()=>{
 const {db,svc,c}=await fixture();try{
 const tour=await svc.saveTourDraft(c,{details:{name:'Route',visibility:'public'},stopIds:[]});
 await svc.saved.createPublic({guildId:c.guildId,esoServer:c.esoServer,houseId:1,esoOwner:'Alpha',createdBy:c.userId});
 let html='';await handleWorkspaceRoute({request:{method:'GET'},response:{},url:new URL(`http://local/app/tours/${tour.id}/edit`),session:{id:c.userId,username:'Member',csrf:'token'},context:c,workspace:svc,send:(_response,status,body)=>{assert.equal(status,200);html=body;},redirect:()=>assert.fail('unexpected redirect')});
 assert.match(html,/href="#add-houses"/);assert.match(html,/id="add-houses"/);assert.match(html,/href="#tour-stops-section"/);assert.match(html,/id="tour-stops-section"/);
 assert.ok(html.includes(`href="/app/tours/${tour.id}">Back to tour`));
 assert.match(html,/target="_blank" rel="noopener" aria-label="Preview House One \(opens in a new tab\)"/);
 }finally{await closeDatabase(db);}
});
