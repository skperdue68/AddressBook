import {escape} from './render.js';
import {buildJumpScript,buildHousePreviewScript,buildHousingLink} from '../utils/eso.js';
export function houseVisitCommands(h){
 return `<details id="visit-house" class="house-visit" open><summary>Visit in ESO · jump, preview & housing link</summary><div class="visit-grid">${[['Jump to this house',buildJumpScript(h.eso_owner,h.house_id)],['Housing link',buildHousingLink(h.eso_owner,h.house_id)],['Unfurnished preview',buildHousePreviewScript(h.house_id)]].map(([label,code])=>`<section class="visit-command"><h3>${label}</h3><pre><code>${escape(code)}</code></pre></section>`).join('')}</div></details>`;
}
