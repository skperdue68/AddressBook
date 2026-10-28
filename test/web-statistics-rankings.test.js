import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {CommunityStatisticsService} from '../src/services/community-statistics-service.js';
import {handleWorkspaceRoute} from '../src/web/workspace-routes.js';

async function seeded(){
 const f=await fixture(),{db,svc,c}=f;
 await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('other','pc_na')");
 const add=(esoOwner,houseId,extra={})=>svc.saved.createPublic({guildId:'g',esoServer:'pc_na',esoOwner,houseId,createdBy:'same-discord-registrar',...extra});
 await add('@Alpha',1);await add('aLPHA',2,{createdBy:'different-discord-registrar'});
 await add('Bravo',1);await add('Bravo',2);await add('Charlie',1);
 await add('Foreign',1,{guildId:'other'});await add('OtherEnvironment',1,{esoServer:'pc_eu'});
 const pending=await add('Pending',2);await db.query("UPDATE saved_houses SET status='pending' WHERE id=?",[pending.id]);
 const archived=await add('Archived',2);await db.query("UPDATE saved_houses SET status='archived' WHERE id=?",[archived.id]);
 await svc.saved.createPrivate({userId:c.userId,esoServer:'pc_na',esoOwner:'MyPrivate',houseId:1});
 await svc.saved.createPrivate({userId:'other',esoServer:'pc_na',esoOwner:'SecretPrivate',houseId:1});
 await svc.saved.createGlobal({originGuildId:'g',esoServer:'pc_na',esoOwner:'GlobalOwner',houseId:1,createdBy:'same-discord-registrar'});
 return f;
}

test('selected server rankings count active Server registrations by official house and ESO account, independently of Discord registrar',async()=>{
 const {db,c}=await seeded();try{
 const ranking=await new CommunityStatisticsService(db).serverRankings(c);
 assert.deepEqual(ranking.houses.map(r=>[r.name,r.registrations]),[['House One',3],['House Two',2]]);
 assert.deepEqual(ranking.owners.map(r=>[r.normalized_owner,r.registrations,r.houseTypes]),[['alpha',2,2],['bravo',2,2],['charlie',1,1]]);
 assert.equal(ranking.owners[0].eso_owner,'Alpha');
 }finally{await closeDatabase(db);}
});

test('statistics page labels selected-server owner rankings separately from shared community rankings',async()=>{
 const {db,svc,c}=await seeded();try{
 let html='';await handleWorkspaceRoute({request:{method:'GET'},response:{},url:new URL('http://local/app/statistics'),session:{id:c.userId,username:'Member'},context:c,workspace:svc,send:(_r,status,body)=>{assert.equal(status,200);html=body;},redirect:()=>assert.fail('unexpected redirect')});
 assert.match(html,/Most registered official houses/);assert.match(html,/ESO owners with the most registrations/);
 assert.match(html,/Selected Discord server/);assert.match(html,/Active Server registrations only/);
 const panel=html.split('ESO owners with the most registrations')[1].split('Community favourites')[0];
 assert.match(panel,/Alpha/);assert.match(panel,/Bravo/);assert.doesNotMatch(panel,/SecretPrivate|MyPrivate|Foreign|OtherEnvironment|GlobalOwner|Pending|Archived|same-discord-registrar/);
 }finally{await closeDatabase(db);}
});

test('empty server rankings return empty lists and house ties sort alphabetically',async()=>{
 const {db,svc,c}=await fixture();try{
 const stats=new CommunityStatisticsService(db);
 assert.deepEqual(await stats.serverRankings(c),{houses:[],owners:[]});
 await svc.saved.createPublic({guildId:'g',esoServer:'pc_na',esoOwner:'Zulu',houseId:2,createdBy:'u'});
 await svc.saved.createPublic({guildId:'g',esoServer:'pc_na',esoOwner:'Alpha',houseId:1,createdBy:'u'});
 const ranks=await stats.serverRankings(c);
 assert.deepEqual(ranks.houses.map(h=>h.name),['House One','House Two']);
 assert.deepEqual(ranks.owners.map(o=>o.eso_owner),['Alpha','Zulu']);
 }finally{await closeDatabase(db);}
});
