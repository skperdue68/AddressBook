import {crc32} from 'node:zlib';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {HouseImageService} from '../src/services/house-image-service.js';

test('gallery validates images, respects Private ownership, selects cover and removes files',async t=>{
 const {db,svc,c}=await fixture(),dir=await mkdtemp(join(tmpdir(),'hearthbound-images-'));t.after(async()=>{await closeDatabase(db);await rm(dir,{recursive:true,force:true});});
 const gallery=new HouseImageService(svc,{directory:dir}),h=await svc.registerHouse(c,{houseId:1,esoOwner:'Builder',visibility:'private'}),png=await sharp({create:{width:80,height:50,channels:3,background:'#eabb55'}}).png().toBuffer();
 const first=await gallery.add(c,h.id,png,'Garden <view>'),second=await gallery.add(c,h.id,png,'Waterfall');
 assert.equal((await gallery.list(c,h.id))[0].id,first.id);await gallery.setCover(c,h.id,second.id);assert.equal((await gallery.list(c,h.id))[0].id,second.id);
 await gallery.updateCaption(c,h.id,first.id,'A better caption');assert.equal((await gallery.list(c,h.id)).find(i=>i.id===first.id).caption,'A better caption');await assert.rejects(()=>gallery.updateCaption({...c,userId:'1'},h.id,first.id,'No'),/not available/);
 const image=await gallery.read(c,h.id,first.id);assert.equal((await sharp(image).metadata()).format,'webp');
 await assert.rejects(()=>gallery.list({...c,userId:'1'},h.id),/not available/);
 await assert.rejects(()=>gallery.add(c,h.id,Buffer.from('<svg onload="bad()"/>')),/PNG|JPEG|WebP/);
 await assert.rejects(()=>gallery.add(c,h.id,Buffer.alloc(5*1024*1024+1)),/5 MB/);
 await assert.rejects(()=>gallery.add(c,h.id,animatedPng(png)),/still PNG/);
 await gallery.remove(c,h.id,first.id);assert.equal((await readdir(dir)).length,1);
 for(let n=1;n<8;n++)await gallery.add(c,h.id,png);await assert.rejects(()=>gallery.add(c,h.id,png),/eight/);
 assert.equal((await gallery.list(c,h.id)).length,8);await db.query('DELETE FROM saved_houses WHERE id=?',[h.id]);assert.equal(await gallery.cleanupOrphans({now:Date.now()+2*86400000}),8);assert.equal((await readdir(dir)).length,0);
 const shared=await svc.registerHouse(await svc.fresh({...c,userId:'1'}),{houseId:2,esoOwner:'Other',visibility:'public'});await assert.rejects(()=>gallery.add(c,shared.id,png),/editing/);
});

function animatedPng(png){
 const chunk=(type,data)=>{const name=Buffer.from(type),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([length,name,data,checksum]);};
 const frame=sequence=>{const data=Buffer.alloc(26);data.writeUInt32BE(sequence);data.writeUInt32BE(80,4);data.writeUInt32BE(50,8);data.writeUInt16BE(1,20);data.writeUInt16BE(10,22);return chunk('fcTL',data);};
 const animation=Buffer.alloc(8);animation.writeUInt32BE(2);const parts=[png.subarray(0,8)],imageData=[];
 for(let offset=8;offset<png.length;){const length=png.readUInt32BE(offset),type=png.toString('ascii',offset+4,offset+8),raw=png.subarray(offset,offset+length+12);if(type==='IDAT')imageData.push(png.subarray(offset+8,offset+8+length));if(type==='IEND'){const sequence=Buffer.alloc(4);sequence.writeUInt32BE(2);parts.push(frame(1),chunk('fdAT',Buffer.concat([sequence,...imageData])));}parts.push(raw);if(type==='IHDR')parts.push(chunk('acTL',animation),frame(0));offset+=length+12;}return Buffer.concat(parts);
}
