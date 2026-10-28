import {ActionRowBuilder,EmbedBuilder,ModalBuilder,TextInputBuilder,TextInputStyle} from 'discord.js';
import {buttonRows} from './housing-ui.js';
import {normalizeAccount} from '../utils/eso.js';

const normalized=value=>String(value||'').normalize('NFKC').toLocaleLowerCase('en').trim();
const scope=row=>({personal:'private',server:'public'}[row.source||row.scope]||row.source||row.scope);
const keys=row=>[...(Number(row.destination_id)>0?[`destination:${Number(row.destination_id)}`]:[]),...(row.eso_owner&&Number(row.house_id)>0?[`owner:${normalizeAccount(row.eso_owner)}:${Number(row.house_id)}`]:[]),`registration:${Number(row.saved_house_id||row.source_id||row.id)}`];
export function eligibleTourHouses(rows,stops){
 const existing=new Set(stops.flatMap(keys)),chosen=new Map(),priority={global:3,public:2,private:1};
 for(const row of rows){const identifiers=keys(row);if(identifiers.some(key=>existing.has(key)))continue;const key=identifiers[0],old=chosen.get(key);if(!old||(priority[scope(row)]||0)>(priority[scope(old)]||0))chosen.set(key,row);}
 return [...chosen.values()].sort((a,b)=>String(a.display_name||a.house_name||'').localeCompare(String(b.display_name||b.house_name||''),'en',{sensitivity:'base'}));
}
export function filterTourHouses(rows,filters={}){
 const visibility=({server:'public',personal:'private',all:''}[normalized(filters.visibility)]??normalized(filters.visibility));if(visibility&&!['public','global','private'].includes(visibility))throw new Error('Visibility must be Server, Global or Private, or leave it blank.');
 const words=normalized(filters.query).split(/\s+/).map(word=>word.replace(/^@+/,'')).filter(Boolean),tags=normalized(filters.tags).split(',').map(tag=>tag.trim()).filter(Boolean),architecture=normalized(filters.architecture).split(/\s+/).filter(Boolean);
 return rows.filter(row=>{let rowTags=[];try{rowTags=Array.isArray(row.tags)?row.tags:JSON.parse(row.tags||'[]');}catch{}if(!Array.isArray(rowTags))rowTags=[];
  const search=normalized([row.display_name,row.nickname,row.house_name,row.eso_owner].filter(Boolean).join(' '));return words.every(word=>search.includes(word))&&(!visibility||scope(row)===visibility)&&tags.every(tag=>rowTags.some(value=>normalized(value).includes(tag)))&&(!filters.zone||normalized(row.zone).includes(normalized(filters.zone)))&&architecture.every(word=>normalized(`${row.style||''} ${row.classification||''}`).includes(word));
 });
}
export function tourHouseFiltersModal(stateId,filters={}){
 filters??={};
 const modal=new ModalBuilder().setCustomId(`hu:modal:tourhouses:${stateId}`).setTitle('Find houses for this tour');
 for(const [id,label,placeholder] of [['query','House or ESO owner','House name, nickname or @owner'],['tags','Tags (comma separated)','garden, cozy'],['visibility','Visibility (optional)','Server, Global or Private'],['zone','Zone (optional)','Auridon'],['architecture','Style or classification (optional)','Breton Classic']]){const field=new TextInputBuilder().setCustomId(id).setLabel(label).setPlaceholder(placeholder).setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(150);if(filters[id])field.setValue(String(filters[id]).slice(0,150));modal.addComponents(new ActionRowBuilder().addComponents(field));}return modal;
}
export function tourStopNotesModal(tour,stop,pickerId='none',returnHouseId=null){
 const field=new TextInputBuilder().setCustomId('description').setLabel('Tour-specific notes (optional)').setPlaceholder('What should visitors look for at this stop?').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000);if(stop.notes)field.setValue(String(stop.notes).slice(0,1000));
 return new ModalBuilder().setCustomId(`hu:modal:stop:notes:${tour.id}:${stop.id}:${pickerId}:${returnHouseId||'none'}`).setTitle('Notes for this tour stop').addComponents(new ActionRowBuilder().addComponents(field));
}
export function tourHouseAddedPayload(tour,stop,{pickerId='none',notesSaved=false,returnHouseId=null}={}){
 const embed=new EmbedBuilder().setColor(0x368568).setTitle(notesSaved?'Tour notes saved':'House added to tour').setDescription(`**${String(tour.name).slice(0,180)}**\n\nStop ${Number(stop.position)} · ${String(stop.display_name||stop.house_name||'House').slice(0,180)}\n${String(stop.house_name||'').slice(0,180)} · @${String(stop.eso_owner||'').replace(/^@/,'').slice(0,100)}`).addFields({name:'Tour-specific notes',value:stop.notes?String(stop.notes).slice(0,1000):'Optional: point out a detail, hidden room, or activity visitors should see. These notes belong only to this tour.'});
 return {content:'',allowedMentions:{parse:[]},embeds:[embed],components:buttonRows([{customId:`hu:stop:notes:${tour.id}:${stop.id}:${pickerId}:${returnHouseId||'none'}`,label:stop.notes?'Edit Tour Notes':'Add Tour Notes',style:'primary'},{customId:`hu:tour:addmore:${tour.id}:${pickerId}`,label:'Add Another House',style:'success'},{customId:`hu:tour:view:${tour.id}`,label:returnHouseId?'Open Tour':'View Tour',style:'secondary'},{customId:`hu:tour:manage:${tour.id}`,label:'Manage Stops',style:'secondary'},...(returnHouseId?[{customId:`hu:registration:house:${Number(returnHouseId)}`,label:'Back to House',style:'secondary'}]:[])],2)};
}
