const b=(customId,label,style='secondary')=>({customId,label,style});

export function homeButtonSpecs(isAdmin=false){
  const out=[
    {...b('hu:find','Search Houses','primary'),emoji:'🔎'},
    {...b('hu:register','Register New House','success'),emoji:'➕'},
    {...b('hu:tours','Housing Tours','secondary'),emoji:'🗺️'},
    {...b('hu:my','My AddressBook','primary'),emoji:'📖'},
    {...b('hu:help','Help','secondary'),emoji:'❓'},
    {...b('hu:globalmod','Global Moderator Access','secondary'),emoji:'🌐'}
  ];
  if(isAdmin)out.push({...b('hu:admin','Administration','secondary'),emoji:'⚙️'});
  return out;
}
export function toursButtonSpecs(){ return [{...b('hu:tours:start','Start a Tour','success'),emoji:'▶️'},b('hu:tours:browse','Browse Tours','primary'),{...b('hu:tours:create','Create Tour','secondary'),emoji:'➕'},b('hu:tours:events','Upcoming Events','primary'),b('hu:tours:featured','Featured Housing','primary'),{...b('hu:home','Back','secondary'),emoji:'↩️'}]; }
export function tourDetailButtonSpecs(canEdit=false){ const out=[{...b('hu:tour:start','Start a Tour','success'),emoji:'▶️'}]; if(canEdit)out.push(b('hu:tour:manage','Edit Tour','secondary')); out.push({...b('hu:tours','Back','secondary'),emoji:'↩️'}); return out; }
export function tourManageButtonSpecs(){ return [b('hu:tour:edit','Edit Tour Details','primary'),b('hu:tour:add','Add House','success'),b('hu:tour:event','Schedule Event','primary'),b('hu:tour:editstop','Edit a Stop','primary'),b('hu:tour:reorder','Reorder Stops','secondary'),b('hu:tour:removestop','Remove a Stop','danger'),b('hu:tour:delete','Delete Tour','danger'),{...b('hu:tours','Back','secondary'),emoji:'↩️'}]; }
export function commentsButtonSpecs(){ return [b('hu:comments:add','Add Comment','primary'),{...b('hu:comments:back','Back','secondary'),emoji:'↩️'}]; }
