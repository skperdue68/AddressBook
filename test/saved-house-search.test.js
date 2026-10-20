import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { SavedHouseSearchService } from '../src/services/saved-house-search-service.js';
import { hasMeaningfulSearchFilters, normalizeSearchFilters, parseSavedSearchFilters } from '../src/utils/search-filters.js';

test('saved-search filters normalize current fields into one stable version',()=>{
  assert.deepEqual(normalizeSearchFilters({name:' moon ',visibilities:['private','global','global'],includeNonPlayer:true,tags:['  spooky ','spooky','castle'],unknown:'discard me',notOnPublicTours:false}),{name:'moon',tags:['spooky','castle'],visibilities:['global','private'],includeNonPlayer:true});
  assert.equal(hasMeaningfulSearchFilters({}),false);
  assert.equal(hasMeaningfulSearchFilters({includeNonPlayer:true}),true);
  assert.throws(()=>normalizeSearchFilters({unknown:true},{strict:true}),/unknown saved-search filter/i);
  assert.throws(()=>normalizeSearchFilters({tags:Array.from({length:26},(_,i)=>`tag-${i}`)}),/too many/i);
});

test('saved-search parsing fails closed for future corrupt and oversized values',()=>{
  assert.throws(()=>parseSavedSearchFilters({filter_version:2,filters_json:'{}'}),/newer version/i);
  assert.throws(()=>parseSavedSearchFilters({filter_version:1,filters_json:'not-json'}),/cannot be read/i);
  assert.throws(()=>parseSavedSearchFilters({filter_version:1,filters_json:`{"name":"${'x'.repeat(101)}"}`}),/too long/i);
  assert.throws(()=>parseSavedSearchFilters({filter_version:1,filters_json:`{"query":"${'x'.repeat(16400)}"}`}),/too large/i);
});

test('saved searches preserve conflicts unless replacement is explicit',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-saved-search-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'saved.sqlite')});
  try{
    await migrate(db);
    const service=new SavedHouseSearchService(db);
    const created=await service.save({userId:'u1',name:'  Moon Homes  ',filters:{name:'moon'},globalName:'Global One',displayName:'Display One'});
    assert.equal(created.status,'created');
    assert.equal(created.search.name,'Moon Homes');
    assert.deepEqual(service.filters(created.search),{name:'moon'});
    const conflict=await service.save({userId:'u1',name:'moon   homes',filters:{owner:'luna'}});
    assert.equal(conflict.status,'conflict');
    assert.deepEqual(service.filters(await service.getOwned(created.search.id,'u1')),{name:'moon'});
    const replaced=await service.save({userId:'u1',name:'MOON HOMES',filters:{owner:' luna ',includeNonPlayer:true},replace:true});
    assert.equal(replaced.status,'replaced');
    assert.equal(replaced.search.id,created.search.id);
    assert.deepEqual(service.filters(replaced.search),{owner:'luna',includeNonPlayer:true});
    assert.equal(await service.count('u1'),1);
  }finally{await closeDatabase(db);}
});

test('saved-search reads renames and deletes are owner-safe',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-saved-search-owner-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'saved.sqlite')});
  try{
    await migrate(db);
    const service=new SavedHouseSearchService(db);
    const first=await service.save({userId:'u1',name:'Castles',filters:{styles:['Breton']}});
    await service.save({userId:'u1',name:'Gardens',filters:{tags:['garden']}});
    assert.equal(await service.getOwned(first.search.id,'u2'),null);
    assert.deepEqual((await service.list('u1')).map(row=>row.name).sort(),['Castles','Gardens']);
    assert.deepEqual(await service.list('u2'),[]);
    assert.equal((await service.rename({id:first.search.id,userId:'u2',name:'Stolen'})).status,'not_found');
    assert.equal((await service.delete({id:first.search.id,userId:'u2'})).status,'not_found');
    assert.equal((await service.getOwned(first.search.id,'u1')).name,'Castles');
    const renamed=await service.rename({id:first.search.id,userId:'u1',name:'  Favorite Castles '});
    assert.equal(renamed.status,'renamed');
    assert.equal(renamed.search.name,'Favorite Castles');
    assert.equal((await service.delete({id:first.search.id,userId:'u1'})).status,'deleted');
    assert.equal(await service.getOwned(first.search.id,'u1'),null);
    assert.equal(await service.count('u1'),1);
  }finally{await closeDatabase(db);}
});

test('saved-search names and payloads are bounded before persistence',async()=>{
  const service=new SavedHouseSearchService({type:'sqlite',query:async()=>{throw new Error('SQL must not run');}});
  await assert.rejects(service.save({userId:'u1',name:' ',filters:{name:'home'}}),/name is required/i);
  await assert.rejects(service.save({userId:'u1',name:'x'.repeat(81),filters:{name:'home'}}),/80 characters/i);
  await assert.rejects(service.save({userId:'u1',name:'Valid',filters:{name:'x'.repeat(101)}}),/too long/i);
});
