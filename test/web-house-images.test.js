import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import sharp from 'sharp';
import {fixture} from './workspace-fixture.js';import {closeDatabase} from '../src/db/database.js';import {HouseImageService} from '../src/services/house-image-service.js';
import {createWebAdminServer} from '../src/web/server.js';import {WebAdminService} from '../src/services/web-admin-service.js';import {createSession,readSession} from '../src/web/session.js';

test('web upload and image delivery enforce CSRF, context, and live Private permissions',async t=>{
 const {db,svc,c}=await fixture(),dir=await mkdtemp(join(tmpdir(),'hearthbound-web-images-'));svc.images=new HouseImageService(svc,{directory:dir});const h=await svc.registerHouse(c,{houseId:1,esoOwner:'Builder',visibility:'private'});
 const server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async()=>({id:'g',name:'Guild',roleIds:[],esoServer:'pc_na'})});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await closeDatabase(db);await rm(dir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`,token=createSession({id:'u',username:'Member',guilds:[{id:'g'}]},Date.now(),'s'),cookie=`addressbook_session=${token}`,csrf=readSession(token,Date.now(),'s').csrf,png=await sharp({create:{width:80,height:50,channels:3,background:'#eabb55'}}).png().toBuffer();
 const upload=async(csrfValue)=>{const form=new FormData();for(const [k,v]of Object.entries({csrf:csrfValue,contextGuildId:'g',contextEsoServer:'pc_na',action:'upload',caption:'A garden'}))form.set(k,v);form.set('image',new Blob([png],{type:'image/png'}),'garden.png');return fetch(`${base}/app/houses/${h.id}/gallery`,{method:'POST',headers:{cookie},body:form,redirect:'manual'});};
 assert.equal((await upload('wrong')).status,403);assert.equal((await svc.images.list(c,h.id)).length,0);assert.equal((await upload(csrf)).status,302);
 const image=(await svc.images.list(c,h.id))[0],path=`/app/houses/${h.id}/images/${image.id}`,response=await fetch(base+path,{headers:{cookie}});assert.equal(response.headers.get('content-type'),'image/webp');assert.equal(response.headers.get('cache-control'),'private, no-store');assert.ok((await response.arrayBuffer()).byteLength);
 const other=createSession({id:'1',guilds:[{id:'g'}]},Date.now(),'s');assert.notEqual((await fetch(base+path,{headers:{cookie:`addressbook_session=${other}`}})).headers.get('content-type'),'image/webp');
 const detail=await (await fetch(`${base}/app/houses/${h.id}`,{headers:{cookie}})).text();assert.ok(detail.includes('House screenshots'));assert.ok(detail.includes('A garden'));
});
