import 'dotenv/config';
import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { closeDatabase, ensureMariaDatabase, migrate, openDatabase } from './db/database.js';
import { runConfiguredMigration } from './db/database-migration.js';
import { seedHouses } from './db/seed-houses.js';
import { createHandlers } from './handlers.js';
import { EventReminderService } from './services/event-reminder-service.js';
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
  console.log('Set MIGRATE=false, then start AddressBook again.');
  process.exit(0);
}

if(String(process.env.DB_TYPE||'sqlite').toLowerCase()==='mariadb')await ensureMariaDatabase();
const db=openDatabase();
await migrate(db);
await seedHouses(db);
const handlers=createHandlers(db);
const client=new Client({intents:[GatewayIntentBits.Guilds]});
const reminders=new EventReminderService(db,{gateway:{
  async sendChannel({channelId,event,reminderKey}){const channel=await client.channels.fetch(channelId);await channel.send(`Reminder (${reminderKey}): **${event.title}** starts soon. Use the event card to RSVP or start the tour.`);},
  async sendDm({userId,event,reminderKey}){const user=await client.users.fetch(userId);await user.send(`AddressBook reminder (${reminderKey}): **${event.title}** starts soon in ${event.channel_id}.`);}
}});
const worker=new EngagementWorker({reminders,featured:new FeaturedContentService(db),intervalMs:60_000});
const webConfig=webAdminConfig();
const webAdmin=webConfig.enabled?new WebAdminService(db):null;
let webServer=null;

client.once(Events.ClientReady,async c=>{
  try{await handlers.ready(c);}catch(err){console.error('AddressBook could not refresh Discord names at startup:',err);}
  await worker.start();
  if(webAdmin){
    webServer=createWebAdminServer({service:webAdmin,config:webConfig,resolveOAuthIdentity:async tokens=>{
      const response=await fetch('https://discord.com/api/users/@me',{headers:{authorization:`Bearer ${tokens.access_token}`}});
      if(!response.ok)throw new Error('Discord identity lookup failed.');
      const user=await response.json(),guilds=[];
      for(const guild of c.guilds.cache.values()){
        try{
          const member=await guild.members.fetch(user.id),settings=await webAdmin.guilds.ensureSettings(guild.id);
          guilds.push({id:guild.id,name:guild.name,roleIds:[...member.roles.cache.keys()],esoServer:settings.eso_server});
        }catch{/* user is not a member of this bot guild */}
      }
      return {...user,guilds};
    },resolveGuildMembership:async ({userId,guildId})=>{
      const guild=c.guilds.cache.get(String(guildId));
      if(!guild)return null;
      try{const member=await guild.members.fetch(String(userId)),settings=await webAdmin.guilds.ensureSettings(guild.id);return {id:guild.id,name:guild.name,roleIds:[...member.roles.cache.keys()],esoServer:settings.eso_server};}catch{return null;}
    }});
    await new Promise((resolve,reject)=>{webServer.once('error',reject);webServer.listen(webConfig.port,webConfig.host,resolve);});
    console.log(`AddressBook web administration listening on ${webConfig.host}:${webConfig.port}`);
  }
  console.log(`AddressBook ready as ${c.user.tag}`);
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
      ?'AddressBook cannot reach its database right now. Please try again shortly.'
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
  if(webServer)await new Promise(resolve=>webServer.close(()=>resolve()));
  client.destroy();
  await closeDatabase(db).catch(()=>{});
  process.exit(0);
}
process.on('SIGINT',shutdown);
process.on('SIGTERM',shutdown);

await client.login(process.env.DISCORD_TOKEN);
