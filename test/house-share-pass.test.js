import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, migrate, one, openDatabase } from '../src/db/database.js';
import { SavedHouseService } from '../src/services/saved-house-service.js';
import { SharePassService } from '../src/services/share-pass-service.js';
import { createHandlers } from '../src/handlers.js';

async function fixture(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'addressbook-house-pass-'));
  const db=openDatabase({DB_TYPE:'sqlite',DATABASE_PATH:path.join(dir,'pass.sqlite')});
  await migrate(db);
  await db.query("INSERT INTO houses(house_id,name,normalized_name) VALUES(62,'Grand Psijic Villa','grand psijic villa')");
  return {db,houses:new SavedHouseService(db),passes:new SharePassService(db)};
}

test('house pass creates hashed token posts resolves usage and revokes',async()=>{
  const {db,houses,passes}=await fixture();
  try{
    const house=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'HouseOwner',createdBy:'owner'});
    const created=await passes.createHousePass({savedHouseId:house.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na',channelId:'c1'});
    assert.ok(created.token);
    const stored=await one(db,'SELECT * FROM house_share_passes WHERE id=?',[created.pass.id]);
    assert.notEqual(stored.token_hash,created.token);
    assert.equal(stored.token_hash.length,64);
    await passes.markHousePassPosted(created.pass.id,{guildId:'g1',channelId:'c1',messageId:'m1',channelName:'housing'});
    const resolved=await passes.resolveHousePass(created.token,{userId:'viewer',guildId:'g1',esoServer:'pc_na'});
    assert.equal(resolved.house.id,house.id);
    assert.equal(resolved.access.passOnly,true);
    assert.equal(Number((await one(db,'SELECT usage_count c FROM house_share_passes WHERE id=?',[created.pass.id])).c),1);
    await passes.revokeHousePass(created.pass.id,{actorId:'owner',reason:'Done sharing'});
    await assert.rejects(()=>passes.resolveHousePass(created.token,{userId:'viewer',guildId:'g1',esoServer:'pc_na'}),/revoked by its owner/i);
  }finally{await closeDatabase(db);}
});

test('Private house pass creation and management remain owner-only',async()=>{
  const {db,houses,passes}=await fixture();
  try{
    const house=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'HouseOwner',createdBy:'owner'});
    await assert.rejects(()=>passes.createHousePass({savedHouseId:house.id,createdBy:'viewer',originGuildId:'g1',esoServer:'pc_na',channelId:'c1'}),/normal access|owner/i);
    const created=await passes.createHousePass({savedHouseId:house.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na',channelId:'c1'});
    await assert.rejects(()=>passes.revokeHousePass(created.pass.id,{actorId:'viewer'}),/creator|owner/i);
    assert.equal((await one(db,'SELECT status FROM house_share_passes WHERE id=?',[created.pass.id])).status,'active');
  }finally{await closeDatabase(db);}
});

