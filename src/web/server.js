import {adminOverview} from './admin-overview.js';
import {pagination} from './pagination.js';
import {houseGalleryRoute} from './house-gallery.js';
import {readFile} from 'node:fs/promises';
import {renderWorkspace,csrfField} from './workspace-render.js';
import {ESO_SERVERS} from '../utils/eso-server.js';
import {handleWorkspaceRoute} from './workspace-routes.js';
import http from 'node:http';
import { buildDiscordAuthorizeUrl, consumeOAuthState, createOAuthState, exchangeDiscordCode } from './oauth.js';
import { createSession, readSession, sessionLifetimeSeconds } from './session.js';
import { csrfMatches } from './session.js';
import { page, escape } from './render.js';
import {welcomePage,guildPickerPage} from './public-pages.js';

const cookieValue = (request, name) => String(request.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith(`${name}=`))?.slice(name.length + 1) || null;
const send = (response, status, body, headers = {}) => { response.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'referrer-policy':'no-referrer', 'cache-control':'private, no-store', ...headers }); response.end(body); };
const redirect = (response, location, headers = {}) => { response.writeHead(302, { location, ...headers }); response.end(); };
const sessionCookie = (value, secure = false, lifetimeSeconds = sessionLifetimeSeconds(), issuedAt = Date.now()) => `addressbook_session=${value}; HttpOnly; SameSite=Lax;${secure ? ' Secure;' : ''} Path=/; Max-Age=${lifetimeSeconds}; Expires=${new Date(Number(issuedAt) + lifetimeSeconds * 1000).toUTCString()}`;
const pendingPage = value => Math.min(1000000, Math.max(1, Math.floor(Number(value) || 1)));
const readBody = (request,limit=8192) => new Promise((resolve, reject) => {
  let data = '';
  request.setEncoding('utf8');
  request.on('data', chunk => { data += chunk; if (data.length > limit) { reject(new Error('Request body is too large.')); request.destroy(); } });
  request.on('end', () => resolve(new URLSearchParams(data)));
  request.on('error', reject);
});

