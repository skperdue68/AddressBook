import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { GuildService } from '../src/services/guild-service.js';
import { adminOtherRolesPayload, adminPayload } from '../src/ui/housing-ui.js';
import { createHousingMenu } from '../src/ui/housing-menu.js';

const componentById = (payload, id) => payload.components
  .flatMap(row => row.components)
  .find(component => component.data.custom_id === id)
  .toJSON();

test('administration role selectors restore every configured role and allow 25 selections', () => {
  const settings = {
    registration_policy: 'roles',
    staff_role_ids: ['mod-1', 'mod-2'],
    registration_role_ids: ['trusted-1', 'trusted-2'],
    tour_role_ids: ['tour-1', 'tour-2'],
    bot_channel_id: null
  };
  const admin = adminPayload(settings);
  const moderator = componentById(admin, 'hu:admin:moderator');
  const trusted = componentById(admin, 'hu:admin:trusted');
  const tours = componentById(adminOtherRolesPayload(settings), 'hu:admin:tours');
  for (const [component, expected] of [
    [moderator, ['mod-1', 'mod-2']],
    [trusted, ['trusted-1', 'trusted-2']],
    [tours, ['tour-1', 'tour-2']]
  ]) {
    assert.equal(component.max_values, 25);
    assert.deepEqual(component.default_values.map(value => value.id), expected);
  }
});

test('administration saves all selected roles and any configured role grants its permission', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-multi-role-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'roles.sqlite') });
  try {
    await migrate(db);
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('guild-1','pc_na')");
    const menu = createHousingMenu(db);
    const updates = [];
    const interaction = {
      guildId: 'guild-1', channelId: 'channel-1', user: { id: 'user-1' },
      member: { roles: { cache: new Map([['mod-2', true]]) } },
      values: ['mod-1', 'mod-2'], customId: 'hu:admin:moderator',
      update(payload) { updates.push(payload); return Promise.resolve(payload); },
      reply(payload) { throw new Error(`Unexpected reply: ${payload.content}`); }
    };
    await menu.select(interaction);
    interaction.customId = 'hu:admin:trusted';
    interaction.values = ['trusted-1', 'trusted-2'];
    await menu.select(interaction);
    interaction.customId = 'hu:admin:tours';
    interaction.values = ['tour-1', 'tour-2'];
    await menu.select(interaction);

    const service = new GuildService(db);
    const settings = await service.ensureSettings('guild-1');
    assert.deepEqual(settings.staff_role_ids, ['mod-1', 'mod-2']);
    assert.deepEqual(settings.registration_role_ids, ['trusted-1', 'trusted-2']);
    assert.deepEqual(settings.tour_role_ids, ['tour-1', 'tour-2']);
    const withRole = role => ({ guildId: 'guild-1', member: { roles: { cache: new Map([[role, true]]) } } });
    assert.equal(service.canAdmin(withRole('mod-2')), true);
    assert.equal(service.hasTrustedSubmitterRole(withRole('trusted-2')), true);
    assert.equal(service.hasHousingToursRole(withRole('tour-2')), true);
    assert.equal(updates.length, 3);
  } finally {
    await closeDatabase(db);
  }
});
