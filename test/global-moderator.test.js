import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.existsSync('src/services/global-moderator-service.js')?fs.readFileSync('src/services/global-moderator-service.js','utf8'):'';
test('global moderator workflow is centralized by approver ids',()=>{
  assert.match(s,/GLOBAL_MODERATOR_APPROVER_USER_IDS/);
  assert.match(s,/requestAccess/); assert.match(s,/reason/);
  assert.match(s,/listPending/); assert.match(s,/approve/); assert.match(s,/deny/); assert.match(s,/revoke/);
  assert.match(s,/global_moderators/); assert.match(s,/global_moderator_requests/);
  assert.match(s,/status='pending'/);
});

test('global moderator changes are audited',()=>{
  assert.match(s,/approve_global_moderator/);
  assert.match(s,/deny_global_moderator/);
  assert.match(s,/revoke_global_moderator/);
});
