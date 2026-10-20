import test from 'node:test';
import assert from 'node:assert/strict';
import { destinationMenuPayload } from '../src/ui/housing-ui.js';
import { sharedPrivateHousePayload } from '../src/ui/share-pass-ui.js';

const labels=payload=>payload.components.flatMap(row=>row.toJSON().components.map(component=>component.label));

test('normal saved-house card offers Share House but never Copy',()=>{
  const payload=destinationMenuPayload({id:7,scope:'global',house_id:62,eso_owner:'HouseOwner',house_name:'Grand Psijic Villa',comment_count:0},{canEdit:true});
  assert.ok(labels(payload).includes('Share House'));
  assert.equal(labels(payload).includes('Copy to My AddressBook'),false);
});

test('pass-only Private card exposes restricted actions and separate copyable ESO fields',()=>{
  const payload=sharedPrivateHousePayload({id:7,scope:'private',house_id:62,eso_owner:'HouseOwner',house_name:'Grand Psijic Villa',comment_count:2},{passId:9,canCopy:true,backToTourId:4});
  const actionLabels=labels(payload);
  for(const label of ['Copy to My AddressBook','Comments','More Details','Report a Problem','Back to Tour'])assert.ok(actionLabels.includes(label),label);
  for(const forbidden of ['Edit House','Change Visibility','Delete House','Add to Tour','Share House'])assert.equal(actionLabels.includes(forbidden),false,forbidden);
  const fields=payload.embeds[0].toJSON().fields;
  const codeFields=fields.filter(field=>/Jump|Preview|Housing Link/.test(field.name));
  assert.deepEqual(codeFields.map(field=>field.name),['🔗 Jump in ESO','🏚️ Unfurnished Preview','🔗 Housing Link']);
  for(const field of codeFields)assert.match(field.value,/^```text\n[\s\S]+\n```$/);
});

test('Copy button stays hidden without pass-only copy authorization',()=>{
  const payload=sharedPrivateHousePayload({id:7,scope:'private',house_id:62,eso_owner:'HouseOwner',house_name:'Grand Psijic Villa',comment_count:0},{passId:9,canCopy:false});
  assert.equal(labels(payload).includes('Copy to My AddressBook'),false);
});
