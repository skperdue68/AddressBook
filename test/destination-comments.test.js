import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import { CommentService } from '../src/services/comment-service.js';
import { DestinationService } from '../src/services/destination-service.js';
import { SavedHouseService } from '../src/services/saved-house-service.js';
import { commentsPayload } from '../src/ui/housing-ui.js';

async function fixture(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-destination-comments-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'comments.sqlite')});
  await migrate(db);
  await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Psijic Villa','grand psijic villa')");
  return db;
}

test('owner spelling and leading at-sign resolve to one housing destination',async()=>{
  const db=await fixture();
  try{
    const destinations=new DestinationService(db);
    const a=await destinations.resolve({esoServer:'pc_na',esoOwner:'@HouseOwner',houseId:62});
    const b=await destinations.resolve({esoServer:'pc_na',esoOwner:'houseowner',houseId:62});
    const c=await destinations.resolve({esoServer:'pc_na',esoOwner:'HOUSEOWNER',houseId:62});
    assert.equal(a.id,b.id);
    assert.equal(b.id,c.id);
    assert.equal(a.normalized_owner,'houseowner');
    assert.equal(Number((await one(db,'SELECT count(*) c FROM housing_destinations')).c),1);
  }finally{await closeDatabase(db);}
});

test('comments are shared across saved entries and survive deletion of one entry',async()=>{
  const db=await fixture();
  try{
    const houses=new SavedHouseService(db),comments=new CommentService(db);
    const personal=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'u3',houseId:62,esoOwner:'houseowner',displayName:'Private Villa',createdBy:'u3'});
    const server=await houses.createPublic({esoServer:'pc_na',guildId:'g1',houseId:62,esoOwner:'HOUSEOWNER',displayName:'Server Villa',createdBy:'u2'});
    const global=await houses.createGlobal({esoServer:'pc_na',originGuildId:'g1',houseId:62,esoOwner:'@HouseOwner',displayName:'Global Villa',createdBy:'u1'});
    await comments.add({esoServer:'pc_na',savedHouseId:global.id,commenterUserId:'u4',text:'global view'});
    await comments.add({esoServer:'pc_na',savedHouseId:server.id,commenterUserId:'u5',text:'server view'});
    await comments.add({esoServer:'pc_na',savedHouseId:personal.id,commenterUserId:'u6',text:'private view'});

    for(const entry of [global,server,personal]){
      assert.equal(await comments.count(entry.scope,entry.id,'pc_na'),3);
      assert.deepEqual(new Set((await comments.list(entry.scope,entry.id,10,'pc_na')).map(row=>row.comment_text)),new Set(['global view','server view','private view']));
    }

    await houses.delete(global.id,'u1');
    assert.equal(await comments.count(server.scope,server.id,'pc_na'),3);
    assert.equal(Number((await one(db,'SELECT count(*) c FROM housing_destinations')).c),1);
    assert.equal(Number((await one(db,'SELECT count(*) c FROM house_comments')).c),3);
  }finally{await closeDatabase(db);}
});

test('comments screen discloses that comments belong to the ESO destination',()=>{
  const payload=commentsPayload({label:'Grand Psijic Villa',owner:'@HouseOwner',rows:[],scope:'global',id:1,backId:'hu:find'});
  const description=payload.embeds[0].toJSON().description;
  assert.match(description,/comments apply to this ESO destination/i);
  assert.match(description,/other saved entries/i);
});
