import test from 'node:test';
import assert from 'node:assert/strict';
test('selection updates keep existing ranks and append newly received values',async()=>{
 const {updateOrderedSelection,moveSelection,selectionRows}=await import('../src/utils/ordered-selection.js');
 assert.deepEqual([...updateOrderedSelection(new Set([3,1]),['1','4'],0,25)],[1,4]);
 assert.deepEqual([...updateOrderedSelection(new Set([26,3,1]),['1','3','4'],0,25)],[26,3,1,4]);
 assert.deepEqual([...updateOrderedSelection(new Set([3,1]),['1','3'],0,25)],[3,1]);
 let selected=updateOrderedSelection(new Set([3,1]),['1'],0,25);selected=updateOrderedSelection(selected,['3','1'],0,25);assert.deepEqual([...selected],[1,3]);
 for(const value of ['-1','25','0.5','NaN'])assert.throws(()=>updateOrderedSelection(new Set([1]),[value],0,25));
 assert.deepEqual([...moveSelection(new Set([3,1,4]),2,0)],[4,3,1]);assert.throws(()=>moveSelection(new Set([1]),0,2));
 assert.deepEqual(selectionRows(['a','b','c','d'],new Set([3,1]),'select'),['d','b']);
});
