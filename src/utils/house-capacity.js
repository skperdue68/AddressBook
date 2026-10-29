// Catalog visitor limits can arrive as numbers or database numeric strings.
export function houseCapacity(h={}){
 const value=h?.population_limit;
 if(value===null||value===undefined||typeof value==='boolean'||String(value).trim()==='')return null;
 const count=Number(value);
 return Number.isSafeInteger(count)&&count>0?count:null;
}
export function houseCapacityText(h){const count=houseCapacity(h);return count===null?'':`👥 ${count}`;}
