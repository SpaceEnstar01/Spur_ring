import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transform } from 'esbuild'

const source = await transform(
  await readFile(new URL('../src/platformCatalog.ts', import.meta.url), 'utf8'),
  { loader: 'ts', format: 'esm', target: 'es2020' }
)
const code = source.code.replace(/import\s+type\s+\{[^}]+\}\s+from\s+['"]\.\/guestConnections['"];?\n/, '')
const { platforms, connectionView } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
)

test('six platforms stay distinct and Douyin is not TikTok', () => {
  assert.deepEqual(platforms.map((item) => item.id), ['youtube', 'instagram', 'tiktok', 'x', 'reddit', 'douyin'])
  assert.equal(platforms.find((item) => item.id === 'tiktok').name, 'TikTok')
  assert.equal(platforms.find((item) => item.id === 'douyin').name, '抖音')
})

test('only a real YouTube grant is shown as connected', () => {
  const grant = { provider: 'youtube', state: 'connected', label: 'LEO', configured: true, connectedAt: null }
  assert.equal(connectionView('youtube', grant, true, true).label, '已连接')
  assert.equal(connectionView('youtube', grant, true, true).account, 'LEO')
  assert.equal(connectionView('youtube', grant, false, true).label, '未连接')
  assert.equal(connectionView('youtube', null, true, false).label, '正在读取…')
  assert.equal(connectionView('youtube', null, true, true).label, '暂时无法核验')
  assert.equal(connectionView('youtube', { ...grant, state: 'disconnected', label: '' }, true, true).label, '未连接')
  for (const id of ['instagram', 'tiktok', 'x', 'reddit', 'douyin']) {
    assert.equal(connectionView(id, grant, true, true).state, 'soon')
    assert.equal(connectionView(id, grant, true, true).account, '')
  }
})
