import test from 'node:test';
import assert from 'node:assert/strict';
import {statisticsRoute} from '../src/web/statistics-routes.js';

test('statistics counts share a size and retain scoped drilldowns in independent ranking tables',async()=>{
 const html=await statisticsRoute({context:{guildName:'Guild',esoServer:'pc_na'},workspace:{statistics:{snapshot:async()=>({privateHouses:1,serverRegistrations:12345,globalRegistrations:2,tours:3,houseTypes:4,averageStops:1.5}),popularity:async()=>[{name:'Home',zone:'Zone',house_id:7,members:2,owners:1,registrations:2,tours:1}],serverRankings:async()=>({houses:[{name:'Home',zone:'Zone',house_id:7,registrations:12345}],owners:[{eso_owner:'@Owner',normalized_owner:'owner',registrations:2,houseTypes:1}]})}},render:(_title,body)=>body});
 assert.match(html,/class="statistics-page" style="--stat-count-digits:5"/);
 assert.equal((html.match(/class="stat-count"/g)||[]).length,13);
 assert.match(html,/class="grid server-rankings" data-server-rankings/);
 assert.equal((html.split('data-server-rankings')[1].split('Community favourites')[0].match(/<table>/g)||[]).length,2);
 assert.match(html,/class="stat-count" href="\/app\/houses\?scope=public&amp;ownerExact=owner"/);
 assert.match(html,/<small>Zone<\/small>/);
 assert.match(html,/scope=shared&amp;houseId=7/);
});

test('independent ranking geometry aligns matching desktop rows and resets when stacked',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {runInNewContext}=await import('node:vm');
 const source=(await readFile(new URL('../src/web/assets/interface.js',import.meta.url),'utf8')).split('// These are independent rankings; synchronize their geometry, never their data.')[1];
 const element=natural=>({style:{height:'',removeProperty(){this.height='';}},getBoundingClientRect(){return {height:this.style.height?Number.parseFloat(this.style.height):natural};}});
 const left=[element(36),element(76),element(60)],right=[element(50),element(44),element(44),element(44)];
 const headings=[element(24),element(48)];
 const tables=[left,right].map(rows=>({rows,tHead:{rows:rows.slice(0,1)},tBodies:[{rows:rows.slice(1)}]}));
 const group={children:tables.map((table,i)=>({querySelector:selector=>selector==='table'?table:headings[i]}))};
 const frames=[];let columns='400px 400px',resize,observe;
 runInNewContext(source,{document:{querySelectorAll:()=>[group]},getComputedStyle:()=>({gridTemplateColumns:columns}),requestAnimationFrame:fn=>frames.push(fn),window:{addEventListener:(_event,fn)=>{resize=fn;}},ResizeObserver:class{constructor(fn){observe=fn;}observe(){} }});
 frames.shift()();
 assert.equal(headings[0].style.height,'48px');
 assert.equal(left[0].style.height,right[0].style.height);
 assert.equal(right[1].style.height,'76px');
 assert.equal(right[2].style.height,'60px');
 assert.equal(right[3].style.height,''); // An unmatched owner remains an independent row.
 observe([{contentRect:{width:820}}]);frames.shift()();
 observe([{contentRect:{width:820}}]);assert.equal(frames.length,0);
 columns='380px';resize();frames.shift()();
 assert.ok([...left,...right,...headings].every(row=>row.style.height===''));
});

