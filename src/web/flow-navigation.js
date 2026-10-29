import {escape} from './render.js';

const filters=new Set(['q','scope','page','query','name','nickname','owner','tag','zone','houseType','classification','style','names','owners','tags','zones','houseTypes','classifications','styles','visibility','includeNonPlayer','notOnPublicTours','server','member','cursor','houseId','ownerExact','view','kind']);
export function safeHouseReturn(value){
 if(typeof value!=='string'||value.length>4096||!value.startsWith('/app/')||/[\\\x00-\x20]/.test(value))return null;
 try{
  const url=new URL(value,'https://hearthbound.invalid');
  if(url.origin!=='https://hearthbound.invalid'||url.hash)return null;
  if(!['/app/houses','/app/search','/app/personal','/app/featured'].includes(url.pathname)&&!/^\/app\/personal\/(favorites|wantToVisit|visited|recent|pending|submitted)$/.test(url.pathname)&&!/^\/app\/searches\/\d+\/run$/.test(url.pathname))return null;
  for(const [key,value] of url.searchParams){
   if(key==='listPage'&&/^\/app\/searches\/\d+\/run$/.test(url.pathname)&&/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))&&Number(value)>0)continue;
   if(!filters.has(key))return null;
  }
  return url.pathname+url.search;
 }catch{return null;}
}
export function withHouseReturn(path,value){const returnTo=safeHouseReturn(value);if(!returnTo)return path;const url=new URL(path,'https://hearthbound.invalid');url.searchParams.set('returnTo',returnTo);return url.pathname+url.search+url.hash;}
export const houseFlowHref=(id,returnTo,anchor='')=>withHouseReturn(`/app/houses/${Number(id)}${anchor?'#'+anchor:''}`,returnTo);
export const houseReturnField=value=>safeHouseReturn(value)?`<input type="hidden" name="returnTo" value="${escape(safeHouseReturn(value))}">`:'';
export const houseReturnLabel=value=>safeHouseReturn(value)==='/app/featured'?'Back to Featured Housing':safeHouseReturn(value)?.startsWith('/app/personal')?'Back to My Address Book':'Back to search results';


// A return location can restore a view, never a different authorization context.
export function safeActionReturn(value,depth=0){
 if(typeof value!=='string'||value.length>4096||depth>2||!value.startsWith('/')||/[\\\x00-\x20]/.test(value))return null;
 try{
  const url=new URL(value,'https://hearthbound.invalid');if(url.origin!=='https://hearthbound.invalid')return null;
  const app=/^\/app(?:\/(?:houses|tours)(?:\/\d+(?:\/(?:edit|play))?)?|\/personal(?:\/(?:favorites|wantToVisit|visited|recent|pending|submitted))?|\/(?:search|searches|progress|passes|featured|random|statistics|activity|support|help|feedback|catalog|settings|register)(?:\/\d+(?:\/run)?)?)?$/;
  const admin=/^\/admin(?:\/(?:houses|tours|pending|reports|maintenance|audit|backup))?$/;
  if(!app.test(url.pathname)&&!admin.test(url.pathname))return null;
  if(url.hash&&!/^#[a-zA-Z][a-zA-Z0-9_-]*$/.test(url.hash))return null;
  for(const [key,val] of url.searchParams){
   if(key==='listPage'&&/^\/app\/searches\/\d+\/run$/.test(url.pathname)&&/^\d+$/.test(val)&&Number.isSafeInteger(Number(val))&&Number(val)>0)continue;
   if(key==='returnTo'){if(!safeHouseReturn(val))return null;}
   else if(key==='backTo'){if(!safeActionReturn(val,depth+1))return null;}
   else if(!filters.has(key)&&!['mine','saved','copied','posted','adminReady','metric','addedHouse','started','deleted','status','type','name'].includes(key))return null;
  }
  return url.pathname+url.search+url.hash;
 }catch{return null;}
}
export function withActionReturn(path,value){const backTo=safeActionReturn(value);if(!backTo)return path;const url=new URL(path,'https://hearthbound.invalid');url.searchParams.set('backTo',backTo);return url.pathname+url.search+url.hash;}
export const actionReturnField=value=>safeActionReturn(value)?`<input type="hidden" name="backTo" value="${escape(safeActionReturn(value))}">`:'';
