import test from 'node:test';
import assert from 'node:assert/strict';
import { eventCardPayload, eventListPayload, eventStartPreflightPayload, featuredPayload, progressCompletedPayload, progressHistoryPayload, progressPayload, progressRunPayload } from '../src/ui/engagement-ui.js';
import { tourEventCreateModal, tourEventEditModal } from '../src/ui/housing-ui.js';

test('event card exposes timezone, local rendering, RSVP, reminder, and leader actions', () => {
  const payload = eventCardPayload({ id: 7, title: 'Guild Night', tourName: 'Route', hostName: 'Host', startAt: '2026-10-16T00:30:00.000Z', timezone: 'America/Chicago', environmentLabel: 'PC NA', goingCount: 2, interestedCount: 1, startedAt: '2026-10-16T00:30:00.000Z', canStart: true, isLeader: true });
  const text = JSON.stringify(payload);
  assert.match(text, /Guild Night/); assert.match(text, /In progress/); assert.match(text, /America\/Chicago/); assert.match(text, /RSVP/); assert.match(text, /Reminder/); assert.match(text, /Cancel Event/);
  assert.ok(payload.components.length <= 5);
});

test('completed event cards disable RSVP controls', () => {
  const payload = eventCardPayload({ id: 8, title: 'Finished', startAt: '2026-10-16T00:30:00.000Z', status: 'completed' });
  const controls = payload.components[0].components.slice(0, 3).map(component => component.toJSON());
  assert.ok(controls.every(control => control.disabled === true));
});

test('terminal event cards hide stale management controls', () => {
  const payload = eventCardPayload({ id: 11, title: 'Finished', startAt: '2026-10-16T00:30:00.000Z', status: 'completed', canComplete: true, canEdit: true, isLeader: true });
  const text = JSON.stringify(payload);
  assert.doesNotMatch(text, /hu:event:edit:11|hu:event:complete:11|hu:event:cancel:11/);
});

test('cancelled event cards show an explicit Cancelled state', () => {
  const payload = eventCardPayload({ id: 12, title: 'Called Off', startAt: '2026-10-16T00:30:00.000Z', status: 'cancelled' });
  assert.match(JSON.stringify(payload), /Called Off · Cancelled/);
});

test('event cards keep every authorized management action visible across bounded rows', () => {
  const payload = eventCardPayload({ id: 9, title: 'Active', startAt: '2026-10-16T00:30:00.000Z', startedAt: '2026-10-16T00:30:00.000Z', canStart: true, canComplete: true, canEdit: true, isLeader: true });
  const text = JSON.stringify(payload);
  assert.match(text, /hu:event:edit:9/);
  assert.match(text, /hu:event:complete:9/);
  assert.match(text, /hu:event:cancel:9/);
  assert.ok(payload.components.length <= 5);
});

test('event detail cards provide a return to Upcoming Events within Discord limits', () => {
  const payload = eventCardPayload({ id: 14, title: 'Guild Night', startAt: '2026-10-16T00:30:00.000Z', canStart: true, canEdit: true, isLeader: true });
  const controls = payload.components.flatMap(actionRow => actionRow.toJSON().components);
  assert.ok(controls.some(control => control.custom_id === 'hu:tours:events' && control.label === 'Back to Upcoming Events'));
  assert.ok(payload.components.every(actionRow => actionRow.toJSON().components.length <= 5));
});

test('event controls preserve the list page through RSVP and preflight', () => {
  const list = eventListPayload({page:2,items:[{id:14,title:'Guild Night',start_at:'2026-10-16T00:30:00.000Z'}]});
  assert.match(JSON.stringify(list), /hu:event:open:14:2/);
  const card = eventCardPayload({id:14,startAt:'2026-10-16T00:30:00.000Z',returnPage:2,canStart:true});
  assert.match(JSON.stringify(card), /hu:event:rsvp:going:14:2/);
  assert.match(JSON.stringify(card), /hu:event:start:14:2/);
  assert.match(JSON.stringify(card), /hu:events:page:2/);
  const preflight = eventStartPreflightPayload({event:{id:14},readiness:{stopCount:1,blocking:[],advisories:[]},returnPage:2});
  assert.match(JSON.stringify(preflight), /hu:event:startconfirm:14:2/);
  assert.match(JSON.stringify(preflight), /hu:event:open:14:2/);
  const edit = tourEventEditModal({id:14,title:'Guild Night',start_at:'2026-10-16T00:30:00.000Z'},'America/Chicago',2);
  assert.equal(edit.toJSON().custom_id,'hu:modal:event:edit:14:2');
});

