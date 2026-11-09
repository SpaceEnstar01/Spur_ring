import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const providers = ['youtube', 'notion']
const scopes = ['https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/yt-analytics.readonly']
const hash = value => createHash('sha256').update(value).digest('hex')
const secret = () => randomBytes(32).toString('base64url')
const fail = (message, status = 400) => Object.assign(new Error(message), { status })
const valid = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)

export class AppConnections {
  constructor(root, config, fetchImpl = fetch) {
    this.root = join(root, 'app-connections')
    this.config = config
    this.fetch = fetchImpl
    this.locks = new Map()
    mkdirSync(this.root, { recursive: true, mode: 0o700 })
    const keyFile = join(this.root, 'encryption.key')
    if (!existsSync(keyFile)) writeFileSync(keyFile, randomBytes(32), { mode: 0o600, flag: 'wx' })
    this.key = readFileSync(keyFile)
    if (this.key.length !== 32) throw new Error('Invalid connector encryption key')
  }
  write(name, data) {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()])
    const tmp = join(this.root, `${name}.${secret()}.tmp`)
    writeFileSync(tmp, JSON.stringify({ iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: ciphertext.toString('base64') }), { mode: 0o600 })
    renameSync(tmp, join(this.root, name))
  }
  read(name) {
    const file = join(this.root, name)
    if (!existsSync(file)) return null
    const value = JSON.parse(readFileSync(file, 'utf8'))
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(value.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(value.tag, 'base64'))
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, 'base64')), decipher.final()]).toString())
  }
  createProfile() {
    const credential = secret()
    const id = hash(credential)
    this.write(`profile-${id}`, { id, grants: {}, generations: {}, createdAt: Date.now() })
    return { credential }
  }
  bindings() { return this.read('tenant-bindings') || {} }
  credentialForTenant(tenantId) {
    if (!/^guest-[a-f0-9]{24}$/.test(tenantId)) throw fail('访客身份无效。', 401)
    const current = this.bindings()
    if (current[tenantId]) return current[tenantId]
    const credential = this.createProfile().credential
    const latest = this.bindings()
    if (latest[tenantId]) return latest[tenantId]
    latest[tenantId] = credential
    this.write('tenant-bindings', latest)
    return credential
  }
  profile(credential) {
    if (!valid(credential)) throw fail('连接身份缺失，请在 App 中重新打开连接页面。', 401)
    const profile = this.read(`profile-${hash(credential)}`)
    if (!profile) throw fail('连接身份无效，请联系管理员，不要改用其他账号授权。', 401)
    return profile
  }
  publicOrigin() {
    let url
    try { url = new URL(this.config.SPUR_PUBLIC_URL) } catch { throw fail('管理员尚未配置 SPUR_PUBLIC_URL。', 503) }
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw fail('SPUR_PUBLIC_URL 必须为可信的 HTTPS 域名根地址。', 503)
    return url.origin
  }
  callbackUrl(provider) { return `${this.publicOrigin()}/api/connections/callback/${provider}` }
  configured(provider) {
    if (!providers.includes(provider)) return false
    try { this.publicOrigin() } catch { return false }
    return provider === 'youtube'
      ? Boolean(this.config.YOUTUBE_CLIENT_ID && this.config.YOUTUBE_CLIENT_SECRET)
      : Boolean(this.config.NOTION_CLIENT_ID && this.config.NOTION_CLIENT_SECRET)
  }
  start(credential, provider) {
    if (!providers.includes(provider)) throw fail('不支持此应用。')
    if (!this.configured(provider)) throw fail(`${provider === 'youtube' ? 'YouTube' : 'Notion'} 官方授权尚未由管理员配置，不能使用开发者共享授权代替。`, 503)
    const p = this.profile(credential)
    const state = secret()
    const verifier = secret()
    p.generations[provider] = secret()
    this.write(`profile-${p.id}`, p)
    this.write(`state-${hash(state)}`, { profile: p.id, provider, verifier, generation: p.generations[provider], expires: Date.now() + 600000, used: false })
    const url = new URL(provider === 'youtube' ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://api.notion.com/v1/oauth/authorize')
    url.searchParams.set('client_id', this.config[provider === 'youtube' ? 'YOUTUBE_CLIENT_ID' : 'NOTION_CLIENT_ID'])
    url.searchParams.set('redirect_uri', this.callbackUrl(provider))
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('state', state)
    if (provider === 'youtube') {
      url.searchParams.set('scope', scopes.join(' '))
      url.searchParams.set('access_type', 'offline')
      url.searchParams.set('prompt', 'consent')
      url.searchParams.set('code_challenge', createHash('sha256').update(verifier).digest('base64url'))
      url.searchParams.set('code_challenge_method', 'S256')
    } else url.searchParams.set('owner', 'user')
    return { authorizationUrl: url.toString(), expiresIn: 600 }
  }
  async request(url, options = {}) {
    const r = await this.fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) })
    const data = await r.json().catch(() => null)
    if (!r.ok || !data) throw fail('官方服务未接受授权或暂时不可用，请重新连接。', r.status === 401 || data?.error === 'invalid_grant' ? 401 : 502)
    return data
  }
  async callback(provider, params) {
    const state = params.get('state')
    if (!providers.includes(provider) || !valid(state)) throw fail('授权校验失败。')
    const name = `state-${hash(state)}`
    const pending = this.read(name)
    if (!pending || pending.provider !== provider || pending.used || pending.expires < Date.now()) throw fail('授权已过期或已使用，请从 App 重新连接。')
    pending.used = true
    this.write(name, pending) // Consume before exchanging a code; callback replay cannot create a second grant.
    let p = this.read(`profile-${pending.profile}`)
    if (!p || p.generations[provider] !== pending.generation) throw fail('授权已取消或被新的连接替代。')
    if (params.get('error') || !params.get('code')) throw fail('你已取消授权，未建立新的连接。')
    let data
    if (provider === 'youtube') {
      data = await this.request('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: params.get('code'), client_id: this.config.YOUTUBE_CLIENT_ID, client_secret: this.config.YOUTUBE_CLIENT_SECRET, redirect_uri: this.callbackUrl(provider), grant_type: 'authorization_code', code_verifier: pending.verifier }) })
      const granted = String(data.scope || '').split(' ')
      if (!data.refresh_token || !scopes.every(scope => granted.includes(scope))) throw fail('未授予完整的 YouTube 读取权限或长期授权，请重新连接。')
    } else {
      data = await this.request('https://api.notion.com/v1/oauth/token', { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${this.config.NOTION_CLIENT_ID}:${this.config.NOTION_CLIENT_SECRET}`).toString('base64')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'authorization_code', code: params.get('code'), redirect_uri: this.callbackUrl(provider) }) })
    }
    if (!data.access_token) throw fail('官方未返回有效授权。')
    p = this.read(`profile-${pending.profile}`)
    if (!p || p.generations[provider] !== pending.generation) throw fail('连接期间已取消授权，未保存。')
    p.grants[provider] = { access_token: data.access_token, refresh_token: data.refresh_token || '', expires: data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : 0, scope: data.scope || '', label: provider === 'notion' ? String(data.workspace_name || 'Notion workspace') : 'YouTube', connectedAt: new Date().toISOString(), state: 'connected' }
    this.write(`profile-${p.id}`, p)
  }
  async token(credential, provider) {
    const p = this.profile(credential)
    const g = p.grants[provider]
    if (!g || g.state !== 'connected') return ''
    if (!g.expires || g.expires > Date.now() + 60000) return g.access_token
    return this.refresh(credential, provider)
  }
  async refresh(credential, provider) {
    const key = `${hash(credential)}:${provider}`
    if (this.locks.has(key)) return this.locks.get(key)
    const operation = (async () => {
      const p = this.profile(credential)
      const generation = p.generations[provider]
      const g = p.grants[provider]
      if (!g?.refresh_token) throw fail('授权已失效，请重新连接。', 401)
      let data
      try {
        data = provider === 'youtube'
          ? await this.request('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: this.config.YOUTUBE_CLIENT_ID, client_secret: this.config.YOUTUBE_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: g.refresh_token }) })
          : await this.request('https://api.notion.com/v1/oauth/token', { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${this.config.NOTION_CLIENT_ID}:${this.config.NOTION_CLIENT_SECRET}`).toString('base64')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: g.refresh_token }) })
        if (!data.access_token) throw fail('刷新授权失败。', 401)
      } catch (error) {
        // Network outages do not erase a valid refresh credential.
        if (error.status === 401) {
          const latest = this.profile(credential)
          if (latest.generations[provider] === generation && latest.grants[provider]) { latest.grants[provider].state = 'needs_reconnect'; this.write(`profile-${latest.id}`, latest) }
        }
        throw error
      }
      const latest = this.profile(credential)
      if (latest.generations[provider] !== generation || !latest.grants[provider]) throw fail('连接已更改，请重新提交任务。', 409)
      Object.assign(latest.grants[provider], { access_token: data.access_token, refresh_token: data.refresh_token || g.refresh_token, expires: data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : 0 })
      this.write(`profile-${latest.id}`, latest)
      return data.access_token
    })()
    this.locks.set(key, operation)
    try { return await operation } finally { this.locks.delete(key) }
  }
  disconnect(credential, provider) {
    if (!providers.includes(provider)) throw fail('不支持此应用。')
    const p = this.profile(credential)
    delete p.grants[provider]
    p.generations[provider] = secret()
    this.write(`profile-${p.id}`, p)
    return { disconnected: true }
  }
  async status(credential) {
    const p = this.profile(credential)
    const connections = []
    for (const provider of providers) {
      const g = p.grants[provider]
      let state = g?.state || 'disconnected'
      let label = g?.label || ''
      let message = ''
      if (state === 'connected') {
        try {
          let token = await this.token(credential, provider)
          const url = provider === 'youtube' ? 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true' : 'https://api.notion.com/v1/users/me'
          let data
          try { data = await this.request(url, { headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28' } }) }
          catch (error) {
            if (error.status !== 401) throw error
            token = await this.refresh(credential, provider)
            data = await this.request(url, { headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28' } })
          }
          if (provider === 'youtube') label = data.items?.[0]?.snippet?.title || 'YouTube（账号尚无频道）'
        } catch (error) { state = error.status === 401 ? 'needs_reconnect' : 'unavailable'; message = state === 'needs_reconnect' ? '授权已失效，请重新连接。' : '暂时无法核验连接，请稍后刷新。' }
      }
      connections.push({ provider, state, label, message, configured: this.configured(provider), connectedAt: g?.connectedAt || null })
    }
    return { connections }
  }
  async taskConfig(credential) {
    // App calls never inherit the developer's shared YouTube or Notion grant.
    return { NOTION_TOKEN: await this.token(credential, 'notion'), YOUTUBE_ACCESS_TOKEN: await this.token(credential, 'youtube'), YOUTUBE_API_KEY: '', YOUTUBE_CLIENT_ID: '', YOUTUBE_CLIENT_SECRET: '' }
  }
}
