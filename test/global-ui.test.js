import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync('src/ui/housing-ui.js','utf8');
const menu=fs.readFileSync('src/ui/housing-menu.js','utf8');
const specs=fs.readFileSync('src/utils/menu-specs.js','utf8');

test('registration, search, and tours expose Global scope',()=>{
  assert.match(ui,/Global House/);
  assert.match(ui,/Global Tour/);
  assert.match(menu,/scope==='global'/);
  assert.match(menu,/Global entries/);
  assert.match(specs,/Global Moderator Access/);
});

test('visibility changes preview tour impact and require confirmation',()=>{
  assert.match(menu,/previewScopeChange/);
  assert.match(menu,/Change House Visibility\?/);
  assert.match(menu,/affectedTours/);
  assert.match(menu,/hu:scope:confirm:/);
});

test('closed tour controls use the required stale-session message',()=>{
  const matches=menu.match(/This tour has been closed\./g)||[];
  assert.ok(matches.length>=3,'expected stale controls to consistently report closed tour');
});

test('global moderator approval is centralized and user-facing',()=>{
  assert.match(ui,/Global Housing Moderation/);
  assert.match(menu,/globalMods\.isApprover/);
  assert.match(menu,/globalMods\.approve/);
  assert.match(menu,/globalMods\.revoke/);
});

test('global moderator controls identify and revoke one ESO environment grant',()=>{
  assert.match(ui,/Current ESO environment/);
  assert.match(ui,/Active environments/);
  assert.match(ui,/r\.eso_server.*r\.discord_user_id/);
  assert.match(menu,/globalMods\.revoke\(parts\[4\],parts\[3\],i\.user\.id\)/);
});

const functionSource=(name,next='export function')=>{const start=ui.indexOf(`export function ${name}`),end=ui.indexOf(next,start+16);return ui.slice(start,end<0?ui.length:end);};
const expectOrdered=(source,expected)=>{let previous=-1;for(const label of expected){const current=source.indexOf(`label:'${label}'`);assert.ok(current>previous,`${label} must appear after the preceding scope option`);previous=current;}};

test('visibility choices consistently display Global then Server then Private',()=>{
  expectOrdered(functionSource('registrationTypePayload'),['Global','Server','Private']);
  expectOrdered(functionSource('tourVisibilityPayload'),['Global Tour','Server Tour','Private Tour']);
  expectOrdered(functionSource('tourEditVisibilityPayload'),['Global Tour','Server Tour','Private Tour']);
  expectOrdered(functionSource('houseScopePayload'),['Global','Server','Private']);
  expectOrdered(functionSource('bulkTourVisibilityPayload'),['Global Tour','Server Tour','Private Tour']);
});
