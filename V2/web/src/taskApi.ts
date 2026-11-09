import type { VideoTask } from './VideoTask'

export type Plan = {
  steps: Array<{ title: string; status: string; evidence?: string }>
}
export type Link = { title: string; url: string }
export type AgentResult = {
  runId?: string
  response: string
  sources?: Link[]
  artifacts?: Link[]
  media?: Array<Link & { kind: 'image' }>
  videoJobs?: VideoTask[]
  plan?: Plan | null
}
export type Activity = {
  tool?: string
  event?: string
  source?: string
  available?: boolean
}
export type TaskSnapshot = {
  queue?: { state: string; position: number; active: number; limit: number }
  runId: string
  status: string
  updatedAt?: string
  plan?: Plan | null
  activity?: Activity | null
  result?: AgentResult | null
  error?: string | null
}
export type Task = {
  queue?: TaskSnapshot['queue']
  id: string
  title: string
  createdAt: string
  status: 'submitting' | 'running' | 'finished' | 'failed' | 'unknown'
  result?: AgentResult
  plan?: Plan | null
  events: Array<Activity & { observedAt: string }>
  connectionError?: string
  error?: string
  parentId?: string
}
export function taskHistory(parent: Task | undefined, tasks: Task[]) {
  const chain: Task[] = []
  const seen = new Set<string>()
  let current = parent
  while (current && chain.length < 5 && !seen.has(current.id)) {
    chain.push(current)
    seen.add(current.id)
    current = tasks.find((t) => t.id === current?.parentId)
  }
  return chain
    .reverse()
    .flatMap((t) => [
      { role: 'user', content: t.title },
      ...(t.result ? [{ role: 'assistant', content: t.result.response }] : []),
    ])
}
export let backendScope = ''
export let backendLabel = '本机 Agent'
export let publicGuest = false
export function configureBackend(value: {scope?: string; label?: string; mode?: string}) {
  publicGuest = value.mode === 'guest-public' && value.scope === 'guest:public'
  backendScope = publicGuest ? 'guest:public' : value.scope === 'https://api.hispurring.com' || /^guest:guest-[a-f0-9]{24}$/.test(value.scope || '') ? value.scope! : ''
  backendLabel = backendScope.startsWith('guest:') ? 'Spur Cloud' : backendScope ? '硅谷 ECS' : '本机 Agent'
}
export function apiBase() {
  if (backendScope.startsWith('guest:')) return ''
  return (
    (
      import.meta.env?.VITE_CREATOR_AGENT_API_URL as string | undefined
    )?.replace(/\/$/, '') ?? ''
  )
}
export function resourceUrl(url: string, base = apiBase()) {
  try {
    const parsed = new URL(url, base || window.location.origin)
    if (backendScope && parsed.origin === backendScope && /^\/api\/creator-agent\/(artifacts|videos)\//.test(parsed.pathname)) return new URL(parsed.pathname + parsed.search, base || window.location.origin).href
    return ['http:', 'https:'].includes(parsed.protocol)
      ? parsed.href
      : undefined
  } catch {
    return undefined
  }
}
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}
export async function apiRequest(
  path: string,
  options: RequestInit = {},
  base = apiBase(),
  fetcher: typeof fetch = fetch
) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const r = await fetcher(base + path, {
      ...options,
      cache: 'no-store',
      signal: controller.signal,
    })
    const data = await r.json().catch(() => null)
    if (!r.ok)
      throw new ApiError(
        data?.error ||
          (r.status === 401
            ? '当前网页缺少有效授权，请使用已授权的服务入口。'
            : `服务返回 ${r.status}`),
        r.status
      )
    return { status: r.status, data }
  } finally {
    clearTimeout(timer)
  }
}
export async function submitTask(
  id: string,
  message: string,
  history: Array<{ role: string; content: string }>,
  base = apiBase(),
  fetcher: typeof fetch = fetch
): Promise<AgentResult | null> {
  try {
    const { status, data } = await apiRequest(
      '/api/creator-agent/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id, message, history, async: true }),
      },
      base,
      fetcher
    )
    if (status === 202) {
      if (data?.runId !== id)
        throw new ApiError('任务编号不匹配，请保留当前任务并联系管理员。', 502)
      return null
    }
    if (typeof data?.response === 'string' && data.response.trim()) return data
    throw new ApiError('服务没有返回有效任务回执。', 502)
  } catch (error) {
    if (error instanceof ApiError && error.status !== 409) throw error
    // A lost acknowledgement or duplicate ID is resolved only by GET. Never repost.
    const { data } = await apiRequest(
      '/api/creator-agent/tasks/' + id,
      {},
      base,
      fetcher
    )
    if (data?.runId !== id) throw new ApiError('任务编号不匹配。', 502)
    if (data.status === 'failed')
      throw new ApiError(data.error || '任务执行失败。', 422)
    return data.status === 'finished' && data.result?.response
      ? data.result
      : null
  }
}
export async function fetchTask(id: string): Promise<TaskSnapshot> {
  const { data } = await apiRequest('/api/creator-agent/tasks/' + id)
  if (data?.runId !== id) throw new ApiError('任务编号不匹配。', 502)
  if (data.status === 'finished' && !data.result?.response)
    throw new ApiError('任务已结束，但结果暂不可读取，请保留任务编号。', 502)
  return data
}
export function mergeSnapshot(task: Task, snapshot: TaskSnapshot): Task {
  const events = [...task.events]
  const activity = snapshot.activity
  const last = events[events.length - 1]
  if (
    activity?.tool &&
    JSON.stringify([last?.tool, last?.event, last?.source, last?.available]) !==
      JSON.stringify([
        activity.tool,
        activity.event,
        activity.source,
        activity.available,
      ])
  )
    events.push({ ...activity, observedAt: new Date().toISOString() })
  return {
    ...task,
    queue: snapshot.queue,
    status:
      snapshot.status === 'finished'
        ? 'finished'
        : snapshot.status === 'failed'
        ? 'failed'
        : 'running',
    plan: snapshot.plan,
    result: snapshot.result || task.result,
    error: snapshot.error || undefined,
    connectionError: undefined,
    events: events.slice(-100),
  }
}
