import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,migrate,closeDatabase,one} from '../src/db/database.js';

async function fixture(t){
 const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:':memory:'});t.after(()=>closeDatabase(db));await migrate(db);
 await db.query(`INSERT INTO guild_settings(guild_id,eso_server,staff_role_ids) VALUES('g1','pc_na','["staff"]'),('g2','pc_na','[]')`);
 const module=await import('../src/services/server-moderator-service.js');return {db,s:new module.ServerModeratorService(db)};
}
test('server grants require current scoped reviewers and protect rerequest revisions',async t=>{
 const {db,s}=await fixture(t);const actor={userId:'admin',roleIds:['staff']};
 const r=await s.request({guildId:'g1',userId:'u1',reason:'help'});
 await assert.rejects(s.request({guildId:'g1',userId:'u1',reason:'again'}),/pending/i);
 for(const reviewer of [{userId:'u1',roleIds:['staff']},{userId:'global',roleIds:[]}])await assert.rejects(s.review({guildId:'g1',requestId:r.id,revision:r.revision,reviewer,decision:'approve'}));
 await s.review({guildId:'g1',requestId:r.id,revision:r.revision,reviewer:actor,decision:'deny'});
 const next=await s.request({guildId:'g1',userId:'u1',reason:'retry'});assert.equal(next.revision,2);
 await assert.rejects(s.review({guildId:'g1',requestId:r.id,revision:1,reviewer:actor,decision:'approve'}),/stale|pending/i);
 const results=await Promise.allSettled([1,2].map(()=>s.review({guildId:'g1',requestId:r.id,revision:2,reviewer:actor,decision:'approve'})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await s.access({guildId:'g1',userId:'u1',roleIds:[]})).isModerator,true);
 assert.equal((await s.access({guildId:'g2',userId:'u1',roleIds:[]})).isModerator,false);
 assert.equal((await s.access({guildId:'g2',userId:'any',roleIds:[]})).canReviewRequests,false);
 const r2=await s.request({guildId:'g1',userId:'u2',reason:'help'});
 await s.revoke({guildId:'g1',userId:'u1',reviewer:actor});
 await assert.rejects(s.review({guildId:'g1',requestId:r2.id,revision:r2.revision,reviewer:{userId:'u1',roleIds:[]},decision:'approve'}));
 assert.equal((await one(db,`SELECT COUNT(*) n FROM server_moderators`)).n,0);
});
test('bootstrap closes when individual grants exist and role access survives grant removal',async t=>{
 const {s}=await fixture(t);
 assert.equal((await s.access({guildId:'g2',userId:'x',roleIds:[]})).bootstrap,true);
 const r=await s.request({guildId:'g1',userId:'u1',reason:'help'});
 await s.review({guildId:'g1',requestId:r.id,revision:r.revision,reviewer:{userId:'admin',roleIds:['staff']},decision:'approve'});
 await s.revoke({guildId:'g1',userId:'u1',reviewer:{userId:'admin',roleIds:['staff']}});
 assert.equal((await s.access({guildId:'g1',userId:'u1',roleIds:['staff']})).isModerator,true);
});
