import { normalizeAccount, stripLeadingAt } from './eso.js';

function cleanInput(value){
  return String(value??'')
    .replace(/```[^\n]*\n?/gi,'')
    .replace(/```/g,'')
    .trim();
}

function destination(esoOwner,houseId){
  const owner=stripLeadingAt(String(esoOwner??'').trim());
  const id=Number(houseId);
  if(!owner||!normalizeAccount(owner))throw new Error('A valid ESO owner is required.');
  if(!Number.isInteger(id)||id<=0)throw new Error('A valid positive numeric official house ID is required.');
  return {kind:'destination',esoOwner:owner,houseId:id};
}

export function parseDestinationInput(value){
  const input=cleanInput(value);
  if(!input)throw new Error('Enter a house name, ID, Housing Link, or Jump Command.');

  const link=/\|H\d+:housing:([^:|]+):@?([^|]+)\|h[^|]*\|h/i.exec(input);
  if(link)return destination(link[2],link[1]);

  const jump=/\bJumpToSpecificHouse\s*\(\s*(['"])(@?[^'"]+)\1\s*,\s*([+-]?\d+)\s*\)/i.exec(input);
  if(jump)return destination(jump[2],jump[3]);

  const scriptPair=/^\s*(?:\/script\s*)?\(\s*(['"])(@?[^'"]+)\1\s*,\s*([+-]?\d+)\s*\)\s*$/i.exec(input);
  if(scriptPair)return destination(scriptPair[2],scriptPair[3]);

  const barePair=/^\s*(@[A-Za-z0-9_.-]+)\s*,\s*([+-]?\d+)\s*$/.exec(input);
  if(barePair)return destination(barePair[1],barePair[2]);

  if(/^\d+$/.test(input)){
    const houseId=Number(input);
    if(!Number.isSafeInteger(houseId)||houseId<=0)throw new Error('A valid positive numeric official house ID is required.');
    return {kind:'catalog',houseId};
  }

  const looksLikeDestination=/\|H\d*:housing:|JumpToSpecificHouse|^\s*\/script|^\s*[@('"]|@\S+.*\d|\d.*@\S+/i.test(input);
  if(looksLikeDestination)throw new Error('Invalid destination format. Include a valid ESO owner and positive numeric official house ID.');
  if(/^[+-]?\d/.test(input))throw new Error('A valid positive numeric official house ID is required.');
  return {kind:'catalog',houseQuery:input};
}

function houseNotFound(){return Object.assign(new Error('No matching ESO house found. The house was not found in the official ESO catalog.'),{code:'HOUSE_NOT_FOUND'});}

export async function resolveDestinationInput({input,owner=''},houseService){
  const parsed=parseDestinationInput(input);
  let house;
  if(parsed.houseId!=null){
    house=await houseService.get(parsed.houseId);
    if(!house)throw houseNotFound();
  }else{
    const resolved=await houseService.resolve(parsed.houseQuery);
    if(!resolved.exact&&!resolved.matches.length)throw houseNotFound();
    if(!resolved.exact){
      if(resolved.matches.length===1)house=resolved.matches[0];
      else return {house:null,matches:resolved.matches,esoOwner:stripLeadingAt(owner)};
    }else house=resolved.exact;
  }
  const parsedOwner=parsed.esoOwner?stripLeadingAt(parsed.esoOwner):'';
  const enteredOwner=stripLeadingAt(owner);
  if(parsedOwner&&enteredOwner&&normalizeAccount(parsedOwner)!==normalizeAccount(enteredOwner)){
    return {house,esoOwner:null,ownerConflict:{parsed:parsedOwner,entered:enteredOwner}};
  }
  const esoOwner=parsedOwner||enteredOwner;
  if(!esoOwner)throw new Error('ESO owner account name is required.');
  return {house,esoOwner};
}
