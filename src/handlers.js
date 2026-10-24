import { createHousingMenu } from './ui/housing-menu.js';
import { IdentityService } from './services/identity-service.js';

/**
 * Hearthbound registers /hearth and the /housing compatibility alias.  All interaction behavior lives in the
 * Housing menu layer so database access cannot bypass the repository/service
 * scoping rules.
 */
export function createHandlers(db){
  const housingMenu=createHousingMenu(db);
  const identities=new IdentityService(db);
  const dispatch=async(method,i)=>{
    await identities.syncInteraction(i);
    const result=await method(i);
    await identities.refreshInternalNames();
    return result;
  };
  return {
    async ready(client){ return identities.syncClient(client); },
    async autocomplete(i){ await identities.syncInteraction(i); return i.respond([]); },
    async chat(i){
      await identities.syncInteraction(i);
      if(!['hearth','housing'].includes(i.commandName))return;
      const result=await housingMenu.chat(i);
      await identities.refreshInternalNames();
      return result;
    },
    async button(i){ return dispatch(housingMenu.button,i); },
    async select(i){ return dispatch(housingMenu.select,i); },
    async modal(i){ return dispatch(housingMenu.modal,i); }
  };
}
