// Discord retains old uploads on edits unless attachments are explicitly cleared.
export function attachmentSafeInteraction(interaction){
 const methods=new Map();
 return new Proxy(interaction,{get(target,key){
  const value=Reflect.get(target,key,target);
  if(typeof value!=='function')return value;
  if(!methods.has(key))methods.set(key,['update','editReply'].includes(key)
   ?payload=>value.call(target,payload&&typeof payload==='object'?{attachments:[],...payload}:payload)
   :value.bind(target));
  return methods.get(key);
 }});
}
