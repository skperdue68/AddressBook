import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanDestinationEmbed, homePayload, tourDetailPayload, tourStartChoicePayload } from '../src/ui/housing-ui.js';
import { tourButtons, tourEmbed } from '../src/utils/render.js';
import { canControlTourSession } from '../src/ui/housing-menu.js';

const fieldsOf = embed => embed.toJSON().fields || [];

test('home explains AddressBook and displays the running version', () => {
  const embed = homePayload().embeds[0].toJSON();
  assert.match(embed.title, /Hearthbound/);
  assert.match(embed.description, /ESO housing/i);
  assert.match(embed.footer.text, /Version 1\.0\.62/);
});

test('house actions display Jump, Preview, then Housing Link in separate fields', () => {
  const fields = fieldsOf(cleanDestinationEmbed({
    id: 7, scope: 'global', house_id: 74, eso_owner: '@DecorByLuna',
    house_name: 'Moon-Sugar Meadow', comment_count: 0
  }));
  const actionNames = fields.map(field => field.name).filter(name => /Jump|Preview|Housing Link/.test(name));
  assert.deepEqual(actionNames, ['🔗 Jump in ESO', '🏚️ Unfurnished Preview', '🔗 Housing Link']);
  for (const name of actionNames) assert.match(fields.find(field => field.name === name).value, /^```text\n[\s\S]+\n```$/);
});

test('tour stops display Jump, Preview, then Housing Link in separate fields', () => {
  const fields = fieldsOf(tourEmbed({ name: 'Tour' }, [{
    position: 1, house_id: 74, eso_owner: '@DecorByLuna', house_name: 'Moon-Sugar Meadow'
  }], 1));
  const actionNames = fields.map(field => field.name).filter(name => /Jump|Preview|Housing Link/.test(name));
  assert.deepEqual(actionNames, ['🔗 Jump in ESO', '🏚️ Unfurnished Preview', '🔗 Housing Link']);
});

test('shared tour controls preserve expanded details and expose editing for an authorized leader', () => {
  const controls = tourButtons(18, 0, true, { canEdit: true, savedHouseId: 42 });
  const json = JSON.stringify(controls);
  assert.match(json, /tour:next:18:expanded/);
  assert.match(json, /tour:prev:18:expanded/);
  assert.match(json, /tour:edit:18:42:expanded/);
  assert.match(json, /tour:comments:18:expanded/);
  assert.match(json, /tour:list:18:expanded/);
  assert.match(json, /Hide Details/);
});

test('tour preflight distinguishes ready warnings and blocking problems', () => {
  const tour={id:7,name:'Route',scope:'server',eso_server:'pc_na'};
  const ready=tourStartChoicePayload(tour,true,{blocking:[],advisories:[],eligibleStops:[{id:1},{id:2}]},{canManage:true});
  assert.match(JSON.stringify(ready),/Ready to start/);
  assert.match(JSON.stringify(ready),/2 stops/);
  assert.match(JSON.stringify(ready),/hu:tour:startprivate:7/);

  const warning=tourStartChoicePayload(tour,true,{blocking:[],advisories:[{message:'One unresolved accessibility report may affect this tour.'}],eligibleStops:[{id:1}]},{canManage:true});
  assert.match(JSON.stringify(warning),/Warning/);
  assert.match(JSON.stringify(warning),/accessibility report/);
  assert.match(JSON.stringify(warning),/hu:tour:startprivate:7/);

  const blocked=tourStartChoicePayload(tour,true,{blocking:[{message:'A tour stop is no longer available.'}],advisories:[],eligibleStops:[]},{canManage:true});
  const blockedText=JSON.stringify(blocked);
  assert.match(blockedText,/Blocked/);
  assert.match(blockedText,/no longer available/);
  assert.doesNotMatch(blockedText,/hu:tour:startprivate:7|hu:tour:startpublic:7/);
  assert.match(blockedText,/hu:tour:manage:7/);
});

test('Browse Tours detail provides Previous Next and a return to the tour list', () => {
  const payload=tourDetailPayload({id:8,name:'Second Route',scope:'server'},[],false,{stateId:'tourstate',index:1,total:3});
  const text=JSON.stringify(payload);
  assert.match(text,/hu:tourbrowse:prev:tourstate:0/);
  assert.match(text,/hu:tourbrowse:next:tourstate:2/);
  assert.match(text,/hu:tour:start:8:tourstate:1/);
  assert.match(text,/hu:picker:return:tourstate/);
  const back=payload.components.flatMap(row=>row.toJSON().components).find(component=>component.label==='Back to Tours');
  assert.equal(back.emoji.name,'↩️');
});

test('Featured tour detail returns to its Featured source after preflight', () => {
  for(const source of ['viewer','admin']){
    const payload=tourDetailPayload({id:8,name:'Featured Route',scope:'server'},[],false,null,source);
    const ids=payload.components.flatMap(row=>row.toJSON().components).map(c=>c.custom_id);
    assert.ok(ids.includes(`hu:tour:start:8:featured:${source}`));
    assert.ok(ids.includes(source==='admin'?'hu:admin:featured':'hu:tours:featured'));
  }
});

test('only the shared-tour initiator can navigate or end it', () => {
  const shared = { mode: 'shared', started_by: 'leader-id' };
  assert.equal(canControlTourSession(shared, 'leader-id'), true);
  assert.equal(canControlTourSession(shared, 'moderator-id'), false);
});

test('self-paced tour controls belong only to their initiating user', () => {
  const selfPaced = { mode: 'self_paced', started_by: 'user-a' };
  assert.equal(canControlTourSession(selfPaced, 'user-a'), true);
  assert.equal(canControlTourSession(selfPaced, 'user-b'), false);
});
