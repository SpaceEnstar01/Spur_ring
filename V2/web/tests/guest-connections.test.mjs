import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transform } from 'esbuild'

const task = await transform(
  await readFile(new URL('../src/taskApi.ts', import.meta.url), 'utf8'),
  { loader: 'ts', format: 'esm', target: 'es2020' }
)
const guest = await transform(
  await readFile(new URL('../src/guestConnections.ts', import.meta.url), 'utf8'),
  { loader: 'ts', format: 'esm', target: 'es2020' }
)
const guestCode = guest.code.replace(/import\s*\{[^}]+\}\s*from\s*['"]\.\/taskApi['"];?\n/, '')
const { readYoutubeConnection, startYoutubeConnection, youtubeAuthorizationUrl } = await import(
  'data:text/javascript;base64,' + Buffer.from(task.code + '\n' + guestCode).toString('base64')
)
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

test('YouTube authorization must stay on Google accounts', () => {
  assert.equal(
    youtubeAuthorizationUrl('https://accounts.google.com/o/oauth2/v2/auth?state=abc'),
    'https://accounts.google.com/o/oauth2/v2/auth?state=abc'
  )
  assert.throws(() => youtubeAuthorizationUrl('https://evil.example/auth'), /授权地址无效/)
  assert.throws(() => youtubeAuthorizationUrl('javascript:alert(1)'), /授权地址无效/)
})

test('start sends only the guest route and returns the Google address', async () => {
  let called = ''
  const url = await startYoutubeConnection(async (input, options) => {
    called = String(input)
    assert.equal(options.method, 'POST')
    assert.equal(options.body, '{}')
    return json({ authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=abc', access_token: 'hidden' })
  })
  assert.equal(called, '/api/guest/connections/youtube/start')
  assert.equal(url, 'https://accounts.google.com/o/oauth2/v2/auth?state=abc')
  assert.doesNotMatch(url, /hidden/)
})

test('status keeps the channel label and drops token fields', async () => {
  const row = await readYoutubeConnection(async () =>
    json({
      connections: [
        {
          provider: 'youtube',
          state: 'connected',
          label: 'My channel',
          configured: true,
          connectedAt: '2026-11-08T00:00:00.000Z',
          access_token: 'hidden-access',
          refresh_token: 'hidden-refresh',
        },
      ],
    })
  )
  assert.equal(row.label, 'My channel')
  assert.equal(row.state, 'connected')
  assert.equal('access_token' in row, false)
  assert.equal('refresh_token' in row, false)
})
