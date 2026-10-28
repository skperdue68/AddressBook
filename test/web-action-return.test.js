import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {contentReassignmentRoute} from '../src/web/content-reassignment-routes.js';
import {serverHouseCopyRoute} from '../src/web/server-house-copy-routes.js';
import {handleWebSharing} from '../src/web/web-sharing-routes.js';
test('reassignment retains contextual return across preview and returns after confirmation',async()=>{
 const {db,svc,c}=await fixture();try{
  const owner=await svc.fresh({...c,userId:'1'}),house=await svc.registerHouse(owner,{houseId:1,esoOwner:'Builder',visibility:'public'});let html='',location='';
  const back=`/app/houses/${house.id}?returnTo=%2Fapp%2Fpersonal`,args={workspace:svc,context:owner,session:{csrf:'token'},url:new URL(`https://local/app/houses/${house.id}/reassign?backTo=${encodeURIComponent(back)}`),render:(t,b)=>{html=b;},redirect:(r,url)=>{location=url;},response:{},memberLookup:async({userId})=>({id:userId,displayName:'Member'})};
  await contentReassignmentRoute(args);assert.match(html,/name="backTo"/);
  await contentReassignmentRoute({...args,form:new URLSearchParams({memberId:'123456789012345678',backTo:back})});const version=/name="version" value="([^"]+)"/.exec(html)[1];assert.match(html,/name="backTo"/);
  await contentReassignmentRoute({...args,form:new URLSearchParams({memberId:'123456789012345678',backTo:back,version,confirm:'reassign'})});assert.equal(new URL(location,'https://local').searchParams.get('saved'),'1');assert.equal(new URL(location,'https://local').searchParams.get('returnTo'),'/app/personal');
 }finally{await closeDatabase(db);}
});
test('sharing retains backTo through channel confirmation and redirects after posting without exposing token',async()=>{
 let html='',location='';const back='/app/tours/7/edit',args={url:new URL('https://local/app/tours/7/share?backTo='+encodeURIComponent(back)),session:{csrf:'token'},context:{},workspace:{actions:{shareTarget:async()=>({record:{id:7,name:'Tour'}}),createPass:async()=>({token:'secret-token'}),passes:{}},discord:{target:async()=>({channel:{id:'channel',name:'Tours'}}),post:async()=>({url:'https://discord.com/channels/g/c/m'})}},render:(t,b)=>{html=b;},redirect:(r,url)=>{location=url;},response:{},setUsageKind(){}};
 await handleWebSharing({...args,form:new URLSearchParams({channelId:'channel',backTo:back})});assert.match(html,/name="backTo"/);
 await handleWebSharing({...args,form:new URLSearchParams({action:'post',confirm:'post',channelId:'channel',backTo:back})});assert.equal(new URL(location,'https://local').pathname,back);assert.doesNotMatch(location,/secret-token/);
 await handleWebSharing({...args,form:new URLSearchParams({action:'link',backTo:back})});assert.match(html,/secret-token/);assert.match(html,/href="\/app\/tours\/7\/edit"/);
});
test('server copy preserves origin in preview, retains source and returns after confirmation',async()=>{
 const {db,svc,c}=await fixture();try{
  await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g2','pc_na')");
  const owner=await svc.fresh({...c,userId:'1'}),target=await svc.fresh({...owner,guildId:'g2'}),house=await svc.registerHouse(owner,{houseId:1,esoOwner:'CopyBuilder',visibility:'public'});let html='',location='';
  const back=`/app/houses/${house.id}?returnTo=%2Fapp%2Fhouses%3Fscope%3Dpublic`,args={workspace:svc,context:owner,session:{csrf:'token'},url:new URL(`https://local/app/houses/${house.id}/copy-server?backTo=${encodeURIComponent(back)}`),render:(t,b)=>{html=b;},redirect:(r,url)=>{location=url;},response:{},serverContexts:[target],memberLookup:async({userId})=>({id:userId,displayName:'Member'})};
  await serverHouseCopyRoute(args);assert.match(html,/name="backTo"/);
  await serverHouseCopyRoute({...args,form:new URLSearchParams({targetGuildId:'g2',backTo:back})});assert.match(html,/source registration and tour stops stay/);assert.match(html,/original submitter is a current member/);const version=/name="version" value="([^"]+)"/.exec(html)[1];
  await serverHouseCopyRoute({...args,form:new URLSearchParams({targetGuildId:'g2',backTo:back,version,confirm:'copy'})});assert.equal(new URL(location,'https://local').searchParams.get('copied'),'1');assert.ok(await svc.saved.get(house.id));
 }finally{await closeDatabase(db);}
});
test('unsafe return origins cannot redirect sharing out of the application',async()=>{
 let html='',redirected=false;await handleWebSharing({url:new URL('https://local/app/houses/1/share?backTo=https://evil.test'),session:{csrf:'token'},context:{},workspace:{actions:{shareTarget:async()=>({record:{id:1,name:'House'}}),createPass:async()=>({token:'safe-token'})}},form:new URLSearchParams({action:'link',backTo:'//evil.test'}),render:(t,b)=>{html=b;},redirect:()=>{redirected=true;},setUsageKind(){}});
 assert.equal(redirected,false);assert.doesNotMatch(html,/evil\.test/);assert.match(html,/href="\/app\/houses\/1"/);
});

test('sharing a partially successful Discord post preserves its warning and contextual return',async()=>{
 let html='',redirected=false;const warning='Posted, but message details could not be saved. Do not repost; the pass can still be revoked.',back='/app/houses/7?returnTo=%2Fapp%2Fpersonal';
 await handleWebSharing({url:new URL('https://local/app/houses/7/share?backTo='+encodeURIComponent(back)),session:{csrf:'s'},context:{},form:new URLSearchParams({action:'post',confirm:'post',channelId:'c',backTo:back}),workspace:{actions:{shareTarget:async()=>({record:{id:7,house_name:'House'}}),passes:{}},discord:{post:async()=>({posted:true,warning})}},render:(title,body)=>{html=body;},redirect:()=>{redirected=true;},response:{},setUsageKind(){}});
 assert.equal(redirected,false);assert.ok(html.includes(warning));assert.match(html,/Back to record/);assert.ok(html.includes(back.replaceAll('&','&amp;')));
});