test('started event cards do not offer a second Start action', () => {
  const payload = eventCardPayload({ id: 10, title: 'Already Started', startAt: '2026-10-16T00:30:00.000Z', startedAt: '2026-10-16T00:30:00.000Z', canStart: true, canComplete: true, isLeader: true });
  assert.doesNotMatch(JSON.stringify(payload), /hu:event:start:10/);
  assert.match(JSON.stringify(payload), /hu:event:complete:10/);
});

test('Featured and progress cards keep bounded controls', () => {
  const featured = featuredPayload({ items: [{ target_kind: 'house', target_name: 'Villa', position: 1 }] });
  const progress = progressPayload({ item: { tour_name: 'Route', current_stop_id: 2, status: 'active', completion_count: 1 } });
  assert.match(JSON.stringify(featured), /Villa/); assert.match(JSON.stringify(progress), /Resume/);
});

test('multiple active tour runs can all be resumed across pages', () => {
  const items=Array.from({length:6},(_,index)=>({id:index+1,tour_name:`Route ${index+1}`,status:'active'}));
  const first=progressPayload({items,page:1});
  const firstIds=first.components.flatMap(row=>row.toJSON().components).map(control=>control.custom_id);
  assert.deepEqual(firstIds.filter(id=>id.startsWith('hu:progress:resume:')),['hu:progress:resume:1','hu:progress:resume:2','hu:progress:resume:3','hu:progress:resume:4','hu:progress:resume:5']);
  assert.ok(firstIds.includes('hu:my:progress:next:2'));
  const second=progressPayload({items,page:2});
  const secondIds=second.components.flatMap(row=>row.toJSON().components).map(control=>control.custom_id);
  assert.deepEqual(secondIds.filter(id=>id.startsWith('hu:progress:resume:')),['hu:progress:resume:6:2']);
  assert.ok(secondIds.includes('hu:my:progress:prev:1'));
});

test('active route controls retain the source progress page', () => {
  const item={id:6,tour_name:'Route',status:'active',current_stop_id:1,discord_user_id:'user'};
  const tour={id:6,name:'Route'};
  const stops=[{id:1,source_id:12,position:1,house_name:'House'}];
  const card=progressRunPayload({item,tour,stops,currentPosition:1,listPage:2,canEdit:true});
  const ids=card.components.flatMap(row=>row.toJSON().components).map(control=>control.custom_id);
  for(const id of ['hu:progress:next:6:compact:2','hu:progress:details:6:2','hu:progress:comments:6:compact:2','hu:progress:edit:6:12:compact:2','hu:progress:list:6:compact:2','hu:progress:restart:6:compact:2','hu:my:progress:page:2'])assert.ok(ids.includes(id),id);
});

test('completion history exposes every tour across pages', () => {
  const items=Array.from({length:6},(_,index)=>({id:index+1,tour_name:`Route ${index+1}`,completion_count:1}));
  const first=progressCompletedPayload({items,page:1});
  const firstIds=first.components.flatMap(row=>row.toJSON().components).map(control=>control.custom_id);
  assert.deepEqual(firstIds.filter(id=>id.startsWith('hu:progress:history:')),['hu:progress:history:1','hu:progress:history:2','hu:progress:history:3','hu:progress:history:4','hu:progress:history:5']);
  assert.ok(firstIds.includes('hu:progress:completed:next:2'));
  const second=progressCompletedPayload({items,page:2});
  const secondIds=second.components.flatMap(row=>row.toJSON().components).map(control=>control.custom_id);
  assert.deepEqual(secondIds.filter(id=>id.startsWith('hu:progress:history:')),['hu:progress:history:6:2']);
  assert.ok(secondIds.includes('hu:progress:completed:prev:1'));
  assert.ok(first.components.every(row=>row.toJSON().components.length<=5));
  assert.ok(secondIds.includes('hu:progress:history:6:2'));
});

