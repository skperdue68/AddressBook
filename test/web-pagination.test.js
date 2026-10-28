import test from 'node:test';
import assert from 'node:assert/strict';
import {pagination} from '../src/web/pagination.js';
test('pagination preserves filters in numbered links and bounded direct jump',()=>{
 const html=pagination({page:6,total:500,path:'/app/houses',params:{q:'garden & sky',scope:'global',page:99}});
 assert.match(html,/aria-current="page"[^>]*>6</);assert.match(html,/page=4/);assert.match(html,/page=8/);assert.match(html,/page=20/);assert.match(html,/class="pagination-ellipsis"/);
 assert.match(html,/name="page"[^>]*min="1"[^>]*max="20"/);assert.match(html,/name="q" value="garden &amp; sky"/);assert.match(html,/name="scope" value="global"/);assert.equal((html.match(/name="page"/g)||[]).length,1);
});
test('zero and one page show counts without redundant navigation',()=>{
 for(const total of [0,1,25]){const html=pagination({page:1,total,path:'/app/houses'});assert.match(html,new RegExp(`${total} records`));assert.doesNotMatch(html,/page-jump|Previous|Next/);}
});
test('pagination clamps invalid and out-of-range pages and honors page size',()=>{
 const html=pagination({page:999,total:120,pageSize:50,path:'/app/catalog'});assert.match(html,/aria-current="page"[^>]*>3</);assert.match(html,/value="3"/);assert.doesNotMatch(html,/>Next</);
 const first=pagination({page:-8,total:100,path:'/app/houses'});assert.match(first,/aria-current="page"[^>]*>1</);assert.doesNotMatch(first,/>Previous</);
});
