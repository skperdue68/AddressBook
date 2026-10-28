import test from 'node:test';import assert from 'node:assert/strict';
import {adminNavigation,adminContent} from '../src/web/admin-navigation.js';import {adminOverview} from '../src/web/admin-overview.js';import {page} from '../src/web/render.js';
test('administration tabs identify the current section without a redundant back button',()=>{
 const nav=adminNavigation('/admin/reports/1/resolve');assert.match(nav,/<a href="\/admin\/reports" aria-current="page">/);assert.ok(nav.includes('Overview'));assert.ok(!nav.includes('Back to Administration'));
 const body=adminContent('<h2>Records</h2><table><tr><td>House</td></tr></table>');assert.match(body,/class="admin-table-wrap"/);
 const c={guildId:'g',guildName:'Guild',esoServer:'pc_na',roles:[{kind:'server',label:'Server Administrator'}],isServerAdmin:true};const html=page('Audit Log','<table></table>',{id:'u',accessContext:c},{path:'/admin/audit'});assert.match(html,/aria-label="Administration"/);assert.match(html,/href="\/admin\/audit" aria-current="page"/);assert.ok(!html.includes('Back to Administration'));
});
test('administration overview prioritizes actionable queues and excludes retired event noise',()=>{
 const overview={backend:'MariaDB',connection:'Connected',pendingSubmissions:2,openReports:3,globalModeratorRequests:4,freshness:{staleHouses:5},duplicates:{duplicateGroups:6},integrity:{orphanStops:1},reminderHealth:{failedDeliveries:10}};
 const html=adminOverview(overview);for(const url of ['/admin/pending','/admin/reports','/admin/maintenance#stale','/admin/maintenance#duplicates'])assert.ok(html.includes(`href="${url}"`));assert.ok(!html.includes('Failed reminders'));assert.ok(!html.includes('Global access requests'));
 assert.ok(adminOverview(overview,{isOwner:true}).includes('Global access requests'));
});
