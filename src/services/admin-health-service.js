import { one } from '../db/database.js';
import { IntegrityService } from './integrity-service.js';
import { HouseMaintenanceService } from './house-maintenance-service.js';

const parseIds=value=>{try{return Array.isArray(value)?value:JSON.parse(value||'[]');}catch{return[];}};

export class AdminHealthService{
  constructor(db,{version='1.0.59'}={}){this.db=db;this.version=version;this.integrity=new IntegrityService(db);this.maintenance=new HouseMaintenanceService(db);}
  async snapshot({guildId,esoServer=null,allEnvironments=false,isApprover=false,availableChannelIds=[]}={}){
    let connected='Disconnected';
    try{await this.db.query('SELECT 1 ok');connected='Connected';}catch{}
    const backend=this.db.type==='mariadb'?'MariaDB':'SQLite';
    const migration=await one(this.db,'SELECT version,applied_at FROM schema_migrations ORDER BY version DESC LIMIT 1').catch(()=>null);
    const settings=await one(this.db,'SELECT * FROM guild_settings WHERE guild_id=?',[guildId]).catch(()=>null);
    const server=esoServer||settings?.eso_server||null;
    const showAll=!!allEnvironments&&!!isApprover;
    const pending=server?await one(this.db,"SELECT count(*) c FROM saved_houses WHERE eso_server=? AND status='pending' AND (guild_id=? OR origin_guild_id=?)",[server,guildId,guildId]).catch(()=>({c:0})):({c:0});
    const requests=showAll?await one(this.db,"SELECT count(*) c FROM global_moderator_requests WHERE status='pending'",[]).catch(()=>({c:0})):server?await one(this.db,"SELECT count(*) c FROM global_moderator_requests WHERE eso_server=? AND status='pending'",[server]).catch(()=>({c:0})):({c:0});
    const reports=server?await one(this.db,`SELECT count(*) c FROM housing_reports r JOIN housing_destinations d ON d.id=r.destination_id
      WHERE d.eso_server=? AND r.status IN ('open','reviewing') AND (r.guild_id=? OR r.guild_id IS NULL)`,[server,guildId]).catch(()=>({c:0})):({c:0});
    const passRows=await this.db.query(`SELECT 'house' kind,status,count(*) c FROM house_share_passes GROUP BY status UNION ALL SELECT 'tour' kind,status,count(*) c FROM tour_share_passes GROUP BY status`).catch(()=>[]);
    const passes={house:{active:0,revoked:0},tour:{active:0,revoked:0}};
    for(const row of passRows)if(passes[row.kind])passes[row.kind][row.status]=Number(row.c||0);
    const reminderRows=server?await this.db.query(`SELECT d.status,count(*) c
      FROM tour_event_deliveries d JOIN tour_events e ON e.id=d.event_id
      WHERE e.eso_server=? AND (e.guild_id=? OR e.guild_id IS NULL) AND d.status IN ('claimed','failed')
      GROUP BY d.status`,[server,guildId]).catch(()=>[]):[];
    const reminderHealth={staleClaims:0,failedDeliveries:0};
    for(const row of reminderRows){if(row.status==='claimed')reminderHealth.staleClaims+=Number(row.c||0);if(row.status==='failed')reminderHealth.failedDeliveries+=Number(row.c||0);}
    const integrity=(await this.integrity.scan({guildId,esoServer:server}).catch(()=>({counts:{orphanStops:0,duplicateDestinations:0,mismatchedHouses:0,staleProgress:0}}))).counts;
    const maintenance=await Promise.all([
      this.maintenance.stale({guildId,esoServer:server,limit:100}).catch(()=>[]),
      this.maintenance.duplicates({guildId,esoServer:server}).catch(()=>[])
    ]);
    const freshness={staleHouses:maintenance[0].length}; const duplicates={duplicateGroups:maintenance[1].length};
    const roles={moderator:parseIds(settings?.staff_role_ids).length,trusted:parseIds(settings?.registration_role_ids).length,tours:parseIds(settings?.tour_role_ids).length};
    const channelId=settings?.bot_channel_id||null;
    return {backend,connection:connected,version:this.version,esoServer:server,allEnvironments:showAll,channel:{id:channelId,name:settings?.bot_channel_name||null,missing:!!channelId&&availableChannelIds.length>0&&!availableChannelIds.map(String).includes(String(channelId))},registrationPolicy:settings?.registration_policy||'open',roleCounts:roles,pendingSubmissions:Number(pending?.c||0),globalModeratorRequests:Number(requests?.c||0),openReports:Number(reports?.c||0),passes,reminderHealth,integrity,freshness,duplicates,lastMigration:{version:Number(migration?.version||0),appliedAt:migration?.applied_at||null},backupReminder:'Database connectivity does not confirm a backup. Configure and verify an external backup schedule.'};
  }
}
