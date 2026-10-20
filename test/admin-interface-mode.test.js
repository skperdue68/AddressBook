import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, openDatabase } from '../src/db/database.js';
import { adminInterfaceMode } from '../src/config/admin-interface.js';
import { webAdminConfig } from '../src/web/config.js';
import { createHousingMenu } from '../src/ui/housing-menu.js';
import { homePayload } from '../src/ui/housing-ui.js';

test('admin interface mode defaults to both and rejects invalid values', () => {
  assert.equal(adminInterfaceMode({}), 'both');
  assert.equal(adminInterfaceMode({ ADMIN_INTERFACE: 'web' }), 'web');
  assert.equal(adminInterfaceMode({ ADMIN_INTERFACE: 'discord' }), 'discord');
  assert.equal(adminInterfaceMode({ ADMIN_INTERFACE: 'unexpected' }), 'both');
});

test('web-only administration requires the companion web server', () => {
  assert.throws(() => webAdminConfig({ ADMIN_INTERFACE: 'web' }), /WEB_ADMIN_ENABLED=true/);
  assert.equal(webAdminConfig({ ADMIN_INTERFACE: 'discord', WEB_ADMIN_ENABLED: 'true' }).enabled, false);
});

test('web-only mode retains Discord access to administrative tools without web equivalents', () => {
  const payload = homePayload({ isAdmin: true, adminInterface: 'web' });
  const ids = payload.components.flatMap(row => row.toJSON().components).map(component => component.custom_id);
  assert.equal(ids.includes('hu:admin'), true);
});

test('web-only mode keeps Discord-only settings while directing reports and migrated tools to web', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addressbook-admin-mode-'));
  const db = openDatabase({ DB_TYPE: 'sqlite', DATABASE_PATH: path.join(dir, 'mode.sqlite') });
  try {
    await migrate(db);
    await db.query("INSERT INTO guild_settings(guild_id,guild_name,eso_server,staff_role_ids) VALUES('g1','Guild One','pc_na','[]')");
    const menu = createHousingMenu(db, { adminInterface: 'web' });
    let reply, updated;
    const interaction = {
      guildId: 'g1', channelId: 'c1', user: { id: 'u1', username: 'User' }, guild: { name: 'Guild One' },
      member: { displayName: 'User', roles: { cache: new Map() } },
      reply: async payload => { reply = payload; }, update: async payload => { updated = payload; }
    };
    await menu.button({ ...interaction, customId: 'hu:home' });
    const homeIds = updated.components.flatMap(row => row.toJSON().components).map(component => component.custom_id);
    assert.ok(homeIds.includes('hu:admin'));
    updated = undefined;
    await menu.button({
      ...interaction, customId: 'hu:admin'
    });
    assert.ok(updated?.components);
    const options = updated.components.flatMap(row => row.toJSON().components).flatMap(component => component.options || []).map(option => option.value);
    assert.ok(options.includes('environment'));
    for (const moved of ['health', 'audit', 'maintenance', 'export', 'pending', 'reports']) assert.equal(options.includes(moved), false);
    updated = undefined;
    await menu.button({ ...interaction, customId: 'hu:admin:settings' });
    assert.ok(updated?.components);
    updated = undefined;
    await menu.button({ ...interaction, customId: 'hu:admin:health' });
    assert.match(reply.content, /web administration console/i);
    assert.equal(updated, undefined);
    reply = undefined;
    await menu.select({ ...interaction, customId: 'hu:admin:tool', values: ['export'] });
    assert.match(reply.content, /web administration console/i);
  } finally {
    await closeDatabase(db);
  }
});

test('web-only mode blocks stale buttons and selectors for all migrated tools',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-admin-stale-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'mode.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO guild_settings(guild_id,guild_name,eso_server,staff_role_ids) VALUES('g1','Guild One','pc_na','[]')");
    const menu=createHousingMenu(db,{adminInterface:'web'});let reply,updated;
    const interaction={guildId:'g1',channelId:'c1',user:{id:'u1',username:'User'},guild:{name:'Guild'},member:{displayName:'User',roles:{cache:new Map()}},reply:async p=>{reply=p;},update:async p=>{updated=p;}};
    for(const id of ['hu:admin:health','hu:admin:audit','hu:admin:export','hu:admin:maintenance','hu:admin:reports','hu:guild:pending']){
      reply=undefined;updated=undefined;
      await menu.button({...interaction,customId:id});
      assert.match(reply?.content||'',/web administration console/i,id);
      assert.equal(updated,undefined,id);
    }
    for(const id of ['hu:admin:maintenance:verify','hu:admin:maintenance:merge']){
      reply=undefined;updated=undefined;
      await menu.select({...interaction,customId:id,values:['1']});
      assert.match(reply?.content||'',/web administration console/i,id);
      assert.equal(updated,undefined,id);
    }
    await menu.button({...interaction,customId:'hu:admin:settings'});
    assert.ok(updated?.components);
  }finally{await closeDatabase(db);}
});