export function createWebAdminServer({ service, workspace = null, config = {}, resolveOAuthIdentity, resolveGuildMembership, fetchImpl = fetch, now = () => Date.now() } = {}) {
  if (!service) throw new Error('WebAdminService is required.');
  const cfg = { lifetimeSeconds:sessionLifetimeSeconds({WEB_SESSION_DAYS:config.sessionDays??process.env.WEB_SESSION_DAYS}), sessionSecret: config.sessionSecret || process.env.WEB_SESSION_SECRET, oauth: config.oauth || { clientId: process.env.DISCORD_OAUTH_CLIENT_ID || process.env.DISCORD_CLIENT_ID, clientSecret: process.env.DISCORD_OAUTH_CLIENT_SECRET, redirectUri: process.env.DISCORD_OAUTH_REDIRECT_URI } };
  const identityResolver = resolveOAuthIdentity || (async tokens => {
    const response = await fetchImpl('https://discord.com/api/users/@me', { headers: { authorization: `Bearer ${tokens.access_token}` } });
    if (!response.ok) throw new Error('Discord identity lookup failed.');
    return response.json();
  });

  const memberLookup=async ({userId,guildId})=>{
    if(!resolveGuildMembership)throw new Error('Live Discord membership lookup is unavailable. Try again later.');
    const current=await resolveGuildMembership({userId,guildId,strict:true});
    return current?(current.member||{id:String(userId),displayName:String(userId)}):null;
  };

  const claimFirstAdmin=async({userId,guildId})=>{
    if(!workspace||!resolveGuildMembership)throw new Error('Live Discord verification is unavailable. Try again later.');
    const current=await resolveGuildMembership({userId,guildId,strict:true});
    if(!current)throw new Error('You must be a current member of this Discord server.');
    return workspace.policy.server.claimFirstAdmin({guildId,userId,setupAuthority:current.setupAuthority===true});
  };

  async function sessionContext(request, url) {
    const session = readSession(cookieValue(request, 'addressbook_session'), now(), cfg.sessionSecret);
    if (!session) return null;
    const guilds = Array.isArray(session.guilds) ? session.guilds : [];
    const choices = [];
    for (const guild of guilds) {
      const current = resolveGuildMembership ? await resolveGuildMembership({ userId: session.id, guildId: guild.id }) : guild;
      if (!current) continue;
      const settings = service.guilds?.getSettings ? service.guilds.getSettings(guild.id) : { eso_server: current.esoServer || guild.esoServer || null };
      const esoServer = settings?.eso_server || current.esoServer || guild.esoServer || null;
      const authorization = await service.authorizeGuild({ userId: session.id, guildId: guild.id, requestedGuildId: guild.id, esoServer, requestedEsoServer: esoServer, memberRoleIds: current.roleIds || [] });
      let memberContext=null;
      if(workspace&&esoServer){try{memberContext=await workspace.authorizeContext({userId:session.id,guildId:guild.id,guildName:current.name||guild.name,esoServer,memberRoleIds:current.roleIds||[],setupAuthority:current.setupAuthority===true});}catch{/* unavailable context */}}
      if(workspace&&!esoServer)memberContext={userId:String(session.id),guildId:String(guild.id),guildName:current.name||guild.name,esoServer:null,memberRoleIds:current.roleIds||[],roles:[{kind:'member',label:'Member'}],setupRequired:true};
      const memberRoute=url.pathname==='/'||url.pathname==='/app'||url.pathname.startsWith('/app/');
      if (memberRoute?!!memberContext:authorization.allowed) choices.push({ guild: { ...guild, ...current }, settings, esoServer, memberContext });
    }
    const requestedGuildId = url.searchParams.get('choose') === '1' ? '' : String(url.searchParams.get('guildId') || session.selectedGuildId || '');
    if (!requestedGuildId && choices.length > 1) return { session, choices };
    const selected = choices.find(item => String(item.guild.id) === requestedGuildId) || (!requestedGuildId && choices.length === 1 ? choices[0] : null);
    if (!selected) return { session, forbidden: true };
    const selectionChanged = url.searchParams.has('guildId') && String(session.selectedGuildId || '') !== String(selected.guild.id);
    return { session, ...selected, availableContexts:choices.map(item=>item.memberContext).filter(Boolean), selectionCookie: selectionChanged ? sessionCookie(createSession({ ...session, selectedGuildId: selected.guild.id }, now(), cfg.sessionSecret, cfg.lifetimeSeconds), String(cfg.oauth.redirectUri || '').startsWith('https://'), cfg.lifetimeSeconds, now()) : null };
  }

  async function route(request, response) {
    const url = new URL(request.url, 'http://localhost');
    if(['/assets/workspace.css','/assets/public-pages.css','/assets/hearthbound-preview.png','/assets/hearthbound-banner.webp','/assets/hearthbound-landscape.webp','/assets/tour-editor.js','/assets/hearthbound-logo.png','/assets/account-menu.css','/assets/account-menu.js','/assets/web-actions.js','/assets/interface.js','/assets/house-gallery.js','/assets/catalog-editor.js'].includes(url.pathname)){
      if(request.method!=='GET')return send(response,405,'Method not allowed',{allow:'GET'});
      const asset=url.pathname.split('/').pop();return send(response,200,await readFile(new URL(`./assets/${asset}`,import.meta.url)),{'content-type':asset.endsWith('.png')?'image/png':asset.endsWith('.webp')?'image/webp':asset.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','x-content-type-options':'nosniff'});
    }
    if(url.pathname==='/'){
      if(!['GET','HEAD'].includes(request.method))return send(response,405,'Method not allowed',{allow:'GET, HEAD'});
      return send(response,200,welcomePage(cfg.oauth,readSession(cookieValue(request, 'addressbook_session'), now(), cfg.sessionSecret)));
    }
    if (url.pathname === '/auth/discord') {
      const { state } = createOAuthState(url.searchParams.get('returnTo') || '/admin', now(), cfg.sessionSecret);
      return redirect(response, buildDiscordAuthorizeUrl(state, cfg.oauth));
    }
    if (url.pathname === '/auth/callback') {
      const returnTo = consumeOAuthState(url.searchParams.get('state'), now(), cfg.sessionSecret);
      if (!returnTo || !url.searchParams.get('code')) return send(response, 400, page('OAuth Error', '<p>The sign-in link is invalid or expired. Please try again.</p>'));
      try {
        const tokens = await exchangeDiscordCode(url.searchParams.get('code'), cfg.oauth, fetchImpl);
        const identity = await identityResolver(tokens);
        const cookie = createSession(identity, now(), cfg.sessionSecret, cfg.lifetimeSeconds);
        const secure = String(cfg.oauth.redirectUri || '').startsWith('https://');
        return redirect(response, returnTo, { 'set-cookie': sessionCookie(cookie, secure, cfg.lifetimeSeconds, now()) });
      } catch (error) { return send(response, 502, page('OAuth Error', `<p>${escape(error.message)}</p>`)); }
    }
    if (url.pathname === '/auth/logout') return redirect(response, '/admin', { 'set-cookie': 'addressbook_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
    const context = await sessionContext(request, url);
    if (!context) return redirect(response, `/auth/discord?returnTo=${encodeURIComponent(url.pathname)}`);
    if (context.forbidden) return send(response, 403, page('Access unavailable', '<p>You do not have Housing Moderator access to a HearthBound guild.</p>'));
    if (context.choices) {
      const destination=['/app/feedback','/app/feedback/review'].includes(url.pathname)?url.pathname:url.pathname.startsWith('/app')?'/app':'/admin';
      return send(response, 200, guildPickerPage(context.choices,context.session,destination));
    }
    if (context.selectionCookie) {
      const cleanPath = url.pathname === '/admin' ? '/admin' : `${url.pathname}${url.search.replace(/([?&])guildId=[^&]*&?/, '$1').replace(/[?&]$/, '')}`;
      return redirect(response, cleanPath, { 'set-cookie': context.selectionCookie });
    }
    const { session, guild, esoServer } = context;
    if(context.memberContext)session.accessContext=context.memberContext;
    if(workspace && url.pathname === '/app/guide') {
      if(request.method !== 'GET')return send(response,405,'Method not allowed',{allow:'GET'});
      if(!context.memberContext)return send(response,403,'This member context is unavailable.');
      const guide=await readFile(new URL('../../HearthBound_User_Admin_Guide.docx',import.meta.url));
      return send(response,200,guide,{
        'content-type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'content-disposition':'attachment; filename="HearthBound_User_Admin_Guide.docx"',
        'content-length':guide.length,
        'cache-control':'private, no-store',
        'x-content-type-options':'nosniff'
      });
    }
    if(context.memberContext?.setupRequired){
      if(!['/','/app','/app/setup'].includes(url.pathname))return redirect(response,'/app/setup');
      if(request.method==='POST'){
        const form=await readBody(request);
        if(!csrfMatches(session.csrf,form.get('csrf'))||form.get('contextGuildId')!==String(guild.id)||form.get('contextEsoServer')!=='')return send(response,400,page('Form expired','<p>Reload setup and try again.</p>'));
        await workspace.actions.environments.selectInitial({guildId:guild.id,esoServer:form.get('esoServer'),actorId:session.id});workspace.invalidateSettings?.(guild.id);return redirect(response,'/app');
      }
      if(request.method!=='GET')return send(response,405,'Method not allowed',{allow:'GET, POST'});
      return send(response,200,renderWorkspace({title:'Choose this server’s ESO environment',user:session,context:context.memberContext,body:`<p>This is the same initial setup offered in Discord. Choose carefully; later changes require administration and an impact confirmation.</p><form action="/app/setup" method="post">${csrfField(session.csrf)}<label>ESO environment<select name="esoServer">${ESO_SERVERS.map(s=>`<option value="${s.value}">${s.label}</option>`).join('')}</select></label><button class="primary">Complete initial setup</button></form>`}));
    }
    if(workspace&&context.memberContext){const gallery=await houseGalleryRoute({request,response,url,workspace,context:context.memberContext,session,send,redirect,readBody});if(gallery!==null)return gallery;}
    if(workspace&&(url.pathname==='/'||url.pathname==='/app'||url.pathname.startsWith('/app/'))){return handleWorkspaceRoute({request,response,url,session,context:context.memberContext,workspace,serverContexts:context.availableContexts||[],memberLookup,claimFirstAdmin,readBody,send,redirect});}
    const common = { guildId: guild.id, esoServer };
    const reportMutation = /^\/admin\/reports\/(\d+)\/(review|resolve|dismiss)$/.exec(url.pathname);
    if (reportMutation) {
      if (request.method !== 'POST') return send(response, 405, page('Method not allowed', '<p>Report moderation actions require a POST form.</p>', session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }, { moderation: true }), { allow: 'POST' });
      let form;
      try { form = await readBody(request); } catch { return send(response, 400, page('Invalid request', '<p>The report moderation form could not be read.</p>', session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }, { moderation: true })); }
      const action = reportMutation[2];
      if (!csrfMatches(session.csrf, form.get('csrf')) || form.get('confirm') !== action) return send(response, 400, page('Invalid confirmation', '<p>This report moderation form is invalid or expired. Return to Problem Reports and try again.</p>', session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }, { moderation: true }));
      const returnPage = pendingPage(form.get('page'));
      const returnPath = `/admin/reports${returnPage > 1 ? `?page=${returnPage}` : ''}`;
      try {
        await service.moderateReport({ id: reportMutation[1], action, ...common, actor: { id: session.id, globalName: session.global_name || session.username, displayName: session.display_name || session.username } });
        return redirect(response, `${returnPath}${returnPage > 1 ? '&' : '?'}status=${action === 'review' ? 'reviewing' : action === 'dismiss' ? 'dismissed' : 'resolved'}`);
      } catch {
        return send(response, 409, page('Report action not completed', `<p>That housing report is no longer available for this action.</p><p><a href="${returnPath}">Return to Problem Reports</a></p>`, session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }, { moderation: true }));
      }
    }
    const mutation = /^\/admin\/pending\/(\d+)\/(approve|deny)$/.exec(url.pathname);
    if (mutation) {
      if (request.method !== 'POST') return send(response, 405, page('Method not allowed', '<p>Moderation actions require a POST form.</p>', session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }, { moderation: true }), { allow: 'POST' });
      let form;
      try { form = await readBody(request); } catch { return send(response, 400, page('Invalid request', '<p>The moderation form could not be read.</p>', session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }, { moderation: true })); }
      const action = mutation[2];
      if (!csrfMatches(session.csrf, form.get('csrf')) || form.get('confirm') !== action) return send(response, 400, page('Invalid confirmation', '<p>This moderation form is invalid or expired. Return to Pending Review and try again.</p>', session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }, { moderation: true }));
      const returnPage = pendingPage(form.get('page'));
      const returnPath = `/admin/pending${returnPage > 1 ? `?page=${returnPage}` : ''}`;
      try {
        await service.reviewPending({ id: mutation[1], action, ...common, actor: { id: session.id, globalName: session.global_name || session.username, displayName: session.display_name || session.username } });
        return redirect(response, `${returnPath}${returnPage > 1 ? '&' : '?'}status=${action === 'approve' ? 'approved' : 'denied'}`);
      } catch (error) {
        const message = /already reviewed|not available/i.test(String(error?.message || '')) ? 'That pending house was already reviewed or is not available in this queue.' : 'The moderation action could not be completed.';
        return send(response, 409, page('Review not completed', `<p>${escape(message)}</p><p><a href="${returnPath}">Return to Pending Review</a></p>`, session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }, { moderation: true }));
      }
    }
    const verification = /^\/admin\/maintenance\/verify\/(\d+)$/.exec(url.pathname);
    if (verification) {
      if (request.method !== 'POST') return send(response, 405, page('Method not allowed', '<p>Maintenance actions require a POST form.</p>', session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }, { moderation: true }), { allow: 'POST' });
      let form;
      try { form = await readBody(request); } catch { return send(response, 400, page('Invalid request', '<p>The maintenance form could not be read.</p>', session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }, { moderation: true })); }
      if (!csrfMatches(session.csrf, form.get('csrf')) || form.get('confirm') !== 'verify') return send(response, 400, page('Invalid confirmation', '<p>This maintenance form is invalid or expired. Return to Maintenance and try again.</p>', session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }, { moderation: true }));
      try {
        await service.verifyHouse({ houseId: verification[1], ...common, actor: { id: session.id, globalName: session.global_name || session.username, displayName: session.display_name || session.username } });
        return redirect(response, '/admin/maintenance?status=verified');
      } catch (error) {
        const message = /not available/i.test(String(error?.message || '')) ? 'That house is not available in this guild and environment.' : 'The maintenance action could not be completed.';
        return send(response, 409, page('Verification not completed', `<p>${escape(message)}</p><p><a href="/admin/maintenance">Return to Maintenance</a></p>`, session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }, { moderation: true }));
      }
    }
    const duplicateMerge = /^\/admin\/maintenance\/merge\/(\d+)\/(\d+)$/.exec(url.pathname);
    if (duplicateMerge) {
      if (request.method !== 'POST') return send(response, 405, page('Method not allowed', '<p>Duplicate merges require a POST form.</p>', session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }, { moderation: true }), { allow: 'POST' });
      let form;
      try { form = await readBody(request); } catch { return send(response, 400, page('Invalid request', '<p>The duplicate merge form could not be read.</p>', session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }, { moderation: true })); }
      if (!csrfMatches(session.csrf, form.get('csrf')) || form.get('confirm') !== 'merge') return send(response, 400, page('Invalid confirmation', '<p>This duplicate merge form is invalid or expired. Return to Maintenance and try again.</p>', session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }, { moderation: true }));
      try {
        await service.mergeDuplicate({ keepId: duplicateMerge[1], removeId: duplicateMerge[2], ...common, actor: { id: session.id, globalName: session.global_name || session.username, displayName: session.display_name || session.username } });
        return redirect(response, '/admin/maintenance?status=merged');
      } catch (error) {
        const message = /not available|active|duplicate/i.test(String(error?.message || '')) ? 'Those entries are no longer eligible exact-context duplicates.' : 'The duplicate merge could not be completed.';
        return send(response, 409, page('Merge not completed', `<p>${escape(message)}</p><p><a href="/admin/maintenance">Return to Maintenance</a></p>`, session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }, { moderation: true }));
      }
    }
    if (url.pathname === '/admin') {
      const overview=await service.overview(common);
      return send(response,200,page('Administration Overview',adminOverview(overview,{isOwner:session.accessContext?.isOwner===true}),session,{guildId:guild.id,guildName:guild.name,esoServer,path:url.pathname}));
    }
    if (url.pathname === '/admin/audit.csv') {
      if (request.method !== 'GET') return send(response, 405, page('Method not allowed', '<p>Audit downloads require GET.</p>', session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }), { allow: 'GET' });
      const csv = await service.exportAudit({ ...common, action: String(url.searchParams.get('action') || '').trim() || null, entityType: String(url.searchParams.get('entityType') || '').trim() || null, target: String(url.searchParams.get('target') || '').trim() || null });
      response.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="hearthbound-audit-${String(guild.id).replace(/[^a-zA-Z0-9_-]/g, '')}.csv"` });
      return response.end(csv);
    }
    if (url.pathname === '/admin/audit') {
      const actionFilter = String(url.searchParams.get('action') || '').trim();
      const entityTypeFilter = String(url.searchParams.get('entityType') || '').trim();
      const targetFilter = String(url.searchParams.get('target') || '').trim();
      const rawPage = Number(url.searchParams.get('page') || 1);
      const requestedPage = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
      const audit = await service.listAudit({ ...common, page: requestedPage, action: actionFilter || null, entityType: entityTypeFilter || null, target: targetFilter || null });
      const currentPage = Math.max(1, Number(audit.page || 1));
      const totalPages = Math.max(1, Math.ceil(Number(audit.total || 0) / Math.max(1, Number(audit.pageSize || 25))));
      const filterQuery = new URLSearchParams(); if (actionFilter) filterQuery.set('action', actionFilter); if (entityTypeFilter) filterQuery.set('entityType', entityTypeFilter); if (targetFilter) filterQuery.set('target', targetFilter);
      const pageLink = pageNumber => { const query = new URLSearchParams(filterQuery); query.set('page', String(pageNumber)); return `/admin/audit?${query.toString()}`; };
      if(currentPage>totalPages)return redirect(response,pageLink(totalPages));
      const navigation=pagination({page:currentPage,total:audit.total,pageSize:audit.pageSize||25,path:'/admin/audit',params:Object.fromEntries(filterQuery)});
      const filters = `<form class="filters" method="get" action="/admin/audit"><label>Action <input name="action" value="${escape(actionFilter)}" placeholder="house_updated"></label> <label>Target <input name="target" value="${escape(targetFilter)}" placeholder="house name or ID"></label> <label>Entity type <input name="entityType" value="${escape(entityTypeFilter)}" placeholder="saved_house"></label> <button type="submit">Filter</button> <a href="/admin/audit">Clear</a></form>`;
      const exportLink = `/admin/audit.csv${filterQuery.size ? `?${filterQuery.toString()}` : ''}`;
      const body = `${filters}<p><a class="button secondary" href="${escape(exportLink)}">Download matching audit entries (CSV)</a></p>${audit.rows.length ? `<table><thead><tr><th>Action</th><th>Target</th><th>Actor</th><th>When</th></tr></thead><tbody>${audit.rows.map(row => `<tr><td>${escape(row.action)}</td><td>${escape(row.entity_name || row.entity_id)}</td><td>${escape(row.actor_display_name || row.actor_global_name || row.actor_id)}</td><td>${escape(row.created_at)}</td></tr>`).join('')}</tbody></table>` : '<p>No audit entries are available.</p>'}${navigation}`;
      return send(response, 200, page('Audit Log', body, session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }));
    }
    if (url.pathname === '/admin/maintenance') {
      const result = await service.listMaintenance(common);
      const status = url.searchParams.get('status');
      const notice = status === 'verified' ? '<p><strong>House marked verified.</strong></p>' : status === 'merged' ? '<p><strong>Duplicate entries merged.</strong></p>' : '';
      const stale = Array.isArray(result.stale) ? result.stale : [];
      const duplicates = Array.isArray(result.duplicates) ? result.duplicates : [];
      const rows = stale.length ? `<table><thead><tr><th>House</th><th>Visibility</th><th>Last verified</th><th>Action</th></tr></thead><tbody>${stale.map(row => {
        const id = Number(row.house_id); const visibility = row.scope === 'global' ? 'Global' : 'Server';
        return `<tr><td>${escape(row.name || `House #${id}`)}</td><td>${visibility}</td><td>${escape(row.last_verified || 'Never')}</td><td><form method="post" action="/admin/maintenance/verify/${id}" onsubmit="return confirm('Mark this house as verified?')"><input type="hidden" name="csrf" value="${escape(session.csrf)}"><input type="hidden" name="confirm" value="verify"><button class="approve" type="submit">Mark verified</button></form></td></tr>`;
      }).join('')}</tbody></table>` : '<p>No stale houses are available.</p>';
      const duplicateRows = duplicates.length ? `<table><thead><tr><th>Destination</th><th>Visibility</th><th>Owner</th><th>Duplicate entries</th><th>Action</th></tr></thead><tbody>${duplicates.map(group => {
        const ids = String(group.saved_house_ids || '').split(',').map(value => Number(value)).filter(Number.isInteger);
        const keep = ids[0]; const forms = ids.slice(1).map(remove => `<form method="post" action="/admin/maintenance/merge/${keep}/${remove}" onsubmit="return confirm('Keep entry ${keep} and archive duplicate ${remove}?')"><input type="hidden" name="csrf" value="${escape(session.csrf)}"><input type="hidden" name="confirm" value="merge"><button class="deny" type="submit">Keep ${keep}, archive ${remove}</button></form>`).join('');
        return `<tr><td>${escape(group.destination_id)}</td><td>${group.scope === 'global' ? 'Global' : group.scope === 'public' ? 'Server' : 'Private'}</td><td>${escape(group.owner_user_id || '—')}</td><td>${escape(group.saved_house_ids || '')}</td><td><div class="actions table-actions table-actions--wrap">${forms}</div></td></tr>`;
      }).join('')}</tbody></table>` : '<p>No duplicate groups are available.</p>';
      const body = `${notice}<h2 id="stale">Stale houses</h2><p>${stale.length}</p>${rows}<h2 id="duplicates">Duplicate groups</h2><p>${duplicates.length}</p>${duplicateRows}`;
      return send(response, 200, page('Maintenance', body, session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }, { moderation: true }));
    }
    if (url.pathname === '/admin/reports') {
      const requestedPage = pendingPage(url.searchParams.get('page'));
      const result = await service.listReports({ ...common, actor: { id: session.id, globalName: session.global_name || session.username, displayName: session.display_name || session.username }, page: requestedPage, pageSize: 25 });
      const currentPage = Math.max(1, Number(result.page || requestedPage));
      const totalPages = Math.max(1, Math.ceil(Number(result.total || 0) / Math.max(1, Number(result.pageSize || 25))));
      const status = url.searchParams.get('status');
      const notices = { reviewing: 'Report marked as reviewing.', resolved: 'Report resolved.', dismissed: 'Report dismissed.' };
      const notice = notices[status] ? `<p><strong>${notices[status]}</strong></p>` : '';
      const rows = Array.isArray(result.rows) ? result.rows : [];
      const actionForm = (row, action, label, style = '') => `<form method="post" action="/admin/reports/${Number(row.id)}/${action}" onsubmit="return confirm('Confirm ${action} for report #${Number(row.id)}?')"><input type="hidden" name="csrf" value="${escape(session.csrf)}"><input type="hidden" name="confirm" value="${action}"><input type="hidden" name="page" value="${currentPage}"><button${style ? ` class="${style}"` : ''} type="submit">${label}</button></form>`;
      const table = rows.length ? `<table><thead><tr><th>Target</th><th>Problem</th><th>Reporter</th><th>Status</th><th>Submitted</th><th>Details</th><th>Actions</th></tr></thead><tbody>${rows.map(row => {
        const reporter = row.reporter_display_name || row.reporter_global_name || row.reporter_id || 'Unknown';
        const actions = `${row.status === 'open' ? actionForm(row, 'review', 'Mark reviewing') : ''}${actionForm(row, 'resolve', 'Resolve', 'approve')}${actionForm(row, 'dismiss', 'Dismiss', 'deny')}`;
        return `<tr><td>${escape(row.targetSummary || `Report #${row.id}`)}</td><td>${escape(row.problemLabel || row.problem_type || '')}</td><td>${escape(reporter)}</td><td>${escape(row.status || '')}</td><td>${escape(row.created_at || '')}</td><td class="user-text">${escape(row.explanation || 'Private details redacted')}</td><td><div class="actions table-actions">${actions}</div></td></tr>`;
      }).join('')}</tbody></table>` : '<p>No open housing problem reports are available for this server and ESO environment.</p>';
      if(currentPage>totalPages)return redirect(response,`/admin/reports?page=${totalPages}${notices[status]?'&status='+status:''}`);
      const navigation=pagination({page:currentPage,total:result.total,pageSize:result.pageSize||25,path:'/admin/reports'});
      return send(response, 200, page('Problem Reports', notice + table + navigation, session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }, { moderation: true }));
    }
    if (url.pathname === '/admin/pending') {
      const currentPage = pendingPage(url.searchParams.get('page'));
      const requested = await service.listPending({ ...common, limit: 26, offset: (currentPage - 1) * 25 });
      const rows = requested.slice(0, 25);
      const status = url.searchParams.get('status');
      const notice = status === 'approved' ? '<p><strong>House approved.</strong></p>' : status === 'denied' ? '<p><strong>House rejected.</strong></p>' : '';
      const body = rows.length ? `${notice}<table><thead><tr><th>House</th><th>Owner</th><th>Visibility</th><th>Submitter</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>${rows.map(row => {
        const id = Number(row.id); const label = row.display_name || row.house_name || `Saved House #${id}`;
        const visibility = row.scope === 'global' ? 'Global' : 'Server';
        const submitter = row.created_by_display_name || row.created_by_global_name || row.created_by || 'Unknown';
        const form = action => `<form method="post" action="/admin/pending/${id}/${action}" onsubmit="return confirm('Confirm ${action === 'approve' ? 'approval' : 'rejection'} of this house?')"><input type="hidden" name="csrf" value="${escape(session.csrf)}"><input type="hidden" name="confirm" value="${action}"><input type="hidden" name="page" value="${currentPage}"><button class="${action === 'approve' ? 'approve' : 'deny'}" type="submit">${action === 'approve' ? 'Approve' : 'Reject'}</button></form>`;
        return `<tr><td>${escape(label)}</td><td>${escape(row.eso_owner || '')}</td><td>${visibility}</td><td>${escape(submitter)}</td><td>${escape(row.created_at || '')}</td><td><div class="actions table-actions">${form('approve')}${form('deny')}</div></td></tr>`;
      }).join('')}</tbody></table>` : `${notice}<p>No pending submissions.</p>`;
      const navigation = `<p>Page ${currentPage}</p><p>${currentPage > 1 ? `<a href="/admin/pending?page=${currentPage - 1}">⬅️ Previous</a>` : ''}${requested.length > 25 ? `${currentPage > 1 ? ' · ' : ''}<a href="/admin/pending?page=${currentPage + 1}">➡️ Next</a>` : ''}</p>`;
      return send(response, 200, page('Pending Review', body + navigation, session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }, { moderation: true }));
    }
    if (url.pathname === '/admin/backup') {
      const body = `<p>Use the portable JSON export to inspect or retain this guild's data. It is not a complete database backup and cannot be restored through this page.</p><p><a href="/admin/export">Download portable JSON export</a></p><h2>Current scope</h2><ul><li><strong>Guild:</strong> ${escape(guild.name || guild.id)}</li><li><strong>ESO environment:</strong> ${escape(esoServer || 'Not configured')}</li><li><strong>Included:</strong> Server and compatible Global records, with their comments and tour stops. Private houses and tours are excluded.</li><li><strong>Excluded:</strong> All Private records, plus unrelated guilds and environments.</li></ul><h2>Backend backup guidance</h2><ul><li><strong>SQLite:</strong> stop HearthBound before copying the configured database file.</li><li><strong>MariaDB:</strong> use <code>mariadb-dump</code> with the database credentials outside HearthBound; do not expose credentials through this web console.</li></ul><p>A full database backup includes Private data regardless of visibility. Keep at least one independent backup before migrations, upgrades, or environment reassignment.</p>`;
      return send(response, 200, page('Backup & Export', body, session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }));
    }
    if (url.pathname === '/admin/export') {
      if (url.searchParams.get('view') === '1') {
        const body = `<p>Download a JSON snapshot for the current Discord guild and exact ESO environment. It is not a complete database backup.</p><ul><li><strong>Guild:</strong> ${escape(guild.name || guild.id)}</li><li><strong>ESO environment:</strong> ${escape(esoServer || 'Not configured')}</li><li><strong>Included:</strong> Server and compatible Global records, with their comments and stops. Private houses and tours are excluded.</li><li><strong>Excluded:</strong> All Private records, plus unrelated guilds and environments.</li></ul><p>Private entries remain searchable only by their owner in normal member workflows. The export preserves stable numeric HearthBound and Discord IDs plus readable companion names.</p><p><a href="/admin/export">Download JSON export</a></p>`;
        return send(response, 200, page('Export Data', body, session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }));
      }
      const json = await service.exportGuild(common);
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="hearthbound-${guild.id}-${esoServer}.json"` });
      return response.end(json);
    }
    return send(response, 404, page('Not found', '<p>That administration page does not exist.</p>', session, { guildId: guild.id, guildName: guild.name, esoServer, path:url.pathname }));
  }
  return http.createServer((request, response) => { route(request, response).catch(error => send(response, 500, page('Administration error', `<p>${escape(error.message)}</p>`))); });
}
