import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';

test('statistic filters round-trip scoped counts without private, foreign or environment leaks',async()=>{
 const {db,svc,c}=await fixture();try{
 await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('other','pc_na')");
 const add=(houseId,esoOwner,extra={})=>svc.saved.createPublic({guildId:'g',esoServer:'pc_na',houseId,esoOwner,createdBy:'u',...extra});
 const h=await add(1,'@Alpha');await add(2,'Alpha');await add(1,'Alphabet');await add(1,'Alpha',{guildId:'other'});await add(1,'Alpha',{esoServer:'pc_eu'});
 await svc.saved.createPrivate({userId:'u',esoServer:'pc_na',houseId:1,esoOwner:'Secret'});
 await svc.saved.createGlobal({originGuildId:'g',esoServer:'pc_na',houseId:1,esoOwner:'Alpha',createdBy:'u'});
 const stats=await svc.statistics.snapshot(c),ranks=await svc.statistics.serverRankings(c),popular=await svc.statistics.popularity(c);
 assert.equal((await svc.listHouses(c,{scope:'shared',houseId:1})).total,popular.find(r=>r.house_id===1).registrations);
 assert.equal((await svc.listHouses(c,{scope:'public',houseId:1})).total,ranks.houses.find(r=>r.house_id===1).registrations);
 assert.equal((await svc.listHouses(c,{scope:'public',ownerExact:' @ALPHA '})).total,2);
 for(const [scope,key] of [['private','privateHouses'],['public','serverRegistrations'],['global','globalRegistrations']])assert.equal((await svc.listHouses(c,{scope})).total,stats[key]);
 const tour=await svc.tours.create({creatorId:'u',guildId:'g',esoServer:'pc_na',visibility:'public',name:'Shared'});await svc.tours.addStopInConnection(db,{tourId:tour.id,savedHouseId:h.id,position:1});
 await svc.tours.create({creatorId:'u',guildId:'g',esoServer:'pc_na',visibility:'private',name:'Private'});
 const foreign=await svc.tours.create({creatorId:'else',guildId:'other',esoServer:'pc_na',visibility:'public',name:'Foreign'});
 const admin={...c,isGlobalAdmin:true};
 assert.deepEqual((await svc.listTours(admin,{scope:'shared',houseId:1})).map(r=>r.id),[tour.id]);
 assert.equal((await svc.listTours(c,{scope:'shared'})).length,(await svc.statistics.snapshot(c)).tours);
 assert.ok(!(await svc.listTours(admin,{scope:'shared'})).some(r=>r.id===foreign.id));
 }finally{await closeDatabase(db);}
});

test('statistics render exact numeric drilldowns with distinct-count explanations',async()=>{
 const {statisticsRoute}=await import('../src/web/statistics-routes.js');
 const {db,svc,c}=await fixture();try{
 await svc.saved.createPublic({guildId:'g',esoServer:'pc_na',houseId:1,esoOwner:'Alpha',createdBy:'u'});
 const html=await statisticsRoute({workspace:svc,context:c,query:{},render:(_title,body)=>body});
 assert.match(html,/\/app\/houses\?scope=public&amp;houseId=1/);
 assert.match(html,/\/app\/houses\?scope=public&amp;ownerExact=alpha/);
 assert.match(html,/\/app\/tours\?scope=shared&amp;houseId=1/);
 assert.match(html,/Distinct members/);assert.match(html,/Distinct ESO owners/);
 }finally{await closeDatabase(db);}
});
