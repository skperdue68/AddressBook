import test from 'node:test';
import assert from 'node:assert/strict';
import {ServerHouseCopyService} from '../src/services/server-house-copy-service.js';

// Model InnoDB REPEATABLE READ: the first ordinary read freezes committed rows;
// FOR UPDATE reads acquire current locks and do not establish that snapshot.
test('concurrent copies from different registrations see the committed target after waiting for its destination lock',async()=>{
 const committed=[],locks=new Map();let nextId=100;
 const lock=async(key,conn)=>{
  const previous=locks.get(key)||Promise.resolve();let release;const held=new Promise(r=>{release=r;});locks.set(key,previous.then(()=>held));
  await previous;conn.unlock.push(release);
 };
 const db={type:'mariadb',read:()=>committed,getConnection:async()=>{
  const conn={unlock:[],pending:[],snapshot:null,read(){return this.snapshot??=committed.map(r=>({...r}));},
   async beginTransaction(){},async commit(){committed.push(...this.pending);this.unlock.forEach(r=>r());},async rollback(){this.unlock.forEach(r=>r());},release(){},
   async query(sql,args){
    if(sql.includes('FROM saved_houses')&&sql.includes('FOR UPDATE')){await lock('house:'+args[0],this);return [{id:args[0],destination_id:9}];}
    if(sql.includes('FROM housing_destinations')&&sql.includes('FOR UPDATE')){await lock('destination:'+args[0],this);return [{id:9}];}
    return {affectedRows:1};
   }};return conn;
 }};
 const sources=new Map([1,2].map(id=>[id,{id,destination_id:9,house_id:1,eso_server:'pc_na',scope:'public',status:'active',guild_id:'source'+id,created_by:'creator',tags:'[]'}]));
 const workspace={db,fresh:async c=>({...c}),policy:{canViewHouse:()=>true,canEditHouse:()=>true},saved:{
  get:async(id,conn=db)=>{const rows=conn.read();return sources.get(Number(id))||conn.pending?.find(r=>r.id===id)||rows.find(r=>r.id===id);},
  findByDestinationContext:async({guildId},conn=db)=>conn.read().find(r=>r.guild_id===guildId)||null,
  createInConnection:async(conn,data)=>{const row={id:nextId++,destination_id:9,guild_id:data.guildId,created_by:data.createdBy};conn.pending.push(row);return row;}
 }};
 const service=new ServerHouseCopyService(workspace,{memberLookup:async({userId})=>({id:userId,username:userId})}),context=guildId=>({userId:'owner',guildId,esoServer:'pc_na',isOwner:true,settings:{}}),a=context('source1'),b=context('source2'),target=context('target');
 const first=await service.preview(a,1,target),second=await service.preview(b,2,target);
 const outcomes=await Promise.allSettled([service.copy(a,1,target,first.version),service.copy(b,2,target,second.version)]);
 assert.equal(committed.length,1,'one Server registration per destination even when sources differ');
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.match(outcomes.find(r=>r.status==='rejected').reason.message,/changed/);
});
