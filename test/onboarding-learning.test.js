import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { OnboardingService } from '../src/services/onboarding-service.js';
import { helpLearningPayload, helpPayload, learningTopicPayload, whatsNewPayload } from '../src/ui/housing-ui.js';

async function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-learning-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'learning.sqlite') });
  await migrate(db);
  return { db, onboarding: new OnboardingService(db) };
}

test('learning state starts empty and preserves onboarding status when acknowledged', async () => {
  const { db, onboarding } = await fixture();
  try {
    assert.deepEqual(await onboarding.getLearningState('u1'), { walkthroughVersion: null, acknowledgedFeatures: [] });
    await onboarding.complete('u1', { globalName: 'User' });
    await onboarding.acknowledgeFeature('u1', 'whats-new-1.0', { globalName: 'User' });
    await onboarding.markWalkthroughSeen('u1', '1.0.0');
    const row = await onboarding.get('u1');
    assert.equal(row.status, 'completed');
    assert.equal(row.last_seen_tour_version, '1.0.0');
    assert.deepEqual(JSON.parse(row.acknowledged_features), ['whats-new-1.0']);
  } finally { await closeDatabase(db); }
});

test('feature acknowledgement is idempotent and retains skipped status', async () => {
  const { db, onboarding } = await fixture();
  try {
    await onboarding.skip('u2');
    await onboarding.acknowledgeFeature('u2', 'admin-console');
    await onboarding.acknowledgeFeature('u2', 'admin-console');
    const row = await onboarding.get('u2');
    assert.equal(row.status, 'skipped');
    assert.deepEqual(JSON.parse(row.acknowledged_features), ['admin-console']);
  } finally { await closeDatabase(db); }
});

test('Help & Learning exposes replay, What’s New, and bounded topic shortcuts', () => {
  const learning = helpLearningPayload({ latestVersion: '1.0.0', seenVersion: null, acknowledgedFeatures: [] });
  const whatsNew = whatsNewPayload({ latestVersion: '1.0.0', acknowledgedFeatures: [] });
  assert.match(JSON.stringify(learning), /Show Me Around Again/);
  assert.match(JSON.stringify(learning), /What.s New/);
  assert.match(JSON.stringify(whatsNew), /Acknowledge/);
  for (const payload of [learning, whatsNew, learningTopicPayload('tours'), helpPayload()]) {
    assert.ok(payload.components.length <= 5);
    for (const row of payload.components) assert.ok(row.toJSON().components.length <= 5);
  }
});

test('current release notes explain bot ownership and the new Home actions',()=>{
 const text=JSON.stringify(whatsNewPayload());assert.match(text,/BOT_OWNER_IDS/);assert.match(text,/Random House/);assert.match(text,/Featured Housing/);assert.match(text,/whatsnew:ack:1\.0\.62/);
});
