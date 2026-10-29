import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderWorkspace} from '../src/web/workspace-render.js';
import {fixture} from './workspace-fixture.js';
import {closeDatabase} from '../src/db/database.js';
import {createWebAdminServer} from '../src/web/server.js';
import {WebAdminService} from '../src/services/web-admin-service.js';
import {createSession} from '../src/web/session.js';

const context={guildId:'g',guildName:'Guild',esoServer:'pc_na',roles:[{kind:'owner',label:'Bot Owner'},{kind:'member',label:'Member'}]};
test('account disclosure shows Discord avatar, escaped identity and current access with guide link',()=>{
 const html=renderWorkspace({title:'Home',body:'',context,user:{id:'123456789012345678',avatar:'a_0123456789abcdef0123456789abcdef',global_name:'<Alex>',username:'alex&co'}});
 assert.match(html,/<details class="account-menu"/);
 assert.match(html,/cdn\.discordapp\.com\/avatars\/123456789012345678\/a_0123456789abcdef0123456789abcdef\.png\?size=128/);
 assert.match(html,/Account menu for &lt;Alex&gt;/);
 assert.match(html,/@alex&amp;co/);
 assert.match(html,/Bot Owner/);assert.match(html,/href="\/app\/guide"/);
 assert.doesNotMatch(html,/<Alex>|role="menu"/);
 for(const user of [{username:'Alex Smith'},{id:'../bad',avatar:'x" onerror="alert(1)',global_name:'<script>'}]){
  const fallback=renderWorkspace({title:'Home',body:'',context,user});
  assert.match(fallback,/avatar-initials/);assert.doesNotMatch(fallback,/cdn\.discordapp\.com\/avatars\/|onerror=|<script>/);
 }
});

test('guide download requires a signed-in account, serves exact Word bytes, and rejects writes',async()=>{
 const {db,svc}=await fixture();let member=true;
 const server=createWebAdminServer({service:new WebAdminService(db),workspace:svc,config:{sessionSecret:'s'},resolveGuildMembership:async()=>member?{id:'g',name:'Guild',roleIds:[],esoServer:'pc_na'}:null});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`,cookie=`addressbook_session=${createSession({id:'u',username:'User',guilds:[{id:'g',name:'Guild'}]},Date.now(),'s')}`;
 try{
  const anon=await fetch(base+'/app/guide',{redirect:'manual'});assert.equal(anon.status,302);assert.match(anon.headers.get('location'),/auth\/discord/);
  const result=await fetch(base+'/app/guide',{headers:{cookie},redirect:'manual'});assert.equal(result.status,200);
  assert.equal(result.headers.get('content-type'),'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.match(result.headers.get('content-disposition'),/attachment; filename="HearthBound_User_Admin_Guide.docx"/);
  assert.match(result.headers.get('cache-control'),/no-store/);assert.equal(result.headers.get('x-content-type-options'),'nosniff');
  assert.deepEqual(Buffer.from(await result.arrayBuffer()),await readFile(new URL('../HearthBound_User_Admin_Guide.docx',import.meta.url)));
  assert.equal((await fetch(base+'/app/guide',{method:'POST',headers:{cookie},redirect:'manual'})).status,405);
  const help=await fetch(base+'/app/help',{headers:{cookie}});assert.match(await help.text(),/Download.*guide.*Word/i);
  member=false;assert.equal((await fetch(base+'/app/guide',{headers:{cookie},redirect:'manual'})).status,200);assert.equal((await fetch(base+'/app/guide?guildId=g',{headers:{cookie},redirect:'manual'})).status,403);
 }finally{await new Promise(r=>server.close(r));await closeDatabase(db);}
});
