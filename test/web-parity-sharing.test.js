import test from 'node:test';
import assert from 'node:assert/strict';
import {ChannelType,PermissionFlagsBits as P} from 'discord.js';
import {DiscordWorkspace} from '../src/web/discord-workspace.js';
import {houseShareCardPayload,tourShareCardPayload} from '../src/ui/share-pass-ui.js';
import {handleWebSharing} from '../src/web/web-sharing-routes.js';

test('pass pagination continues past a page belonging to another environment',async()=>{
 const actions={passes:{listHousePasses:async()=>Array.from({length:25},(_,id)=>({id})),listTourPasses:async()=>[]},ownedPass:async()=>{throw new Error('Another environment');}};
 const html=await handleWebSharing({request:{method:'GET'},url:new URL('https://example.test/app/passes'),session:{csrf:'test'},context:{userId:'u'},workspace:{actions},form:null,render:(_title,body)=>body});
 assert.match(html,/No passes in this environment/);assert.match(html,/href="\/app\/passes\?page=2"/);
});

test('Discord share cards offer an authorized web-pass entry point within component limits',()=>{
 const token='a'.repeat(32),portalUrl='https://homes.example/app';
 for(const payload of [houseShareCardPayload({scope:'private',house_name:'House',eso_owner:'Owner',house_id:1},{token,portalUrl}),tourShareCardPayload({name:'Tour',visibility:'private'},{token,portalUrl})]){
  const buttons=payload.components.flatMap(row=>row.toJSON().components),web=buttons.find(b=>b.style===5);assert.match(web.url,/https:\/\/homes.example\/app\/shared\/(house|tour)\/a{32}/);assert.ok(payload.components.every(row=>row.components.length<=5));
 }
});

test('web Discord posting validates live membership/thread permission and deduplicates a confirmed form',async()=>{
 let posts=0,issued=0,revoked=0,threadMember=true;
 const members={user:{id:'u',displayName:'User'},bot:{id:'bot'}};
 const permissions=[P.ViewChannel,P.SendMessagesInThreads,P.EmbedLinks,P.ReadMessageHistory];
 const thread={id:'123',guildId:'g',parentId:'100',name:'Thread',type:ChannelType.PrivateThread,locked:false,isThread:()=>true,permissionsFor:()=>({has:flags=>(Array.isArray(flags)?flags:[flags]).every(p=>permissions.includes(p))}),members:{fetch:async()=>threadMember?members.user:null},send:async()=>{posts++;return {id:'message'};}};
 const guild={id:'g',name:'Guild',members:{fetch:async()=>members.user,fetchMe:async()=>members.bot},channels:{fetch:async()=>thread}};
 const adapter=new DiscordWorkspace({guilds:{cache:new Map([['g',guild]])}}),c={userId:'u',guildId:'g',esoServer:'pc_na'};
 const passes={createHousePass:async()=>{issued++;return {pass:{id:1},token:'a'.repeat(32)};},markHousePassPosted:async()=>{},revokeHousePass:async()=>{revoked++;}};
 const input={channelId:'123',eventKey:'one',kind:'house',record:{id:1,scope:'private',house_name:'House',house_id:1,eso_owner:'Owner'},passes};
 assert.ok((await adapter.post(c,input)).posted);assert.equal(posts,1);
 await assert.rejects(()=>adapter.post(c,input),/already submitted/);assert.equal(issued,1);
 threadMember=false;await assert.rejects(()=>adapter.post(c,{...input,eventKey:'two'}),/access to this private thread/);assert.equal(posts,1);assert.equal(issued,1);assert.equal(revoked,0);
});
