import { one } from '../db/database.js';
import { withCatalogHouseName, withCatalogHouseNames } from '../utils/query-results.js';
import { requireEsoServer } from '../utils/eso-server.js';
import { UserHouseStateService } from './user-house-state-service.js';

const META=`h.name catalog_house_name,h.zone,h.subzone,h.category,h.classification,h.house_type,h.style,
 h.furnishing_limit,h.furnishing_limit_plus,h.special_furnishing_limit,h.special_furnishing_limit_plus,
 h.collectible_limit,h.collectible_limit_plus,h.special_collectible_limit,h.special_collectible_limit_plus,
 h.population_limit,h.population_limit_plus,h.purchase_type,h.gold_price,h.crown_price,h.crown_price_unfurnished,
 h.crown_price_furnished,h.requirements,h.availability,h.uesp_url,h.last_verified`;

export class MyAddressBookService{
  constructor(db){this.db=db;this.personalStates=new UserHouseStateService(db);}
  async summary(userId,guildId=null,esoServer){
    const id=String(userId),gid=String(guildId||''),server=requireEsoServer(esoServer);
    const [houses,tours,pendingHouses,pendingAccess,recent,personal,savedSearches]=await Promise.all([
      one(this.db,"SELECT COUNT(*) c FROM saved_houses WHERE eso_server=? AND (owner_user_id=? OR created_by=?) AND status<>'archived'",[server,id,id]),
      one(this.db,'SELECT COUNT(*) c FROM tours WHERE eso_server=? AND creator_id=?',[server,id]),
      one(this.db,"SELECT COUNT(*) c FROM saved_houses WHERE eso_server=? AND created_by=? AND status='pending'",[server,id]),
      one(this.db,"SELECT COUNT(*) c FROM global_moderator_requests WHERE eso_server=? AND discord_user_id=? AND status='pending'",[server,id]),
      one(this.db,`SELECT COUNT(*) c FROM recent_house_views rv JOIN saved_houses s ON s.id=rv.saved_house_id
        WHERE rv.discord_user_id=? AND s.eso_server=? AND s.status='active' AND (s.scope='global' OR (s.scope='public' AND s.guild_id=?) OR (s.scope='private' AND s.owner_user_id=?))`,[id,server,gid,id]),
      this.personalStates.counts({userId:id,guildId:gid,esoServer:server}),
      one(this.db,'SELECT COUNT(*) c FROM saved_house_searches WHERE discord_user_id=?',[id])
    ]);
    return {houses:Number(houses.c),tours:Number(tours.c),pending:Number(pendingHouses.c)+Number(pendingAccess.c),recent:Number(recent.c),...personal,savedSearches:Number(savedSearches.c)};
  }
  async houses(userId,esoServer){
    const id=String(userId),server=requireEsoServer(esoServer);
    return withCatalogHouseNames(await this.db.query(`SELECT s.*,${META} FROM saved_houses s JOIN houses h ON h.house_id=s.house_id
      WHERE s.eso_server=? AND (s.owner_user_id=? OR s.created_by=?) AND s.status<>'archived'
      ORDER BY CASE s.scope WHEN 'global' THEN 1 WHEN 'public' THEN 2 ELSE 3 END,coalesce(s.display_name,h.name),s.id`,[server,id,id]));
  }
  tours(userId,esoServer){const server=requireEsoServer(esoServer);return this.db.query("SELECT *,CASE visibility WHEN 'private' THEN 'personal' WHEN 'public' THEN 'server' ELSE 'global' END scope FROM tours WHERE eso_server=? AND creator_id=? ORDER BY name",[server,String(userId)]);}
  async pending(userId,esoServer){
    const id=String(userId),server=requireEsoServer(esoServer);
    const houses=withCatalogHouseNames(await this.db.query(`SELECT s.*,${META} FROM saved_houses s JOIN houses h ON h.house_id=s.house_id WHERE s.eso_server=? AND s.created_by=? AND s.status='pending' ORDER BY s.created_at DESC`,[server,id]));
    const requests=await this.db.query("SELECT * FROM global_moderator_requests WHERE eso_server=? AND discord_user_id=? AND status='pending' ORDER BY requested_at DESC",[server,id]);
    return {houses,requests};
  }
  async recordView(userId,savedHouseId){
    const uid=String(userId),hid=Number(savedHouseId);
    if(this.db.type==='sqlite') await this.db.query(`INSERT INTO recent_house_views(discord_user_id,saved_house_id,viewed_at) VALUES(?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(discord_user_id,saved_house_id) DO UPDATE SET viewed_at=CURRENT_TIMESTAMP`,[uid,hid]);
    else await this.db.query(`INSERT INTO recent_house_views(discord_user_id,saved_house_id,viewed_at) VALUES(?,?,CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE viewed_at=CURRENT_TIMESTAMP`,[uid,hid]);
  }
  async recent(userId,guildId=null,esoServer,limit=25){const server=requireEsoServer(esoServer);return withCatalogHouseNames(await this.db.query(`SELECT s.*,${META},rv.viewed_at FROM recent_house_views rv
    JOIN saved_houses s ON s.id=rv.saved_house_id JOIN houses h ON h.house_id=s.house_id
    WHERE rv.discord_user_id=? AND s.eso_server=? AND s.status='active' AND (s.scope='global' OR (s.scope='public' AND s.guild_id=?) OR (s.scope='private' AND s.owner_user_id=?))
    ORDER BY rv.viewed_at DESC,rv.saved_house_id DESC LIMIT ?`,[String(userId),server,String(guildId||''),String(userId),Number(limit)]));}
  async continueItems(userId,guildId=null,esoServer){
    const id=String(userId),gid=String(guildId||''),server=requireEsoServer(esoServer);
    const activeTourRow=await one(this.db,`SELECT ts.*,t.name current_tour_name,t.visibility FROM tour_sessions ts JOIN tours t ON t.id=ts.tour_id
      LEFT JOIN share_pass_sessions sps ON sps.tour_session_id=ts.id AND sps.closed_at IS NULL
      LEFT JOIN tour_share_passes tsp ON tsp.id=sps.tour_share_pass_id AND tsp.status='active'
      WHERE ts.mode='self_paced' AND ts.started_by=? AND t.eso_server=? AND (t.visibility='global' OR (t.visibility='public' AND t.guild_id=?) OR (t.visibility='private' AND t.creator_id=?) OR tsp.id IS NOT NULL)
      ORDER BY ts.updated_at DESC,ts.id DESC LIMIT 1`,[id,server,gid,id]);
    const activeTour=activeTourRow?{...activeTourRow,tour_name:activeTourRow.current_tour_name}:null;
    if(activeTour)delete activeTour.current_tour_name;
    const recentHouse=(await this.recent(id,gid,server,1))[0]||null;
    const editedTour=await one(this.db,"SELECT *,CASE visibility WHEN 'private' THEN 'personal' WHEN 'public' THEN 'server' ELSE 'global' END scope FROM tours WHERE eso_server=? AND creator_id=? ORDER BY updated_at DESC,id DESC LIMIT 1",[server,id]);
    return {activeTour,recentHouse,editedTour};
  }
  async legacyUnassigned(userId){
    const id=String(userId);
    const [houses,tours]=await Promise.all([
      one(this.db,'SELECT count(*) c FROM saved_houses WHERE eso_server IS NULL AND owner_user_id=?',[id]),
      one(this.db,'SELECT count(*) c FROM tours WHERE eso_server IS NULL AND creator_id=?',[id])
    ]);
    return {houses:Number(houses?.c||0),tours:Number(tours?.c||0)};
  }
}
