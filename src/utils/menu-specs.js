const b=(customId,label,style='secondary')=>({customId,label,style});

export function homeButtonSpecs(isAdmin=false){
  return [
    {...b('hu:find','Search Houses','primary'),emoji:'🔎'},
    {...b('hu:tours','Search Housing Tours','secondary'),emoji:'🗺️'},
    {...b('hu:register','Register New House','success'),emoji:'➕'},
    {...b('hu:random','Random House','primary'),emoji:'🎲'},
    {...b('hu:featured','Featured Housing','primary'),emoji:'⭐'},
    {...b('hu:my','My Address Book','primary'),emoji:'📖'},
    ...(isAdmin?[{...b('hu:admin','Administration','secondary'),emoji:'⚙️'}]:[]),
    {...b('hu:help','Support & Access','secondary'),emoji:'❓'}
  ];
}
export function toursButtonSpecs(){ return [{...b('hu:tours:start','Start a Tour','success'),emoji:'▶️'},b('hu:tours:browse','Browse Tours','primary'),{...b('hu:tours:create','Create Tour','secondary'),emoji:'➕'},b('hu:tours:featured','Featured Housing','primary'),{...b('hu:home','Main Menu','secondary'),emoji:'↩️'}]; }
export function tourDetailButtonSpecs(canEdit=false){ const out=[{...b('hu:tour:start','Start a Tour','success'),emoji:'▶️'}]; if(canEdit)out.push(b('hu:tour:add','Add House','primary'),b('hu:tour:manage','Edit Tour','secondary')); out.push({...b('hu:tours','Back to Tours','secondary'),emoji:'↩️'}); return out; }
export function tourManageButtonSpecs(){ return [b('hu:tour:edit','Edit Tour Details','primary'),b('hu:tour:add','Add House','success'),b('hu:tour:editstop','Edit a Stop','primary'),b('hu:tour:reorder','Reorder Stops','secondary'),b('hu:tour:removestop','Remove a Stop','danger'),b('hu:tour:delete','Delete Tour','danger'),{...b('hu:tours','Back to Tour','secondary'),emoji:'↩️'}]; }
export function commentsButtonSpecs(){ return [b('hu:comments:add','Add Comment','primary'),{...b('hu:comments:back','Back','secondary'),emoji:'↩️'}]; }
