import test from 'node:test';
import assert from 'node:assert/strict';
import { listSupportedTimezones, normalizeTimezone, parseLocalDateTime } from '../src/utils/timezone.js';

test('normalizes supported IANA timezone names and paginates searches', () => {
  assert.equal(normalizeTimezone(' America/Chicago '), 'America/Chicago');
  assert.throws(() => normalizeTimezone('Not/A_Timezone'), /timezone/i);
  const page = listSupportedTimezones({ query: 'america/ch', page: 1, limit: 10 });
  assert.ok(page.items.includes('America/Chicago'));
  assert.ok(page.total >= page.items.length);
});

test('parses friendly and twenty-four-hour local event times to UTC', () => {
  const friendly = parseLocalDateTime({ date: '2026-01-15', time: '7:30 PM', timezone: 'America/Chicago' });
  const military = parseLocalDateTime({ date: '2026-01-15', time: '19:30', timezone: 'America/Chicago' });
  assert.equal(friendly.utc.toISOString(), '2026-01-16T01:30:00.000Z');
  assert.equal(military.utc.toISOString(), friendly.utc.toISOString());
});

test('rejects nonexistent and ambiguous DST local times', () => {
  assert.throws(() => parseLocalDateTime({ date: '2026-03-08', time: '2:30 AM', timezone: 'America/Chicago' }), /nonexistent|zero/i);
  assert.throws(() => parseLocalDateTime({ date: '2026-11-01', time: '1:30 AM', timezone: 'America/Chicago' }), /ambiguous|twice/i);
});

test('rejects malformed dates and times', () => {
  assert.throws(() => parseLocalDateTime({ date: '2026-02-30', time: '12:00', timezone: 'UTC' }), /date/i);
  assert.throws(() => parseLocalDateTime({ date: '2026-01-15', time: '25:00', timezone: 'UTC' }), /time/i);
});
