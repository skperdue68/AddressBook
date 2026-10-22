import {EmbedBuilder} from 'discord.js';
import {buttonRows} from './housing-ui.js';
export const isRetiredEventInteraction=id=>id==='hu:tours:events'||['hu:events:','hu:event:','hu:tour:event:','hu:modal:tour:event:','hu:modal:event:edit:'].some(prefix=>String(id).startsWith(prefix));
export const retiredEventPayload=()=>({embeds:[new EmbedBuilder().setTitle('Scheduled events are no longer available').setDescription('You can still browse, share, and follow housing tours.')],components:buttonRows([{customId:'hu:tours',label:'Back to Housing Tours',style:'primary'}])});
