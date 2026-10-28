import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';

test('access directory refreshes access and shows only current-server administrators their configured roles and grants',async()=>{
 const {db,svc,c}=await fixture();try{
 const {AccessDirectoryService}=await import('../src/services/access-directory-service.js');
 await db.query("INSERT INTO server_moderators(guild_id,discord_user_id,approved_by,request_id,request_revision) VALUES('g','grantee','1',1,1),('foreign','secret','1',2,1)");
 let looked=[];svc.discord={roles:async()=>[{id:'staff',name:'Housing Staff'}]};
 const directory=new AccessDirectoryService(svc,{memberLookup:async({userId,guildId})=>{assert.equal(guildId,'g');looked.push(userId);return {id:userId,displayName:'Readable name',username:'account'};}});
 const ordinary=await directory.snapshot({...c,isServerAdmin:true,isOwner:true});assert.equal(ordinary.server,null);assert.deepEqual(looked,[]);
 const admin=await directory.snapshot({...c,memberRoleIds:['staff']});
 assert.equal(admin.server.roles[0].roles[0].name,'Housing Staff');assert.equal(admin.server.grants[0].name,'Readable name');assert.deepEqual(looked,['grantee']);assert.equal(admin.server.roleMembersAvailable,false);
 assert.match(admin.server.roleMembersNotice,/unavailable|not available/i);assert.ok(admin.server.roles.every(group=>group.explanation));
 }finally{await closeDatabase(db);}
});

test('Global-only access directory keeps Server grants private and limits Global status to own environment',async()=>{
 const {db,svc,c}=await fixture();try{
 const {AccessDirectoryService}=await import('../src/services/access-directory-service.js');
 await db.query("INSERT INTO global_moderators(discord_user_id,eso_server,approved_by,request_id) VALUES('u','pc_na','1',1),('other','pc_na','1',2),('u','pc_eu','1',3)");
 const result=await new AccessDirectoryService(svc).snapshot(c);
 assert.equal(result.context.isGlobalAdmin,true);assert.equal(result.server,null);assert.deepEqual(result.global.grants.map(g=>[g.discord_user_id,g.eso_server]),[['u','pc_na']]);
 }finally{await closeDatabase(db);}
});

test('access directory never accepts foreign member identity or incomplete cached role rosters',async()=>{
 const {db,svc,c}=await fixture();try{
 const {AccessDirectoryService}=await import('../src/services/access-directory-service.js');
 await db.query("INSERT INTO server_moderators(guild_id,discord_user_id,approved_by,request_id,request_revision) VALUES('g','member','1',1,1)");
 const result=await new AccessDirectoryService(svc,{memberLookup:async()=>({id:'foreign',displayName:'Secret foreign name'}),roleMembersLookup:async()=>({complete:false,members:[{id:'foreign',displayName:'Secret cached name',roleIds:['staff']}]})}).snapshot({...c,memberRoleIds:['staff']});
 assert.equal(result.server.grants[0].name,'member');assert.equal(result.server.grants[0].currentMember,false);assert.equal(result.server.roleMembersAvailable,false);assert.ok(!JSON.stringify(result).includes('Secret'));
 }finally{await closeDatabase(db);}
});

test('complete fresh role roster is grouped by configured role and renderer escapes member names',async()=>{
 const {db,svc,c}=await fixture();try{
 const {AccessDirectoryService}=await import('../src/services/access-directory-service.js');
 const {accessDirectory}=await import('../src/web/access-directory.js');
 const options={workspace:svc,context:{...c,memberRoleIds:['staff']},roleMembersLookup:async({context,roleIds})=>{assert.equal(context.guildId,'g');assert.deepEqual(roleIds,['staff']);return {complete:true,members:[{id:'member',displayName:'<Housing helper>',username:'helper',roleIds:['staff']},{id:'not-staff',displayName:'Unrelated member',roleIds:['other-role']}]};}};
 const result=await new AccessDirectoryService(svc,options).snapshot(options.context);
 assert.equal(result.server.roleMembersAvailable,true);assert.deepEqual(result.server.roles[0].roles[0].members.map(m=>m.id),['member']);
 const html=await accessDirectory(options);assert.match(html,/&lt;Housing helper&gt;/);assert.match(html,/@helper/);assert.doesNotMatch(html,/Unrelated member/);
 }finally{await closeDatabase(db);}
});
