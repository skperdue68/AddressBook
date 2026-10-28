const groups=[
 {kind:'staff',column:'staff_role_ids',label:'Server administrators',explanation:'These roles can manage this server’s HearthBound settings, shared content and Server access requests.'},
 {kind:'trusted',column:'registration_role_ids',label:'Trusted submitters',explanation:'These roles can submit shared houses under role restrictions and bypass registration approval.'},
 {kind:'tours',column:'tour_role_ids',label:'Shared tour hosts',explanation:'These roles can run shared Server tours. With no roles configured, all members may host them.'}
];
export class AccessDirectoryService{
 constructor(workspace,{memberLookup,roleMembersLookup}={}){this.workspace=workspace;this.memberLookup=memberLookup;this.roleMembersLookup=roleMembersLookup;}
 async snapshot(context){
  const w=this.workspace,c=await w.fresh(context);
  const own=await w.policy.global.statusForUser(c.userId);
  const global={active:c.isGlobalAdmin,isOwner:c.isOwner,grants:own.grants.filter(g=>g.eso_server===c.esoServer),requests:own.requests.filter(r=>r.eso_server===c.esoServer)};
  if(c.isOwner)global.approved=await w.policy.global.listModerators({esoServer:c.esoServer});
  let server=null;
  if(c.isServerAdmin||c.isOwner){
   let named=[];try{named=await w.discord?.roles(c)||[];}catch{/* show the exact configured IDs when Discord is unavailable */}
   const names=new Map(named.map(r=>[String(r.id),r.name]));
   const roles=groups.map(({column,...group})=>({...group,roles:JSON.parse(c.settings[column]||'[]').map(id=>({id:String(id),name:names.get(String(id))||'Role name unavailable'}))}));
   const rawGrants=await w.policy.server.listGrants({guildId:c.guildId}),grants=[];
   const resolved=new Map();
   for(const grant of rawGrants){
    const id=String(grant.discord_user_id);let member=null;
    if(!resolved.has(id)){try{member=await this.memberLookup?.({userId:id,guildId:c.guildId});}catch{/* current identity unavailable */}resolved.set(id,member?.id===id?member:null);}
    member=resolved.get(id);
    grants.push({id,name:member?.displayName||member?.globalName||member?.username||id,username:member?.username||null,currentMember:!!member,approvedAt:grant.approved_at});
   }
   const roleIds=[...new Set(roles.flatMap(g=>g.roles.map(r=>r.id)))];
   let roster=null;if(this.roleMembersLookup&&roleIds.length){try{roster=await this.roleMembersLookup({context:c,roleIds});}catch{/* do not substitute cached partial membership */}}
   const roleMembersAvailable=roster?.complete===true&&Array.isArray(roster.members);
   if(roleMembersAvailable)for(const group of roles)for(const role of group.roles)role.members=roster.members.filter(m=>Array.isArray(m.roleIds)&&m.roleIds.map(String).includes(role.id)).map(m=>({id:String(m.id),name:m.displayName||m.globalName||m.username||String(m.id),username:m.username||null}));
   server={roles,grants,roleMembersAvailable,roleMembersNotice:roleMembersAvailable?'Current role holders, freshly loaded from Discord.':roster?.notice||'A complete current role-holder list is unavailable. Configured roles and individual grants are shown below.'};
  }
  return {context:c,server,global};
 }
}
