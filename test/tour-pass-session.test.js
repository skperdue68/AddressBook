import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import { SharePassService } from '../src/services/share-pass-service.js';
import { SavedHouseService } from '../src/services/saved-house-service.js';
import { TourService } from '../src/services/tour-service.js';
import { TourSessionService } from '../src/services/tour-session-service.js';

test('Tour Pass recipients receive independent sessions and revocation closes only derived sessions',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-tour-pass-session-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'session.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Psijic Villa','grand psijic villa')");
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(63,'Second House','second house')");
    const tours=new TourService(db),sessions=new TourSessionService(db),passes=new SharePassService(db);
    const tour=await tours.create({esoServer:'pc_na',originGuildId:'g1',creatorId:'owner',visibility:'private',sourceGuildId:'g1',name:'Secret Route'});
    await db.query("UPDATE tours SET eso_server='pc_na' WHERE id=?",[tour.id]);
    const house=await new SavedHouseService(db).createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'Owner',createdBy:'owner'});
    await tours.addStop(tour.id,house.id);
    const second=await new SavedHouseService(db).createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:63,esoOwner:'Owner',createdBy:'owner'});
    await tours.addStop(tour.id,second.id);
    const created=await passes.createTourPass({tourId:tour.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na',channelId:'c1'});
    const a=await sessions.startFromPass({passId:created.pass.id,tourId:tour.id,guildId:'g1',channelId:'c1',userId:'a',esoServer:'pc_na'});
    const b=await sessions.startFromPass({passId:created.pass.id,tourId:tour.id,guildId:'g1',channelId:'c1',userId:'b',esoServer:'pc_na'});
    const ordinary=await sessions.startSelfPaced({tourId:tour.id,guildId:'g1',channelId:'c2',userId:'ordinary',esoServer:'pc_na'});
    await sessions.advance(a.id,1,5,{esoServer:'pc_na'});
    assert.equal((await sessions.get(a.id)).current_position,2);
    assert.equal((await sessions.get(b.id)).current_position,1);
    await passes.revokeTourPass(created.pass.id,{actorId:'owner',reason:'Closed'});
    assert.equal(await sessions.get(a.id),null);
    assert.equal(await sessions.get(b.id),null);
    assert.ok(await sessions.get(ordinary.id));
    assert.equal(Number((await one(db,'SELECT count(*) c FROM share_pass_sessions WHERE tour_share_pass_id=? AND closed_at IS NOT NULL',[created.pass.id])).c),2);
  }finally{await closeDatabase(db);}
});
