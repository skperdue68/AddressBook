import {escape} from './render.js';
export function pagination({page=1,total=0,pageSize=25,path,params={}}){
 const count=Math.max(0,Math.floor(Number(total)||0)),size=Math.max(1,Math.floor(Number(pageSize)||25)),pages=Math.max(1,Math.ceil(count/size)),current=Math.min(pages,Math.max(1,Math.floor(Number(page)||1)));
 if(pages===1)return `<div class="pagination"><span>${count} records</span></div>`;
 const query=new URLSearchParams(params);query.delete('page');
 const href=number=>{const next=new URLSearchParams(query);next.set('page',number);return `${path}?${next}`;};
 const link=(label,number)=>`<a class="button secondary" href="${escape(href(number))}">${label}</a>`;
 const numbers=[...new Set([1,pages,...Array.from({length:5},(_,i)=>current+i-2).filter(n=>n>=1&&n<=pages)])].sort((a,b)=>a-b);
 let previous=0;
 const links=numbers.map(number=>{const gap=previous&&number-previous>1?'<span class="pagination-ellipsis" aria-hidden="true">…</span>':'';previous=number;return gap+(number===current?`<span class="button" aria-current="page" aria-label="Page ${number}">${number}</span>`:link(String(number),number));}).join('');
 return `<nav class="pagination" aria-label="Pagination"><span>Page ${current} of ${pages} · ${count} records</span><div class="page-links">${current>1?link('Previous',current-1):''}${links}${current<pages?link('Next',current+1):''}</div><form method="get" action="${escape(path)}" class="page-jump">${[...query].map(([name,value])=>`<input type="hidden" name="${escape(name)}" value="${escape(value)}">`).join('')}<label>Jump to page<input name="page" type="number" min="1" max="${pages}" value="${current}" step="1" required></label><button>Go</button></form></nav>`;
}