test('issuing House Share Passes still obeys the creation rate limit',async()=>{
  const {db,houses,passes}=await fixture();
  try{
    const house=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'HouseOwner',createdBy:'owner'});
    for(let attempt=0;attempt<5;attempt++)await passes.createHousePass({savedHouseId:house.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na'});
    await assert.rejects(()=>passes.createHousePass({savedHouseId:house.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na'}),/Please wait/);
  }finally{await closeDatabase(db);}
});

test('pass lookup uses its own abuse limit without consuming the creation quota',async()=>{
  const {db,houses}=await fixture();
  try{
    const passes=new SharePassService(db,{settings:{share:{limit:1,windowMs:300000},shareAccess:{limit:2,windowMs:300000}}});
    const house=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'HouseOwner',createdBy:'owner'});
    const {token}=await passes.createHousePass({savedHouseId:house.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na'});
    await passes.resolveHousePass(token,{userId:'owner',guildId:'g1',esoServer:'pc_na'});
    await passes.resolveHousePass(token,{userId:'owner',guildId:'g1',esoServer:'pc_na'});
    await assert.rejects(()=>passes.resolveHousePass(token,{userId:'owner',guildId:'g1',esoServer:'pc_na'}),/opening another Share Pass screen/);
  }finally{await closeDatabase(db);}
});

test('reposting rotates token and makes surviving old cards stale',async()=>{
  const {db,houses,passes}=await fixture();
  try{
    const house=await houses.createGlobal({esoServer:'pc_na',originGuildId:'g1',houseId:62,esoOwner:'HouseOwner',createdBy:'owner'});
    const created=await passes.createHousePass({savedHouseId:house.id,createdBy:'viewer',originGuildId:'g1',esoServer:'pc_na',channelId:'c1'});
    const reposted=await passes.repostHousePass(created.pass.id,{actorId:'viewer',guildId:'g1',channelId:'c2',messageId:'m2'});
    assert.notEqual(reposted.token,created.token);
    await assert.rejects(()=>passes.resolveHousePass(created.token,{userId:'recipient',guildId:'g1',esoServer:'pc_na'}),/no longer connected|stale/i);
    assert.equal((await passes.resolveHousePass(reposted.token,{userId:'recipient',guildId:'g1',esoServer:'pc_na'})).house.id,house.id);
  }finally{await closeDatabase(db);}
});

test('deleted shared house leaves pass audit but cannot be opened',async()=>{
  const {db,houses,passes}=await fixture();
  try{
    const house=await houses.createGlobal({esoServer:'pc_na',originGuildId:'g1',houseId:62,esoOwner:'HouseOwner',createdBy:'owner'});
    const created=await passes.createHousePass({savedHouseId:house.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na',channelId:'c1'});
    await houses.delete(house.id,'owner');
    assert.equal((await one(db,'SELECT saved_house_id FROM house_share_passes WHERE id=?',[created.pass.id])).saved_house_id,null);
    await assert.rejects(()=>passes.resolveHousePass(created.token,{userId:'recipient',guildId:'g1',esoServer:'pc_na'}),/no longer available/i);
  }finally{await closeDatabase(db);}
});

test('House Share Pass comments open and return to the private pass',async()=>{
  const {db,houses,passes}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const house=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'HouseOwner',createdBy:'owner'});
    const {token}=await passes.createHousePass({savedHouseId:house.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na'});
    const handlers=createHandlers(db);
    const interact=async customId=>{let response;await handlers.button({customId,guildId:'g1',user:{id:'viewer',username:'Viewer'},member:{roles:{cache:new Map()}},message:{flags:{has:()=>true}},update:p=>{response=p;},reply:p=>{response=p;}});return response;};
    const comments=await interact(`hu:pass:house:comments:${token}`);
    assert.match(JSON.stringify(comments?.embeds),/Comments/);
    const buttons=comments.components.flatMap(row=>row.toJSON().components);
    assert.ok(buttons.some(button=>button.label==='Add Comment'&&button.custom_id.startsWith('hu:discussion:add:')));
    assert.ok(buttons.some(button=>button.custom_id===`hu:pass:house:view:${token}`));
  }finally{await closeDatabase(db);}
});

test('House Share Pass Add Comment opens a modal for the visitor',async()=>{
  const {db,houses,passes}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const house=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'HouseOwner',createdBy:'owner'});
    const {token}=await passes.createHousePass({savedHouseId:house.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na'});
    let modal;
    await createHandlers(db).button({customId:`hu:pass:house:comment:add:${token}`,guildId:'g1',user:{id:'viewer'},member:{roles:{cache:new Map()}},showModal:m=>{modal=m;}});
    assert.equal(modal?.toJSON().custom_id,`hu:modal:pass:house:comment:${token}`);
  }finally{await closeDatabase(db);}
});

test('House Share Pass visitor comment submits and appears in the pass comments',async()=>{
  const {db,houses,passes}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const house=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'HouseOwner',createdBy:'owner'});
    const {token}=await passes.createHousePass({savedHouseId:house.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na'});
    let result;
    await createHandlers(db).modal({customId:`hu:modal:pass:house:comment:${token}`,guildId:'g1',user:{id:'viewer',username:'Viewer'},member:{roles:{cache:new Map()}},fields:{getTextInputValue:()=> 'Lovely place'},reply:p=>{result=p;}});
    assert.match(JSON.stringify(result?.embeds),/Lovely place/);
    assert.equal((await db.query("SELECT count(*) c FROM house_comments WHERE discord_user_id='viewer'"))[0].c,1);
    await passes.revokeHousePass((await db.query('SELECT id FROM house_share_passes'))[0].id,{actorId:'owner'});
    result=null;
    await createHandlers(db).modal({customId:`hu:modal:pass:house:comment:${token}`,guildId:'g1',user:{id:'viewer',username:'Viewer'},member:{roles:{cache:new Map()}},fields:{getTextInputValue:()=> 'Should be rejected'},reply:p=>{result=p;}});
    assert.match(result?.content,/revoked/i);
    assert.equal((await db.query("SELECT count(*) c FROM house_comments WHERE discord_user_id='viewer'"))[0].c,1);
  }finally{await closeDatabase(db);}
});

test('House Share Pass More Details toggles on and off',async()=>{
  const {db,houses,passes}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const house=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'HouseOwner',createdBy:'owner'});
    const {token}=await passes.createHousePass({savedHouseId:house.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na'});
    let response;
    const handlers=createHandlers(db);
    for(const id of [`hu:pass:house:details:${token}`,`hu:pass:house:details:hide:${token}`]){
      await handlers.button({customId:id,guildId:'g1',user:{id:'viewer'},member:{roles:{cache:new Map()}},message:{flags:{has:()=>true}},update:p=>{response=p;}});
      const labels=response?.components.flatMap(row=>row.toJSON().components.map(button=>button.label));
      assert.ok(labels?.includes(id.includes(':hide:')?'More Details':'Hide Details'));
    }
  }finally{await closeDatabase(db);}
});

test('House Share Pass copy cancellation returns to the private house in the same message',async()=>{
  const {db,houses,passes}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const house=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'HouseOwner',createdBy:'owner'});
    const {token}=await passes.createHousePass({savedHouseId:house.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na'});
    let method, response;
    await createHandlers(db).button({customId:`hu:pass:house:view:${token}`,guildId:'g1',user:{id:'viewer'},member:{roles:{cache:new Map()}},message:{flags:{has:()=>true}},update:p=>{method='update';response=p;},reply:p=>{method='reply';response=p;}});
    assert.equal(method,'update');
    assert.match(JSON.stringify(response?.embeds),/Shared Private access/);
  }finally{await closeDatabase(db);}
});

