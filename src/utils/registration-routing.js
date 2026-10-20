export function registrationScopeFromType(value){
  if(value==='private')return 'personal';
  if(value==='public')return 'guild';
  if(value==='global')return 'global';
  return '';
}
