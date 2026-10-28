import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {PermissionFlagsBits as P} from 'discord.js';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {HouseImageService} from '../src/services/house-image-service.js';
import {createHousingMenu} from '../src/ui/housing-menu.js';
const embed=p=>p.embeds?.[0]?.toJSON?.()||p.embeds?.[0];
test('Discord house cards attach the current cover and clear it for a house without images',async t=>{
 const {db,svc,c}=await fixture(),directory=await mkdtemp(join(tmpdir(),'hearthbound-cover-'));t.after(async()=>{await closeDatabase(db);await rm(directory,{recursive:true,force:true});});
 const images=new HouseImageService(svc,{directory}),owner=await svc.fresh({...c,userId:'1'}),h=await svc.registerHouse(owner,{houseId:1,esoOwner:'Builder',visibility:'public'}),plain=await svc.registerHouse(owner,{houseId:2,esoOwner:'Builder',visibility:'public'});
 const png=await sharp({create:{width:80,height:50,channels:3,background:'#eabb55'}}).png().toBuffer();await images.add(owner,h.id,png,'Garden');const second=await images.add(owner,h.id,png,'Another view');
 const menu=createHousingMenu(db,{images});let payload;const i={guildId:'g',guild:{name:'Guild'},channelId:'c',user:{id:'1'},member:{roles:[]},update:async p=>payload=p,reply:async p=>payload=p};
 await menu.button({...i,customId:`hu:details:guild:${h.id}:show:hu%3Ahome`});assert.equal(embed(payload).image?.url,'attachment://house-cover.webp');assert.equal(payload.files.length,1);assert.ok(Buffer.isBuffer(payload.files[0].attachment));assert.deepEqual(payload.attachments,[]);
 await images.setCover(owner,h.id,second.id);await menu.button({...i,customId:`hu:details:guild:${h.id}:show:hu%3Ahome`});assert.equal(payload.files[0].description,'Another view');
 await menu.button({...i,customId:`hu:details:guild:${plain.id}:show:hu%3Ahome`});assert.equal(embed(payload).image,undefined);assert.deepEqual(payload.attachments,[]);assert.deepEqual(payload.files,[]);
 await menu.button({...i,appPermissions:{has:permission=>permission!==P.AttachFiles},customId:`hu:details:guild:${h.id}:show:hu%3Ahome`});assert.equal(embed(payload).image,undefined);assert.deepEqual(payload.files,[]);assert.match(embed(payload).footer.text,/Attach Files/);
});
test('Discord house-cover loading never reveals another creator’s Private gallery',async t=>{
 const {db,svc,c}=await fixture(),directory=await mkdtemp(join(tmpdir(),'hearthbound-cover-private-'));t.after(async()=>{await closeDatabase(db);await rm(directory,{recursive:true,force:true});});
 const images=new HouseImageService(svc,{directory}),h=await svc.registerHouse(c,{houseId:1,esoOwner:'Secret',visibility:'private'}),png=await sharp({create:{width:20,height:20,channels:3,background:'#eabb55'}}).png().toBuffer();await images.add(c,h.id,png);
 const menu=createHousingMenu(db,{images});let payload;const i={guildId:'g',channelId:'c',user:{id:'1'},member:{roles:[]},update:async p=>payload=p,reply:async p=>payload=p};await menu.button({...i,customId:`hu:details:personal:${h.id}:show:hu%3Ahome`});assert.ok(!payload.files?.length);assert.ok(!embed(payload)?.image);
});
test('direct comment refresh keeps the current house cover attachment',async t=>{
 const {db,svc,c}=await fixture(),directory=await mkdtemp(join(tmpdir(),'hearthbound-cover-comment-'));t.after(async()=>{await closeDatabase(db);await rm(directory,{recursive:true,force:true});});
 const images=new HouseImageService(svc,{directory}),owner=await svc.fresh({...c,userId:'1'}),h=await svc.registerHouse(owner,{houseId:1,esoOwner:'Builder',visibility:'public'}),png=await sharp({create:{width:20,height:20,channels:3,background:'#eabb55'}}).png().toBuffer();await images.add(owner,h.id,png,'Garden');
 const menu=createHousingMenu(db,{images});let payload,modal;const i={guildId:'g',channelId:'c',user:{id:'1'},member:{roles:[]},update:async p=>payload=p,reply:async p=>payload=p,showModal:async m=>modal=m};
 await menu.button({...i,customId:`hu:details:guild:${h.id}:show:hu%3Ahome`});
 const message={...payload,attachments:new Map([['42',{id:'42'}]])},favorite=payload.components.flatMap(r=>r.toJSON().components).find(b=>b.label==='Favorite');
 await menu.button({...i,message,customId:favorite.custom_id.replace('hu:mark:favorite:','hu:comment:quick:')});
 await menu.modal({...i,message,customId:modal.toJSON().custom_id,isFromMessage:()=>true,fields:{getTextInputValue:()=> 'A beautiful room'}});
 assert.deepEqual(payload.attachments,[{id:'42'}]);assert.equal(embed(payload).image.url,'attachment://house-cover.webp');assert.match(embed(payload).fields.find(f=>f.name.includes('Comments')).value,/1 comment/);
});
import {welcomePage} from '../src/web/public-pages.js';
test('bot invite requests Attach Files for screenshots without Administrator permission',()=>{
 const html=welcomePage({clientId:'1546718742732341278'}),match=/href="(https:\/\/discord.com\/oauth2\/authorize\?[^"]+)"/.exec(html);assert.ok(match);const invite=new URL(match[1].replaceAll('&amp;','&')),permissions=BigInt(invite.searchParams.get('permissions'));assert.equal((permissions&P.AttachFiles)!==0n,true);assert.equal((permissions&P.Administrator)!==0n,false);
});
