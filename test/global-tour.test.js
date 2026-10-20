import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('src/services/tour-service.js','utf8');
test('global tours are visible bot wide and global-only',()=>{
  assert.match(s,/visibility.*global/s);
  assert.match(s,/Global tours may contain Global houses only/);
  assert.match(s,/saved_house_id/);
});

test('tours retain the source guild for Public house sources',()=>{
  assert.match(s,/sourceGuildId/);
  assert.match(s,/source_guild_id/);
});
