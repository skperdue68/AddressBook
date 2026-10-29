import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';import {closeDatabase} from '../src/db/database.js';import {MyAddressBookService} from '../src/services/my-addressbook-service.js';import {WebAdminService} from '../src/services/web-admin-service.js';

test('pending houses remain in administrative review only, including for submitters and admins',async t=>{
 const {db,svc,c}=await fixture();t.after(()=>closeDatabase(db));const h=await svc.registerHouse(c,{houseId:1,esoOwner:'Awaiting approval',visibility:'public'});assert.equal(h.status,'pending');const admin=await svc.fresh({...c,userId:'1'}),book=new MyAddressBookService(db);
 assert.equal((await svc.listHouses(c,{personal:true})).total,0);assert.equal((await book.houses(c.userId,c.esoServer)).length,0);assert.equal((await book.pending(c.userId,c.esoServer,c.guildId)).houses.length,0);
 for(const context of [c,admin]){await assert.rejects(()=>svc.getHouse(context,h.id),/not available/);await assert.rejects(()=>svc.images.access(context,h.id),/not available/);assert.equal(svc.policy.canEditHouse(h,context),false);}
 assert.equal((await new WebAdminService(db).listPending({guildId:'g',esoServer:'pc_na'})).length,1);
 const tour=await svc.saveTourDraft(c,{details:{name:'Route',visibility:'private'},stopIds:[]});await db.query('INSERT INTO tour_stops(tour_id,position,saved_house_id) VALUES(?,?,?)',[tour.id,1,h.id]);assert.equal((await svc.tours.getStops(tour.id)).length,0);
});

// A successful approval-required copy must not send its submitter to a forbidden detail page.
test('Share Pass house copies awaiting approval return to the submission acknowledgement',async()=>{
 const {handleWebSharing}=await import('../src/web/web-sharing-routes.js');let location;
 await handleWebSharing({url:new URL('https://example.test/app/shared/house/'+'a'.repeat(32)),session:{csrf:'test'},context:{},workspace:{actions:{resolvePass:async()=>({}),copyPass:async()=>({house:{id:9,status:'pending'}})}},form:new URLSearchParams({action:'copy'}),redirect:(_response,value)=>{location=value;},response:{},setUsageKind:()=>{}});
 assert.equal(location,'/app/register?submitted=1');
});
