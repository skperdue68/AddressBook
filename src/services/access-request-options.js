const kinds=['server','global'];
export const accessRequestTitles={server:'Server administrator',global:'Global administrator'};
export function knownRequestableKinds(c){
 if(!c?.esoServer)return [];
 if(Array.isArray(c.requestableAccess))return kinds.filter(kind=>c.requestableAccess.includes(kind));
 const has=kind=>c.roles?.some(role=>role.kind===kind),owner=c.isOwner||has('owner');if(owner)return [];
 return [...(c.guildId&&!c.isServerAdmin&&!has('server')?['server']:[]),...(!c.isGlobalAdmin&&!has('global')?['global']:[])];
}
export async function requestableAccessKinds(policy,context){
 const c=context.permissionPreview?await policy.context({...context,memberRoleIds:context.previewMemberRoleIds||context.memberRoleIds}):context;
 const possible=knownRequestableKinds({...c,requestableAccess:undefined});if(!possible.length)return [];
 const [server,global]=await Promise.all([possible.includes('server')?policy.server.status({guildId:c.guildId,userId:c.userId}):null,possible.includes('global')?policy.global.statusForUser(c.userId):null]);
 return possible.filter(kind=>kind==='server'?server?.request?.status!=='pending':!global?.requests?.some(r=>r.eso_server===c.esoServer));
}
export const elevatedAccessHref=kinds=>'/app/request-access'+(kinds.length===1?'?kind='+kinds[0]:'');
