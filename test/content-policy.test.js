import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,migrate,closeDatabase} from '../src/db/database.js';
import {ContentPolicyService} from '../src/services/content-policy-service.js';
test('shared policy preserves Private and scoped administrator boundaries with all role labels',async()=>{
 const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:':memory:'});try{await migrate(db);await db.query("INSERT INTO guild_settings(guild_id,eso_server,staff_role_ids) VALUES('g','pc_na','[\"staff\"]')");await db.query("INSERT INTO global_moderators(discord_user_id,eso_server,approved_by) VALUES('global','pc_na','1')");
 const p=new ContentPolicyService(db,{BOT_OWNER_IDS:'1'});const input={guildId:'g',esoServer:'pc_na',memberRoleIds:[]};
 const owner=await p.context({...input,userId:'1'}),global=await p.context({...input,userId:'global'}),server=await p.context({...input,userId:'staff',memberRoleIds:['staff']}),member=await p.context({...input,userId:'member'});
 assert.deepEqual(owner.roles.map(r=>r.kind),['owner','global','server']);assert.equal(member.roles[0].kind,'member');
 const privateHouse={scope:'private',owner_user_id:'other',created_by:'other',eso_server:'pc_na',status:'active'};assert.equal(p.canViewHouse(privateHouse,owner),false);assert.equal(p.canEditHouse(privateHouse,owner),false);
 const tour={visibility:'public',guild_id:'other',creator_id:'other',eso_server:'pc_na'};assert.equal(p.canEditTour(tour,global),true);assert.equal(p.canEditTour(tour,server),false);assert.equal(p.canViewTour(tour,global),false);
 assert.equal(p.canEditHouse({...privateHouse,scope:'public',guild_id:'g'},global),false);assert.equal(p.canEditHouse({...privateHouse,scope:'public',guild_id:'g'},server),true);
 assert.equal(p.canEditTour({...tour,eso_server:'pc_eu'},global),false);assert.equal(p.canEditTour({...tour,visibility:'private'},owner),false);
 await db.query("DELETE FROM global_moderators WHERE discord_user_id='global'");assert.equal((await p.context({...input,userId:'global'})).isGlobalAdmin,false);
 }finally{await closeDatabase(db)}
});
