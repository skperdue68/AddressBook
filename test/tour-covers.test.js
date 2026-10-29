import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';import {mkdtemp,rm,readdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {fixture} from './workspace-fixture.js';import {closeDatabase,migrate,one} from '../src/db/database.js';import {TourCoverService} from '../src/services/tour-cover-service.js';
import {tourCoverSchema} from '../src/db/tour-cover-schema.js';

test('MariaDB tour-cover schema matches the unsigned tour key and cascades deletion',()=>{
 assert.match(tourCoverSchema('mariadb'),/tour_id BIGINT UNSIGNED NOT NULL PRIMARY KEY/);
 assert.match(tourCoverSchema('mariadb'),/REFERENCES tours\(id\) ON DELETE CASCADE/);
 assert.match(tourCoverSchema('mariadb'),/ENGINE=InnoDB/);
});
test('tour covers migrate safely, replace/remove and enforce live tour visibility/edit scope',async t=>{
 const {db,svc,c}=await fixture(),dir=await mkdtemp(join(tmpdir(),'hearthbound-tour-covers-'));t.after(async()=>{await closeDatabase(db);await rm(dir,{recursive:true,force:true});});const covers=new TourCoverService(svc,{directory:dir}),owner=await svc.fresh({...c,userId:'1'}),bytes=await sharp({create:{width:60,height:40,channels:3,background:'#a74'}}).png().toBuffer();
 await migrate(db);assert.ok(await one(db,'SELECT version FROM schema_migrations WHERE version=16'));
 const tour=await svc.saveTourDraft(c,{details:{name:'My private route',visibility:'private'},stopIds:[]});assert.equal(await covers.get(c,tour.id),null);await covers.save(c,tour.id,bytes);assert.equal((await sharp(await covers.read(c,tour.id)).metadata()).format,'webp');await assert.rejects(()=>covers.read(owner,tour.id),/not available/);await assert.rejects(()=>covers.save(owner,tour.id,bytes),/not available/);
 await covers.save(c,tour.id,bytes);assert.equal((await readdir(dir)).length,1);await assert.rejects(()=>covers.save(c,tour.id,Buffer.from('bad')),/PNG|JPEG|WebP/);assert.ok(await covers.get(c,tour.id));await covers.remove(c,tour.id);assert.equal(await covers.get(c,tour.id),null);assert.equal((await readdir(dir)).length,0);
 const shared=await svc.saveTourDraft(owner,{details:{name:'Shared route',visibility:'public'},stopIds:[]});await covers.save(owner,shared.id,bytes);assert.ok(await covers.read(c,shared.id));await assert.rejects(()=>covers.remove(c,shared.id),/editing/);await db.query("UPDATE tours SET visibility='private',creator_id='1',guild_id=NULL WHERE id=?",[shared.id]);await assert.rejects(()=>covers.read(c,shared.id),/not available/);
});
