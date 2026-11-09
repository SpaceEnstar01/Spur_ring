import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parseRange} from './video-stream.mjs'
test('video ranges support seeking, suffixes and bounded responses',()=>{
 assert.deepEqual(parseRange('bytes=10-19',100),{start:10,end:19})
 assert.deepEqual(parseRange('bytes=90-',100),{start:90,end:99})
 assert.deepEqual(parseRange('bytes=-10',100),{start:90,end:99})
 for(const value of ['bytes=100-','bytes=20-10','bytes=-0','bytes=0-1,5-6'])assert.throws(()=>parseRange(value,100))
})
