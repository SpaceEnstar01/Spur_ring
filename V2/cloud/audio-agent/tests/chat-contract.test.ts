import { afterAll, beforeAll, expect, test } from 'bun:test'
import { join } from 'node:path'

let upstream: ReturnType<typeof Bun.serve>
let child: ReturnType<typeof Bun.spawn>
let base: string
let mode = 'ok'
let lastPrompt = ''
let requests = 0

beforeAll(async () => {
  upstream = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(request) {
      requests++
      const body = await request.json() as { messages: { content: string }[] }
      lastPrompt = body.messages.map(item => item.content).join('\n')
      if (mode === 'error') return Response.json({ error: 'fixture failure' }, { status: 503 })
      return Response.json({ choices: [{ message: { content: mode === 'empty' ? '' : '本地模拟回复：保留原文，分析下一步。' } }] })
    },
  })
  const reservation = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response('') })
  const port = reservation.port!
  reservation.stop(true)
  base = `http://127.0.0.1:${port}`
  child = Bun.spawn([process.execPath, 'run', 'src/server.ts'], {
    cwd: join(import.meta.dir, '..'),
    env: {
      ...process.env,
      AUDIO_AGENT_PORT: String(port),
      AUDIO_AGENT_STT_PROVIDER: 'mock',
      DEEPSEEK_API_KEY: 'fixture-only-not-a-real-key',
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${upstream.port}/v1`,
      DEEPSEEK_MODEL: 'fixture-model',
      EMAIL_ENABLED: 'false',
    },
    stdout: 'ignore', stderr: 'pipe',
  })
  for (let i = 0; i < 100; i++) {
    const response = await fetch(`${base}/health`).catch(() => null)
    if (response?.ok) return
    await Bun.sleep(50)
  }
  throw new Error('V2 audio-agent did not become healthy')
})

afterAll(async () => {
  child?.kill()
  if (child) await child.exited
  upstream?.stop(true)
})

test('the real server exposes the original health and JSON chat protocol', async () => {
  expect(await (await fetch(`${base}/health`)).json()).toMatchObject({ ok: true, service: 'audio-agent' })
  const response = await fetch(`${base}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'fixture-context：请分析这个选题', recordingIds: [] }),
  })
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ message: '本地模拟回复：保留原文，分析下一步。', recordingIds: [] })
  expect(lastPrompt).toContain('fixture-context')
})

test('missing text is rejected before spending a model request', async () => {
  const before = requests
  const response = await fetch(`${base}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  })
  expect(response.status).toBe(400)
  expect(requests).toBe(before)
})

test('upstream failure and empty output remain failures, never successful replies', async () => {
  for (const value of ['error', 'empty']) {
    mode = value
    const response = await fetch(`${base}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'fixture failure case', recordingIds: [] }),
    })
    expect(response.ok).toBe(false)
    expect(await response.json()).toHaveProperty('error')
  }
  mode = 'ok'
})

test('Java-only workspace and SSE endpoints are not implied by the migration', async () => {
  expect((await fetch(`${base}/api/agent/workspace`)).status).toBe(404)
  expect((await fetch(`${base}/api/chat/stream`, { method: 'POST' })).status).toBe(404)
})

test('missing model configuration fails explicitly instead of executing an old workspace command', async () => {
  const { getConfig } = await import('../src/config')
  const { runParentAgent } = await import('../src/agent')
  const config = getConfig()
  config.deepseek.apiKey = ''
  config.agentCommand = ''
  await expect(runParentAgent('fixture', config)).rejects.toThrow('Configure DEEPSEEK_API_KEY')
})
