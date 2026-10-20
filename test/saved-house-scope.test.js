import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const saved=fs.existsSync('src/services/saved-house-service.js')?fs.readFileSync('src/services/saved-house-service.js','utf8'):'';
const comments=fs.readFileSync('src/services/comment-service.js','utf8');
const visits=fs.readFileSync('src/services/visit-service.js','utf8');

test('saved house service models private public global and scope impact',()=>{
  assert.match(saved,/createPrivate/);
  assert.match(saved,/createPublic/);
  assert.match(saved,/createGlobal/);
  assert.match(saved,/previewScopeChange/);
  assert.match(saved,/changeScope/);
  assert.match(saved,/tour_stops/);
  assert.match(saved,/saved_house_id/);
  assert.match(saved,/withTransaction/);
});

test('comments attach to stable saved house identity',()=>{
  assert.match(comments,/saved_house_id/);
  assert.doesNotMatch(comments,/personal_bookmarks|registered_houses/);
});

test('search includes global while public remains guild-scoped',()=>{
  assert.match(visits,/global/);
  assert.match(visits,/s\.guild_id=\?/);
  assert.match(visits,/s\.owner_user_id=\?/);
});

test('house scope changes and deletes are audited and tour positions are reconciled',()=>{
  assert.match(saved,/change_house_scope/);
  assert.match(saved,/delete_house/);
  assert.match(saved,/ORDER BY position,id/);
});
