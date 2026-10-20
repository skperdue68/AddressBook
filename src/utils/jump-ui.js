export function destinationJumpButtonSpec(r){
  return {customId:`jumpcopy:${Number(r.house_id)}:${encodeURIComponent(r.eso_owner)}`,label:'Show Command / Link',style:'primary'};
}
export function destinationActionButtonSpecs(r){
  const scope=r.scope==='personal'?'personal':'server';
  const id=Number(r.id);
  const specs=[destinationJumpButtonSpec(r)];
  if(Number(r.comment_count||0)>0) specs.push({customId:`comments:view:${scope}:${id}`,label:'View Comments',style:'secondary'});
  specs.push({customId:`comments:add:${scope}:${id}`,label:'Add Comment',style:'secondary'});
  return specs;
}
export function tourButtonSpecs(tourId,commentCount=0,showDetails=false,{canEdit=false,savedHouseId=null}={}){
  const detailState=showDetails?'expanded':'compact';
  const specs=[
    {customId:`tour:prev:${tourId}:${detailState}`,label:'Previous Stop',style:'secondary',emoji:'⬅️'},
    {customId:`tour:next:${tourId}:${detailState}`,label:'Next Stop',style:'primary',emoji:'➡️'},
    {customId:`tour:${showDetails?'hide':'details'}:${tourId}`,label:showDetails?'Hide Details':'More Details',style:'primary'},
    {customId:`tour:comments:${tourId}:${detailState}`,label:'Comments',style:'primary'},
    {customId:`tour:list:${tourId}:${detailState}`,label:'Show Tour List',style:'secondary'},
    {customId:`tour:end:${tourId}`,label:'End Tour',style:'danger'}
  ];
  if(canEdit&&savedHouseId!=null)specs.splice(4,0,{customId:`tour:edit:${tourId}:${Number(savedHouseId)}:${detailState}`,label:'Edit House',style:'secondary',emoji:'✏️'});
  return specs;
}
