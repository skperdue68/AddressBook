import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,unlink,readdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {one,withTransaction} from '../db/database.js';
import {normalizeUploadedImage} from './house-image-service.js';

export class TourCoverService{
 constructor(workspace,{directory=process.env.TOUR_COVER_DIR||'./data/tour-covers'}={}){this.w=workspace;this.db=workspace.db;this.directory=resolve(directory);}
 async access(context,id,edit=false,conn=this.db){const c=await this.w.fresh(context),tour=await this.w.tours.get(Number(id),conn);if(!tour||(edit?!this.w.policy.canEditTour(tour,c):!this.w.policy.canViewTour(tour,c)))throw Error(edit?'Tour is not available for editing.':'Tour is not available.');return {c,tour};}
 filePath(key){if(!/^[a-f0-9-]{36}\.webp$/.test(key))throw Error('Tour cover is unavailable.');return join(this.directory,key);}
 async get(c,id){await this.access(c,id);return one(this.db,'SELECT tour_id,updated_at FROM tour_covers WHERE tour_id=?',[Number(id)]);}
 async read(c,id){await this.access(c,id);const row=await one(this.db,'SELECT storage_key FROM tour_covers WHERE tour_id=?',[Number(id)]);if(!row)throw Error('Tour cover is unavailable.');return readFile(this.filePath(row.storage_key));}
 async save(context,id,input){await this.access(context,id,true);const bytes=await normalizeUploadedImage(input),key=randomUUID()+'.webp';let written=false,previous;
  try{previous=await withTransaction(this.db,async conn=>{await one(conn,'SELECT id FROM tours WHERE id=? FOR UPDATE',[Number(id)]);const {c}=await this.access(context,id,true,conn),old=await one(conn,'SELECT storage_key FROM tour_covers WHERE tour_id=?',[Number(id)]);await mkdir(this.directory,{recursive:true});await writeFile(this.filePath(key),bytes,{flag:'wx',mode:0o600});written=true;
   if(old)await conn.query('UPDATE tour_covers SET storage_key=?,created_by=?,updated_at=CURRENT_TIMESTAMP WHERE tour_id=?',[key,c.userId,Number(id)]);else await conn.query('INSERT INTO tour_covers(tour_id,storage_key,created_by) VALUES(?,?,?)',[Number(id),key,c.userId]);return old?.storage_key;
  });}catch(error){if(written)await unlink(this.filePath(key)).catch(()=>{});throw error;}
  if(previous)await unlink(this.filePath(previous)).catch(()=>{});
 }
 async remove(context,id){const key=await withTransaction(this.db,async conn=>{await one(conn,'SELECT id FROM tours WHERE id=? FOR UPDATE',[Number(id)]);await this.access(context,id,true,conn);const old=await one(conn,'SELECT storage_key FROM tour_covers WHERE tour_id=?',[Number(id)]);await conn.query('DELETE FROM tour_covers WHERE tour_id=?',[Number(id)]);return old?.storage_key;});if(key)await unlink(this.filePath(key)).catch(()=>{});}
 async cleanupOrphans({now=Date.now()}={}){const names=await readdir(this.directory).catch(e=>{if(e.code==='ENOENT')return [];throw e;});let removed=0;for(const key of names){if(!/^[a-f0-9-]{36}\.webp$/.test(key))continue;const path=this.filePath(key),info=await stat(path);if(!info.isFile()||info.mtimeMs>now-86400000)continue;if(!await one(this.db,'SELECT tour_id FROM tour_covers WHERE storage_key=?',[key])){await unlink(path);removed++;}}return removed;}
}
