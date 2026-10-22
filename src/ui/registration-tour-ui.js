export function registrationTourActions({savedHouseId,status}){
 return status==='active'?[{customId:`hu:registration:tour:${Number(savedHouseId)}`,label:'Add to a Tour',style:'success'}]:[];
}
