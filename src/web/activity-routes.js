import {activityLabels} from '../services/usage-activity-service.js';
import {escape} from './render.js';
import {linkButton} from './workspace-render.js';
import {activityTime} from './activity-time.js';

export async function activityRoute({workspace:w,context:c,query={},render}){
 const filters={server:query.server||'',kind:query.kind||'',member:query.member||''};
 const [feed,totals,servers,people]=await Promise.all([w.usage.listActivity(c,{...filters,cursor:query.cursor}),w.usage.usageTotals(),w.usage.activityServers(),w.usage.activityMembers({server:filters.server,kind:filters.kind})]);
 return render('Recent Activity',`<p>Across HearthBound · Newest first · Discord and web</p><p class="note" data-local-time-zone>Times shown in UTC until your browser applies your local time zone.</p><div class="cards">
 <div class="card">Recorded actions<strong class="number"><a href="/app/activity#activity-results">${totals.actions}</a></strong></div>
 <div class="card">People using HearthBound<strong class="number"><a href="/app/activity#filter-member">${totals.members}</a></strong><small class="muted">Distinct Discord accounts recorded over 90 days · Discord + web</small></div>
 <div class="card">Originating servers<strong class="number"><a href="/app/activity#filter-server">${totals.servers}</a></strong></div><div class="card">History window<strong class="number">90 days</strong></div></div>
 <p class="note">${totals.since?`Recording since ${escape(new Date(totals.since).toLocaleDateString('en-US',{timeZone:'UTC'}))}.`:'Activity begins collecting after deployment.'} Totals cover all recorded activity in the last 90 days, not online presence or in-game visits.</p>
 <form class="filters activity-filters"><label>Originating server<select id="filter-server" name="server"><option value="">All servers</option>${servers.map(g=>`<option value="${escape(g.id)}" ${filters.server===g.id?'selected':''}>${escape(g.name||'A Discord server')}</option>`).join('')}</select></label>
 <label>Activity<select name="kind"><option value="">All usage</option>${Object.entries(activityLabels).map(([key,label])=>`<option value="${key}" ${filters.kind===key?'selected':''}>${escape(label)}</option>`).join('')}</select></label>
 <label>Person<input id="filter-member" name="member" list="activity-members" value="${escape(filters.member)}" placeholder="Choose a person or paste Discord ID" autocomplete="off"><datalist id="activity-members">${people.members.map(m=>`<option value="${escape(m.id)}">${escape(m.name)} · ${escape(m.id)}</option>`).join('')}</datalist></label><div class="actions"><button>Filter activity</button>${linkButton('Clear filters','/app/activity')}</div></form>
 ${people.hasMore?'<p class="note">Showing the first 1,000 people for these filters. Narrow the server or activity, or paste a Discord ID.</p>':''}
 <div class="panel" id="activity-results">${feed.items.length?feed.items.map(a=>`<div class="activity"><div><strong>${escape(a.actorName)}</strong> ${escape(a.action)}${a.targetUrl?` · <a href="${escape(a.targetUrl)}">${escape(a.targetTitle)}</a>`:''}<p class="note">${escape(a.serverName)} · ${escape(a.source)}${a.esoServer?` · ${escape(a.esoServer)}`:''}</p></div>${activityTime(a.occurredAt)}</div>`).join(''):'<p>No matching activity yet. Try another person or filter.</p>'}</div>
 ${feed.nextCursor?linkButton('Older activity',`/app/activity?${new URLSearchParams({...filters,cursor:feed.nextCursor})}`):''}<p class="note">Private actions use generic descriptions. Search text and Private destinations are never recorded here. Content links require your current access.</p>`,'activity');
}
