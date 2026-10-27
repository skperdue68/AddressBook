import review from './catalog-updates/uesp-2026-10-27.json' with {type:'json'};
export {review as CATALOG_REVIEW};

export function applyReviewedCatalog(definitions){
 const houses=new Map(definitions.map(h=>[Number(h.house_id),{...h}]));
 for(const patch of review.patches){
  const previous=houses.get(patch.house_id)||{house_id:patch.house_id,name:patch.name};
  houses.set(patch.house_id,{...previous,...patch.values,...Object.fromEntries(Object.entries(patch.replacements).map(([field,change])=>[field,change.after])),last_verified:review.checked_on});
 }
 return [...houses.values()].sort((a,b)=>a.house_id-b.house_id);
}
