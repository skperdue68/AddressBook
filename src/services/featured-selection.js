// Engagement can at most double the baseline chance. Repeated clicks do not
// count: inputs are each member's current favorite / visit / interest state.
export function engagementWeight({favorites=0,visitors=0,interested=0}={}){
 const score=Math.max(0,Number(favorites)||0)*2+Math.max(0,Number(visitors)||0)+Math.max(0,Number(interested)||0)*0.5;
 return 1+Math.min(1,Math.log1p(score)/Math.log(21));
}
export function weightedOrder(rows,random=Math.random){
 return rows.map(row=>({row,key:-Math.log(1-Math.max(0,Math.min(1-Number.EPSILON,Number(random())||0)))/engagementWeight(row)})).sort((a,b)=>a.key-b.key).map(item=>item.row);
}
