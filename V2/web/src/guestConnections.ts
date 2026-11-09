import { apiRequest } from './taskApi'

export type GuestConnection = {
  provider: 'youtube'
  state: 'connected' | 'disconnected' | 'needs_reconnect' | 'unavailable'
  label: string
  configured: boolean
  connectedAt: string | null
}

const states = ['connected', 'disconnected', 'needs_reconnect', 'unavailable']

export function youtubeAuthorizationUrl(value: unknown) {
  if (typeof value !== 'string') throw new Error('授权地址无效')
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('授权地址无效')
  }
  if (
    url.origin !== 'https://accounts.google.com' ||
    url.username ||
    url.password
  )
    throw new Error('授权地址无效')
  return url.href
}

export async function readYoutubeConnection(
  fetcher: typeof fetch = fetch
): Promise<GuestConnection | null> {
  const { data } = await apiRequest('/api/guest/connections', {}, '', fetcher)
  const row = Array.isArray(data?.connections)
    ? data.connections.find(
        (item: { provider?: string }) => item?.provider === 'youtube'
      )
    : null
  if (!row || !states.includes(row.state)) return null
  return {
    provider: 'youtube',
    state: row.state,
    label: String(row.label || '').slice(0, 120),
    configured: row.configured === true,
    connectedAt: typeof row.connectedAt === 'string' ? row.connectedAt : null,
  }
}

export async function startYoutubeConnection(fetcher: typeof fetch = fetch) {
  const { data } = await apiRequest(
    '/api/guest/connections/youtube/start',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    },
    '',
    fetcher
  )
  return youtubeAuthorizationUrl(data?.authorizationUrl)
}

export async function disconnectYoutube(fetcher: typeof fetch = fetch) {
  await apiRequest(
    '/api/guest/connections/youtube/disconnect',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    },
    '',
    fetcher
  )
}
