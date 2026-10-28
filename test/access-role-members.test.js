import test from 'node:test';
import assert from 'node:assert/strict';
import {DiscordWorkspace} from '../src/web/discord-workspace.js';
const member=(id,roleIds=[])=>({id:String(id),displayName:`Member ${id}`,user:{username:`user${id}`},roles:{cache:new Map(roleIds.map(id=>[id,true]))}});
function fixture(list){
 const lookups=[];
 const guild={id:'guild',members:{cache:new Map([['cached-secret',member('cached-secret',['staff'])]]),fetch:async options=>{lookups.push(options);return member('admin');},fetchMe:async options=>{lookups.push(options);return member('bot');},list}};
 return {adapter:new DiscordWorkspace({guilds:{cache:new Map([['guild',guild]])}}),lookups,context:{userId:'admin',guildId:'guild',esoServer:'pc_na',isServerAdmin:true}};
}

test('role holder directory fetches every REST page without caching and filters exact role IDs',async()=>{
 const calls=[],first=new Map(Array.from({length:1000},(_,index)=>{const id=String(index+1);return [id,member(id,id==='999'?['staff']:['other'])];}));
 const {adapter,context,lookups}=fixture(async options=>{calls.push(options);return calls.length===1?first:new Map([['1001',member('1001',['staff','trusted'])],['1002',member('1002',['other'])]]);});
 const result=await adapter.roleMembers(context,['staff']);
 assert.equal(result.complete,true);assert.deepEqual(result.members.map(m=>m.id),['999','1001']);assert.equal(result.members[1].username,'user1001');
 assert.deepEqual(calls,[{limit:1000,after:undefined,cache:false},{limit:1000,after:'1000',cache:false}]);
 assert.ok(lookups.every(options=>options.force===true));assert.ok(!JSON.stringify(result).includes('cached-secret'));
});

test('role holder pagination failures return unavailable with no misleading partial roster',async()=>{
 let pages=0;const first=new Map(Array.from({length:1000},(_,i)=>[String(i+1),member(i+1,['staff'])]));
 const {adapter,context}=fixture(async()=>{if(++pages===1)return first;throw new Error('Missing members intent');});
 const result=await adapter.roleMembers(context,['staff']);assert.equal(pages,2);assert.equal(result.complete,false);assert.deepEqual(result.members,[]);assert.match(result.notice,/Server Members Intent/);
});

test('role holder directory denies Global-only callers and handles no configured roles without member enumeration',async()=>{
 let lists=0;const {adapter,context,lookups}=fixture(async()=>{lists++;return new Map();});
 await assert.rejects(adapter.roleMembers({...context,isServerAdmin:false,isGlobalAdmin:true},['staff']),/Server administrator/);
 assert.deepEqual(await adapter.roleMembers(context,[]),{complete:true,members:[]});assert.equal(lists,0);assert.deepEqual(lookups,[]);
});
