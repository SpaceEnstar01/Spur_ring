import test from 'node:test'
import assert from 'node:assert/strict'
import { agentMailConfig, emailAddressFromSender, getAgentMailInbox, listAgentMailMessages, normalizeMessage, replyToAgentMailMessage } from './agentmail.mjs'
import { extractEmailDraft, stripDraftMarker } from './reply-draft.mjs'

test('configuration never requires or returns credentials to the UI shape', () => {
  assert.equal(agentMailConfig({}).configured, false)
  const config = agentMailConfig({ AGENTMAIL_API_KEY: 'am_private', AGENTMAIL_INBOX_ID: 'creator@agentmail.to' })
  assert.equal(config.configured, true)
  assert.equal(config.inboxId, 'creator@agentmail.to')
})

test('normalizes an inbound message without exposing HTML', () => {
  const message = normalizeMessage({
    message_id: 'msg-1', thread_id: 'thread-1', from: ['brand@example.test'], subject: '合作',
    timestamp: '2026-10-31T10:00:00Z', extracted_text: '预算 5000 元', html: '<b>ignored</b>', labels: ['received'],
  })
  assert.equal(message.id, 'msg-1')
  assert.equal(message.sender, 'brand@example.test')
  assert.equal(message.body, '预算 5000 元')
  assert.equal('html' in message, false)
  assert.match(normalizeMessage({ html: '<p>New&nbsp;campaign</p><script>ignore()</script>' }).body, /New campaign/)
  assert.doesNotMatch(normalizeMessage({ html: '<p>New&nbsp;campaign</p><script>ignore()</script>' }).body, /ignore/)
})

test('lists only received mail and bounds the requested page size', async () => {
  let requestedUrl = ''
  const messages = await listAgentMailMessages(
    agentMailConfig({ AGENTMAIL_API_KEY: 'am_private', AGENTMAIL_INBOX_ID: 'creator@agentmail.to' }),
    999,
    async (url, options) => {
      requestedUrl = url
      assert.equal(options.headers.Authorization, 'Bearer am_private')
      return Response.json({ messages: [
        { message_id: 'in', labels: ['received'], from: 'brand@example.test', text: 'hello' },
        { message_id: 'out', labels: ['sent'], from: 'creator@agentmail.to', text: 'reply' },
      ] })
    },
  )
  assert.match(requestedUrl, /limit=50/)
  assert.deepEqual(messages.map((message) => message.id), ['in'])
})

test('fails closed when no mailbox has been configured', async () => {
  await assert.rejects(() => getAgentMailInbox(agentMailConfig({})), /尚未配置/)
})

test('extracts one email address for an explicit reply target', () => {
  assert.equal(emailAddressFromSender('Leo <leo@example.test>'), 'leo@example.test')
  assert.equal(emailAddressFromSender('not-an-email'), '')
  assert.equal(emailAddressFromSender('Team <a@example.test>, b@example.test'), '')
})

test('replies only through the original message thread and validates the edited draft', async () => {
  let requestedUrl = ''
  let sentPayload
  const config = agentMailConfig({ AGENTMAIL_API_KEY: 'am_private', AGENTMAIL_INBOX_ID: 'creator@agentmail.to' })
  const result = await replyToAgentMailMessage(config, 'msg-1', { subject: 'Re: 合作', text: '谢谢来信' }, async (url, options) => {
    requestedUrl = url
    sentPayload = JSON.parse(options.body)
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.Authorization, 'Bearer am_private')
    assert.equal(options.headers['Content-Type'], 'application/json')
    return Response.json({ message_id: 'reply-1', thread_id: 'thread-1' })
  })
  assert.match(requestedUrl, /\/messages\/msg-1\/reply$/)
  assert.deepEqual(sentPayload, { subject: 'Re: 合作', text: '谢谢来信' })
  assert.equal(result.message_id, 'reply-1')
  await assert.rejects(() => replyToAgentMailMessage(config, 'msg-1', { subject: '', text: 'x' }, async () => Response.json({})), /主题不能为空/)
})

test('extracts only a structured single reply draft and hides its marker from the UI report', () => {
  const report = `合作分析内容\n\n<<SPUR_DRAFT_JSON>>${JSON.stringify({ subject: 'Re: 合作', text: 'Leo 你好，\n感谢来信。' })}<<END_SPUR_DRAFT_JSON>>`
  assert.deepEqual(extractEmailDraft(report), { subject: 'Re: 合作', text: 'Leo 你好，\n感谢来信。' })
  assert.equal(stripDraftMarker(report), '合作分析内容')
  assert.equal(extractEmailDraft('<<SPUR_DRAFT_JSON>>{bad}<<END_SPUR_DRAFT_JSON>>'), null)
})