test('completed route details retain the history list page through stop navigation', () => {
  const stops=Array.from({length:26},(_,index)=>({position:index+1,saved_house_id:index+1,house_name:`House ${index+1}`}));
  const detail=progressHistoryPayload({progress:{id:6,tour_name:'Route'},stops,page:2,listPage:2});
  const ids=detail.components.flatMap(row=>row.toJSON().components).map(control=>control.custom_id);
  assert.ok(ids.includes('hu:progress:history:prev:6:1:2'));
  assert.ok(ids.includes('hu:progress:history:house:6:2:2'));
  assert.ok(ids.includes('hu:progress:completed:page:2'));
});

test('Completion History retains its source active Tour Progress page', () => {
  const runs=Array.from({length:6},(_,index)=>({id:index+1,tour_name:`Route ${index+1}`}));
  const active=progressPayload({items:runs,page:2});
  assert.match(JSON.stringify(active),/hu:progress:completed:from:2/);
  const completed=progressCompletedPayload({items:runs,page:2,activePage:2});
  const completedIds=completed.components.flatMap(row=>row.toJSON().components).map(c=>c.custom_id);
  assert.ok(completedIds.includes('hu:progress:history:6:2:from:2'));
  assert.ok(completedIds.includes('hu:progress:completed:prev:1:from:2'));
  assert.ok(completedIds.includes('hu:my:progress:page:2'));
  const history=progressHistoryPayload({progress:runs[5],stops:[{position:1,saved_house_id:1,house_name:'Villa'}],listPage:2,activePage:2});
  const historyIds=history.components.flatMap(row=>row.toJSON().components).map(c=>c.custom_id);
  assert.ok(historyIds.includes('hu:progress:completed:page:2:from:2'));
  assert.ok(historyIds.includes('hu:progress:history:house:6:2:1:from:2'));
});

test('event list exposes bounded open buttons and pagination', () => {
  const payload = eventListPayload({ page: 2, hasNext: true, items: Array.from({ length: 5 }, (_, i) => ({ id: i + 1, title: `Event ${i + 1}`, start_at: '2026-10-16T00:30:00.000Z' })) });
  assert.match(JSON.stringify(payload), /Event 1/); assert.match(JSON.stringify(payload), /hu:event:open:1/); assert.match(JSON.stringify(payload), /hu:events:next:3/);
  const openIds = payload.components.flatMap(actionRow => actionRow.toJSON().components)
    .map(control => control.custom_id).filter(id => id.startsWith('hu:event:open:'));
  assert.deepEqual(openIds, ['hu:event:open:1:2', 'hu:event:open:2:2', 'hu:event:open:3:2', 'hu:event:open:4:2', 'hu:event:open:5:2']);
});

test('empty upcoming event list never creates an empty Discord action row', () => {
  const payload = eventListPayload({ items: [], page: 1, hasNext: false });
  assert.equal(payload.components.length, 1);
  for (const actionRow of payload.components) {
    const count = actionRow.toJSON().components.length;
    assert.ok(count >= 1 && count <= 5);
  }
});

test('scheduled events show route preflight before the final start action', () => {
  const payload=eventStartPreflightPayload({event:{id:4,title:'Guild Night'},tour:{id:8,name:'Route',visibility:'public'},readiness:{stopCount:2,blocking:[],advisories:[{message:'One accessibility report may affect this tour.'}]},environmentLabel:'PC NA'});
  const text=JSON.stringify(payload);
  assert.match(text,/Tour Preflight/);
  assert.match(text,/2 stops/);
  assert.match(text,/accessibility report/);
  assert.match(text,/hu:event:startconfirm:4/);
  assert.doesNotMatch(text,/hu:event:start:4/);
});

