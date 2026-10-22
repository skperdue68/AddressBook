export function updateOrderedSelection(selected,submitted,start,end){
 const incoming=[];
 for(const value of submitted){if(!/^\d+$/.test(String(value)))throw new Error('Invalid house selection.');const index=Number(value);if(!Number.isSafeInteger(index)||index<start||index>=end)throw new Error('House selection is outside this page.');incoming.push(index);}
 const wanted=new Set(incoming),next=new Set([...selected].filter(n=>n<start||n>=end||wanted.has(n)));
 for(const index of incoming)next.add(index);
 return next;
}
export function moveSelection(selected,from,to){const values=[...selected];if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=values.length||to>=values.length)throw new Error('Invalid route position.');const [value]=values.splice(from,1);values.splice(to,0,value);return new Set(values);}
export const selectionRows=(rows,selected,mode)=>mode==='all'?rows:[...selected].map(n=>rows[n]).filter(Boolean);
