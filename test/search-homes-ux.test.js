import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, migrate, closeDatabase } from '../src/db/database.js';
import { VisitService } from '../src/services/visit-service.js';
import { searchFiltersModal, pickerPayload, advancedAttributePayload } from '../src/ui/housing-ui.js';
import { searchCriteria } from '../src/ui/housing-menu.js';

test('search filters modal exposes compact filters and visibility in Global Server Private order', () => {
  const json = searchFiltersModal('search-token', {
    name: 'moon', owner: 'luna', visibilities: ['global', 'private']
  }, false).toJSON();
  assert.equal(json.custom_id, 'hu:modal:advanced:filters:search-token');
  assert.equal(json.components.length, 5);
  assert.equal(json.components[0].component.custom_id, 'name');
  assert.equal(json.components[1].component.custom_id, 'owner');
  assert.deepEqual(json.components[2].component.options.map(option => option.label), ['Global', 'Server', 'Private']);
  assert.deepEqual(json.components[2].component.options.filter(option => option.default).map(option => option.value), ['global', 'private']);
  assert.deepEqual(json.components[3].component.options.map(option => option.label), ['Exclude Non-Player Homes', 'Include Non-Player Homes']);
  assert.equal(json.components[4].component.custom_id, 'attribute');
});

test('empty optional modal text fields omit empty values accepted poorly by Discord clients', () => {
  const json = searchFiltersModal('search-token', {}, false).toJSON();
  assert.equal('value' in json.components[0].component, false);
  assert.equal('value' in json.components[1].component, false);
});

test('search filters modal offers an active not-on-server-or-global-tour filter', () => {
  const json = searchFiltersModal('search-token', { notOnPublicTours: true }, false).toJSON();
  const additional = json.components[4].component;
  assert.equal(additional.custom_id, 'attribute');
  assert.equal(additional.max_values, 2);
  const option = additional.options.find(item => item.value === 'notOnPublicTours');
  assert.equal(option.label, 'Not on a Server or Global Tour');
  assert.equal(option.default, true);
  assert.match(searchCriteria('Search Houses', { notOnPublicTours: true }), /Tour Membership:\*\* Not on a Server or Global Tour/);
});

test('house results can display Filters and Clear Filters actions beside the populated picker', () => {
  const payload = pickerPayload({
    title: 'House Search Results', description: 'Showing all accessible homes.',
    customId: 'hu:picker:state', options: [{ label: 'House', value: '0' }],
    actions: [
      { customId: 'hu:advanced:filters:token', label: 'Filters', style: 'primary' },
      { customId: 'hu:advanced:clear:token', label: 'Clear Filters', style: 'secondary' }
    ]
  });
  const labels = payload.components.flatMap(row => row.components).map(component => component.data.label).filter(Boolean);
  assert.deepEqual(labels.slice(0, 2), ['Filters', 'Clear Filters']);
});

test('large attribute picker provides a direct return to the filtered house results', () => {
  const payload = advancedAttributePayload({ token: 'search-token', field: 'zone', values: ['High Isle'] });
  const buttons = payload.components.flatMap(row => row.components).filter(component => component.data.label);
  assert.deepEqual(buttons.map(component => component.data.label), ['Back to Results']);
  assert.equal(buttons[0].data.custom_id, 'hu:advanced:results:search-token');
});

test('active search summary presents house visibility with user-facing labels and order', () => {
  const summary = searchCriteria('Search Houses', { visibilities: ['global', 'public'] });
  assert.match(summary, /House Visibility:\*\* Global, Server/);
  assert.doesNotMatch(summary, /public|private/);
});

test('house visibility filter limits saved-house results without treating non-player homes as a visibility', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-search-visibility-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'search.sqlite') });
  try {
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'House','house')");
    await db.query("INSERT INTO saved_houses(eso_server,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES('pc_na','global',NULL,'g1',NULL,1,'Global','global','active','u1','u1')");
    await db.query("INSERT INTO saved_houses(eso_server,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES('pc_na','public','g1','g1',NULL,1,'Server','server','active','u1','u1')");
    await db.query("INSERT INTO saved_houses(eso_server,scope,guild_id,origin_guild_id,owner_user_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES('pc_na','private',NULL,'g1','u1',1,'Private','private','active','u1','u1')");
    const visits = new VisitService(db);
    const rows = await visits.search({ userId: 'u1', guildId: 'g1', esoServer:'pc_na', includeNonPlayer: true, visibilities: ['public'] });
    assert.deepEqual(rows.map(row => row.scope), ['server', 'official']);
  } finally {
    await closeDatabase(db);
  }
});

test('not-on-public-tours excludes current-server and global tour houses but ignores private and other-server tours', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-search-tour-membership-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'search.sqlite') });
  try {
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'House','house')");
    const houses = [
      [1, 'No Tours'],
      [2, 'Private Tour Only'],
      [3, 'Other Server Only'],
      [4, 'This Server Tour'],
      [5, 'Global Tour']
    ];
    for (const [id, owner] of houses) {
      await db.query("INSERT INTO saved_houses(id,eso_server,scope,guild_id,origin_guild_id,house_id,eso_owner,normalized_owner,status,created_by,updated_by) VALUES(?,'pc_na','global',NULL,'g1',1,?,?,'active','u1','u1')", [id, owner, owner.toLowerCase()]);
    }
    const tours = [
      [1, 'private', null, 'u1', 2],
      [2, 'public', 'g2', 'u2', 3],
      [3, 'public', 'g1', 'u2', 4],
      [4, 'global', null, 'u2', 5]
    ];
    for (const [id, visibility, guildId, creatorId, houseId] of tours) {
      await db.query("INSERT INTO tours(id,eso_server,visibility,guild_id,creator_id,name,house_source) VALUES(?,'pc_na',?,?,?,?,?)", [id, visibility, guildId, creatorId, `Tour ${id}`, visibility === 'global' ? 'global' : 'all']);
      await db.query('INSERT INTO tour_stops(tour_id,position,saved_house_id) VALUES(?,1,?)', [id, houseId]);
    }
    const rows = await new VisitService(db).search({ userId: 'u1', guildId: 'g1', esoServer:'pc_na', includeNonPlayer: true, notOnPublicTours: true, limit: null });
    assert.deepEqual(new Set(rows.map(row => row.eso_owner)), new Set(['No Tours', 'Other Server Only', 'Private Tour Only']));
    assert.equal(rows.some(row => row.scope === 'official'), false);
  } finally {
    await closeDatabase(db);
  }
});
