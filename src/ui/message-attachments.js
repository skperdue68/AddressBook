import {unifiedMessagePayload,messageFlagBits} from './message-layout.js';
import {MessageFlags} from 'discord.js';
// Full message replacements clear uploads; component-only edits retain them.
export function attachmentSafeInteraction(interaction){
 const methods=new Map();let v2=!!(messageFlagBits(interaction.message?.flags)&MessageFlags.IsComponentsV2);
 return new Proxy(interaction,{get(target,key){
  const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;
  if(!methods.has(key)){
   if(['update','editReply','reply','followUp'].includes(key))methods.set(key,payload=>{
    const edit=key==='update'||key==='editReply';
    const full=payload&&typeof payload==='object'&&['embeds','files'].some(name=>Object.hasOwn(payload,name));
    const base=edit&&full?{attachments:[],...payload}:payload;
    const result=unifiedMessagePayload(base,{edit,force:edit&&v2});
    if(key!=='followUp')v2=!!(messageFlagBits(result?.flags)&MessageFlags.IsComponentsV2);
    return value.call(target,result);
   });
   else if(key==='deferReply')methods.set(key,(...args)=>{v2=false;return value.apply(target,args);});
   else methods.set(key,value.bind(target));
  }return methods.get(key);
 }});
}
