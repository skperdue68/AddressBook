import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ESO_SERVERS, ESO_SERVER_CODES, normalizeEsoServer,
  requireEsoServer, esoServerLabel, esoServerOptions
} from '../src/utils/eso-server.js';

test('ESO environments normalize supported user input and retain the required display order',()=>{
  assert.deepEqual(ESO_SERVERS.map(item=>[item.value,item.label]),[
    ['pc_na','PC NA'],['pc_eu','PC EU'],['xbox_na','Xbox NA'],['xbox_eu','Xbox EU'],
    ['playstation_na','PlayStation NA'],['playstation_eu','PlayStation EU'],['pts','PTS']
  ]);
  assert.deepEqual(ESO_SERVER_CODES,[
    'pc_na','pc_eu','xbox_na','xbox_eu','playstation_na','playstation_eu','pts'
  ]);
  assert.equal(normalizeEsoServer(' PC-NA '),'pc_na');
  assert.equal(normalizeEsoServer('PlayStation EU'),'playstation_eu');
  assert.equal(normalizeEsoServer('pts'),'pts');
  assert.equal(normalizeEsoServer('unassigned'),null);
  assert.equal(normalizeEsoServer('switch_na'),null);
  assert.throws(()=>requireEsoServer('unassigned'),/valid ESO environment/);
  assert.equal(esoServerLabel('pc_eu'),'PC EU');
  assert.equal(esoServerLabel(null),'Unassigned');
});

test('ESO environment options are safe copies rather than mutable canonical records',()=>{
  const options=esoServerOptions();
  options[0].label='Changed';
  assert.equal(ESO_SERVERS[0].label,'PC NA');
  assert.notEqual(options[0],ESO_SERVERS[0]);
});