test('self-paced progress card exposes navigation for a run', () => {
  const stops = [
    { id: 2, position: 1, source_id: 7, house_id: 62, display_name: 'Villa', house_name: 'Grand Villa', eso_owner: 'Owner', population_limit: 12 },
    { id: 3, position: 2, source_id: 8, house_id: 63, display_name: 'Manor', house_name: 'Grand Manor', eso_owner: 'Owner' }
  ];
  const payload = progressRunPayload({
    item: { id: 9, tour_name: 'Route', current_stop_id: 2, completion_count: 0 },
    tour: { name: 'Route', description: 'A polished route.' }, stops, currentPosition: 1, canEdit: true
  });
  const text = JSON.stringify(payload);
  assert.match(text, /Stop 1 of 2.*Villa.*12 Players/);
  assert.match(text, /Jump in ESO/);
  assert.match(text, /hu:progress:next:9:compact/);
  assert.match(text, /hu:progress:edit:9:7:compact/);
  assert.match(text, /hu:progress:list:9:compact/);
  assert.doesNotMatch(text, /Open House/);
  const back = payload.components.flatMap(row => row.toJSON().components).find(component => component.label === 'Back');
  assert.equal(back.emoji.name, '↩️');
});

test('self-paced details remain expanded while advancing and show normal and ESO Plus limits', () => {
  const stop = {
    id: 2, position: 1, source_id: 7, house_id: 62, display_name: 'Villa', house_name: 'Grand Villa', eso_owner: 'Owner',
    furnishing_limit: 350, furnishing_limit_plus: 700, special_furnishing_limit: 5, special_furnishing_limit_plus: 10,
    collectible_limit: 55, collectible_limit_plus: 110, special_collectible_limit: 5, special_collectible_limit_plus: 10
  };
  const payload = progressRunPayload({
    item: { id: 9, tour_name: 'Route', current_stop_id: 2, completion_count: 0 },
    tour: { name: 'Route' }, stops: [stop, { ...stop, id: 3, position: 2, source_id: 8 }], currentPosition: 1, showDetails: true
  });
  const json = payload.embeds[0].toJSON();
  assert.equal(json.fields.find(field => field.name.includes('Traditional Furnishings')).value, '350 • 700 with ESO+');
  assert.equal(json.fields.find(field => field.name.includes('Special Furnishings')).value, '5 • 10 with ESO+');
  assert.equal(json.fields.find(field => field.name === '🏺 Collectibles*').value, '55 • 110 with ESO+');
  assert.equal(json.fields.find(field => field.name === '💎 Special Collectibles*').value, '5 • 10 with ESO+');
  assert.match(JSON.stringify(payload), /hu:progress:next:9:expanded/);
  assert.match(JSON.stringify(payload), /Hide Details/);
});

test('completed self-paced progress hides stale stop controls', () => {
  const payload = progressRunPayload({ item: { id: 10, tour_name: 'Finished Route', status: 'completed', completion_count: 1 } });
  const text = JSON.stringify(payload);
  assert.doesNotMatch(text, /hu:progress:(back|next|house):10/);
  assert.match(text, /hu:progress:restart:10/);
});

test('completion history card lists completed runs', () => {
  const payload = progressCompletedPayload({ items: [{ id: 9, tour_name: 'Route', completion_count: 2 }] });
  assert.match(JSON.stringify(payload), /Route/); assert.match(JSON.stringify(payload), /2 completions/); assert.match(JSON.stringify(payload), /hu:progress:history:9/);
});

test('progress history card lists completed stops', () => {
  const payload = progressHistoryPayload({ progress: { id: 4, tour_name: 'Route' }, stops: [{ position: 1, saved_house_id: 17, house_name: 'Villa', eso_owner: 'Owner' }] });
  assert.match(JSON.stringify(payload), /Villa/); assert.match(JSON.stringify(payload), /@Owner/); assert.match(JSON.stringify(payload), /hu:progress:history:house:4/);
});

