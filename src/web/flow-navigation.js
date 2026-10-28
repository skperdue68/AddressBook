import {escape} from './render.js';

const filters=new Set(['q','scope','page','query','name','nickname','owner','tag','zone','houseType','classification','style','names','owners','tags','zones','houseTypes','classifications','styles','visibility','includeNonPlayer','notOnPublicTours']);
export function safeHouseReturn(value){
 if(typeof value!=='string'||value.length>4096||!value.startsWith('/app/')||/[\\\x00-\x20]/.test(value))return null;
 try{
  const url=new URL(value,'https://hearthbound.invalid');
  if(url.origin!=='https://hearthbound.invalid'||url.hash)return null;
  if(!['/app/houses','/app/search','/app/personal'].includes(url.pathname)&&!/^\/app\/personal\/(favorites|wantToVisit|visited|recent|pending)$/.test(url.pathname)&&!/^\/app\/searches\/\d+\/run$/.test(url.pathname))return null;
  for(const key of url.searchParams.keys())if(!filters.has(key))return null;
  return url.pathname+url.search;
 }catch{return null;}
}
export function withHouseReturn(path,value){const returnTo=safeHouseReturn(value);if(!returnTo)return path;const url=new URL(path,'https://hearthbound.invalid');url.searchParams.set('returnTo',returnTo);return url.pathname+url.search+url.hash;}
export const houseFlowHref=(id,returnTo,anchor='')=>withHouseReturn(`/app/houses/${Number(id)}${anchor?'#'+anchor:''}`,returnTo);
export const houseReturnField=value=>safeHouseReturn(value)?`<input type="hidden" name="returnTo" value="${escape(safeHouseReturn(value))}">`:'';
export const houseReturnLabel=value=>safeHouseReturn(value)?.startsWith('/app/personal')?'Back to My Address Book':'Back to search results';
