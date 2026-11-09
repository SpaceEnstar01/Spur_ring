import type { GuestConnection } from './guestConnections'

export type PlatformId =
  | 'youtube'
  | 'instagram'
  | 'tiktok'
  | 'x'
  | 'reddit'
  | 'douyin'

export type PlatformDefinition = {
  id: PlatformId
  name: string
  mark: string
  description: string
  home: boolean
}

export const platforms: PlatformDefinition[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    mark: '▶',
    description: '连接你的 YouTube 频道，管理和分析视频表现。',
    home: true,
  },
  {
    id: 'instagram',
    name: 'Instagram',
    mark: '◎',
    description: '连接你的 Instagram 创作者账号。',
    home: false,
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    mark: '♪',
    description: '连接你的 TikTok 创作者账号。',
    home: true,
  },
  {
    id: 'x',
    name: 'X',
    mark: '𝕏',
    description: '连接你的 X 账号。',
    home: true,
  },
  {
    id: 'reddit',
    name: 'Reddit',
    mark: '●',
    description: '连接你的 Reddit 账号。',
    home: true,
  },
  {
    id: 'douyin',
    name: '抖音',
    mark: '抖',
    description: '连接你的国内抖音账号，了解作品表现。',
    home: false,
  },
]

export type ConnectionView = {
  state: 'connected' | 'reconnect' | 'unavailable' | 'disconnected' | 'loading' | 'soon'
  label: string
  account: string
}

export function connectionView(
  id: PlatformId,
  youtube: GuestConnection | null,
  signedIn: boolean,
  ready: boolean
): ConnectionView {
  if (id !== 'youtube') return { state: 'soon', label: '即将支持', account: '' }
  if (!signedIn) return { state: 'disconnected', label: '未连接', account: '' }
  if (!ready) return { state: 'loading', label: '正在读取…', account: '' }
  if (!youtube) return { state: 'unavailable', label: '暂时无法核验', account: '' }
  if (youtube.state === 'connected') {
    return { state: 'connected', label: '已连接', account: youtube.label }
  }
  if (youtube.state === 'needs_reconnect') {
    return { state: 'reconnect', label: '需要重新连接', account: youtube.label }
  }
  if (youtube.state === 'unavailable') {
    return { state: 'unavailable', label: '暂时无法核验', account: '' }
  }
  return { state: 'disconnected', label: '未连接', account: '' }
}
