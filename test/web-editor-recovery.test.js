import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {createWebAdminServer} from '../src/web/server.js';
import {WebAdminService} from '../src/services/web-admin-service.js';
import {createSession,readSession} from '../src/web/session.js';
async function setup(){const f=await fixture(),server=createWebAdminServer({service:new WebAdminService(f.db),workspace:f.svc,config:{sessionSecret:'s'},resolveGuildMembership:async()=>({id:'g',name:'Guild',roleIds:[],esoServer:'pc_na'})});await new Promise(r=>server.listen(0,'127.0.0.1',r));const token=createSession({id:'u',username:'User',selectedGuildId:'g',guilds:[{id:'g'}]},Date.now(),'s'),cookie=`addressbook_session=${token}`,csrf=readSession(token,Date.now(),'s').csrf,base=`http://127.0.0.1:${server.address().port}`;return{...f,get:p=>fetch(base+p,{headers:{cookie},redirect:'manual'}),post:(p,data)=>fetch(base+p,{method:'POST',headers:{cookie},body:new URLSearchParams({csrf,contextGuildId:'g',contextEsoServer:'pc_na',...data}),redirect:'manual'}),close:async()=>{await new Promise(r=>server.close(r));await closeDatabase(f.db);}};}
test('house validation retains entered fields and filtered return context without changing saved data',async()=>{
 const f=await setup();try{const h=await f.svc.registerHouse(f.c,{houseId:1,esoOwner:'Builder',displayName:'Original',visibility:'private'}),r=await f.post(`/app/houses/${h.id}/edit`,{houseId:'1',esoOwner:'',displayName:'New <name>',description:'One\n\nTwo',tags:'cozy, garden',returnTo:'/app/houses?q=garden&page=2'}),html=await r.text();assert.equal(r.status,409);assert.match(html,/Edit house/);assert.match(html,/name="displayName" value="New &lt;name&gt;"/);assert.match(html,/One\n\nTwo/);assert.match(html,/name="tags" value="cozy, garden"/);assert.match(html,/name="returnTo"/);assert.match(html,/data-form-error/);assert.equal((await f.svc.getHouse(f.c,h.id)).display_name,'Original');}finally{await f.close();}
});
test('tour validation restores ordered draft stops and notes and can be corrected and resubmitted',async()=>{
 const f=await setup();try{const a=await f.svc.registerHouse(f.c,{houseId:1,esoOwner:'A',visibility:'private'}),b=await f.svc.registerHouse(f.c,{houseId:2,esoOwner:'B',visibility:'private'}),data={name:'',description:'A draft <story>',visibility:'private',stopIds:`${b.id},${a.id}`,[`stopNotes[${b.id}]`]:'Look upstairs\n\nA hidden room'};
 const r=await f.post('/app/tours/new',data),html=await r.text();assert.equal(r.status,409);assert.match(html,/id="tour-editor"/);assert.match(html,/data-restored-draft="true"/);assert.ok(html.includes(`name="stopIds" id="stopIds" value="${b.id},${a.id}"`));assert.match(html,/Look upstairs\n\nA hidden room/);assert.match(html,/A draft &lt;story&gt;/);assert.equal((await f.svc.listTours(f.c)).length,0);
 const save=await f.post('/app/tours/new',{...data,name:'Corrected route'});assert.equal(save.status,302);const tour=(await f.svc.listTours(f.c))[0],draft=await f.svc.getTourDraft(f.c,tour.id);assert.deepEqual(draft.stops.map(s=>s.saved_house_id),[b.id,a.id]);assert.match(draft.stops[0].notes,/Look upstairs/);
 }finally{await f.close();}
});
test('stale tour recovery retains the original version and cannot overwrite current data',async()=>{
 const f=await setup();try{const tour=await f.svc.saveTourDraft(f.c,{details:{name:'Original',visibility:'private'},stopIds:[]}),old=await f.svc.getTourDraft(f.c,tour.id);await f.svc.saveTourDraft(f.c,{id:tour.id,version:old.version,details:{name:'Newer saved version'},stopIds:[]});
 const r=await f.post(`/app/tours/${tour.id}/edit`,{version:old.version,name:'My unsaved draft',description:'Do not lose this',visibility:'private',stopIds:''}),html=await r.text();assert.equal(r.status,409);assert.match(html,/value="My unsaved draft"/);assert.ok(html.includes(`name="version" value="${old.version}"`));assert.match(html,/Open latest editor/);assert.match(html,/<button[^>]*disabled[^>]*>Save tour/);assert.equal((await f.svc.getTourDraft(f.c,tour.id)).tour.name,'Newer saved version');
 }finally{await f.close();}
});

test('recovery placeholders do not reveal another user private house details',async()=>{
 const f=await setup();try{const other=await f.svc.fresh({...f.c,userId:'someone'}),h=await f.svc.registerHouse(other,{houseId:2,esoOwner:'SecretBuilder',displayName:'Private secret name',description:'Private description',visibility:'private'}),r=await f.post('/app/tours/new',{name:'My draft',visibility:'private',description:'My own text',stopIds:String(h.id)}),html=await r.text();assert.equal(r.status,409);assert.match(html,/Unavailable selected house/);assert.match(html,/My own text/);assert.doesNotMatch(html,/SecretBuilder|Private secret name|Private description/);assert.equal((await f.svc.listTours(f.c)).length,0);}finally{await f.close();}
});
test('recovery rechecks house access before redisplaying record metadata',async()=>{
 const f=await setup();try{const h=await f.svc.registerHouse(f.c,{houseId:1,esoOwner:'Builder',displayName:'Previously visible house',visibility:'private'});f.svc.updateHouse=async()=>{await f.db.query("UPDATE saved_houses SET owner_user_id='other' WHERE id=?",[h.id]);throw new Error('Could not save.');};const r=await f.post(`/app/houses/${h.id}/edit`,{houseId:'1',esoOwner:'Builder',displayName:'New name'}),html=await r.text();assert.equal(r.status,403);assert.doesNotMatch(html,/Previously visible house|data-form-error/);}finally{await f.close();}
});
import {restoredTourStops} from '../src/web/editor-forms.js';
test('restoring a draft keeps existing notes when no replacement was submitted and respects explicit clearing',()=>{
 const candidates=[{id:7,house_name:'House',eso_owner:'Builder',scope:'public'}],saved=[{saved_house_id:7,display_name:'Tour title',notes:'Keep this note'}];
 assert.equal(restoredTourStops(new URLSearchParams({stopIds:'7'}),candidates,saved).stops[0].notes,'Keep this note');
 assert.equal(restoredTourStops(new URLSearchParams({stopIds:'7','stopNotes[7]':''}),candidates,saved).stops[0].notes,'');
});
