import {EmbedBuilder,ActionRowBuilder,StringSelectMenuBuilder} from 'discord.js';
import {buttonRows} from './housing-ui.js';
import {destinationLabel} from '../utils/labels.js';
const routeLabel=(house,budget)=>{const owner=String(house.eso_owner||'Unknown owner').replace(/^@+/,'').slice(0,60),suffix=` — @${owner}`;return `${destinationLabel(house).slice(0,Math.max(1,budget-suffix.length))}${suffix}`;};
export function tourSelectionReviewPayload({token,rows,page=0,selectedPosition=0,backId}){
 const pages=Math.max(1,Math.ceil(rows.length/25)),current=Math.max(0,Math.min(pages-1,Number(page)||0)),start=current*25,slice=rows.slice(start,start+25);
 const components=[];
 if(slice.length)components.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`hu:bulkorder:pick:${token}`).setPlaceholder('Choose a stop to adjust its order').addOptions(slice.map((r,index)=>({label:`${start+index+1}. ${routeLabel(r,100-String(start+index+1).length-2)}`,value:String(start+index),default:start+index===selectedPosition})))));
 components.push(...buttonRows([{customId:`hu:bulkorder:move:${token}:up`,label:'Move Up',style:'secondary',disabled:selectedPosition<=0},{customId:`hu:bulkorder:move:${token}:down`,label:'Move Down',style:'secondary',disabled:selectedPosition>=rows.length-1},{customId:`hu:bulkorder:confirm:${token}`,label:'Confirm Order',style:'success',disabled:!rows.length},{customId:backId,label:'Back',style:'secondary'},...(pages>1?[{customId:`hu:bulkorder:page:${token}:${current-1}`,label:'Previous',style:'secondary',disabled:!current},{customId:`hu:bulkorder:page:${token}:${current+1}`,label:'Next',style:'secondary',disabled:current===pages-1}]:[])]));
 return {embeds:[new EmbedBuilder().setTitle('Review Tour Stop Order').setDescription('Stops will be added in the order below. Discord supplies selected values; this preview determines the route. Select a stop and use Move Up or Move Down to adjust it.\n\n'+(slice.map((r,n)=>`**${start+n+1}.** ${routeLabel(r,125)}`).join('\n')||'No houses selected.'))],components};
}
