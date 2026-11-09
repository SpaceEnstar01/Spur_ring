import {test} from 'node:test'
import assert from 'node:assert/strict'
import {summarizeTiming} from './performance.mjs'

test('overlapping tools do not inflate tool time or imply negative model latency',() => {
  const event = (event,id,ms) => ({event,id,at:new Date(ms).toISOString()})
  const result = summarizeTiming(1000,10000,2000,[event('call','a',2000),event('call','b',3000),event('result','a',6000),event('result','b',7000)])
  assert.equal(result.totalMs,9000)
  assert.equal(result.toolMs,5000)
  assert.equal(result.nonToolMs,4000)
  assert.equal(result.toolCalls,2)
  assert.equal(result.firstOutputMs,1000)
})
