export const CAPACITY_FIELDS=Object.freeze(['furnishing_limit','furnishing_limit_plus','special_furnishing_limit','special_furnishing_limit_plus','collectible_limit','collectible_limit_plus','special_collectible_limit','special_collectible_limit_plus','population_limit','population_limit_plus']);
const profile=values=>Object.freeze(Object.fromEntries(CAPACITY_FIELDS.map((key,i)=>[key,values[i]])));
// The existing packaged catalog's capacity profiles. Individual definitions may override them.
export const CLASSIFICATION_DEFAULTS=Object.freeze({
 'Staple Home':profile([75,150,2,4,10,20,2,4,6,6]),
 'Classic Home':profile([250,500,4,8,25,50,4,8,12,12]),
 'Notable Home':profile([350,700,5,10,55,110,5,10,24,24])
});
export function classificationDefaults(value){const name=String(value||'').trim().replace(/ home$/i,'');const key=Object.keys(CLASSIFICATION_DEFAULTS).find(k=>k.toLowerCase()===`${name} Home`.toLowerCase());return key?{...CLASSIFICATION_DEFAULTS[key]}:{};}
