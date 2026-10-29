export const PREVIEW_LABELS={full:'Your normal access',guest:'Guest',member:'Member',server:'Server administrator',global:'Global administrator'};
export function previewChoices(c){return ['full','guest','member',...(c.isServerAdmin?['server']:[]),...(c.isGlobalAdmin?['global']:[])].map(value=>({value,label:PREVIEW_LABELS[value]}));}
export function applyPermissionPreview(c,requested){
 if(!requested||requested==='full')return c;
 const permissionPreview=previewChoices(c).some(x=>x.value===requested)?requested:'member';
 const isServerAdmin=permissionPreview==='server'&&c.isServerAdmin===true,isGlobalAdmin=permissionPreview==='global'&&c.isGlobalAdmin===true;
 const roles=isServerAdmin?[{kind:'server',label:'Server Administrator',guildId:c.guildId,guildName:c.guildName}]:isGlobalAdmin?[{kind:'global',label:'Global Administrator',esoServer:c.esoServer}]:[{kind:'member',label:permissionPreview==='guest'?'Guest':'Member'}];
 return {...c,previewMemberRoleIds:c.memberRoleIds,permissionPreview,previewChoices:previewChoices(c),isOwner:false,isServerAdmin,isGlobalAdmin,roles,memberRoleIds:[],bootstrap:false,setupAuthority:false,canClaimFirstAdmin:false};
}
