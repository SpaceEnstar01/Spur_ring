import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require = createRequire(import.meta.url)
const {myComments} = require('./client.cjs')

test('my comments returns only the authorized channel text', async () => {
  process.env.YOUTUBE_ACCESS_TOKEN = 'ya29.test-token-value'
  delete process.env.YOUTUBE_API_KEY
  const original = global.fetch
  global.fetch = async url => {
    const address = String(url)
    assert.match(address, /googleapis\.com/)
    if (address.includes('/channels')) return Response.json({items:[{id:'channel-1'}]})
    assert.match(address, /allThreadsRelatedToChannelId=channel-1/)
    return Response.json({items:[{snippet:{totalReplyCount:2,topLevelComment:{snippet:{videoId:'video-1',authorDisplayName:'Ada',publishedAt:'2026-11-01T00:00:00Z',likeCount:3,textOriginal:'  A real comment.  '}}}}]})
  }
  try {
    const result = await myComments()
    assert.equal(result.channelId, 'channel-1')
    assert.deepEqual(result.comments, [{videoId:'video-1',author:'Ada',publishedAt:'2026-11-01T00:00:00Z',likeCount:3,replyCount:2,text:'A real comment.'}])
  } finally {
    global.fetch = original
    delete process.env.YOUTUBE_ACCESS_TOKEN
  }
})

test('disabled comments stay empty instead of being invented', async () => {
  process.env.YOUTUBE_ACCESS_TOKEN = 'ya29.test-token-value'
  delete process.env.YOUTUBE_API_KEY
  const original = global.fetch
  global.fetch = async url => {
    if (String(url).includes('/channels')) return Response.json({items:[{id:'channel-1'}]})
    return new Response(JSON.stringify({error:{errors:[{reason:'commentsDisabled'}]}}), {status:403, headers:{'Content-Type':'application/json'}})
  }
  try {
    const result = await myComments()
    assert.equal(result.channelId, 'channel-1')
    assert.deepEqual(result.comments, [])
    assert.match(result.reason, /not available/)
  } finally {
    global.fetch = original
    delete process.env.YOUTUBE_ACCESS_TOKEN
  }
})
