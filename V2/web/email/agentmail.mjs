const API_ROOT = 'https://api.agentmail.to/v0'

export function agentMailConfig(source = process.env) {
  const apiKey = String(source.AGENTMAIL_API_KEY || '').trim()
  const inboxId = String(source.AGENTMAIL_INBOX_ID || '').trim()
  return {
    configured: Boolean(apiKey && inboxId),
    apiKey,
    inboxId,
  }
}

async function request(path, apiKey, fetchImpl = fetch, options = {}) {
  const response = await fetchImpl(`${API_ROOT}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', ...(options.headers || {}) },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    const safeDetail = detail.replace(/am_[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 300)
    throw new Error(`AgentMail returned ${response.status}${safeDetail ? `: ${safeDetail}` : ''}`)
  }
  return response.json()
}

export function normalizeMessage(message) {
  const html = String(message.extracted_html || message.html || '')
  const htmlText = html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|br|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
  const body = String(message.extracted_text || message.text || htmlText || message.preview || '').trim()
  const sender = Array.isArray(message.from) ? message.from.join(', ') : String(message.from || '')
  return {
    id: String(message.message_id || ''),
    threadId: String(message.thread_id || ''),
    sender,
    subject: String(message.subject || '(无主题)'),
    timestamp: String(message.timestamp || message.created_at || ''),
    preview: body.slice(0, 420),
    body,
    labels: Array.isArray(message.labels) ? message.labels.map(String) : [],
  }
}

export async function getAgentMailInbox(config, fetchImpl = fetch) {
  if (!config.configured) throw new Error('AgentMail 尚未配置。')
  return request(`/inboxes/${encodeURIComponent(config.inboxId)}`, config.apiKey, fetchImpl)
}

export async function listAgentMailMessages(config, limit = 20, fetchImpl = fetch) {
  if (!config.configured) throw new Error('AgentMail 尚未配置。')
  const boundedLimit = Math.min(50, Math.max(1, Number(limit) || 20))
  const query = new URLSearchParams({ limit: String(boundedLimit), ascending: 'false' })
  const result = await request(`/inboxes/${encodeURIComponent(config.inboxId)}/messages?${query}`, config.apiKey, fetchImpl)
  const messages = Array.isArray(result.messages) ? result.messages : []
  return messages
    .filter((message) => !Array.isArray(message.labels) || message.labels.includes('received'))
    .map(normalizeMessage)
}

export async function getAgentMailMessage(config, messageId, fetchImpl = fetch) {
  if (!config.configured) throw new Error('AgentMail 尚未配置。')
  const id = String(messageId || '').trim()
  if (!id || id.length > 300) throw new Error('邮件编号无效。')
  const result = await request(`/inboxes/${encodeURIComponent(config.inboxId)}/messages/${encodeURIComponent(id)}`, config.apiKey, fetchImpl)
  return normalizeMessage(result.message || result)
}

export function emailAddressFromSender(sender) {
  const value = String(sender || '').trim()
  const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
  if (matches.length !== 1) return ''
  const address = matches[0].trim()
  return /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address) ? address : ''
}

export async function replyToAgentMailMessage(config, messageId, { text, subject }, fetchImpl = fetch) {
  if (!config.configured) throw new Error('AgentMail 尚未配置。')
  const id = String(messageId || '').trim()
  const body = String(text || '').trim()
  const title = String(subject || '').trim()
  if (!id || id.length > 300) throw new Error('邮件编号无效。')
  if (!body || body.length > 20000) throw new Error('回复正文不能为空且不能超过 20,000 个字符。')
  if (!title || title.length > 500) throw new Error('邮件主题不能为空且不能超过 500 个字符。')
  return request(`/inboxes/${encodeURIComponent(config.inboxId)}/messages/${encodeURIComponent(id)}/reply`, config.apiKey, fetchImpl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: body, subject: title }),
  })
}


// A reply draft lets us preserve the exact edited subject and bind one approved recipient.
// Official API: drafts.create(in_reply_to), drafts.update, drafts.send.
export async function sendApprovedAgentMailDraft(config, messageId, { subject, text, recipient, clientId }, fetchImpl = fetch) {
  if (!config.configured || !messageId || !emailAddressFromSender(recipient) || !subject?.trim() || !text?.trim()) throw new Error('已批准草稿参数无效。')
  const root = `/inboxes/${encodeURIComponent(config.inboxId)}/drafts`
  const created = await request(root, config.apiKey, fetchImpl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ in_reply_to: messageId, reply_all: false, to: [recipient], subject, text, client_id: clientId }) })
  if (!created.draft_id) throw new Error('AgentMail 未返回草稿编号。')
  const path = `${root}/${encodeURIComponent(created.draft_id)}`
  const reviewed = await request(path, config.apiKey, fetchImpl, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: [recipient], cc: [], bcc: [], subject, text }) })
  if (reviewed.in_reply_to !== messageId || reviewed.subject !== subject || reviewed.text !== text || reviewed.to?.length !== 1 || emailAddressFromSender(reviewed.to[0]) !== recipient || reviewed.cc?.length || reviewed.bcc?.length) throw new Error('服务商草稿与批准内容不一致，未发送。')
  const sent = await request(`${path}/send`, config.apiKey, fetchImpl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  if (typeof sent.message_id !== 'string' || !sent.message_id) throw new Error('服务商没有返回有效发送编号，请人工核对。')
  return sent
}
