import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const importer=fs.readFileSync('src/db/migrate-sqlite-to-mariadb.js','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));

test('explicit SQLite-to-MariaDB import command exists alongside SQLite runtime support',()=>{
  assert.equal(pkg.scripts['db:migrate-sqlite-to-mariadb'],'node src/db/migrate-sqlite-to-mariadb.js');
  assert.match(importer,/DatabaseSync/);
  assert.match(importer,/readOnly:true/);
  assert.match(importer,/assertEmptyTarget/);
  assert.match(importer,/withTransaction/);
});

test('import maps public and private records to unified saved houses',()=>{
  assert.match(importer,/registered_houses/);
  assert.match(importer,/personal_bookmarks/);
  assert.match(importer,/saved_houses/);
  assert.match(importer,/buildSavedHouseIdMaps/);
  assert.match(importer,/saved_house_id/);
});

test('import detects and copies an already-upgraded unified SQLite database',()=>{
  assert.match(importer,/sourceIsUnified/);
  assert.match(importer,/UNIFIED_SOURCE_TABLES/);
  assert.match(importer,/copyUnifiedSavedHouses/);
  assert.match(importer,/copyUnifiedComments/);
  assert.match(importer,/copyUnifiedTours/);
  assert.match(importer,/copyUnifiedTourStops/);
  assert.match(importer,/copyGlobalModeration/);
  assert.match(importer,/sourceSchema:unified\?'unified':'legacy'/);
});

test('legacy tour sessions are deliberately not imported',()=>{
  assert.doesNotMatch(importer,/sourceRows\(sqlite,'tour_sessions'\)/);
  assert.match(importer,/tourSessionsImported:0/);
  assert.match(importer,/Legacy tour_sessions were intentionally not imported/);
});

test('migration preserves Public source guild on tours',()=>{
  assert.match(importer,/source_guild_id/);
  assert.match(importer,/Public house source has no source Discord server/);
});
