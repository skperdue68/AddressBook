import test from 'node:test';import assert from 'node:assert/strict';
import {createSession,readSession,sessionLifetimeSeconds} from '../src/web/session.js';
import {createWebAdminServer} from '../src/web/server.js';
const day=86400000;
test('persistent session lasts 30 days by default and respects configured duration',()=>{
 const cookie=createSession({id:'u',username:'Alex'},1000,'stable-secret');assert.equal(readSession(cookie,1000+29*day,'stable-secret').id,'u');assert.equal(readSession(cookie,1000+30*day,'stable-secret'),null);
 assert.equal(sessionLifetimeSeconds({}),30*86400);assert.equal(sessionLifetimeSeconds({WEB_SESSION_DAYS:'7'}),7*86400);
 const short=createSession({id:'u'},1000,'stable-secret',7*86400);assert.equal(readSession(short,1000+6*day,'stable-secret').id,'u');assert.equal(readSession(short,1000+7*day,'stable-secret'),null);
 for(const value of ['0','-1','366','NaN','1.5'])assert.throws(()=>sessionLifetimeSeconds({WEB_SESSION_DAYS:value}),/WEB_SESSION_DAYS/);
 assert.equal(readSession(cookie,1000+day,'changed-secret'),null);
});
test('OAuth and server selection use persistent cookies matching signed lifetime; restart, revocation and logout work',async()=>{
 let clock=1000,allowed=true;const config={sessionSecret:'stable-secret',sessionDays:7,oauth:{clientId:'c',clientSecret:'s',redirectUri:'https://portal.example/auth/callback'}},service={authorizeGuild:()=>({allowed}),overview:async()=>({backend:'SQLite',connection:'Connected',esoServer:'pc_na'})};
 const create=async()=>{const server=createWebAdminServer({service,config,now:()=>clock,resolveGuildMembership:async({guildId})=>({id:guildId,name:guildId,roleIds:[],esoServer:'pc_na'}),resolveOAuthIdentity:async()=>({id:'u',username:'Alex',guilds:[{id:'g1',name:'One',esoServer:'pc_na'},{id:'g2',name:'Two',esoServer:'pc_na'}]}),fetchImpl:async()=>({ok:true,json:async()=>({access_token:'token'})})});await new Promise(r=>server.listen(0,'127.0.0.1',r));return {server,base:`http://127.0.0.1:${server.address().port}`};};
 let app=await create();try{const login=await fetch(app.base+'/auth/discord',{redirect:'manual'}),state=new URL(login.headers.get('location')).searchParams.get('state');const callback=await fetch(app.base+`/auth/callback?code=test&state=${state}`,{redirect:'manual'}),cookie=callback.headers.get('set-cookie');assert.match(cookie,/Max-Age=604800/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);
 clock+=2*day;let selected=await fetch(app.base+'/admin?guildId=g1',{headers:{cookie},redirect:'manual'});assert.equal(selected.status,302);const selectedCookie=selected.headers.get('set-cookie');assert.match(selectedCookie,/Max-Age=604800/);
 await new Promise(r=>app.server.close(r));app=await create();const page=await fetch(app.base+'/admin',{headers:{cookie:selectedCookie},redirect:'manual'});assert.equal(page.status,200);
 allowed=false;assert.equal((await fetch(app.base+'/admin',{headers:{cookie:selectedCookie},redirect:'manual'})).status,403);allowed=true;
 const logout=await fetch(app.base+'/auth/logout',{headers:{cookie:selectedCookie},redirect:'manual'});assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
 const noCookie=await fetch(app.base+'/admin',{redirect:'manual'});assert.match(noCookie.headers.get('location'),/^\/auth\/discord/);
 clock+=8*day;assert.match((await fetch(app.base+'/admin',{headers:{cookie:selectedCookie},redirect:'manual'})).headers.get('location'),/^\/auth\/discord/);
 }finally{await new Promise(r=>app.server.close(r));}
});
