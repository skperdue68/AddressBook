import {activityTime} from './activity-time.js';
import {linkButton} from './workspace-render.js';
import {statisticCards} from './statistics-routes.js';
import {escape} from './render.js';
export async function homeRoute({workspace:w,context:c,render}){
 const [counts,feed]=await Promise.all([w.statistics.snapshot(c),w.usage.listActivity(c,{limit:4})]);
 const journeys=[
  ['Share a home','Register your build or a house you want others to discover.','Register New House','/app/register','primary'],
  ['Build a tour','Bring houses together, arrange the stops, and share the route.','Create a tour','/app/tours/new','primary'],
  ['Go exploring','Follow a tour at your own pace or find somewhere unexpected.','Browse housing tours','/app/tours','secondary'],
  ['Keep your favorites','Your submissions, favorites, and recently viewed houses.','My Address Book','/app/personal','secondary']
 ];
 const body=`<section class="welcome-hero"><span class="section-kicker">Your ESO housing community</span><h2>Find a place worth sharing.</h2><p>Discover creative homes, make a tour of your own, or keep the places you love close at hand.</p><div class="actions">${linkButton('Search Houses','/app/houses',true)}${linkButton('Surprise me with a random house','/app/random')}</div></section><div class="journey-grid">${journeys.map(([title,copy,label,url,variant],index)=>`<section class="panel journey-card"><span class="journey-number">0${index+1}</span><h2>${title}</h2><p>${copy}</p>${linkButton(label,url,variant)}</section>`).join('')}</div><section class="community-summary"><div class="section-heading"><h2>Your community</h2>${linkButton('Explore statistics','/app/statistics')}</div>${statisticCards(counts,c)}</section><section class="panel"><div class="section-heading"><h2>Recent activity</h2>${linkButton('View all activity','/app/activity')}</div><p class="note">Across HearthBound · newest first</p><p class="note" data-local-time-zone>Times shown in UTC until your browser applies your local time zone.</p>${feed.items.map(item=>`<div class="activity"><div><strong>${escape(item.actorName)}</strong> ${escape(item.action)}<p class="note">${escape(item.serverName)} · ${escape(item.source)}</p></div>${activityTime(item.occurredAt)}</div>`).join('')||'<p class="muted">Activity appears here as people explore, save houses, and create tours.</p>'}</section>`;
 return render('Welcome to your HearthBound',body,'home');
}
