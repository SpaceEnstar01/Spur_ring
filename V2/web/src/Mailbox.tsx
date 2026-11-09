import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { apiBase as getApiBase } from './taskApi'
type EmailMessage = {
  id: string
  threadId: string
  sender: string
  subject: string
  timestamp: string
  preview: string
}

export function Mailbox({ onClose }: { onClose: () => void }) {
  const [mailboxConfigured, setMailboxConfigured] = useState(false)
  const [mailboxId, setMailboxId] = useState('')
  const [emailMessages, setEmailMessages] = useState<EmailMessage[]>([])
  const [mailboxLoading, setMailboxLoading] = useState(false)
  const [mailboxError, setMailboxError] = useState('')
  const [analyzingEmailId, setAnalyzingEmailId] = useState('')
  const [emailAnalysis, setEmailAnalysis] = useState<{
    id: string
    response: string
    recipient: string
    draft: { subject: string; text: string } | null
    sent?: { replyMessageId?: string; sentAt?: string }
  } | null>(null)
  const [emailSendingId, setEmailSendingId] = useState('')

  useEffect(() => {
    void openMailbox()
  }, [])
  async function refreshMailbox() {
    setMailboxLoading(true)
    setMailboxError('')
    try {
      const response = await fetch(
        `${getApiBase()}/api/creator-agent/email/messages?limit=30`,
        { cache: 'no-store' }
      )
      const result = (await response.json()) as {
        error?: string
        inboxId?: string
        messages?: EmailMessage[]
      }
      if (!response.ok)
        throw new Error(result.error || `服务返回 ${response.status}`)
      setMailboxConfigured(true)
      setMailboxId(result.inboxId || '')
      setEmailMessages(result.messages || [])
    } catch (cause) {
      setMailboxError(
        cause instanceof Error ? cause.message : '读取收件箱失败。'
      )
    } finally {
      setMailboxLoading(false)
    }
  }

  async function openMailbox() {
    setMailboxError('')
    setEmailAnalysis(null)
    try {
      const response = await fetch(
        `${getApiBase()}/api/creator-agent/email/status`,
        { cache: 'no-store' }
      )
      const status = (await response.json()) as {
        configured?: boolean
        inboxId?: string | null
      }
      setMailboxConfigured(Boolean(status.configured))
      setMailboxId(status.inboxId || '')
      if (status.configured) await refreshMailbox()
    } catch {
      setMailboxError('无法连接 Spur 邮件服务，请确认本地 Agent 服务正在运行。')
    }
  }

  async function analyzeEmail(messageId: string) {
    setAnalyzingEmailId(messageId)
    setMailboxError('')
    setEmailAnalysis(null)
    try {
      const response = await fetch(
        `${getApiBase()}/api/creator-agent/email/analyze`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId }),
        }
      )
      const result = (await response.json()) as {
        error?: string
        response?: string
        recipient?: string
        draft?: { subject?: string; text?: string } | null
      }
      if (!response.ok)
        throw new Error(result.error || `服务返回 ${response.status}`)
      if (!result.response?.trim()) throw new Error('Agent 没有返回分析结果。')
      const draft =
        result.draft?.subject && result.draft?.text
          ? { subject: result.draft.subject, text: result.draft.text }
          : null
      setEmailAnalysis({
        id: messageId,
        response: result.response,
        recipient: result.recipient || '',
        draft,
      })
    } catch (cause) {
      setMailboxError(cause instanceof Error ? cause.message : '邮件分析失败。')
    } finally {
      setAnalyzingEmailId('')
    }
  }

  async function sendEmailReply(analysis: NonNullable<typeof emailAnalysis>) {
    if (!analysis.draft || !analysis.recipient || emailSendingId) return
    const confirmed = window.confirm(
      `确认发送这封回复？\n\n收件人：${analysis.recipient}\n主题：${analysis.draft.subject}\n\n邮件将从 ${mailboxId} 发出。`
    )
    if (!confirmed) return
    setEmailSendingId(analysis.id)
    setMailboxError('')
    try {
      const post = async (path: string, payload: unknown) => {
        const response = await fetch(`${getApiBase()}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await response.json()
        if (!response.ok)
          throw new Error(result.error || `服务返回 ${response.status}`)
        return result
      }
      const listed = await fetch(
        `${getApiBase()}/api/creator-agent/email/drafts`,
        { cache: 'no-store' }
      ).then((r) => r.json())
      const prior = listed.drafts?.find(
        (d: { messageId: string }) => d.messageId === analysis.id
      )
      if (prior && ['sending', 'unknown', 'accepted'].includes(prior.status))
        throw new Error('该邮件已提交或状态待核对，请勿重发。')
      const saved = await post(
        `/api/creator-agent/email/drafts${prior ? '/' + prior.id : ''}`,
        {
          messageId: analysis.id,
          subject: analysis.draft.subject,
          text: analysis.draft.text,
          analysis: analysis.response,
          version: prior?.version,
        }
      )
      const approved = await post(
        `/api/creator-agent/email/drafts/${saved.draft.id}/approve`,
        { version: saved.draft.version, confirm: true }
      )
      const result = await post('/api/creator-agent/email/reply', {
        draftId: saved.draft.id,
        version: saved.draft.version,
        approvalId: approved.approvalId,
        confirm: true,
      })
      if (!result.accepted) throw new Error('未确认提交发送，请核对邮箱状态。')
      setEmailAnalysis((current) =>
        current?.id === analysis.id
          ? {
              ...current,
              sent: {
                replyMessageId: result.draft.replyMessageId,
                sentAt: result.draft.acceptedAt,
              },
            }
          : current
      )
    } catch (cause) {
      setMailboxError(cause instanceof Error ? cause.message : '发送回复失败。')
    } finally {
      setEmailSendingId('')
    }
  }

  return (
    <div className="email-workspace">
      <div className="email-heading-row">
        <div>
          <p className="eyebrow">SPUR CREATOR AGENT</p>
          <h1>合作收件箱</h1>
          <p className="welcome-subtitle">
            逐封查看 Agent 专用邮箱中的合作来信，生成分析与待审回复。
          </p>
        </div>
        <div className="email-heading-actions">
          <button
            className="email-secondary-button"
            onClick={() => {
              onClose()
              setMailboxError('')
            }}
          >
            返回对话
          </button>
          {mailboxConfigured && (
            <button
              className="email-refresh-button"
              onClick={() => void refreshMailbox()}
              disabled={mailboxLoading}
            >
              <Icon name="refresh" size={16} />
              {mailboxLoading ? '同步中' : '刷新'}
            </button>
          )}
        </div>
      </div>
      {mailboxError && (
        <div className="email-notice email-notice-error" role="status">
          {mailboxError}
        </div>
      )}
      {!mailboxConfigured ? (
        <div className="email-setup-card">
          <div className="email-setup-icon">
            <Icon name="mail" size={20} />
          </div>
          <div>
            <strong>先连接 AgentMail 收件箱</strong>
            <p>
              在本机服务端配置只读 API Key 和邮箱地址，然后重启
              Spur。密钥不会发送到网页。
            </p>
            <code>AGENTMAIL_API_KEY · AGENTMAIL_INBOX_ID</code>
          </div>
        </div>
      ) : (
        <>
          <div className="email-inbox-meta">
            <span>
              <span className="email-online-dot" />
              已连接
            </span>
            <strong>{mailboxId}</strong>
            <span>{emailMessages.length} 封来信</span>
          </div>
          <div className="email-privacy-note">
            点击分析后，所选邮件正文会发送给当前配置的 SiliconFlow
            模型。回复只会在你审阅草稿并再次确认后发送。
          </div>
          {mailboxLoading && emailMessages.length === 0 ? (
            <div className="email-empty-state">正在读取收件箱…</div>
          ) : emailMessages.length === 0 ? (
            <div className="email-empty-state">
              暂时没有收到来信。你可以从个人邮箱向这个地址发送一封测试邮件。
            </div>
          ) : (
            <div className="email-message-list">
              {emailMessages.map((message) => (
                <article
                  className={`email-message-card ${
                    emailAnalysis?.id === message.id
                      ? 'email-message-selected'
                      : ''
                  }`}
                  key={message.id}
                >
                  <div className="email-message-top">
                    <strong>{message.sender || '发件人未知'}</strong>
                    <time>
                      {message.timestamp
                        ? new Date(message.timestamp).toLocaleString()
                        : ''}
                    </time>
                  </div>
                  <h2>{message.subject}</h2>
                  <p className="email-preview">
                    {message.preview || '（没有可显示的文字预览）'}
                  </p>
                  <button
                    className="email-analyze-button"
                    onClick={() => void analyzeEmail(message.id)}
                    disabled={Boolean(analyzingEmailId)}
                  >
                    {analyzingEmailId === message.id
                      ? '正在生成分析与草稿…'
                      : '生成合作分析与回复草稿'}
                  </button>
                  {emailAnalysis?.id === message.id && (
                    <div className="email-analysis-result">
                      <div className="email-analysis-title">
                        <Icon name="spark" size={16} />
                        <strong>合作分析</strong>
                      </div>
                      <div className="email-analysis-body">
                        {emailAnalysis.response}
                      </div>
                      {emailAnalysis.sent ? (
                        <div className="email-sent-notice" role="status">
                          已发送给 {emailAnalysis.recipient}
                          {emailAnalysis.sent.sentAt
                            ? ` · ${new Date(
                                emailAnalysis.sent.sentAt
                              ).toLocaleString()}`
                            : ''}
                        </div>
                      ) : emailAnalysis.draft && emailAnalysis.recipient ? (
                        <div className="email-draft-editor">
                          <div className="email-draft-heading">
                            <strong>回复草稿</strong>
                            <span>请检查并可直接修改</span>
                          </div>
                          <label>
                            收件人
                            <input value={emailAnalysis.recipient} readOnly />
                          </label>
                          <label>
                            主题
                            <input
                              value={emailAnalysis.draft.subject}
                              onChange={(event) =>
                                setEmailAnalysis((current) =>
                                  current?.id === message.id && current.draft
                                    ? {
                                        ...current,
                                        draft: {
                                          ...current.draft,
                                          subject: event.target.value,
                                        },
                                      }
                                    : current
                                )
                              }
                            />
                          </label>
                          <label>
                            正文
                            <textarea
                              rows={9}
                              value={emailAnalysis.draft.text}
                              onChange={(event) =>
                                setEmailAnalysis((current) =>
                                  current?.id === message.id && current.draft
                                    ? {
                                        ...current,
                                        draft: {
                                          ...current.draft,
                                          text: event.target.value,
                                        },
                                      }
                                    : current
                                )
                              }
                            />
                          </label>
                          <div className="email-draft-footer">
                            <span>发送前会再次弹出确认</span>
                            <button
                              className="email-send-reply-button"
                              onClick={() => void sendEmailReply(emailAnalysis)}
                              disabled={
                                Boolean(emailSendingId) ||
                                !emailAnalysis.draft.subject.trim() ||
                                !emailAnalysis.draft.text.trim()
                              }
                            >
                              <Icon name="send" size={15} />
                              {emailSendingId === message.id
                                ? '正在发送…'
                                : '确认并发送回复'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="email-notice">
                          分析已完成，但没有提取到可安全编辑的回复草稿；不会提供发送操作。
                        </div>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
