import test from 'node:test';
import assert from 'node:assert/strict';
import { homePayload, adminHealthPayload, onboardingPayload, registrationTypePayload, searchFiltersModal, environmentSetupPayload, environmentChangePreviewPayload, legacyTourRecoveryPayload, personalActionsPayload, savedSearchListPayload, savedSearchDetailPayload, savedSearchConflictPayload, savedSearchDeleteConfirmPayload, destinationMenuPayload, officialHousePayload } from '../src/ui/housing-ui.js';
import { reportProblemTypePayload } from '../src/ui/report-ui.js';
import { houseCopyVisibilityPayload } from '../src/ui/share-pass-ui.js';

function inspect(payload){
  const json={...payload,embeds:payload.embeds?.map(e=>e.toJSON?.()||e),components:payload.components?.map(row=>row.toJSON?.()||row)};
  for(const row of json.components||[]){assert.ok((row.components||[]).length<=5,'Discord action rows may contain at most five components');for(const component of row.components||[]){if(component.options)assert.ok(component.options.length<=25,'Discord select menus may contain at most 25 options');if(component.custom_id)assert.ok(component.custom_id.length<=100,'Discord custom IDs may contain at most 100 characters');}}
  return json;
}

test('core AddressBook payloads stay within Discord component limits',()=>{
  const preview={destination:{houseName:'Villa',esoOwner:'Owner'},choices:[{visibility:'global',label:'Global',enabled:true},{visibility:'public',label:'Server',enabled:true},{visibility:'private',label:'Private',enabled:true}]};
  const environmentPreview={fromEsoServer:'pc_na',toEsoServer:'pc_eu',fingerprint:'f'.repeat(64),counts:{serverHouses:1,globalHouses:1,serverTours:1,globalTours:1,destinationsClaimed:1,destinationsReused:1,destinationsCreated:1,removedStops:2,housePasses:1,tourPasses:1,sessions:1,unresolvedRecords:1}};
  const legacyTourPreview={tourId:Number.MAX_SAFE_INTEGER,name:'Legacy Tour',visibility:'public',creator_id:'1234567890123456789',esoServer:'pc_na',fingerprint:'f'.repeat(64),counts:{stops:3,retainedStops:2,removedStops:1}};
  const savedRows=Array.from({length:25},(_,index)=>({id:index+1,name:`Saved Search ${index+1}`}));
  const surpriseHouse={id:1,scope:'global',destination_id:1,house_id:62,eso_owner:'Owner',house_name:'Villa',display_name:'Villa',associated_tours:[]};
  for(const payload of [homePayload(),environmentSetupPayload(),environmentChangePreviewPayload(environmentPreview),legacyTourRecoveryPayload(legacyTourPreview),...Array.from({length:8},(_,page)=>onboardingPayload({page})),registrationTypePayload(),searchFiltersModal('a'.repeat(20),{},false),personalActionsPayload({token:'x'.repeat(20),target:{houseName:'Villa',esoOwner:'Owner'},state:{favorite:true,visitState:'want'}}),savedSearchListPayload({rows:savedRows,page:0,pages:2}),savedSearchDetailPayload({row:{id:1,name:'Castles'},filters:{styles:['Breton']},hasCurrentSearch:true}),savedSearchConflictPayload({token:'x'.repeat(20),name:'Castles'}),savedSearchDeleteConfirmPayload({id:1,name:'Castles'}),destinationMenuPayload(surpriseHouse,{backId:'hu:sr:shorttoken',surpriseToken:'shorttoken'}),officialHousePayload({house_id:62,name:'Villa'},'hu:sr:shorttoken',false,null,'shorttoken'),reportProblemTypePayload({kind:'housepass',token:'x'.repeat(60)}),houseCopyVisibilityPayload(preview,{token:'x'.repeat(60)}),adminHealthPayload({backend:'SQLite',connection:'Connected',version:'0.7.0',channel:{},registrationPolicy:'open',roleCounts:{moderator:0,trusted:0,tours:0},pendingSubmissions:0,globalModeratorRequests:0,openReports:0,passes:{house:{active:0,revoked:0},tour:{active:0,revoked:0}},lastMigration:{version:4},backupReminder:'Use backups.'})])inspect(payload);
});
