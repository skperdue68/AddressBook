import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const serviceFiles=fs.readdirSync('src/services').filter(name=>name.endsWith('.js'));

test('service SELECT wildcards do not repeat readable companion column names',()=>{
  const collisions=[];
  for(const name of serviceFiles){
    const source=fs.readFileSync(path.join('src/services',name),'utf8');
    const savedHouseSelections=source.matchAll(/SELECT\s+s\.\*([\s\S]*?)\s+FROM\s+saved_houses\s+s/gi);
    for(const match of savedHouseSelections){
      if(/h\.name\s+(?:AS\s+)?house_name\b/i.test(match[1]))collisions.push(`${name}: saved_houses.house_name`);
      if(/\w+\.eso_server\s+(?:AS\s+)?eso_server\b/i.test(match[1]))collisions.push(`${name}: saved_houses.eso_server`);
    }
    const stopSelections=source.matchAll(/SELECT\s+ts\.\*([\s\S]*?)\s+FROM\s+tour_stops\s+ts/gi);
    for(const match of stopSelections){
      if(/sh\.id\s+(?:AS\s+)?saved_house_id\b/i.test(match[1]))collisions.push(`${name}: tour_stops.saved_house_id`);
      if(/t\.name\s+(?:AS\s+)?tour_name\b/i.test(match[1]))collisions.push(`${name}: tour_stops.tour_name`);
    }
    const sessionSelections=source.matchAll(/SELECT\s+ts\.\*([\s\S]*?)\s+FROM\s+tour_sessions\s+ts/gi);
    for(const match of sessionSelections){
      if(/t\.name\s+(?:AS\s+)?tour_name\b/i.test(match[1]))collisions.push(`${name}: tour_sessions.tour_name`);
    }
    const tourSelections=source.matchAll(/SELECT\s+t\.\*([\s\S]*?)\s+FROM\s+tours\s+t/gi);
    for(const match of tourSelections)if(/\w+\.eso_server\s+(?:AS\s+)?eso_server\b/i.test(match[1]))collisions.push(`${name}: tours.eso_server`);
  }
  assert.deepEqual(collisions,[]);
});
