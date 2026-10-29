import {pageWindow} from '../utils/pagination.js';
import {escape} from './render.js';
export function pagination({page=1,total=0,pageSize=25,path,params={},pageParam='page',anchor='',label='Pagination'}){
 const {total:count,pages,page:current}=pageWindow(page,total,pageSize);
 if(pages===1)return `<div class="pagination"><span>${count} records</span></div>`;
 const query=new URLSearchParams(params);query.delete(pageParam);
 const href=number=>{const next=new URLSearchParams(query);next.set(pageParam,number);return `${path}?${next}${anchor?'#'+encodeURIComponent(anchor):''}`;};
 const link=(label,number)=>`<a class="button secondary" href="${escape(href(number))}">${label}</a>`;
 const numbers=[...new Set([1,pages,...Array.from({length:5},(_,i)=>current+i-2).filter(n=>n>=1&&n<=pages)])].sort((a,b)=>a-b);
 let previous=0;
 const links=numbers.map(number=>{const gap=previous&&number-previous>1?'<span class="pagination-ellipsis" aria-hidden="true">…</span>':'';previous=number;return gap+(number===current?`<span class="button" aria-current="page" aria-label="Page ${number}">${number}</span>`:link(String(number),number));}).join('');
 return `<nav class="pagination" aria-label="${escape(label)}"><span>Page ${current} of ${pages} · ${count} records</span><div class="page-links">${current>1?link('Previous',current-1):''}${links}${current<pages?link('Next',current+1):''}</div><form method="get" action="${escape(path+(anchor?'#'+encodeURIComponent(anchor):''))}" class="page-jump">${[...query].map(([name,value])=>`<input type="hidden" name="${escape(name)}" value="${escape(value)}">`).join('')}<label>Jump to page<input name="${escape(pageParam)}" type="number" min="1" max="${pages}" value="${current}" step="1" required></label><button>Go</button></form></nav>`;
}

export function correctedPageLocation(url,page){
 const raw=url.searchParams.get('page');
 if(raw===null||raw===String(page))return null;
 const next=new URL(url);next.searchParams.set('page',String(page));
 return next.pathname+next.search;
}
