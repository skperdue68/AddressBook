export function portalPublicUrl(env=process.env){
 const enabled=String(env.WEB_PORTAL_ENABLED||'').toLowerCase()==='true'||(String(env.WEB_ADMIN_ENABLED||'').toLowerCase()==='true'&&env.ADMIN_INTERFACE!=='discord');
 if(!enabled)return null;try{const url=new URL(env.WEB_PORTAL_URL||'');if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return null;return url.toString();}catch{return null;}
}
