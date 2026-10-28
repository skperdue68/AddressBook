import test from 'node:test';import assert from 'node:assert/strict';
import {attachmentSafeInteraction} from '../src/ui/message-attachments.js';
test('message updates clear stale image attachments while explicit retention and new replies are preserved',async()=>{
 class Interaction{#marker='bound';get marker(){return this.#marker;}async update(payload){assert.equal(this.#marker,'bound');return payload;}async editReply(payload){return payload;}async reply(payload){return payload;}}
 const source=new Interaction(),i=attachmentSafeInteraction(source);assert.equal(i.marker,'bound');assert.deepEqual(await i.update({content:'Main menu'}),{attachments:[],content:'Main menu'});assert.deepEqual(await i.editReply({embeds:[]}),{attachments:[],embeds:[]});assert.deepEqual(await i.update({attachments:[{id:'123'}],content:'Comment added'}),{attachments:[{id:'123'}],content:'Comment added'});assert.deepEqual(await i.reply({content:'New message'}),{content:'New message'});
});
