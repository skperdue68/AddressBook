import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { RegistrationService } from '../src/services/registration-service.js';
import { createHousingMenu } from '../src/ui/housing-menu.js';

test('Administration Pending Review acknowledges the button and opens the server queue',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-pending-review-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'pending.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('guild-1','pc_na')");
    await db.query("INSERT INTO server_moderators(guild_id,discord_user_id,approved_by,request_id,request_revision) VALUES('guild-1','moderator-1','fixture-admin',1,1)");
    await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(1,'Grand Villa','grand villa')");
    await new RegistrationService(db).create({guildId:'guild-1',esoServer:'pc_na',houseId:1,esoOwner:'Owner',displayName:'Open House',createdBy:'submitter-1',status:'pending',scope:'public'});
    const updates=[];
    const interaction={
      customId:'hu:guild:pending',guildId:'guild-1',channelId:'channel-1',
      user:{id:'moderator-1',username:'Moderator'},member:{displayName:'Moderator',roles:{cache:new Map()}},
      update(payload){updates.push(payload);return Promise.resolve(payload);},
      reply(payload){throw new Error(`Unexpected reply: ${payload.content}`);}
    };

    await createHousingMenu(db).button(interaction);

    assert.equal(updates.length,1,'the Discord interaction must be acknowledged');
    const json=JSON.stringify(updates[0].components?.map(row=>row.toJSON?.()||row));
    assert.match(json,/hu:picker:/);
    assert.match(json,/Open House/);
  }finally{await closeDatabase(db);}
});
