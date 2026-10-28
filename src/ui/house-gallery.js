import {unifiedCard} from './message-layout.js';
import {ActionRowBuilder,ButtonBuilder,ButtonStyle,EmbedBuilder,MessageFlags,ModalBuilder,TextInputBuilder,TextInputStyle} from 'discord.js';
import {one} from '../db/database.js';
import {portalPublicUrl} from '../web/portal-url.js';
import {HOUSE_IMAGE_BYTES} from '../services/house-image-service.js';

export async function galleryContext(workspace,i){
 const settings=await one(workspace.db,'SELECT eso_server FROM guild_settings WHERE guild_id=?',[String(i.guildId||'')]);
 if(!settings?.eso_server)throw new Error('Choose this server’s ESO environment from /hearth first.');
 return workspace.authorizeContext({userId:i.user.id,guildId:i.guildId,esoServer:settings.eso_server,memberRoleIds:[...(i.member?.roles?.cache?.keys?.()||i.member?.roles||[])].map(String),guildName:i.guild?.name});
}
async function attachmentBytes(attachment,fetchImpl){
 const url=new URL(attachment.url);if(url.protocol!=='https:'||!['cdn.discordapp.com','media.discordapp.net'].includes(url.hostname)||!url.pathname.startsWith('/attachments/'))throw new Error('Use a screenshot attached directly to Discord.');
 if(Number(attachment.size)>HOUSE_IMAGE_BYTES)throw new Error('Choose an image no larger than 5 MB.');
 const response=await fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Discord could not supply that attachment. Upload it again.');
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>HOUSE_IMAGE_BYTES){throw new Error('Choose an image no larger than 5 MB.');}chunks.push(chunk);}return Buffer.concat(chunks);
}
export async function discordHouseGallery(workspace,i,{houseId,index=0,attachment=null,caption='',action=null,imageId=null,fetchImpl=fetch}={}){
 if(action||String(i.customId||'').startsWith('hu:gallery:page:'))await i.deferUpdate();else await i.deferReply({flags:MessageFlags.Ephemeral});
 try{
  const c=await galleryContext(workspace,i);
  if(attachment)await workspace.images.add(c,houseId,await attachmentBytes(attachment,fetchImpl),caption);
  if(action==='remove')await workspace.images.remove(c,houseId,imageId);
  if(action==='cover')await workspace.images.setCover(c,houseId,imageId);
  if(action==='caption')await workspace.images.updateCaption(c,houseId,imageId,caption);
  const house=await workspace.getHouse(c,houseId),images=await workspace.images.list(c,houseId);index=Math.min(Math.max(0,Number(index)||0),Math.max(0,images.length-1));if(action==='caption')index=Math.max(0,images.findIndex(image=>Number(image.id)===Number(imageId)));const image=images[index];
  const embed=new EmbedBuilder().setColor(0xe5bc71).setTitle(String(house.display_name||house.house_name).slice(0,256)).setDescription(`${house.house_name} · ${house.eso_owner}\n\n${image?image.caption||'Explore the details of this home.':'No screenshots yet.'}`).setFooter({text:`${images.length?`${index+1} / ${images.length} · `:''}Upload: choose /hearth, then add the house and screenshot options.`});
  const buttons=[];if(images.length>1)buttons.push(new ButtonBuilder().setCustomId(`hu:gallery:page:${houseId}:${index-1}`).setLabel('Previous image').setStyle(ButtonStyle.Secondary).setDisabled(index===0),new ButtonBuilder().setCustomId(`hu:gallery:page:${houseId}:${index+1}`).setLabel('Next image').setStyle(ButtonStyle.Primary).setDisabled(index===images.length-1));
  const manage=[];if(image&&house.canEdit){manage.push(new ButtonBuilder().setCustomId(`hu:gallery:edit-caption:${houseId}:${image.id}:${index}`).setLabel('Edit caption').setStyle(ButtonStyle.Secondary));if(index)manage.push(new ButtonBuilder().setCustomId(`hu:gallery:cover:${houseId}:${image.id}`).setLabel('Use as cover').setStyle(ButtonStyle.Secondary));manage.push(new ButtonBuilder().setCustomId(`hu:gallery:remove:${houseId}:${image.id}`).setLabel('Remove screenshot').setStyle(ButtonStyle.Danger));}
  const portal=portalPublicUrl();if(portal)buttons.push(new ButtonBuilder().setLabel(house.canEdit?'Manage screenshots on web':'View house on web').setStyle(ButtonStyle.Link).setURL(new URL(`/app/houses/${houseId}#screenshots`,portal).toString()));
  const files=image?[{attachment:await workspace.images.read(c,houseId,image.id),name:'house.webp'}]:[];const embeds=image?[new EmbedBuilder().setColor(0xe5bc71).setImage('attachment://house.webp'),embed]:[embed];
  const payload={attachments:[],allowedMentions:{parse:[]},embeds,files,components:[...(buttons.length?[new ActionRowBuilder().addComponents(buttons)]:[]),...(manage.length?[new ActionRowBuilder().addComponents(manage)]:[])]};
  return i.editReply(image?unifiedCard(payload):payload);
 }catch(error){return i.editReply({content:error.message,attachments:[],embeds:[],components:[],allowedMentions:{parse:[]}});}
}

export async function galleryCaptionModal(workspace,i,{houseId,imageId,index=0}){
 try{const c=await galleryContext(workspace,i);await workspace.images.access(c,houseId,true);const image=(await workspace.images.list(c,houseId)).find(image=>Number(image.id)===Number(imageId));if(!image)throw new Error('Screenshot is unavailable.');
 const field=new TextInputBuilder().setCustomId('caption').setLabel('What does this screenshot show?').setStyle(TextInputStyle.Paragraph).setMaxLength(250).setRequired(false).setPlaceholder('Describe a detail visitors should look for');if(image.caption)field.setValue(image.caption);
 return i.showModal(new ModalBuilder().setCustomId(`hu:gallery:caption:${houseId}:${imageId}:${index}`).setTitle('Edit screenshot caption').addComponents(new ActionRowBuilder().addComponents(field)));
 }catch(error){return i.reply({content:error.message,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});}
}
