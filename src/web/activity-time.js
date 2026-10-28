export function activityTime(value){
 const raw=String(value||''),date=value instanceof Date?value:new Date(/(?:Z|[+-]\d\d:?\d\d)$/.test(raw)?raw:raw.replace(' ','T')+'Z');
 if(!Number.isFinite(date.getTime()))return '<span class="note">Time unavailable</span>';
 const iso=date.toISOString();return `<time class="activity-timestamp" data-local-datetime datetime="${iso}" title="${iso}">${iso.slice(0,19).replace('T',' ')} UTC</time>`;
}
