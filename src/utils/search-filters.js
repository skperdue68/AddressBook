export const SEARCH_FILTER_VERSION=1;

const TEXT_KEYS=['query','name','nickname','owner','tag','zone','houseType','classification','category','style'];
const ARRAY_KEYS=['names','owners','tags','zones','houseTypes','classifications','styles'];
const BOOLEAN_KEYS=['includeNonPlayer','notOnPublicTours'];
const VISIBILITY_ORDER=['global','public','private'];
const KNOWN=new Set([...TEXT_KEYS,...ARRAY_KEYS,...BOOLEAN_KEYS,'visibilities']);
const MAX_JSON_BYTES=16*1024;

const text=value=>{
  const result=String(value??'').trim();
  if(result.length>100)throw new Error('A saved-search value is too long.');
  return result;
};

const array=value=>{
  const result=[...new Set((Array.isArray(value)?value:[]).map(text).filter(Boolean))];
  if(result.length>25)throw new Error('A saved-search selection has too many values.');
  return result;
};

export function normalizeSearchFilters(raw={}, {strict=false}={}){
  if(!raw||Array.isArray(raw)||typeof raw!=='object')throw new Error('Saved-search filters must be an object.');
  if(strict){
    const unknown=Object.keys(raw).filter(key=>!KNOWN.has(key));
    if(unknown.length)throw new Error(`Unknown saved-search filter: ${unknown[0]}`);
  }
  const out={};
  for(const key of TEXT_KEYS){const value=text(raw[key]);if(value)out[key]=value;}
  for(const key of ARRAY_KEYS){const value=array(raw[key]);if(value.length)out[key]=value;}
  const visibilitySet=new Set(array(raw.visibilities).filter(value=>VISIBILITY_ORDER.includes(value)));
  if(visibilitySet.size)out.visibilities=VISIBILITY_ORDER.filter(value=>visibilitySet.has(value));
  for(const key of BOOLEAN_KEYS)if(raw[key]===true)out[key]=true;
  return out;
}

export function hasMeaningfulSearchFilters(filters){
  const normalized=normalizeSearchFilters(filters);
  const keys=Object.keys(normalized).filter(key=>key!=='visibilities'||normalized.visibilities.length!==VISIBILITY_ORDER.length);
  return keys.length>0;
}

export function parseSavedSearchFilters(row){
  if(Number(row?.filter_version)!==SEARCH_FILTER_VERSION)throw new Error('This saved search uses a newer version.');
  const encoded=String(row?.filters_json??'');
  if(Buffer.byteLength(encoded,'utf8')>MAX_JSON_BYTES)throw new Error('This saved search is too large.');
  let raw;
  try{raw=JSON.parse(encoded);}catch{throw new Error('This saved search cannot be read.');}
  return normalizeSearchFilters(raw,{strict:true});
}

export function encodeSearchFilters(filters){
  const encoded=JSON.stringify(normalizeSearchFilters(filters,{strict:true}));
  if(Buffer.byteLength(encoded,'utf8')>MAX_JSON_BYTES)throw new Error('This saved search is too large.');
  return encoded;
}
