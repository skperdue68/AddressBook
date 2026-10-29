import {MessageFlags} from 'discord.js';
export const UNIFIED_CARD=Symbol('hearthbound.unified-card');
const COMMENT_ID=50000;
const data=value=>value?.toJSON?.()||value;
export const unifiedCard=payload=>({...payload,[UNIFIED_CARD]:true});
export const messageFlagBits=value=>Number(value?.bitfield??value??0)||0;
export function mapMessageControls(components,change){
 return (components||[]).map(raw=>{let node={...data(raw)};if(node.components)node.components=mapMessageControls(node.components,change);if(node.accessory)node.accessory=mapMessageControls([node.accessory],change)[0];return node.custom_id?change(node):node;});
}
export function messageControls(components){
 const out=[];const visit=nodes=>{for(const raw of nodes||[]){const node=data(raw);if(node.custom_id)out.push(node);if(node.components)visit(node.components);if(node.accessory)visit([node.accessory]);}};visit(components);return out;
}
export function refreshComponentCommentCount(components,count){
 const visit=nodes=>(nodes||[]).map(raw=>{const node={...data(raw)};if(node.type===10&&node.id>=COMMENT_ID&&node.id<COMMENT_ID+10)node.content=`**💬 Comments**\n${count} comment${count===1?'':'s'}`;if(node.components)node.components=visit(node.components);return node;});return visit(components);
}
// Keep each logical field/code block together; only oversized descriptions split.
function pieces(value){
 const text=String(value||'');if(text.length<=4000)return text?[text]:[];
 const result=[];let remaining=text,openFence='';
 while(remaining.length>3900){let end=remaining.lastIndexOf('\n',3850);if(end<1900)end=remaining.lastIndexOf(' ',3850);if(end<1900)end=3850;
  const chunk=remaining.slice(0,end),fences=[...chunk.matchAll(/^```([^\n]*)/gm)];let fence=openFence;for(const match of fences)fence=fence?'':match[0];
  result.push((openFence?openFence+'\n':'')+chunk+(fence?'\n```':''));openFence=fence;remaining=remaining.slice(end);
 }
 if(remaining)result.push((openFence?openFence+'\n':'')+remaining);return result;
}
export function unifiedMessagePayload(payload,{edit=false,force=false}={}){
 if(!payload||typeof payload!=='object')return payload;
 const {[UNIFIED_CARD]:marked,...rest}=payload;
 if(!marked&&!force&&!(messageFlagBits(rest.flags)&MessageFlags.IsComponentsV2))return rest;
 const rows=(rest.components||[]).map(data),native=rows.some(row=>row.type!==1);
 let components;
 if(native){components=rest.content?[{type:10,content:String(rest.content)},...rows]:rows;}
 else{
  const children=[],embeds=(rest.embeds||[]).map(data),media=embeds.flatMap(e=>e.image?.url?[{media:{url:e.image.url},...(e.image.description?{description:e.image.description}:{})}]:[]);
  if(media.length)children.push({type:12,items:media.slice(0,10)});
  let buffer='';const flush=()=>{if(buffer){children.push({type:10,content:buffer});buffer='';}};
  const append=value=>{for(const part of pieces(value)){if(buffer.length+part.length+2>4000)flush();buffer+=(buffer?'\n\n':'')+part;}};
  if(rest.content)append(rest.content);
  embeds.forEach((embed,index)=>{
   if(embed.author?.name)append(embed.author.name);
   if(embed.title)append(`## ${embed.url?`[${embed.title}](${embed.url})`:embed.title}`);
   if(embed.description)append(embed.description);
   for(const field of embed.fields||[]){if(field.name==='💬 Comments'){flush();children.push({type:10,id:COMMENT_ID+index,content:`**${field.name}**\n${field.value}`});}else append(`**${field.name}**\n${field.value}`);}
   if(embed.footer?.text)append(`-# ${embed.footer.text}`);
   if(embed.timestamp)append(`-# ${embed.timestamp}`);
  });flush();children.push(...rows);
  components=children.length?[{type:17,accent_color:embeds.find(e=>e.color!==undefined)?.color??0x5865f2,components:children}]:[];
 }
 const count=nodes=>nodes.reduce((n,raw)=>{const c=data(raw);return n+1+count(c.components||[])+(c.accessory?count([c.accessory]):0);},0);
 if(count(components)>40)throw new Error('This Discord screen has too many controls. Reopen HearthBound to continue.');
 const {content:ignoredContent,embeds:ignoredEmbeds,poll:ignoredPoll,stickers:ignoredStickers,...options}=rest;
 return {...options,flags:messageFlagBits(rest.flags)|MessageFlags.IsComponentsV2,allowedMentions:{parse:[],repliedUser:false},components,...(edit?{content:null,embeds:[],poll:null}:{} )};
}