for(const [name,customId] of [
  ['opening the house',token=>`hu:pass:house:view:${token}`],
  ['reading comments',token=>`hu:pass:house:comments:${token}`],
  ['toggling details',token=>`hu:pass:house:details:${token}`],
  ['reviewing a copy',token=>`hu:pass:house:copy:${token}`]
])test(`House Share Pass ${name} stays available after five screen visits`,async()=>{
  const {db,houses,passes}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const house=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'HouseOwner',createdBy:'owner'});
    const {token}=await passes.createHousePass({savedHouseId:house.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na'});
    const handlers=createHandlers(db);
    for(let attempt=0;attempt<7;attempt++){
      let response;
      await handlers.button({customId:customId(token),guildId:'g1',user:{id:'viewer',username:'Viewer'},member:{roles:{cache:new Map()}},message:{flags:{has:()=>true}},update:p=>{response=p;},reply:p=>{response=p;}});
      assert.ok(response?.embeds?.length,`attempt ${attempt+1}: ${response?.content}`);
    }
  }finally{await closeDatabase(db);}
});


for(const target of ['channel','thread','link','send-failure','record-failure'])test(`House Share Pass destination flow: ${target}`,async()=>{
  const {db,houses}=await fixture();
  try{
    await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");
    const house=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'HouseOwner',createdBy:'owner'});
    let sent=0,response;
    const parent={id:'parent',name:'Housing',guildId:'g1',type:0,isThread:()=>false,permissionsFor:()=>({has:()=>true}),send:async()=>{sent++;if(target==='send-failure')throw new Error('Missing Access');return {id:'message'};}};
    const thread={...parent,id:'thread',name:'Open houses',type:11,parentId:'parent',isThread:()=>true};
    parent.threads={fetchActive:async()=>({threads:new Map([['thread',thread]])})};
    const channels=new Map([['parent',parent],['thread',thread]]);
    const handlers=createHandlers(db);
    const interaction=(customId,values=[])=>({customId,values,guildId:'g1',user:{id:'owner',username:'Owner'},member:{roles:{cache:new Map()}},guild:{id:'g1',name:'Test',members:{fetch:async()=>({id:'owner',displayName:'Owner'}),fetchMe:async()=>({id:'bot'})},channels:{fetch:async id=>id?channels.get(id):channels}},deferUpdate:async()=>{},editReply:async p=>{response=p;}});
    await handlers.button(interaction(`hu:pass:house:share:${house.id}`));
    assert.ok(response.components.flatMap(r=>r.toJSON().components).some(c=>c.custom_id===`hu:pass:house:channel:${house.id}`));
    if(target==='link'){
      const i=interaction(`hu:modal:housedestination:${house.id}`);
      i.fields={getTextInputValue:()=> '123'};channels.set('123',parent);
      await handlers.modal(i);
    }else await handlers.select(interaction(`hu:pass:house:channel:${house.id}`,['parent']));
    assert.equal(sent,0);
    assert.equal((await one(db,'SELECT count(*) c FROM house_share_passes')).c,0);
    const action=target==='thread'?'thread':'confirm',dest=target==='thread'?'thread':'parent';
    await handlers[target==='thread'?'select':'button'](interaction(`hu:pass:house:${action}:${house.id}:parent`,target==='thread'?['thread']:[]));
    assert.equal(sent,0);
    assert.ok(response.components.flatMap(r=>r.toJSON().components).some(c=>c.custom_id===`hu:pass:house:post:${house.id}:${dest}`));
    if(target==='record-failure'){
      const query=db.query.bind(db);
      db.query=(sql,...args)=>sql.startsWith('UPDATE house_share_passes SET origin_guild_id')?Promise.reject(new Error('Write failed')):query(sql,...args);
    }
    await handlers.button(interaction(`hu:pass:house:post:${house.id}:${dest}`));
    assert.equal(sent,1);
    const pass=await one(db,'SELECT * FROM house_share_passes');
    assert.equal(pass.channel_id,dest);
    if(target==='send-failure'){
      assert.equal(pass.status,'revoked');assert.match(response.content,/Missing Access/);
      assert.ok(response.components.flatMap(r=>r.toJSON().components).some(c=>c.label==='Back to Channels'));
    }else if(target==='record-failure'){
      assert.equal(pass.status,'active');assert.equal(pass.message_id,null);assert.match(response.content,/Please do not repost/);
    }else{assert.equal(pass.message_id,'message');assert.equal(pass.status,'active');assert.match(response.content,/House Share Pass posted/);}
  }finally{await closeDatabase(db);}
});

