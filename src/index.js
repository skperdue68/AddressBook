import {UsageActivityService} from './services/usage-activity-service.js';
import {WebWorkspaceService} from './services/web-workspace-service.js';
import {resolveCurrentGuildMembership} from './web/guild-membership.js';
import 'dotenv/config';
import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { closeDatabase, ensureMariaDatabase, migrate, openDatabase } from './db/database.js';
import { runConfiguredMigration } from './db/database-migration.js';
import { seedHouses } from './db/seed-houses.js';
import { createHandlers } from './handlers.js';
import { FeaturedContentService } from './services/featured-content-service.js';
import { EngagementWorker } from './services/engagement-worker.js';
import { WebAdminService } from './services/web-admin-service.js';
import { webAdminConfig } from './web/config.js';
import { createWebAdminServer } from './web/server.js';

if(!process.env.DISCORD_TOKEN) throw new Error('DISCORD_TOKEN is required. Copy .env.example to .env and fill it in.');

const migration=await runConfiguredMigration();
if(migration){
  console.log(`Database migration completed: ${migration.direction}`);
  console.table(migration.summary);
  console.log('Set MIGRATE=false, then start HearthBound again.');
  process.exit(0);
}

if(String(process.env.DB_TYPE||'sqlite').toLowerCase()==='mariadb')await ensureMariaDatabase();
const db=openDatabase();
await migrate(db);
await seedHouses(db);
const handlers=createHandlers(db);
const client=new Client({intents:[GatewayIntentBits.Guilds]});
const worker=new EngagementWorker({featured:new FeaturedContentService(db),intervalMs:60_000});
const webConfig=webAdminConfig();
const webAdmin=webConfig.enabled?new WebAdminService(db):null;
let webServer=null;
const usage=new UsageActivityService(db,{isGuildActive:id=>client.guilds.cache.has(String(id))});
const usageCleanup=setInterval(()=>usage.purgeExpired().catch(()=>console.error('Usage history cleanup failed.')),3600000);usageCleanup.unref();

client.once(Events.ClientReady,async c=>{
  try{await handlers.ready(c);}catch(err){console.error('HearthBound could not refresh Discord names at startup:',err);}
  await worker.start();
  await usage.purgeExpired().catch(()=>console.error('Usage history cleanup failed.'));
  if(webAdmin){
    webServer=createWebAdminServer({service:webAdmin,workspace:Object.assign(new WebWorkspaceService(db),{usage}),config:webConfig,resolveOAuthIdentity:async tokens=>{
      const response=await fetch('https://discord.com/api/users/@me',{headers:{authorization:`Bearer ${tokens.access_token}`}});
      if(!response.ok)throw new Error('Discord identity lookup failed.');
      const user=await response.json(),guilds=[];
      for(const guild of c.guilds.cache.values()){
        try{
          const member=await guild.members.fetch({user:user.id,force:true}),settings=await webAdmin.guilds.ensureSettings(guild.id);
          guilds.push({id:guild.id,name:guild.name,roleIds:[...member.roles.cache.keys()],esoServer:settings.eso_server});
        }catch{/* user is not a member of this bot guild */}
      }
      return {...user,guilds};
    },resolveGuildMembership:({userId,guildId})=>resolveCurrentGuildMembership({client:c,guilds:webAdmin.guilds,userId,guildId})
    });
    await new Promise((resolve,reject)=>{webServer.once('error',reject);webServer.listen(webConfig.port,webConfig.host,resolve);});
    console.log(`HearthBound web administration listening on ${webConfig.host}:${webConfig.port}`);
  }
  console.log(`HearthBound ready as ${c.user.tag}`);
});
client.on(Events.InteractionCreate,async i=>{
  try{
    if(i.isAutocomplete()) return await handlers.autocomplete(i);
    if(i.isChatInputCommand()) return await handlers.chat(i);
    if(i.isButton()) return await handlers.button(i);
    if(i.isStringSelectMenu() || i.isRoleSelectMenu() || i.isChannelSelectMenu()) return await handlers.select(i);
    if(i.isModalSubmit()) return await handlers.modal(i);
  }catch(err){
    console.error(err);
    const message=/database|connect|pool|socket|ECONN/i.test(String(err?.message||''))
      ?'HearthBound cannot reach its database right now. Please try again shortly.'
      :`Error: ${err.message}`;
    const payload={content:message,flags:MessageFlags.Ephemeral};
    if(i.replied||i.deferred) await i.followUp(payload).catch(()=>{});
    else await i.reply(payload).catch(()=>{});
  }
});

let shuttingDown=false;
async function shutdown(){
  if(shuttingDown)return;
  shuttingDown=true;
  worker.stop();
  clearInterval(usageCleanup);
  if(webServer)await new Promise(resolve=>webServer.close(()=>resolve()));
  client.destroy();
  await closeDatabase(db).catch(()=>{});
  process.exit(0);
}
process.on('SIGINT',shutdown);
process.on('SIGTERM',shutdown);

await client.login(process.env.DISCORD_TOKEN);
