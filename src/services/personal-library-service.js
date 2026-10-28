import {pageWindow} from '../utils/pagination.js';
import {houseTarget,houseTargetKey} from '../utils/house-target.js';
// Each input source performs its own visibility and environment checks.
export async function personalLibrary(workspace,context,{page=1}={}){
 const submitted=[];
 for(let current=1;;current++){
  const result=await workspace.personalCollection(context,{page:current});
  submitted.push(...result.rows);
  if(!result.hasNext)break;
 }
 const saved=await Promise.all(['favorites','wantToVisit','visited'].map(kind=>workspace.actions.personal(context,kind)));
 const destinations=new Map();
 for(const row of [...submitted,...saved.flat()]){
  const key=row.destination_id||row.scope==='official'?houseTargetKey(houseTarget(row)):`registration:${row.id}`;
  if(!destinations.has(key))destinations.set(key,row);
  else if(row.personal_state)destinations.set(key,{...destinations.get(key),personal_state:row.personal_state,is_favorite:row.is_favorite,visit_state:row.visit_state,last_visited_at:row.last_visited_at});
 }
 const rows=[...destinations.values()].sort((a,b)=>String(a.display_name||a.house_name||a.name||'').localeCompare(String(b.display_name||b.house_name||b.name||'')));
 const current=pageWindow(page,rows.length).page;
 return {rows:rows.slice((current-1)*25,current*25),page:current,total:rows.length,hasNext:current*25<rows.length};
}
export class PersonalLibraryService{
 constructor(workspace){this.workspace=workspace;}
 async list(context,{kind='all',page=1}={}){
  if(kind==='all')return personalLibrary(this.workspace,context,{page});
  if(kind==='submitted')return this.workspace.personalCollection(context,{page});
  const rows=await this.workspace.actions.personal(context,kind),current=pageWindow(page,rows.length).page;
  return {rows:rows.slice((current-1)*25,current*25),page:current,total:rows.length,hasNext:current*25<rows.length};
 }
}
