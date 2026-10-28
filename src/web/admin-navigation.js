const tabs=[['/admin','Overview'],['/admin/pending','Pending review'],['/admin/reports','Problem reports'],['/admin/maintenance','Maintenance'],['/admin/audit','Audit log'],['/admin/backup','Backup & export'],['/app/settings','Access & settings']];
export function adminNavigation(path='/admin'){
 const current=path==='/admin/export'?'/admin/backup':tabs.find(([url])=>url!=='/admin'&&(path===url||path.startsWith(url+'/')))?.[0]||(path==='/admin'?'/admin':null);
 return `<nav class="admin-navigation" aria-label="Administration">${tabs.map(([url,label])=>`<a href="${url}" ${current===url?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
}
export function adminContent(body){
 return `<div class="admin-content">${body.replace(/<table\b/g,'<div class="admin-table-wrap" role="region" aria-label="Administration records" tabindex="0"><table').replace(/<\/table>/g,'</table></div>')}</div>`;
}
