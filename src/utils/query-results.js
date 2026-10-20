export function withCatalogHouseName(row){
  if(!row)return row;
  const {catalog_house_name,...result}=row;
  return {...result,house_name:catalog_house_name??result.house_name??null};
}

export const withCatalogHouseNames=rows=>rows.map(withCatalogHouseName);
