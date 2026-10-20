import test from 'node:test';
import assert from 'node:assert/strict';
import { adminPayload, toursPayload, adminSettingsPayload } from '../src/ui/housing-ui.js';
import { eventListPayload } from '../src/ui/engagement-ui.js';

const settings = {
  eso_server: 'pc_na',
  registration_policy: 'roles',
  staff_role_ids: ['moderator'],
  registration_role_ids: ['trusted'],
  tour_role_ids: ['tours'],
  timezone: 'America/Chicago',
  bot_channel_id: 'channel'
};

function assertDiscordRows(payload, label) {
  assert.ok(payload.components.length <= 5, `${label} must contain no more than five action rows`);
  for (const row of payload.components) {
    assert.ok(row.toJSON().components.length <= 5, `${label} action rows must contain no more than five components`);
  }
}

test('Administration stays within Discord five-action-row limit', () => {
  assertDiscordRows(adminPayload(settings), 'Administration');
  assertDiscordRows(adminSettingsPayload(settings), 'Administration settings');
});

test('Housing Tours and Upcoming Events stay within Discord component limits', () => {
  assertDiscordRows(toursPayload(12), 'Housing Tours');
  assertDiscordRows(eventListPayload({
    items: Array.from({ length: 5 }, (_, index) => ({ id: index + 1, title: `Event ${index + 1}`, start_at: '2026-10-16T00:30:00.000Z' })),
    hasNext: true
  }), 'Upcoming Events');
});
