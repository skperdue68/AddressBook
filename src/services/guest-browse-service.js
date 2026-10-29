import {readFile} from 'node:fs/promises';
import {one} from '../db/database.js';
import {pageWindow} from '../utils/pagination.js';
import {requireEsoServer,normalizeEsoServer} from '../utils/eso-server.js';
import {withCatalogHouseNames} from '../utils/query-results.js';

// This deliberately has no member context or mutation API. Public reads always
// recheck the current record, including every image and individual tour stop.
export class GuestBrowseService{
 constructor(workspace){this.w=workspace;this.db=workspace.db;}
 async houses(environment,{q='',tag='',page=1}={}){
  const args=[requireEsoServer(environment)],where=["s.scope='global'","s.status='active'",'s.eso_server=?'];
  if(q){where.push("(lower(coalesce(s.display_name,'')) LIKE ? OR lower(h.name) LIKE ? OR lower(s.eso_owner) LIKE ? OR lower(coalesce(h.zone,'')) LIKE ?)");args.push(...Array(4).fill('%'+String(q).slice(0,200).toLowerCase()+'%'));}
  if(tag){where.push('lower(s.tags) LIKE ?');args.push('%'+String(tag).slice(0,80).toLowerCase()+'%');}
  const from=`FROM saved_houses s JOIN houses h ON h.house_id=s.house_id WHERE ${where.join(' AND ')}`,total=Number((await one(this.db,`SELECT count(*) n ${from}`,args)).n),window=pageWindow(page,total);
  const rows=withCatalogHouseNames(await this.db.query(`SELECT s.id,s.display_name,s.eso_owner,s.house_id,s.eso_server,s.description,s.tags,h.name catalog_house_name,h.zone,h.classification,h.style,h.population_limit,(SELECT i.id FROM house_images i WHERE i.saved_house_id=s.id ORDER BY i.position,i.id LIMIT 1) cover_image_id ${from} ORDER BY lower(coalesce(s.display_name,h.name)),s.id LIMIT 25 OFFSET ?`,[...args,window.offset]));
  return {rows,total,page:window.page};
 }
 async tours(environment,{q='',page=1}={}){
  const args=[requireEsoServer(environment)],where=["t.visibility='global'",'t.eso_server=?'];if(q){where.push('lower(t.name) LIKE ?');args.push('%'+String(q).slice(0,200).toLowerCase()+'%');}
  const from=`FROM tours t WHERE ${where.join(' AND ')}`,total=Number((await one(this.db,`SELECT count(*) n ${from}`,args)).n),window=pageWindow(page,total);
  const rows=await this.db.query(`SELECT t.id,t.name,t.description,t.eso_server,(SELECT count(*) FROM tour_stops s WHERE s.tour_id=t.id) stops,(SELECT tour_id FROM tour_covers c WHERE c.tour_id=t.id) cover ${from} ORDER BY lower(t.name),t.id LIMIT 25 OFFSET ?`,[...args,window.offset]);return {rows,total,page:window.page};
 }
 async house(id){const h=await this.w.saved.get(Number(id));if(!h||h.scope!=='global'||h.status!=='active'||!normalizeEsoServer(h.eso_server))throw Error('Entry unavailable.');return h;}
 async tour(id){const tour=await this.w.tours.get(Number(id));if(!tour||tour.visibility!=='global'||!normalizeEsoServer(tour.eso_server))throw Error('Entry unavailable.');const stops=[];
  for(const s of await this.w.tours.getStops(tour.id)){
   let house;try{house=await this.house(s.saved_house_id);}catch{}
   stops.push(house&&house.eso_server===tour.eso_server?{id:s.id,position:s.position,available:true,house,title:s.custom_title||house.display_name||house.house_name,notes:s.notes}:{position:s.position,available:false});
  }
  return {tour,stops,cover:!!await one(this.db,'SELECT tour_id FROM tour_covers WHERE tour_id=?',[Number(id)])};
 }
 async images(id){await this.house(id);return this.db.query('SELECT id,caption FROM house_images WHERE saved_house_id=? ORDER BY position,id',[Number(id)]);}
 async houseImage(id,imageId){await this.house(id);const row=await one(this.db,'SELECT storage_key FROM house_images WHERE saved_house_id=? AND id=?',[Number(id),Number(imageId)]);if(!row)throw Error('Image unavailable.');return readFile(this.w.images.filePath(row.storage_key));}
 async tourImage(id){const tour=await this.w.tours.get(Number(id));if(!tour||tour.visibility!=='global'||!normalizeEsoServer(tour.eso_server))throw Error('Image unavailable.');const row=await one(this.db,'SELECT storage_key FROM tour_covers WHERE tour_id=?',[Number(id)]);if(!row)throw Error('Image unavailable.');return readFile(this.w.tourCovers.filePath(row.storage_key));}
 async houseTours(id){const h=await this.house(id);return this.db.query("SELECT DISTINCT t.id,t.name FROM tours t JOIN tour_stops s ON s.tour_id=t.id WHERE s.saved_house_id=? AND t.visibility='global' AND t.eso_server=? ORDER BY lower(t.name),t.id",[Number(id),h.eso_server]);}
 async random(environment){const row=await one(this.db,`SELECT id FROM saved_houses WHERE scope='global' AND status='active' AND eso_server=? ORDER BY ${this.db.type==='mariadb'?'RAND()':'RANDOM()'} LIMIT 1`,[requireEsoServer(environment)]);return row?this.house(row.id):null;}
}
