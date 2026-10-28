import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {HouseImageService} from '../src/services/house-image-service.js';
import {SharePassService} from '../src/services/share-pass-service.js';
import {personalControls} from '../src/web/personal-controls.js';
import {houseStateSpecs,myAddressBookPayload} from '../src/ui/housing-ui.js';
test('gallery movement changes order and cover, validates ownership and stays within this house',async()=>{
 const {db,svc,c}=await fixture();try{const h=await svc.registerHouse(c,{houseId:1,esoOwner:'Builder',visibility:'private'}),gallery=new HouseImageService(svc);
 for(let n=0;n<3;n++)await db.query('INSERT INTO house_images(saved_house_id,storage_key,caption,position,created_by) VALUES(?,?,?,?,?)',[h.id,`test-${n}`,'',n,c.userId]);
 const initial=await gallery.list(c,h.id);await gallery.move(c,h.id,initial[2].id,-1);await gallery.move(c,h.id,initial[2].id,-1);
 assert.deepEqual((await gallery.list(c,h.id)).map(i=>i.id),[initial[2].id,initial[0].id,initial[1].id]);
 await gallery.move(c,h.id,initial[2].id,-1);assert.equal((await gallery.list(c,h.id))[0].id,initial[2].id);
 await assert.rejects(()=>gallery.move({...c,userId:'1'},h.id,initial[0].id,1),/not available/);
 await assert.rejects(()=>gallery.move(c,h.id,99999,1),/unavailable/);await assert.rejects(()=>gallery.move(c,h.id,initial[0].id,50),/direction/);
 }finally{await closeDatabase(db);}
});
test('sharing remembers only successful posts for the same user and server across house and tour shares',async()=>{
 const {db}=await fixture();try{const service=new SharePassService(db);const add=async(user,guild,channel,message,time)=>db.query('INSERT INTO house_share_passes(token_hash,created_by,origin_guild_id,channel_id,message_id,created_at) VALUES(?,?,?,?,?,?)',[`${user}-${guild}-${channel}`,user,guild,channel,message,time]);
 await add('u','g','10','100','2026-10-27 10:00:00');await add('u','g','20',null,'2026-10-28 10:00:00');await add('other','g','30','300','2026-10-28 11:00:00');await add('u','other','40','400','2026-10-28 12:00:00');
 assert.equal((await service.lastPostedDestination('u','g')).channel_id,'10');assert.equal(await service.lastPostedDestination('nobody','g'),null);
 }finally{await closeDatabase(db);}
});
test('web and Discord personal controls offer favorites without visit-status controls',()=>{
 assert.doesNotMatch(personalControls('/app/houses/1/actions',{csrf:'x'},{}),/Visit status|Want to Visit|Visited|data-personal-action="visit"/);
 assert.doesNotMatch(JSON.stringify(houseStateSpecs({id:1})),/Want to Visit|Visited/);
 assert.doesNotMatch(JSON.stringify(myAddressBookPayload({})),/Want to Visit|Visited/);
});
