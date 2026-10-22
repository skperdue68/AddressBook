import test from 'node:test';
import assert from 'node:assert/strict';
import { EngagementWorker } from '../src/services/engagement-worker.js';

test('engagement worker starts once, runs Featured jobs without reminders, and stops cleanly', async () => {
  let callback; let intervals = 0; let cleared = 0; let reminderRuns = 0; let expiryRuns = 0; let autoRuns = 0;
  const worker = new EngagementWorker({
    reminders: { runOnce: async () => { reminderRuns++; } },
    featured: { expireDue: async () => { expiryRuns++; }, rotateDueHousesAll: async () => { autoRuns++; } }, intervalMs: 1234,
    setIntervalFn: (fn, ms) => { callback = fn; intervals++; assert.equal(ms, 1234); return 9; },
    clearIntervalFn: id => { cleared++; assert.equal(id, 9); }
  });
  await worker.start(); await worker.start();
  assert.equal(intervals, 1); assert.equal(reminderRuns, 0); assert.equal(expiryRuns, 1); assert.equal(autoRuns, 1);
  await callback(); assert.equal(reminderRuns, 0); assert.equal(expiryRuns, 2); assert.equal(autoRuns, 2);
  worker.stop(); worker.stop(); assert.equal(cleared, 1);
});
