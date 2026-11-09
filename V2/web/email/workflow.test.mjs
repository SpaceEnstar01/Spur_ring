import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EmailWorkflow, mailboxScope } from './workflow.mjs'
import { sendApprovedAgentMailDraft } from './agentmail.mjs'
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'spur-mail-test-')); t.after(() => rmSync(dir, { recursive: true, force: true }))
  const file = join(dir, 'state.json'), workflow = new EmailWorkflow(file), scope = mailboxScope('agent@example.test', 'token')
  const input = { scope, inboxId: 'agent@example.test', messageId: 'msg-1', recipient: 'partner@example.test', subject: 'Re: 合作', text: '谢谢，请补充预算。' }
  return { file, workflow, scope, input }
}
test('editing invalidates approval; a different mailbox cannot read or approve it', async t => {
  const { workflow, scope, input } = fixture(t); const d = workflow.draft(input), a = workflow.approve(d.id, scope, d.version, true)
  assert.throws(() => workflow.get(d.id, 'other-scope'), /不存在/)
  const changed = workflow.draft({ ...input, id: d.id, version: 1, text: '新的正文' })
  assert.equal(changed.version, 2); assert.equal(changed.status, 'draft'); assert.equal('approvalId' in changed, false)
  let calls = 0; await assert.rejects(() => workflow.send({ id: d.id, scope, version: 1, approvalId: a.approvalId, confirm: true }, () => { calls++; }), /批准/); assert.equal(calls, 0)
})
test('approved content is persisted before sending and accepted is not sent twice', async t => {
  const { workflow, file, scope, input } = fixture(t); const d = workflow.draft(input), a = workflow.approve(d.id, scope, 1, true)
  const args = { id: d.id, scope, version: 1, approvalId: a.approvalId, confirm: true }; let calls = 0
  const submit = async draft => { calls++; assert.equal(draft.recipient, input.recipient); assert.equal(JSON.parse(readFileSync(file))[0].status, 'sending'); return { message_id: 'reply-1' } }
  assert.equal((await workflow.send(args, submit)).status, 'accepted')
  assert.equal((await workflow.send(args, submit)).duplicatePrevented, true); assert.equal(calls, 1)
})
test('a concurrent submit is rejected while the first request is running', async t => {
  const { workflow, scope, input } = fixture(t); const d = workflow.draft(input), a = workflow.approve(d.id, scope, 1, true); const args = { id: d.id, scope, version: 1, approvalId: a.approvalId, confirm: true }
  let done; const first = workflow.send(args, () => new Promise(resolve => { done = resolve }))
  await assert.rejects(() => workflow.send(args, () => { throw new Error('must not run') }), /批准/)
  done({ message_id: 'reply' }); await first
})
test('timeout and restart during sending become unknown and cannot be resent', async t => {
  const { workflow, file, scope, input } = fixture(t); const d = workflow.draft(input), a = workflow.approve(d.id, scope, 1, true); const args = { id: d.id, scope, version: 1, approvalId: a.approvalId, confirm: true }
  await assert.rejects(() => workflow.send(args, async () => { throw new Error('timeout') }), /人工核对/)
  assert.equal(workflow.get(d.id, scope).status, 'unknown')
  const rows = JSON.parse(readFileSync(file)); rows[0].status = 'sending'; writeFileSync(file, JSON.stringify(rows))
  const restored = new EmailWorkflow(file); assert.equal(restored.get(d.id, scope).status, 'unknown')
  await assert.rejects(() => restored.send(args, () => { throw new Error('must not run') }), /批准/)
})
test('invalid storage and stale draft revisions fail closed', t => {
  const { workflow, file, scope, input } = fixture(t); const d = workflow.draft(input)
  assert.throws(() => workflow.draft({ ...input, id: d.id, version: 99 }), /最新版本/)
  writeFileSync(file, '{broken'); assert.throws(() => new EmailWorkflow(file).list(scope), /存储不可读取/)
})
test('provider reply uses an explicitly addressed, edited and verified draft', async () => {
  const calls = [], config = { configured: true, apiKey: 'mock', inboxId: 'agent@example.test' }
  const args = { recipient: 'partner@example.test', subject: '已编辑主题', text: '已编辑正文', clientId: 'draft-v1' }
  const fetchImpl = async (url, init) => {
    calls.push({ url, method: init.method, body: JSON.parse(init.body) })
    if (init.method === 'PATCH') return Response.json({ ...args, to: [args.recipient], cc: [], bcc: [], in_reply_to: 'msg-1' })
    return Response.json(url.endsWith('/send') ? { message_id: 'reply' } : { draft_id: 'provider-draft' })
  }
  await sendApprovedAgentMailDraft(config, 'msg-1', args, fetchImpl)
  assert.equal(calls.length, 3); assert.equal(calls[0].body.in_reply_to, 'msg-1'); assert.equal(calls[0].body.reply_all, false); assert.deepEqual(calls[1].body.to, [args.recipient]); assert.equal(calls[2].url.endsWith('/provider-draft/send'), true)
})
test('provider recipient mismatch never reaches the sending endpoint', async () => {
  let sent = false
  await assert.rejects(() => sendApprovedAgentMailDraft({ configured: true, apiKey: 'mock', inboxId: 'agent@example.test' }, 'msg', { recipient: 'partner@example.test', subject: 's', text: 't' }, async (url, init) => {
    if (url.endsWith('/send')) sent = true
    return Response.json(init.method === 'PATCH' ? { subject: 's', text: 't', to: ['other@example.test'], in_reply_to: 'msg' } : { draft_id: 'draft' })
  }), /不一致/)
  assert.equal(sent, false)
})
