import {destinationLabel} from './labels.js';
import {houseCapacityText} from './house-capacity.js';
const preview=value=>String(value||'').replace(/\s+/g,' ').trim().slice(0,60);
export function tourRouteLines(stops,budget=980){
 const base=stops.map(s=>`${s.position}. **${destinationLabel(s).slice(0,220)}**${houseCapacityText(s)?' '+houseCapacityText(s):''} — @${String(s.eso_owner||'').replace(/^@+/,'').slice(0,80)}`),enriched=base.map((line,i)=>{const description=preview(stops[i].registration_description||stops[i].description);return description?line+'\n'+description:line;});
 return enriched.join('\n').length<=budget?enriched:base;
}
export function tourRouteSummary(stops){const lines=tourRouteLines(stops),kept=[];let used=0;for(const line of lines){const next=used+line.length+(kept.length?1:0);if(next>980)break;kept.push(line);used=next;}const omitted=lines.length-kept.length;return kept.length?kept.join('\n')+(omitted?`\n… plus ${omitted} more stop${omitted===1?'':'s'}`:''):'No stops yet.';}
