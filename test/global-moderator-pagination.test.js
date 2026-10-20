import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {closeDatabase,migrate,openDatabase} from '../src/db/database.js';
import {createHandlers} from '../src/handlers.js';

test('approver can page to and approve a request from another guild',async()=>{
  const prior=process.env.GLOBAL_MODERATOR_APPROVER_USER_IDS;
  process.env.GLOBAL_MODERATOR_APPROVER_USER_IDS='approver';
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-mod-pages-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'mods.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    for(let n=1;n<=26;n++)await db.query('INSERT INTO global_moderator_requests(eso_server,discord_user_id,origin_guild_id,reason) VALUES(?,?,?,?)',['pc_na',`user${n}`,n===26?'g2':'g1','Help moderate']);
    const handlers=createHandlers(db);let rendered;
    const i=(customId,values)=>({customId,values,guildId:'g1',channelId:'c1',guild:{name:'First Guild'},user:{id:'approver',username:'Approver'},member:{displayName:'Approver',roles:{cache:{has:()=>false}}},update:p=>{rendered=p;},reply:p=>{rendered=p;}});
    await handlers.button(i('hu:globalmod:requests'));
    let controls=rendered.components.flatMap(row=>row.toJSON().components);
    assert.equal(controls.find(c=>c.type===3).options.length,25);
    const next=controls.find(c=>c.label==='Next');assert.ok(next&&!next.disabled);
    await handlers.button(i(next.custom_id));
    controls=rendered.components.flatMap(row=>row.toJSON().components);
    const picker=controls.find(c=>c.type===3);assert.equal(picker.options.length,1);
    await handlers.select(i(picker.custom_id,[picker.options[0].value]));
    assert.match(rendered.embeds[0].toJSON().description,/g2/);
    const approve=rendered.components.flatMap(row=>row.toJSON().components).find(c=>c.label==='Approve');
    await handlers.button(i(approve.custom_id));
    const grants=await db.query("SELECT * FROM global_moderators WHERE discord_user_id='user26'");
    assert.equal(grants.length,1);
  }finally{
    await closeDatabase(db);
    if(prior===undefined)delete process.env.GLOBAL_MODERATOR_APPROVER_USER_IDS;
    else process.env.GLOBAL_MODERATOR_APPROVER_USER_IDS=prior;
  }
});

test('approver can page to and revoke the twenty sixth environment grant',async()=>{
  const prior=process.env.GLOBAL_MODERATOR_APPROVER_USER_IDS;
  process.env.GLOBAL_MODERATOR_APPROVER_USER_IDS='approver';
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-grant-pages-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'mods.sqlite')});
  try{
    await migrate(db);
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    for(let n=1;n<=26;n++)await db.query('INSERT INTO global_moderators(discord_user_id,eso_server,approved_by) VALUES(?,?,?)',[`user${String(n).padStart(2,'0')}`,'pc_na','approver']);
    const handlers=createHandlers(db);let rendered;
    const i=(customId,values)=>({customId,values,guildId:'g1',channelId:'c1',guild:{name:'Guild'},user:{id:'approver',username:'Approver'},member:{displayName:'Approver',roles:{cache:{has:()=>false}}},update:p=>{rendered=p;},reply:p=>{rendered=p;}});
    await handlers.button(i('hu:globalmod:list'));
    let buttons=rendered.components.flatMap(row=>row.toJSON().components);
    const next=buttons.find(c=>c.label==='Next');assert.ok(next&&!next.disabled);
    await handlers.button(i(next.custom_id));
    buttons=rendered.components.flatMap(row=>row.toJSON().components);
    const picker=buttons.find(c=>c.type===3);assert.equal(picker.options.length,1);
    assert.match(picker.options[0].value,/user26|user26/i);
    await handlers.select(i(picker.custom_id,[picker.options[0].value]));
    const revoke=rendered.components.flatMap(row=>row.toJSON().components).find(c=>c.label==='Confirm');
    await handlers.button(i(revoke.custom_id));
    assert.equal((await db.query("SELECT * FROM global_moderators WHERE discord_user_id='user26'")).length,0);
  }finally{
    await closeDatabase(db);
    if(prior===undefined)delete process.env.GLOBAL_MODERATOR_APPROVER_USER_IDS;
    else process.env.GLOBAL_MODERATOR_APPROVER_USER_IDS=prior;
  }
});
