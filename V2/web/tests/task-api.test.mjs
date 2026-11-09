import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transform } from 'esbuild'
const { code } = await transform(
  await readFile(new URL('../src/taskApi.ts', import.meta.url), 'utf8'),
  { loader: 'ts', format: 'esm', target: 'es2020' }
)
const { submitTask, mergeSnapshot, resourceUrl, taskHistory, configureBackend, apiBase } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
)
const id = '12345678-1234-4234-8234-123456789abc'
const response = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
test('submits async request exactly once and accepts matching 202', async () => {
  let calls = 0
  const result = await submitTask(
    id,
    'Task',
    [],
    'http://local',
    async (url, opt) => {
      calls++
      assert.equal(opt.method, 'POST')
      const b = JSON.parse(opt.body)
      assert.equal(b.async, true)
      assert.equal(b.requestId, id)
      return response({ runId: id }, 202)
    }
  )
  assert.equal(calls, 1)
  assert.equal(result, null)
})
test('lost acknowledgement queries the same task instead of reposting', async () => {
  const methods = []
  const result = await submitTask(
    id,
    'Task',
    [],
    'http://local',
    async (url, opt) => {
      methods.push(opt.method || 'GET')
      if (opt.method === 'POST') throw new TypeError('Network failed')
      assert.ok(url.endsWith('/tasks/' + id))
      return response({
        runId: id,
        status: 'finished',
        result: { response: 'Saved result' },
      })
    }
  )
  assert.deepEqual(methods, ['POST', 'GET'])
  assert.equal(result.response, 'Saved result')
})
test('409 resumes task; authorization failure does not attempt recovery or bypass', async () => {
  let calls = 0
  assert.equal(
    await submitTask(id, 'Task', [], 'http://local', async (_u, o) => {
      calls++
      return o.method === 'POST'
        ? response({ error: 'duplicate' }, 409)
        : response({ runId: id, status: 'running' })
    }),
    null
  )
  assert.equal(calls, 2)
  calls = 0
  await assert.rejects(
    () =>
      submitTask(id, 'Task', [], 'http://local', async () => {
        calls++
        return response({ error: 'Denied' }, 401)
      }),
    /Denied/
  )
  assert.equal(calls, 1)
})
test('invalid acknowledgement fails without reposting', async () => {
  let calls = 0
  await assert.rejects(
    () =>
      submitTask(id, 'Task', [], 'http://local', async () => {
        calls++
        return response({ runId: 'wrong' }, 202)
      }),
    /编号不匹配/
  )
  assert.equal(calls, 1)
})
test('observed activity is deduplicated without invented steps and result links survive', () => {
  const t = {
    id,
    title: 'Task',
    createdAt: new Date().toISOString(),
    status: 'running',
    events: [],
  }
  const s = {
    runId: id,
    status: 'running',
    activity: { tool: 'save_document', event: 'result', available: true },
  }
  const first = mergeSnapshot(t, s)
  assert.equal(first.events.length, 1)
  assert.equal(mergeSnapshot(first, s).events.length, 1)
  assert.equal(first.plan, undefined)
  const result = {
    response: 'Complete',
    artifacts: [
      {
        title: 'Report',
        url:
          '/api/creator-agent/artifacts/' + id + '?expires=123&signature=abc',
      },
    ],
  }
  const done = mergeSnapshot(first, { runId: id, status: 'finished', result })
  assert.equal(done.result.artifacts[0].url, result.artifacts[0].url)
  assert.equal(
    resourceUrl(result.artifacts[0].url, 'http://localhost:4173'),
    'http://localhost:4173' + result.artifacts[0].url
  )
  assert.equal(
    resourceUrl('javascript:alert(1)', 'http://localhost:4173'),
    undefined
  )
})

test('follow-up preserves the parent chain and does not include unrelated tasks', () => {
  const first = {
    id: 'first',
    title: 'Research',
    result: { response: 'Sources' },
  }
  const second = {
    id: 'second',
    title: 'Write report',
    parentId: 'first',
    result: { response: 'Report' },
  }
  const unrelated = { id: 'other', title: 'Private unrelated task' }
  assert.deepEqual(taskHistory(second, [first, second, unrelated]), [
    { role: 'user', content: 'Research' },
    { role: 'assistant', content: 'Sources' },
    { role: 'user', content: 'Write report' },
    { role: 'assistant', content: 'Report' },
  ])
  assert.deepEqual(taskHistory(undefined, [first]), [])
})

test('cloud artifact URLs use the private same-origin bridge while external sources stay external',()=>{
 configureBackend({scope:'https://api.hispurring.com'})
 assert.equal(resourceUrl('https://api.hispurring.com/api/creator-agent/artifacts/'+id+'?expires=123','http://local'),'http://local/api/creator-agent/artifacts/'+id+'?expires=123')
 assert.equal(resourceUrl('https://www.youtube.com/watch?v=example','http://local'),'https://www.youtube.com/watch?v=example')
 configureBackend({scope:''})
})

test('guest mode keeps API requests on the invitation gateway rather than the personal endpoint',()=>{
 configureBackend({scope:'guest:guest-'+ 'a'.repeat(24)})
 assert.equal(apiBase(),'')
 configureBackend({scope:''})
})
