export function houseTarget(row){
  if(row?.scope==='official')return {kind:'official',id:Number(row.house_id??row.id)};
  const id=Number(row?.destination_id);
  if(!Number.isSafeInteger(id)||id<1)throw new Error('This house does not have a stable destination.');
  return {kind:'destination',id};
}

export function houseTargetKey(target){
  const kind=String(target?.kind||''),id=Number(target?.id);
  if(!['destination','official'].includes(kind)||!Number.isSafeInteger(id)||id<1)throw new Error('Invalid house target.');
  return `${kind}:${id}`;
}
