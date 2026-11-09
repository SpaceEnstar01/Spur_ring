import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const fail = (message, status = 409) => Object.assign(new Error(message), { status })
export function mailboxScope(inboxId, token = '') {
  return createHash('sha256').update(`${inboxId}\0${token}`).digest('hex')
}
// Single-process, single-Agent mailbox ledger. Not a multi-tenant or exactly-once system.
export class EmailWorkflow {
  constructor(file) {
    this.file = file
    this.records = []
    this.error = null
    try {
      if (existsSync(file)) {
        const stored = JSON.parse(readFileSync(file, 'utf8'))
        if (!Array.isArray(stored) || stored.some(r => !r.id || !r.scope || !r.messageId || !Number.isInteger(r.version))) throw new Error('Invalid ledger')
        this.records = stored
        let changed = false
        for (const r of this.records) if (r.status === 'sending') {
          r.status = 'unknown'; r.error = '发送期间服务重启，请先人工核对 AgentMail，禁止自动重发。'; changed = true
        }
        if (changed) this.save()
      }
    } catch { this.error = '邮件状态存储不可读取，已停止发送；请管理员核对持久化文件。' }
  }
  ready() { if (this.error) throw fail(this.error, 503) }
  save() {
    this.ready()
    mkdirSync(dirname(this.file), { recursive: true, mode: 0o700 })
    const tmp = `${this.file}.${randomUUID()}.tmp`
    try {
      writeFileSync(tmp, JSON.stringify(this.records), { mode: 0o600 })
      renameSync(tmp, this.file)
    } catch {
      this.error = '邮件状态未能持久化，已停止发送。'
      throw fail(this.error, 503)
    }
  }
  list(scope) { this.ready(); return this.records.filter(r => r.scope === scope).map(r => this.public(r)) }
  get(id, scope) {
    this.ready()
    const r = this.records.find(row => row.id === id && row.scope === scope)
    if (!r) throw fail('草稿不存在或不属于当前邮箱。', 404)
    return r
  }
  public(r) {
    const { scope, approvalId, ...view } = r
    return structuredClone(view)
  }
  draft({ scope, inboxId, messageId, recipient, subject, text, analysis = '', id, version }) {
    this.ready()
    if (!messageId || !recipient || typeof subject !== 'string' || !subject.trim() || subject.length > 500 || typeof text !== 'string' || !text.trim() || text.length > 20000) throw fail('邮件对象、主题或正文无效。', 400)
    const existing = id ? this.get(id, scope) : this.records.find(r => r.scope === scope && r.messageId === messageId)
    if (existing) {
      if (!id || version !== existing.version) throw fail('已有草稿，请刷新并使用最新版本。')
      if (existing.messageId !== messageId || existing.recipient !== recipient) throw fail('原邮件或回复对象发生变化，请重新核对。')
      if (['sending', 'accepted', 'unknown'].includes(existing.status)) throw fail('该邮件已提交发送或发送状态待核对，不能覆盖或重发。')
      Object.assign(existing, { subject: subject.trim(), text: text.trim(), analysis, version: existing.version + 1, status: 'draft', approvalId: null, approvedAt: null, updatedAt: new Date().toISOString() })
    } else {
      this.records.push({ id: randomUUID(), scope, inboxId, messageId, recipient, subject: subject.trim(), text: text.trim(), analysis, version: 1, status: 'draft', approvalId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    }
    this.save()
    return this.public(existing || this.records.at(-1))
  }
  approve(id, scope, version, confirm) {
    const r = this.get(id, scope)
    if (confirm !== true) throw fail('请明确确认这封邮件的收件人和当前正文。', 400)
    if (r.version !== version || !['draft', 'approved'].includes(r.status)) throw fail('草稿已更改或不能批准，请刷新。')
    r.status = 'approved'; r.approvalId = randomUUID(); r.approvedAt = new Date().toISOString()
    this.save()
    return { draft: this.public(r), approvalId: r.approvalId }
  }
  async send({ id, scope, version, approvalId, confirm }, send) {
    const r = this.get(id, scope)
    if (r.status === 'accepted') return { ...this.public(r), duplicatePrevented: true }
    if (confirm !== true || r.status !== 'approved' || r.version !== version || !approvalId || r.approvalId !== approvalId) throw fail('缺少有效批准，或邮件版本已经变化。')
    if (Date.now() - Date.parse(r.approvedAt) > 15 * 60 * 1000) throw fail('批准已过期，请重新审阅。')
    r.status = 'sending'
    this.save() // Durable intent before any external side effect; concurrent calls now fail.
    try {
      const result = await send(this.public(r))
      r.status = 'accepted'; r.replyMessageId = result.message_id || result.messageId || ''; r.threadId = result.thread_id || result.threadId || ''; r.acceptedAt = new Date().toISOString(); r.approvalId = null
      this.save()
      return this.public(r)
    } catch (error) {
      r.status = 'unknown'; r.error = '未能确认发送状态，请人工核对邮箱后处理；不要直接重发。'; r.approvalId = null
      if (!this.error) this.save()
      throw fail(r.error, 502)
    }
  }
}
