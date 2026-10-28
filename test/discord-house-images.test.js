import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import sharp from 'sharp';
import {fixture} from './workspace-fixture.js';import {closeDatabase,one,migrate} from '../src/db/database.js';import {HouseImageService} from '../src/services/house-image-service.js';import {discordHouseGallery,galleryCaptionModal} from '../src/ui/house-gallery.js';import {commandJson} from '../src/commands/definitions.js';

test('Discord uploads and web gallery share images while private galleries reject bot owners',async t=>{
 const {db,svc,c}=await fixture(),dir=await mkdtemp(join(tmpdir(),'hearthbound-discord-images-'));svc.images=new HouseImageService(svc,{directory:dir});t.after(async()=>{await closeDatabase(db);await rm(dir,{recursive:true,force:true});});const h=await svc.registerHouse(c,{houseId:1,esoOwner:'Builder',visibility:'private'}),png=await sharp({create:{width:80,height:50,channels:3,background:'#eabb55'}}).png().toBuffer();
 let payload;const i={guildId:'g',user:{id:'u'},member:{roles:[]},deferReply:async()=>{},editReply:async value=>{payload=value;}};
 await discordHouseGallery(svc,i,{houseId:h.id,attachment:{url:'https://cdn.discordapp.com/attachments/1/2/house.png',size:png.length},caption:'Garden view',fetchImpl:async()=>new Response(png)});
 assert.equal((await svc.images.list(c,h.id)).length,1);assert.equal(payload.files.length,1);assert.equal(payload.embeds[0].toJSON().image.url,'attachment://house.webp');
 const image=(await svc.images.list(c,h.id))[0];let modal;await galleryCaptionModal(svc,{...i,showModal:async value=>{modal=value.toJSON();}},{houseId:h.id,imageId:image.id,index:0});assert.match(modal.custom_id,/caption:/);assert.equal(modal.components[0].components[0].value,'Garden view');
 let updated=false;await discordHouseGallery(svc,{...i,deferUpdate:async()=>{updated=true;}},{houseId:h.id,imageId:image.id,index:0,action:'caption',caption:'New garden view'});assert.equal(updated,true);assert.match(payload.embeds[0].toJSON().description,/New garden view/);assert.ok(payload.components.length<=2);
 await discordHouseGallery(svc,{...i,user:{id:'1'}},{houseId:h.id});assert.match(payload.content,/not available/);assert.equal(payload.files,undefined);
 const options=commandJson.map(command=>command.options.map(o=>o.name));assert.deepEqual(options[0],['house','screenshot','caption']);assert.deepEqual(options[1],options[0]);
 // Existing installations acquire the table and migration marker on restart.
 await db.query('DROP TABLE house_images');await db.query('DELETE FROM schema_migrations WHERE version=15');await migrate(db);await migrate(db);assert.equal(Number((await one(db,'SELECT count(*) n FROM schema_migrations WHERE version=15')).n),1);
});
