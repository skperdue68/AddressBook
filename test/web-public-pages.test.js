import test from 'node:test';
import assert from 'node:assert/strict';
import {createWebAdminServer} from '../src/web/server.js';
import {createSession} from '../src/web/session.js';

async function running(t) {
  const calls=[];
  const service={authorizeGuild:({guildId})=>{calls.push(guildId);return {allowed:guildId!=='denied'};},overview:async()=>({backend:'SQLite'})};
  const workspace={authorizeContext:async({guildId,...rest})=>{if(guildId==='denied')throw Error('Denied');return {...rest,guildId,roles:[{kind:'member',label:'Member'}]};}};
  const server=createWebAdminServer({service,workspace,config:{sessionSecret:'test-secret',oauth:{clientId:'1546718742732341278',redirectUri:'https://hearthbound.example/auth/callback'}},resolveGuildMembership:async({guildId})=>guildId==='removed'?null:{id:guildId,name:guildId==='one'?'First <Guild>':'Second Guild',esoServer:'pc_na'}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const cookie='addressbook_session='+createSession({id:'user',username:'Evaine',guilds:['one','two','denied','removed'].map(id=>({id}))},Date.now(),'test-secret');
  return {base:`http://127.0.0.1:${server.address().port}`,calls,cookie};
}

test('public root serves branded metadata and assets without login or membership queries',async t=>{
  const {base,calls,cookie}=await running(t);
  for(const headers of [{host:'attacker.example'},{cookie}]){
    const response=await fetch(base+'/',{headers,redirect:'manual'}),html=await response.text();
    assert.equal(response.status,200);assert.equal(response.headers.get('location'),null);
    assert.match(html,/property="og:title" content="HearthBound/);
    assert.match(html,/property="og:url" content="https:\/\/hearthbound.example\/"/);
    assert.match(html,/property="og:image" content="https:\/\/hearthbound.example\/assets\/hearthbound-banner.webp"/);
    assert.match(html,/<img class="welcome-banner"[^>]*src="\/assets\/hearthbound-banner.webp"/);assert.match(html,/class="public-page welcome-page"/);assert.match(html,/name="twitter:card"/);if(headers.cookie){assert.match(html,/Account menu for Evaine/);assert.match(html,/Continue to HearthBound/);assert.doesNotMatch(html,/>Sign in with Discord/);}else assert.match(html,/Sign in with Discord/);assert.match(html,/Invite to your server/);
    assert.match(html,/permissions=274878024704/);assert.doesNotMatch(html,/First &lt;Guild&gt;|attacker.example/);
  }
  assert.deepEqual(calls,[]);
  for(const path of ['/assets/hearthbound-logo.png','/assets/hearthbound-preview.png','/assets/hearthbound-banner.webp','/assets/hearthbound-landscape.webp','/assets/public-pages.css'])assert.equal((await fetch(base+path,{redirect:'manual'})).status,200);
  for(const path of ['/app','/admin']){const response=await fetch(base+path,{redirect:'manual'});assert.equal(response.status,302);assert.match(response.headers.get('location'),/^\/auth\/discord/);}
});

test('server picker is branded, escapes labels, restricts choices and persists selection',async t=>{
  const {base,cookie}=await running(t);
  for(const path of ['/app','/admin']){
    const response=await fetch(base+path,{headers:{cookie}}),html=await response.text();
    assert.equal(response.status,200);assert.match(html,/Choose Discord Server/);
    assert.match(html,/assets\/workspace.css/);assert.match(html,/assets\/public-pages.css/);assert.match(html,/hearthbound-logo.png/);
    assert.match(html,/First &lt;Guild&gt;/);assert.match(html,/Second Guild/);assert.match(html,/PC NA/);
    assert.doesNotMatch(html,/guildId=(denied|removed)|read-only administration/);
    assert.match(html,new RegExp(path+'\\?guildId=one'));
  }
  const selection=await fetch(base+'/admin?guildId=two',{headers:{cookie},redirect:'manual'});
  assert.equal(selection.status,302);assert.match(selection.headers.get('set-cookie'),/Max-Age=/);
  const selected=await fetch(base+'/admin',{headers:{cookie:selection.headers.get('set-cookie')},redirect:'manual'});assert.equal(selected.status,200);
});


test('public root treats expired and tampered cookies as anonymous',async t=>{
 const {base,calls}=await running(t);
 const expired=createSession({id:'user',username:'Evaine'},Date.now()-31*86400000,'test-secret');
 const valid=createSession({id:'user',username:'Evaine'},Date.now(),'test-secret');
 for(const value of [expired,valid+'x']){
  const response=await fetch(base+'/',{headers:{cookie:'addressbook_session='+value}}),html=await response.text();
  assert.equal(response.status,200);assert.match(html,/>Sign in with Discord/);assert.doesNotMatch(html,/Account menu for Evaine|Continue to HearthBound/);
 }
 assert.deepEqual(calls,[]);
});
