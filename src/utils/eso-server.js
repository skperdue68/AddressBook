export const ESO_SERVERS=Object.freeze([
  Object.freeze({value:'pc_na',label:'PC NA'}),
  Object.freeze({value:'pc_eu',label:'PC EU'}),
  Object.freeze({value:'xbox_na',label:'Xbox NA'}),
  Object.freeze({value:'xbox_eu',label:'Xbox EU'}),
  Object.freeze({value:'playstation_na',label:'PlayStation NA'}),
  Object.freeze({value:'playstation_eu',label:'PlayStation EU'}),
  Object.freeze({value:'pts',label:'PTS'})
]);

export const ESO_SERVER_CODES=Object.freeze(ESO_SERVERS.map(item=>item.value));

export function normalizeEsoServer(value){
  const normalized=String(value??'').trim().toLowerCase().replace(/[\s-]+/g,'_');
  return ESO_SERVER_CODES.includes(normalized)?normalized:null;
}

export function requireEsoServer(value){
  const normalized=normalizeEsoServer(value);
  if(!normalized)throw new Error('Choose a valid ESO environment.');
  return normalized;
}

export function esoServerLabel(value){
  return ESO_SERVERS.find(item=>item.value===value)?.label??'Unassigned';
}

export function esoServerOptions(){
  return ESO_SERVERS.map(item=>({...item}));
}
