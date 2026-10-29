import {attachmentSafeInteraction} from './ui/message-attachments.js';
import {WebWorkspaceService} from './services/web-workspace-service.js';
import {discordHouseGallery,galleryContext,galleryCaptionModal} from './ui/house-gallery.js';
import { createHousingMenu } from './ui/housing-menu.js';
import { IdentityService } from './services/identity-service.js';

/**
 * HearthBound registers /hearth and the /housing compatibility alias.  All interaction behavior lives in the
 * Housing menu layer so database access cannot bypass the repository/service
 * scoping rules.
 */
export function createHandlers(db){
  const housingMenu=createHousingMenu(db);
  const identities=new IdentityService(db);
  const workspace=new WebWorkspaceService(db);
  const dispatch=async(method,i)=>{
    await identities.syncInteraction(i);
    const result=await method(attachmentSafeInteraction(i));
    await identities.refreshInternalNames();
    return result;
  };
  return {
    invalidateSettings(guildId){housingMenu.invalidateSettings(guildId);},
    async ready(client){ return identities.syncClient(client); },
    async autocomplete(i){await identities.syncInteraction(i);try{if(i.options.getFocused(true).name==='house'){const c=await galleryContext(workspace,i),result=await workspace.listHouses(c,{q:i.options.getFocused()});return i.respond(result.rows.slice(0,25).map(h=>({name:`${h.display_name||h.house_name} · ${h.eso_owner}`.slice(0,100),value:String(h.id)})));}}catch{}return i.respond([]);},
    async chat(i){
      i=attachmentSafeInteraction(i);
      await identities.syncInteraction(i);
      if(!['hearth','housing'].includes(i.commandName))return;
      const galleryHouse=i.options?.getString?.('house'),attachment=i.options?.getAttachment?.('screenshot');
      if(galleryHouse||attachment){if(!/^\d+$/.test(galleryHouse||''))return i.reply({content:'Choose a registered house in the house option before adding a screenshot.',flags:64});return discordHouseGallery(workspace,i,{houseId:Number(galleryHouse),attachment,caption:i.options?.getString?.('caption')||''});}
      const result=await housingMenu.chat(i);
      await identities.refreshInternalNames();
      return result;
    },
    async button(i){const caption=/^hu:gallery:edit-caption:(\d+):(\d+):(\d+)$/.exec(i.customId||'');if(caption)return dispatch(interaction=>galleryCaptionModal(workspace,interaction,{houseId:Number(caption[1]),imageId:Number(caption[2]),index:Number(caption[3])}),i);const gallery=/^hu:gallery:(?:(page|cover|remove):)?(\d+):(-?\d+)$/.exec(i.customId||'');if(gallery)return dispatch(interaction=>discordHouseGallery(workspace,interaction,{houseId:Number(gallery[2]),index:gallery[1]&&gallery[1]!=='page'?0:Number(gallery[3]),action:gallery[1]==='page'?null:gallery[1],imageId:gallery[1]&&gallery[1]!=='page'?Number(gallery[3]):null}),i);return dispatch(housingMenu.button,i);},
    async select(i){ return dispatch(housingMenu.select,i); },
    async modal(i){const caption=/^hu:gallery:caption:(\d+):(\d+):(\d+)$/.exec(i.customId||'');if(caption)return dispatch(interaction=>discordHouseGallery(workspace,interaction,{houseId:Number(caption[1]),imageId:Number(caption[2]),index:Number(caption[3]),action:'caption',caption:i.fields.getTextInputValue('caption')}),i);return dispatch(housingMenu.modal,i);}
  };
}
