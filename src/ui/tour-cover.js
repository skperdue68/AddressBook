import {EmbedBuilder,PermissionFlagsBits} from 'discord.js';
import {unifiedCard} from './message-layout.js';

// Recheck access through the cover service; a cached tour card is not authority.
export async function withTourCover(covers,context,interaction,tour,payload){
 if(interaction.appPermissions&&!interaction.appPermissions.has(PermissionFlagsBits.AttachFiles))return payload;
 try{
  if(!await covers.get(context,tour.id))return payload;
  const attachment=await covers.read(context,tour.id);
  return unifiedCard({...payload,attachments:[],files:[...(payload.files||[]),{attachment,name:'tour-cover.webp',description:`Cover for ${tour.name}`.slice(0,1024)}],embeds:[new EmbedBuilder().setImage('attachment://tour-cover.webp'),...(payload.embeds||[])]});
 }catch{/* Missing files or revoked access must not break the tour. */return payload;}
}
