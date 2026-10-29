import {fileURLToPath} from 'node:url';
import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';import {welcomePage} from '../src/web/public-pages.js';
import {createWebAdminServer} from '../src/web/server.js';
test('landing uses real 1200x630 social asset, one primary hero action and hidden decorative icons',async()=>{
 const html=welcomePage({clientId:'123',redirectUri:'https://homes.example.test/auth/callback'}),m=await sharp(fileURLToPath(new URL('../src/web/assets/hearthbound-preview.png',import.meta.url))).metadata();assert.equal(m.width,1200);assert.equal(m.height,630);
 assert.match(html,/og:image" content="https:\/\/homes.example.test\/assets\/hearthbound-preview.png/);assert.match(html,/og:image:width" content="1200/);assert.match(html,/og:image:height" content="630/);assert.match(html,/og:image:type" content="image\/png/);
 const hero=html.split('<section class="welcome-hero">')[1].split('</section>')[0];assert.equal((hero.match(/class="button primary"/g)||[]).length,1);assert.equal((html.match(/class="feature-mark" aria-hidden="true"/g)||[]).length,3);assert.match(html,/href="\/privacy"/);assert.match(html,/href="\/terms"/);
});
test('legal pages are branded and public with HEAD support and no writes',async t=>{
 const server=createWebAdminServer({service:{},config:{sessionSecret:'test'}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base=`http://127.0.0.1:${server.address().port}`;
 for(const path of ['/privacy','/terms']){const response=await fetch(base+path,{redirect:'manual'});assert.equal(response.status,200);const html=await response.text();assert.match(html,/public-page/);assert.match(html,/HearthBound/);assert.match(html,/href="\/privacy"/);assert.match(html,/href="\/terms"/);assert.equal((await fetch(base+path,{method:'POST',redirect:'manual'})).status,405);assert.equal((await fetch(base+path,{method:'HEAD'})).status,200);}
});
