import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,migrate,closeDatabase,one} from '../src/db/database.js';
import {FeaturedContentService} from '../src/services/featured-content-service.js';
const DAY=86400000;
async function fixture(t,count){const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:':memory:'});t.after(()=>closeDatabase(db));await migrate(db);await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g','pc_na')");await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'Villa','villa')");for(let id=1;id<=count;id++){await db.query("INSERT INTO housing_destinations(id,eso_server,eso_owner,normalized_owner,house_id) VALUES(?,'pc_na',?,?,1)",[id,'owner'+id,'owner'+id]);await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(?,'pc_na','public','g',1,?,?,?,'active','u','u')",[id,'owner'+id,'owner'+id,id]);}return db;}
test('weekly selection persists deadlines and avoids previous destinations across restart',async t=>{
 const db=await fixture(t,10);let now=Date.parse('2026-10-21T12:00:00Z');const make=()=>new FeaturedContentService(db,{clock:()=>now,random:()=>0.25});let service=make();
 await service.set({guildId:'g',esoServer:'pc_na',targetKind:'house',targetId:1,actorId:'mod',isModerator:true});
 const initial=await service.rotateHouses({guildId:'g',esoServer:'pc_na'});assert.equal(initial.rotated,false);assert.equal(initial.items.length,1);assert.equal(initial.nextRotationAt.toISOString(),'2026-10-28T12:00:00.000Z');
 service=make();now+=7*DAY-1;assert.equal((await service.rotateHouses({guildId:'g',esoServer:'pc_na'})).rotated,false);now++;
 const result=await Promise.all([service.rotateHouses({guildId:'g',esoServer:'pc_na'}),make().rotateHouses({guildId:'g',esoServer:'pc_na'})]);assert.equal(result.filter(r=>r.rotated).length,1);
 const rows=await service.list({guildId:'g',esoServer:'pc_na',targetKind:'house'});assert.equal(rows.length,5);assert.ok(rows.every(r=>r.target_id!==1));
 const prior=rows.map(r=>r.target_id);now+=7*DAY;const next=await service.rotateHouses({guildId:'g',esoServer:'pc_na'});assert.equal(next.items.length,5);assert.ok(next.items.every(r=>!prior.includes(r.target_id)));
});
for(const count of [0,1,4,5,6])test(`weekly pool ${count} fills distinct slots and empty retries immediately`,async t=>{
 const db=await fixture(t,count);let now=Date.parse('2026-10-21T12:00:00Z');const service=new FeaturedContentService(db,{clock:()=>now});
 const args={guildId:'g',esoServer:'pc_na'};const first=await service.rotateHouses(args);assert.equal(first.items.length,Math.min(5,count));assert.equal(first.nextRotationAt===null,count===0);
 if(count){const due=first.nextRotationAt.getTime();await service.remove({guildId:'g',targetKind:'house',targetId:first.items[0].target_id,isModerator:true});now+=DAY;await service.rotateHouses(args);assert.equal(new Date((await one(db,'SELECT last_rotated_at FROM featured_house_cycles')).last_rotated_at).getTime(),due-7*DAY);now=due;const next=await service.rotateHouses(args);assert.equal(next.items.length,Math.min(5,count));assert.equal(new Set(next.items.map(r=>r.target_id)).size,next.items.length);}
});

test('weekly selection excludes wrong scopes and deduplicates destinations without changing tours',async t=>{
 const db=await fixture(t,2);await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,house_id,eso_owner,normalized_owner,destination_id,status,created_by,updated_by) VALUES(3,'pc_na','global',NULL,1,'owner1','owner1',1,'active','u','u'),(4,'pc_na','global',NULL,1,'owner2','owner2',2,'active','u','u')");
 await db.query("INSERT INTO tours(id,eso_server,visibility,guild_id,creator_id,name,house_source) VALUES(1,'pc_na','public','g','u','Tour','public_global')");
 await db.query("UPDATE saved_houses SET scope='private',owner_user_id='u' WHERE id=4");
 const service=new FeaturedContentService(db,{clock:()=>Date.parse('2026-10-21T12:00:00Z')});await service.set({guildId:'g',esoServer:'pc_na',targetKind:'tour',targetId:1,isModerator:true,actorId:'u'});
 const result=await service.rotateHouses({guildId:'g',esoServer:'pc_na'});assert.equal(result.items.length,2);assert.ok(result.items.every(r=>r.target_id!==4));
 assert.equal((await service.list({guildId:'g',esoServer:'pc_na',targetKind:'tour'})).length,1);
 await db.query("UPDATE saved_houses SET status='archived'");const changed=await service.rotateHouses({guildId:'g',esoServer:'pc_eu'});assert.equal(changed.items.length,0);assert.equal(changed.nextRotationAt,null);
});
