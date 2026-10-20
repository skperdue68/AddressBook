import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.existsSync('src/services/tour-session-service.js')?fs.readFileSync('src/services/tour-session-service.js','utf8'):'';
test('tour sessions replace prior rows and delete on end',()=>{
  assert.match(s,/startSelfPaced/); assert.match(s,/startShared/);
  assert.match(s,/DELETE FROM tour_sessions/i);
  assert.match(s,/mode='self_paced'/i); assert.match(s,/mode='shared'/i);
  assert.match(s,/guild_id=\? AND channel_id=\?/i);
  assert.match(s,/end\(/);
});
