import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Local single-user grant. A multi-user deployment must store this per user,
// not in one shared runtime file.
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
].join(' ')

function tokenPath(runtimeRoot) {
  return join(runtimeRoot, 'youtube-oauth.json')
}

function statePath(runtimeRoot) {
  return join(runtimeRoot, 'youtube-oauth-state.json')
}

function redirectUri(port) {
  return `http://127.0.0.1:${port}/api/youtube/oauth/callback`
}

function readJson(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}

function writeSecret(file, value) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value), { mode: 0o600 })
}

function configured(config) {
  return Boolean(String(config.YOUTUBE_CLIENT_ID || '').trim() && String(config.YOUTUBE_CLIENT_SECRET || '').trim())
}

export function hasYoutubeRefreshToken(runtimeRoot) {
  const stored = readJson(tokenPath(runtimeRoot))
  return Boolean(stored && typeof stored.refresh_token === 'string' && stored.refresh_token.trim())
}

function html(response, status, title, body) {
  response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(`<!doctype html><meta charset="utf-8"><title>${title}</title><p>${body}</p>`)
}

function missingCredentials(response) {
  html(response, 503, 'YouTube 尚未配置', '请在 V2/agent/config/siliconflow.env 填写 YOUTUBE_CLIENT_ID 和 YOUTUBE_CLIENT_SECRET，保存后重启本地服务。公开视频数据也可以改填 YOUTUBE_API_KEY。不要把密钥发到聊天里。')
}

export async function startYoutubeOAuth(response, config, runtimeRoot, port) {
  if (!configured(config)) return missingCredentials(response)
  const state = randomBytes(24).toString('hex')
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  writeSecret(statePath(runtimeRoot), { state, verifier, expiresAt: Date.now() + 10 * 60 * 1000 })
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', String(config.YOUTUBE_CLIENT_ID).trim())
  url.searchParams.set('redirect_uri', redirectUri(port))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  response.writeHead(302, { Location: url.toString(), 'Cache-Control': 'no-store' })
  response.end()
}

export async function finishYoutubeOAuth(response, url, config, runtimeRoot, port) {
  if (!configured(config)) return missingCredentials(response)
  const returnedState = url.searchParams.get('state') || ''
  const saved = readJson(statePath(runtimeRoot))
  const stateOk = saved && typeof saved.state === 'string' && saved.verifier && saved.expiresAt > Date.now()
    && returnedState.length === saved.state.length
    && timingSafeEqual(Buffer.from(returnedState), Buffer.from(saved.state))
  if (!stateOk) return html(response, 400, '授权未完成', '授权校验失败或已过期。请重新从授权入口开始。')
  if (url.searchParams.get('error')) return html(response, 400, '授权未完成', 'Google 没有授予 YouTube 只读权限。')
  const code = url.searchParams.get('code')
  if (!code) return html(response, 400, '授权未完成', '回调里没有授权码。请重新开始。')
  let data = null
  let ok = false
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: String(config.YOUTUBE_CLIENT_ID).trim(),
        client_secret: String(config.YOUTUBE_CLIENT_SECRET).trim(),
        redirect_uri: redirectUri(port),
        grant_type: 'authorization_code',
        code_verifier: saved.verifier,
      }),
    })
    data = await tokenResponse.json().catch(() => null)
    ok = tokenResponse.ok
  } catch {
    return html(response, 502, '授权未完成', '连接 Google 失败。请稍后重试。')
  }
  if (!ok || !data?.access_token) return html(response, 502, '授权未完成', 'Google 没有返回可用的访问令牌。')
  const previous = readJson(tokenPath(runtimeRoot))
  const refresh = data.refresh_token || previous?.refresh_token
  if (!refresh) return html(response, 502, '授权未完成', 'Google 没有返回刷新令牌。请重新开始并在同意页面授予权限。')
  writeSecret(tokenPath(runtimeRoot), {
    isolation: 'local-single-user',
    refresh_token: refresh,
    access_token: data.access_token,
    expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    scope: data.scope || SCOPES,
    obtained_at: new Date().toISOString(),
  })
  writeSecret(statePath(runtimeRoot), { state: '', verifier: '', expiresAt: 0 })
  html(response, 200, 'YouTube 已授权', '授权已保存在本机。可以关闭这个页面，回到 Spur 继续测试。')
}

export async function youtubeAccessToken(config, runtimeRoot) {
  const stored = readJson(tokenPath(runtimeRoot))
  if (!stored?.refresh_token || !configured(config)) return ''
  if (stored.access_token && Number(stored.expires_at) > Date.now() + 60_000) return stored.access_token
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: String(config.YOUTUBE_CLIENT_ID).trim(),
        client_secret: String(config.YOUTUBE_CLIENT_SECRET).trim(),
        refresh_token: stored.refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    const data = await tokenResponse.json().catch(() => null)
    if (!tokenResponse.ok || !data?.access_token) {
      console.error(`[youtube] token refresh failed: ${data?.error || tokenResponse.status}`)
      return ''
    }
    writeSecret(tokenPath(runtimeRoot), {
      ...stored,
      access_token: data.access_token,
      expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    })
    return data.access_token
  } catch {
    console.error('[youtube] token refresh failed: network')
    return ''
  }
}
