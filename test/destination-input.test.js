import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDestinationInput } from '../src/utils/destination-input.js';

test('parses every supported destination input syntax',()=>{
  const cases=[
    ['Grand Psijic Villa',{kind:'catalog',houseQuery:'Grand Psijic Villa'}],
    ['62',{kind:'catalog',houseId:62}],
    ['("@HouseOwner", 62)',{kind:'destination',esoOwner:'HouseOwner',houseId:62}],
    ["('@HouseOwner', 62)",{kind:'destination',esoOwner:'HouseOwner',houseId:62}],
    ['@HouseOwner, 62',{kind:'destination',esoOwner:'HouseOwner',houseId:62}],
    ['JumpToSpecificHouse("@HouseOwner", 62)',{kind:'destination',esoOwner:'HouseOwner',houseId:62}],
    ['/script JumpToSpecificHouse("@HouseOwner", 62)',{kind:'destination',esoOwner:'HouseOwner',houseId:62}],
    ['|H1:housing:62:@HouseOwner|h|h',{kind:'destination',esoOwner:'HouseOwner',houseId:62}]
  ];
  for(const [input,expected] of cases)assert.deepEqual(parseDestinationInput(input),expected,input);
});

test('parses fenced commands extra whitespace mixed case and explanatory command text',()=>{
  assert.deepEqual(parseDestinationInput('```lua\n /script   jumptospecifichouse ( \'@HouseOwner\' , 62 ) \n```'),{kind:'destination',esoOwner:'HouseOwner',houseId:62});
  assert.deepEqual(parseDestinationInput('Try this in ESO: /script JumpToSpecificHouse("@HouseOwner", 62) and it will take you there.'),{kind:'destination',esoOwner:'HouseOwner',houseId:62});
  assert.deepEqual(parseDestinationInput('Housing link: |H1:housing:62:HouseOwner|hGrand Psijic Villa|h'),{kind:'destination',esoOwner:'HouseOwner',houseId:62});
});

test('rejects malformed destination-shaped input rather than treating it as a house name',()=>{
  const invalid=[
    '@HouseOwner, 0','@HouseOwner, -2','@HouseOwner, nope','@, 62',
    'JumpToSpecificHouse("@HouseOwner")','JumpToSpecificHouse("@HouseOwner", -1)',
    '|H1:housing:nope:@HouseOwner|h|h','please ask @HouseOwner about 62 chairs'
  ];
  for(const input of invalid)assert.throws(()=>parseDestinationInput(input),/valid|owner|house ID|format/i,input);
});
