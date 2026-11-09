import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

// Personal demo mailbox only; this worker has no draft approval or email-send capability.
export class MailNotifications {
  constructor(file, { list, summarize, enabled = false, intervalMs = 60000, now = () => Date.now() }) {
    this.file = file; this.listMail = list; this.summarize = summarize; this.enabled = enabled; this.intervalMs = intervalMs; this.now = now; this.running = false; this.timer = null; this.stopped = false
    this.state = { baseline: false, messages: [], lastSyncAt: null, error: '', backlog: false }
    try {
      if (existsSync(file)) {
        this.state = JSON.parse(readFileSync(file, 'utf8'))
        if (!Array.isArray(this.state.messages) || typeof this.state.baseline !== 'boolean') throw new Error('Invalid mailbox ledger')
        for (const row of this.state.messages) if (row.state === 'summarizing') row.state = 'pending'
      }
    } catch { this.storageError = '邮件通知记录不可读取，已停止自动处理，请管理员核对。' }
  }
  save() {
    if (this.storageError) throw new Error(this.storageError)
    try {
      mkdirSync(dirname(this.file), { recursive: true, mode: 0o700 })
      const tmp = `${this.file}.${randomUUID()}.tmp`
      writeFileSync(tmp, JSON.stringify(this.state), { mode: 0o600 })
      renameSync(tmp, this.file)
    } catch { this.storageError = '邮件通知未能持久化，已停止自动处理。'; throw new Error(this.storageError) }
  }
  view() {
    return { enabled: this.enabled, initialized: this.state.baseline, lastSyncAt: this.state.lastSyncAt, error: this.storageError || this.state.error, backlog: this.state.backlog, unreadCount: this.state.messages.filter(m => m.unread).length, notifications: this.state.messages.filter(m => !m.historical).sort((a,b) => b.receivedAt - a.receivedAt) }
  }
  read(id) {
    if (this.storageError) throw new Error(this.storageError)
    const row = this.state.messages.find(m => m.id === id)
    if (row) { row.unread = false; this.save() }
    return this.view()
  }
  async tick() {
    if (!this.enabled || this.running || this.stopped || this.storageError) return
    this.running = true
    try {
      const incoming = await this.listMail()
      if (!Array.isArray(incoming)) throw new Error('Invalid mailbox response')
      const initial = !this.state.baseline
      const known = new Set(this.state.messages.map(m => m.id))
      this.state.backlog = incoming.length >= 50 && !incoming.some(m => known.has(m.id)) && !initial
      for (const mail of incoming) {
        if (!mail.id || known.has(mail.id)) continue
        this.state.messages.push({ id: mail.id, threadId: mail.threadId, sender: mail.sender, subject: mail.subject, timestamp: mail.timestamp, receivedAt: this.now(), historical: initial, unread: !initial, state: initial ? 'history' : 'pending', summary: '', needsAttention: false, attempts: 0, nextAttemptAt: 0 })
        known.add(mail.id)
      }
      this.state.baseline = true; this.state.lastSyncAt = new Date(this.now()).toISOString(); this.state.error = ''
      this.save() // Importing the historical baseline never runs the model or sends replies.
      for (const row of this.state.messages.filter(m => m.state === 'pending' && m.nextAttemptAt <= this.now()).slice(0, 2)) {
        if (this.stopped) break
        row.state = 'summarizing'; row.attempts++; this.save()
        try {
          const result = await this.summarize(row.id)
          if (this.stopped) { row.state = 'pending'; this.save(); break }
          if (!result || typeof result.summary !== 'string' || !result.summary.trim() || typeof result.needsAttention !== 'boolean') throw new Error('Invalid summary')
          row.summary = result.summary.trim().slice(0, 700); row.needsAttention = result.needsAttention; row.state = 'ready'
        } catch {
          row.state = row.attempts >= 3 ? 'failed' : 'pending'; row.nextAttemptAt = this.now() + Math.min(row.attempts * 60000, 300000)
          row.summary = row.state === 'failed' ? '自动摘要暂未完成，打开原信后可手动分析。' : ''
        }
        this.save()
      }
    } catch { this.state.error = '收件同步暂时失败，将自动重试；现有邮件记录保留。' }
    finally { this.running = false }
  }
  start() {
    if (!this.enabled || this.timer || this.storageError) return
    this.stopped = false; this.tick().catch(() => {})
    this.timer = setInterval(() => this.tick().catch(() => {}), this.intervalMs)
    this.timer.unref?.()
  }
  stop() { this.stopped = true; if (this.timer) clearInterval(this.timer); this.timer = null }
}
