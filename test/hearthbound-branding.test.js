import test from 'node:test';import assert from 'node:assert/strict';import {commandJson} from '../src/commands/definitions.js';import {homePayload,helpPayload} from '../src/ui/housing-ui.js';
import {readFile,readdir} from 'node:fs/promises';
test('active runtime uses HearthBound branding while preserving stored compatibility identifiers',async()=>{
 const scan=async dir=>{for(const item of await readdir(dir,{withFileTypes:true})){const file=new URL(item.name+(item.isDirectory()?'/':''),dir);if(item.isDirectory())await scan(file);else if(item.name.endsWith('.js'))assert.doesNotMatch(await readFile(file,'utf8'),/(?<![A-Za-z])AddressBook(?![A-Za-z])|Hearthbound/,file.pathname);}};
 await scan(new URL('../src/',import.meta.url));
 const main=await readFile(new URL('../src/index.js',import.meta.url),'utf8');assert.match(main,/HearthBound web administration listening/);assert.match(main,/HearthBound ready as/);
 const server=await readFile(new URL('../src/web/server.js',import.meta.url),'utf8');assert.match(server,/addressbook_session/);
 const exports=await readFile(new URL('../src/services/data-export-service.js',import.meta.url),'utf8');assert.match(exports,/format: 'addressbook-export'/);
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
 assert.equal(pkg.name,'hearthbound-discord-bot');assert.equal(lock.name,pkg.name);assert.equal(lock.packages[''].name,pkg.name);
});
test('HearthBound primary command retains housing alias and Discord links to configured portal within limits',()=>{assert.deepEqual(commandJson.map(c=>c.name),['hearth','housing']);for(const payload of [homePayload({isAdmin:true,portalUrl:'https://homes.example.test/app'}),helpPayload({portalUrl:'https://homes.example.test/app'})]){const controls=payload.components.flatMap(r=>r.toJSON().components);const link=controls.find(c=>c.label==='Open Web Portal');assert.equal(link.url,'https://homes.example.test/app');assert.equal(link.style,5);assert.ok(payload.components.length<=5);assert.ok(payload.components.every(r=>r.toJSON().components.length<=5));}assert.match(JSON.stringify(homePayload()),/HearthBound/);assert.match(JSON.stringify(homePayload()),/\/hearth/);});
