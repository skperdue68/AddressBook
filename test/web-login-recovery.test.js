import test from 'node:test';import assert from 'node:assert/strict';
import {createWebAdminServer} from '../src/web/server.js';import {createOAuthState} from '../src/web/oauth.js';

test('cancelled, expired and failed sign-in use branded recovery pages without raw provider errors',async t=>{
 const server=createWebAdminServer({service:{},config:{sessionSecret:'s'},fetchImpl:async()=>({ok:false,status:503})});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base=`http://127.0.0.1:${server.address().port}`;
 const {state,binding}=createOAuthState('/app/tours/14',Date.now(),'s'),cancel=await fetch(base+'/auth/callback?'+new URLSearchParams({state,error:'access_denied',error_description:'SECRET_PROVIDER_ERROR'}),{headers:{cookie:`hearthbound_oauth=${binding}`},redirect:'manual'}),html=await cancel.text();assert.equal(cancel.status,200);assert.match(html,/Sign-in cancelled/);assert.match(html,/assets\/public-pages.css/);assert.match(html,/hearthbound-logo.png/);assert.match(html,/href="\/browse\/tours\/14"/);assert.match(html,/returnTo=%2Fapp%2Ftours%2F14/);assert.doesNotMatch(html,/read-only administration|SECRET_PROVIDER_ERROR/);assert.equal(cancel.headers.get('set-cookie'),null);
 const expired=await fetch(base+'/auth/callback?state=expired');assert.equal(expired.status,400);assert.match(await expired.text(),/assets\/public-pages.css/);
 const next=createOAuthState('/app/houses/8',Date.now(),'s'),failure=await fetch(base+'/auth/callback?'+new URLSearchParams({state:next.state,code:'test'}),{headers:{cookie:`hearthbound_oauth=${next.binding}`}});assert.equal(failure.status,502);const failedHtml=await failure.text();assert.match(failedHtml,/Try signing in again/);assert.doesNotMatch(failedHtml,/token exchange|503/);
 const logout=await fetch(base+'/auth/logout',{redirect:'manual'});assert.equal(logout.headers.get('location'),'/');assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
});
