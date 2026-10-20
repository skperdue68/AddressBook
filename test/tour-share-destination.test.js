import test from 'node:test';
import assert from 'node:assert/strict';
import { tourShareChannelPayload } from '../src/ui/share-pass-ui.js';
const components=p=>p.components.flatMap(r=>r.toJSON().components);
test('all 63 channels are reachable through explicit pages',()=>{
 const rows=Array.from({length:63},(_,n)=>({id:String(n+1),name:`housing-${n+1}`,parent:{name:'Community'}}));
 const values=[];
 for(let page=0;page<3;page++){
  const p=tourShareChannelPayload(1,{channels:rows,page});
  const c=components(p),select=c.find(c=>c.type===3);
  assert.ok(select,'explicit paginated channel menu');
  assert.ok(select.options.length<=25);
  values.push(...select.options.map(o=>o.value));
  assert.equal(c.some(b=>b.label==='Next Channels'),page<2);
 }
 assert.equal(new Set(values).size,63);
});
test('empty destination picker offers a link and valid nonempty rows',()=>{
 const p=tourShareChannelPayload(1,{channels:[]});
 assert.ok(components(p).some(c=>c.label==='Use Channel / Thread Link'));
 assert.ok(p.components.every(r=>r.toJSON().components.length>0));
});