test('progress history paginates completed stops beyond Discord select limits', () => {
  const stops = Array.from({ length: 26 }, (_, index) => ({ position: index + 1, saved_house_id: index + 1, house_name: `House ${index + 1}` }));
  const payload = progressHistoryPayload({ progress: { id: 6, tour_name: 'Long Route' }, stops, page: 1 });
  assert.match(JSON.stringify(payload), /House 1/);
  assert.doesNotMatch(JSON.stringify(payload), /House 26/);
  assert.match(JSON.stringify(payload), /hu:progress:history:next:6:2/);
});

test('Featured card shows expiration state', () => {
  const payload = featuredPayload({ items: [{ target_kind: 'house', target_name: 'Villa', position: 1, expires_at: '2026-10-01T00:00:00.000Z' }] });
  assert.match(JSON.stringify(payload), /expires/);
});

test('Featured player houses include copy-ready ESO access links', () => {
  const payload = featuredPayload({ items: [{
    target_kind: 'house', target_id: 4, target_name: 'Villa', position: 1,
    house_id: 62, eso_owner: 'Owner'
  }] });
  const text = JSON.stringify(payload);
  assert.match(text, /@Owner/);
  assert.match(text, /JumpToSpecificHouse/);
  assert.match(text, /\|H1:housing:62:@Owner\|h\|h/);
  assert.match(text, /```text/);
});

test('event edit modal prepopulates local date and time in the guild timezone', () => {
  const payload = tourEventEditModal({ id: 3, title: 'Guild Night', description: 'Route', start_at: '2026-10-16T00:30:00.000Z' }, 'America/Chicago').toJSON();
  const fields = Object.fromEntries(payload.components.map(row => [row.components[0].custom_id, row.components[0]]));
  assert.equal(fields.date.value, '2026-10-15');
  assert.equal(fields.time.value, '7:30 PM');
});

test('event forms advertise storage limits and clamp oversized legacy values', () => {
  const create = tourEventCreateModal({ id: 8 }).toJSON();
  const createFields = Object.fromEntries(create.components.map(row => [row.components[0].custom_id, row.components[0]]));
  assert.equal(createFields.title.max_length, 200);
  assert.equal(createFields.description.max_length, 2000);
  const edit = tourEventEditModal({ id: 8, title: 't'.repeat(500), description: 'd'.repeat(5000), start_at: '2026-10-16T00:30:00.000Z' }, 'America/Chicago').toJSON();
  const editFields = Object.fromEntries(edit.components.map(row => [row.components[0].custom_id, row.components[0]]));
  assert.equal(editFields.title.value.length, 200);
  assert.equal(editFields.description.value.length, 2000);
});

test('legacy oversized event text is bounded in cards, lists, and preflight', () => {
  const long = 'x'.repeat(5000);
  const card = eventCardPayload({ id: 8, title: long, description: long, tourName: long, hostName: long, startAt: '2026-10-16T00:30:00.000Z' });
  assert.ok(card.embeds[0].toJSON().title.length <= 256);
  assert.ok(card.embeds[0].toJSON().description.length <= 4096);
  assert.match(card.embeds[0].toJSON().description, /Event details/);
  const list = eventListPayload({ items: Array.from({ length: 5 }, (_, index) => ({ id: index + 1, title: long, tour_name: long, start_at: '2026-10-16T00:30:00.000Z' })) });
  assert.ok(list.embeds[0].toJSON().description.length <= 4096);
  const preflight = eventStartPreflightPayload({ event: { id: 8, title: long }, tour: { name: long, visibility: 'public' }, readiness: { stopCount: 1, blocking: [], advisories: [{ message: long }] } });
  assert.ok(preflight.embeds[0].toJSON().description.length <= 4096);
});

test('legacy oversized Featured and Tour Progress text remains Discord-safe', () => {
  const long = 'x'.repeat(5000);
  const featured = featuredPayload({ items: [{ target_kind: 'house', target_id: 1, target_name: long, house_display_name: long, eso_owner: long, house_id: 62, position: 1 }] });
  const featuredJson = featured.embeds[0].toJSON();
  assert.ok(featuredJson.description.length <= 4096);
  assert.ok(featuredJson.fields.every(field => field.name.length <= 256 && field.value.length <= 1024));
  const progress = progressPayload({ items: Array.from({ length: 5 }, (_, index) => ({ id: index + 1, tour_name: long })) });
  assert.ok(progress.embeds[0].toJSON().description.length <= 4096);
  const single = progressPayload({ item: { id: 1, tour_name: long, current_stop_id: 1 } });
  assert.ok(single.embeds[0].toJSON().description.length <= 4096);
  const completed = progressCompletedPayload({ items: Array.from({ length: 5 }, (_, index) => ({ id: index + 1, tour_name: long, completion_count: 1 })) });
  assert.ok(completed.embeds[0].toJSON().description.length <= 4096);
});

test('Featured management selector exposes all five entries and selected controls', () => {
  const items = Array.from({ length: 5 }, (_, index) => ({ target_kind: index % 2 ? 'tour' : 'house', target_id: index + 1, target_name: `Entry ${index + 1}`, position: index + 1 }));
  const payload = featuredPayload({ items, canManage: true, selectedItem: items[4] });
  const text = JSON.stringify(payload);
  assert.match(text, /Entry 5/);
  assert.match(text, /hu:featured:select/);
  assert.match(text, /hu:featured:remove:house:5/);
  assert.ok(payload.components.length <= 5);
});

test('Featured tours have bounded Open controls for viewers and managers', () => {
  const items=Array.from({length:4},(_,index)=>({target_kind:'tour',target_id:index+1,target_name:`Route ${index+1}`,position:index+1}));
  for(const canManage of [false,true]){
    const payload=featuredPayload({items,canManage,selectedItem:canManage?items[0]:null});
    const ids=payload.components.flatMap(row=>row.toJSON().components).map(c=>c.custom_id);
    assert.deepEqual(ids.filter(id=>id.startsWith('hu:featured:tour:')),items.map(item=>`hu:featured:tour:${item.target_id}:${canManage?'admin':'viewer'}`));
    assert.ok(payload.components.length<=5);
    assert.ok(payload.components.every(row=>row.toJSON().components.length<=5));
  }
});

test('Featured houses and tours expose Open controls within Discord row limits', () => {
  const houses=Array.from({length:4},(_,index)=>({target_kind:'house',target_id:index+1,target_name:`House ${index+1}`,position:index+1}));
  const tours=Array.from({length:4},(_,index)=>({target_kind:'tour',target_id:index+11,target_name:`Tour ${index+1}`,position:index+1}));
  for(const canManage of [false,true]){
    const payload=featuredPayload({items:[...houses,...tours],canManage,selectedItem:canManage?houses[0]:null});
    const ids=payload.components.flatMap(row=>row.toJSON().components).map(c=>c.custom_id);
    assert.deepEqual(ids.filter(id=>id.startsWith('hu:featured:house:')),houses.map(item=>`hu:featured:house:${item.target_id}:${canManage?'admin':'viewer'}`));
    assert.equal(payload.components.length,canManage?5:3);
    assert.ok(payload.components.every(row=>row.toJSON().components.length<=5));
  }
});

test('Featured reorder controls stop at the end of their own category', () => {
  const items=[
    {target_kind:'house',target_id:1,target_name:'Villa',position:1},
    {target_kind:'house',target_id:2,target_name:'Manor',position:2},
    {target_kind:'tour',target_id:3,target_name:'Route',position:1}
  ];
  const house=featuredPayload({items,canManage:true,selectedItem:items[1]});
  const houseControls=house.components.flatMap(row=>row.toJSON().components);
  assert.equal(houseControls.find(c=>c.label==='↓').disabled,true);
  assert.equal(houseControls.find(c=>c.label==='↑').disabled,false);
  const tour=featuredPayload({items,canManage:true,selectedItem:items[2]});
  const tourControls=tour.components.flatMap(row=>row.toJSON().components);
  assert.equal(tourControls.find(c=>c.label==='↓').disabled,true);
  assert.equal(tourControls.find(c=>c.label==='↑').disabled,true);
});
