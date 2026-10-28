import sharp from 'sharp';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,unlink,readdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {one,withTransaction} from '../db/database.js';

export const HOUSE_IMAGE_LIMIT=8;
export const HOUSE_IMAGE_BYTES=5*1024*1024;
const animatedPng=input=>{
 if(input.length<8||!input.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return false;
 for(let offset=8;offset+12<=input.length;){const length=input.readUInt32BE(offset);if(length>input.length-offset-12)break;if(input.toString('ascii',offset+4,offset+8)==='acTL')return true;offset+=length+12;}return false;
};
export class HouseImageService{
 constructor(workspace,{directory=process.env.HOUSE_IMAGE_DIR||'./data/house-images'}={}){this.w=workspace;this.db=workspace.db;this.directory=resolve(directory);}
 async access(context,houseId,edit=false,conn=this.db){
  const c=await this.w.fresh(context),h=await this.w.saved.get(Number(houseId),conn);
  if(!h||(!this.w.policy.canViewHouse(h,c)&&!(h.status==='pending'&&this.w.policy.canEditHouse(h,c))))throw new Error('House is not available.');
  if(edit&&!this.w.policy.canEditHouse(h,c))throw new Error('House is not available for editing.');
  return {c,h};
 }
 async list(context,houseId){await this.access(context,houseId);return this.db.query('SELECT id,saved_house_id,caption,position,created_by,created_at FROM house_images WHERE saved_house_id=? ORDER BY position,id',[Number(houseId)]);}
 async add(context,houseId,input,caption=''){
  await this.access(context,houseId,true);
  if(!Buffer.isBuffer(input)||input.length>HOUSE_IMAGE_BYTES)throw new Error('Choose an image no larger than 5 MB.');
  let bytes;
  try{if(animatedPng(input))throw new Error();const source=sharp(input,{limitInputPixels:40000000,failOn:'warning'}),meta=await source.metadata();if(!['png','jpeg','webp'].includes(meta.format)||Number(meta.pages||1)>1)throw new Error();bytes=await source.rotate().resize({width:1920,height:1920,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();}
  catch{throw new Error('Choose a valid, still PNG, JPEG or WebP screenshot (up to 40 megapixels).');}
  caption=String(caption||'').trim();if(caption.length>250)throw new Error('Keep the caption to 250 characters.');
  const key=randomUUID()+'.webp';let written=false;
  try{return await withTransaction(this.db,async conn=>{
   await one(conn,'SELECT id FROM saved_houses WHERE id=? FOR UPDATE',[Number(houseId)]);const {c}=await this.access(context,houseId,true,conn);
   const count=await one(conn,'SELECT count(*) n,coalesce(max(position),-1)+1 next_position FROM house_images WHERE saved_house_id=?',[Number(houseId)]);
   if(Number(count.n)>=HOUSE_IMAGE_LIMIT)throw new Error('A house gallery supports up to eight screenshots. Remove one before adding another.');
   await mkdir(this.directory,{recursive:true});await writeFile(join(this.directory,key),bytes,{flag:'wx',mode:0o600});written=true;
   const result=await conn.query('INSERT INTO house_images(saved_house_id,storage_key,caption,position,created_by) VALUES(?,?,?,?,?)',[Number(houseId),key,caption,Number(count.next_position),c.userId]);
   return one(conn,'SELECT id,saved_house_id,caption,position FROM house_images WHERE id=?',[result.insertId]);
  });}catch(error){if(written)await unlink(join(this.directory,key)).catch(()=>{});throw error;}
 }
 filePath(key){if(!/^[a-f0-9-]{36}\.webp$/.test(key))throw new Error('Screenshot is unavailable.');return join(this.directory,key);}
 async read(context,houseId,imageId){await this.access(context,houseId);const image=await one(this.db,'SELECT storage_key FROM house_images WHERE saved_house_id=? AND id=?',[Number(houseId),Number(imageId)]);if(!image)throw new Error('Screenshot is unavailable.');return readFile(this.filePath(image.storage_key));}
 async setCover(context,houseId,imageId){return withTransaction(this.db,async conn=>{
  await one(conn,'SELECT id FROM saved_houses WHERE id=? FOR UPDATE',[Number(houseId)]);await this.access(context,houseId,true,conn);
  const image=await one(conn,'SELECT id FROM house_images WHERE saved_house_id=? AND id=?',[Number(houseId),Number(imageId)]);if(!image)throw new Error('Screenshot is unavailable.');
  await conn.query('UPDATE house_images SET position=position+1 WHERE saved_house_id=?',[Number(houseId)]);await conn.query('UPDATE house_images SET position=0 WHERE id=?',[image.id]);
 });}
 async remove(context,houseId,imageId){const key=await withTransaction(this.db,async conn=>{
  await one(conn,'SELECT id FROM saved_houses WHERE id=? FOR UPDATE',[Number(houseId)]);await this.access(context,houseId,true,conn);
  const image=await one(conn,'SELECT * FROM house_images WHERE saved_house_id=? AND id=?',[Number(houseId),Number(imageId)]);if(!image)throw new Error('Screenshot is unavailable.');
  await conn.query('DELETE FROM house_images WHERE id=?',[image.id]);return image.storage_key;
 });await unlink(this.filePath(key)).catch(error=>{if(error.code!=='ENOENT')throw error;});}
 async cleanupOrphans({now=Date.now()}={}){
  // An age window avoids racing an upload whose file is written before its DB
  // transaction commits. Only application-generated filenames are considered.
  const names=await readdir(this.directory).catch(error=>{if(error.code==='ENOENT')return [];throw error;});let removed=0;
  for(const key of names){if(!/^[a-f0-9-]{36}\.webp$/.test(key))continue;const path=this.filePath(key),info=await stat(path);if(!info.isFile()||info.mtimeMs>now-86400000)continue;
   if(!await one(this.db,'SELECT id FROM house_images WHERE storage_key=?',[key])){await unlink(path);removed++;}
  }return removed;
 }
}