test('direct Private pass comment revalidates revocation before posting',async()=>{
 const {db,houses,passes}=await fixture();try{await db.query("INSERT INTO guild_settings(guild_id,eso_server) VALUES('g1','pc_na')");const house=await houses.createPrivate({esoServer:'pc_na',originGuildId:'g1',userId:'owner',houseId:62,esoOwner:'HouseOwner',createdBy:'owner'}),created=await passes.createHousePass({savedHouseId:house.id,createdBy:'owner',originGuildId:'g1',esoServer:'pc_na'}),handlers=createHandlers(db);let payload,modal;const base={guildId:'g1',channelId:'c',guild:{name:'Guild'},user:{id:'viewer'},member:{roles:{cache:new Map()}},update:async p=>payload=p,reply:async p=>payload=p,showModal:async p=>modal=p};await handlers.button({...base,customId:'hu:pass:house:view:'+created.token,message:{flags:{has:()=>true}}});const original=payload,controls=p=>p.components.flatMap(r=>(r.toJSON?.()||r).components),add=controls(original).find(c=>c.label==='Add Comment');assert.ok(add);await handlers.button({...base,customId:add.custom_id,message:{embeds:original.embeds,components:original.components}});assert.ok(modal,payload.content);await passes.revokeHousePass(created.pass.id,{actorId:'owner'});await handlers.modal({...base,customId:modal.toJSON().custom_id,fields:{getTextInputValue:()=> 'Denied'},isFromMessage:()=>true});assert.match(payload.content,/revoked/);assert.equal((await one(db,'SELECT count(*) n FROM house_comments')).n,0);
 }finally{await closeDatabase(db);}
});