import { ChannelType, PermissionFlagsBits as P } from 'discord.js';
import { handleTourShareDestination, parseTourDestination, validateTourDestination } from '../src/ui/tour-share-destination.js';
import { tourShareThreadPayload } from '../src/ui/share-pass-ui.js';
const actors={user:{id:'u1',displayName:'Visitor'},bot:{id:'bot'}};
const all=[P.ViewChannel,P.SendMessages,P.SendMessagesInThreads,P.EmbedLinks,P.ReadMessageHistory];
function channel(id,{type=ChannelType.GuildText,permissions=all,parentId=null,locked=false,member=true}={}){
 return {id,name:`channel-${id}`,guildId:'g1',type,parentId,locked,isThread:()=>[10,11,12].includes(type),permissionsFor:()=>({has:flags=>(Array.isArray(flags)?flags:[flags]).every(p=>permissions.includes(p))}),members:{fetch:async()=>member?actors.user:null},send:async()=>({id:'m1'})};
}
function interaction(customId,channels,{values=[],destination=''}={}){
 const updates=[];let deferred=false;
 return {customId,values,user:{id:'u1',username:'Visitor'},guildId:'g1',fields:{getTextInputValue:()=>destination},guild:{id:'g1',name:'Test',members:{fetch:async()=>{assert.ok(deferred);return actors.user;},fetchMe:async()=>actors.bot},channels:{fetch:async id=>id?channels.get(id):channels}},deferUpdate:async()=>{deferred=true;},editReply:async payload=>{assert.ok(deferred);updates.push(payload);return payload;},showModal:async modal=>modal,updates};
}
test('thread permissions use SendMessagesInThreads without requiring SendMessages',async()=>{
 const thread=channel('t1',{type:ChannelType.PublicThread,permissions:all.filter(p=>p!==P.SendMessages)});
 assert.equal(await validateTourDestination(thread,{guildId:'g1'},actors),thread);
 await assert.rejects(validateTourDestination(channel('t2',{type:ChannelType.PublicThread,permissions:all.filter(p=>p!==P.SendMessagesInThreads)}),{guildId:'g1'},actors),/Threads/);
});
test('locked, foreign and inaccessible private threads are rejected',async()=>{
 await assert.rejects(validateTourDestination(channel('t',{type:ChannelType.PublicThread,locked:true}),{guildId:'g1'},actors),/locked/);
 await assert.rejects(validateTourDestination(channel('t'),{guildId:'g2'},actors),/View Channel/);
 await assert.rejects(validateTourDestination(channel('t',{type:ChannelType.PrivateThread,member:false}),{guildId:'g1'},actors),/private thread/);
});
test('link parser accepts IDs, mentions and message links but rejects foreign servers',()=>{
 assert.equal(parseTourDestination('123','42'),'123');
 assert.equal(parseTourDestination('<#123>','42'),'123');
 assert.equal(parseTourDestination('https://discord.com/channels/42/123/456','42'),'123');
 assert.throws(()=>parseTourDestination('https://discord.com/channels/99/123','42'),/this Discord server/);
 assert.throws(()=>parseTourDestination('https://other.com/42/123','42'),/Paste a Discord/);
});
test('thread picker paginates 61 threads without invalid component rows',()=>{
 const threads=Array.from({length:61},(_,n)=>channel(String(n),{type:ChannelType.PublicThread}));
 const ids=[];
 for(let page=0;page<3;page++){
  const p=tourShareThreadPayload(1,channel('parent'),{threads,page,canPost:true});
  ids.push(...components(p).find(c=>c.type===3).options.map(o=>o.value));
  assert.ok(p.components.length<=5);
  assert.ok(p.components.every(r=>r.toJSON().components.length<=5));
 }
 assert.equal(new Set(ids).size,61);
});
test('channel loader fetches every visible parent including forums, excludes hidden channels',async()=>{
 const rows=new Map(Array.from({length:63},(_,n)=>[String(n),channel(String(n))]));
 rows.set('forum',channel('forum',{type:ChannelType.GuildForum}));
 rows.set('hidden',channel('hidden',{permissions:[]}));
 const i=interaction('hu:pass:tour:share:1:2',rows);
 await handleTourShareDestination(i,{});
 assert.match(i.updates[0].content,/64 visible channels/);
 assert.equal(components(i.updates[0]).find(c=>c.type===3).options.length,14);
});
test('forum selection lists its active posts and never offers direct posting',async()=>{
 const forum=channel('forum',{type:ChannelType.GuildForum});
 forum.threads={fetchActive:async()=>({threads:new Map([['post',channel('post',{type:ChannelType.PublicThread,parentId:'forum'})]])})};
 const i=interaction('hu:pass:tour:channel:1',new Map([['forum',forum]]),{values:['forum']});
 await handleTourShareDestination(i,{});
 assert.equal(components(i.updates[0]).find(c=>c.type===3).options[0].value,'post');
 assert.equal(components(i.updates[0]).some(c=>c.label==='Post in This Channel'),false);
});
test('selecting a thread confirms without creating or sending a pass',async()=>{
 const t=channel('thread',{type:ChannelType.PublicThread,parentId:'parent'});
 t.send=async()=>assert.fail('must not send before confirmation');
 const i=interaction('hu:pass:tour:thread:1:parent',new Map([['thread',t]]),{values:['thread']});
 await handleTourShareDestination(i,{});
 assert.ok(components(i.updates[0]).some(c=>c.label==='Post Tour Pass'));
});
test('posting uses thread ID for both Discord delivery and pass records',async()=>{
 const t=channel('thread',{type:ChannelType.PublicThread,parentId:'parent',permissions:all.filter(p=>p!==P.SendMessages)});
 let sent,created,posted;
 t.send=async payload=>{sent=payload;return {id:'message'};};
 const i=interaction('hu:pass:tour:post:1:thread',new Map([['thread',t]]));
 await handleTourShareDestination(i,{tours:{get:async()=>({name:'Route',visibility:'public'}),getStops:async()=>[{}]},guilds:{getEsoServer:()=> 'pc_na'},sharePasses:{createTourPass:async input=>{created=input;return {token:'secret',pass:{id:9}};},markTourPassPosted:async(id,data)=>{posted={id,...data};}}});
 assert.equal(created.channelId,'thread');assert.equal(posted.channelId,'thread');assert.equal(posted.messageId,'message');
 assert.ok(components(sent).some(c=>c.custom_id==='hu:pass:tour:start:secret'));
 assert.match(i.updates[0].content,/posted in <#thread>/);
});
test('send failure revokes the newly created pass and returns a usable retry menu',async()=>{
 const t=channel('dest');t.send=async()=>{throw new Error('Missing Access');};let revoked;
 const i=interaction('hu:pass:tour:post:1:dest',new Map([['dest',t]]));
 await handleTourShareDestination(i,{tours:{get:async()=>({name:'Route'}),getStops:async()=>[]},guilds:{getEsoServer:()=> 'pc_na'},sharePasses:{createTourPass:async()=>({token:'secret',pass:{id:9}}),revokeTourPass:async id=>{revoked=id;}}});
 assert.equal(revoked,9);assert.match(i.updates[0].content,/Missing Access/);assert.ok(components(i.updates[0]).some(c=>c.label==='Back to Channels'));
});
test('removal from a private thread after preview prevents posting through cached membership',async()=>{
 const t=channel('private',{type:ChannelType.PrivateThread,parentId:'parent'});
 let removed=false;
 // Discord.js returns cached membership unless force is requested.
 t.members.fetch=async options=>options?.force&&options.member==='u1'&&removed?null:actors.user;
 const rows=new Map([['private',t]]);
 const preview=interaction('hu:pass:tour:thread:1:parent',rows,{values:['private']});
 await handleTourShareDestination(preview,{});
 assert.ok(components(preview.updates[0]).some(c=>c.label==='Post Tour Pass'));
 removed=true;
 const post=interaction('hu:pass:tour:post:1:private',rows);
 await handleTourShareDestination(post,{tours:{get:async()=>assert.fail('removed member must be denied before pass creation')}});
 assert.match(post.updates[0].content,/Both you and AddressBook must have access to this private thread/);
});
