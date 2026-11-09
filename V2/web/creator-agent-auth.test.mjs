import assert from 'node:assert/strict'
import test from 'node:test'
import { hasValidArtifactSignature, hasValidCreatorAgentBearer, signArtifactUrl } from './creator-agent-auth.mjs'

const token = 'abcdefghijklmnopqrstuvwxyzABCDEFG12345678_-'

test('creator-agent API accepts only the configured bearer token', () => {
  assert.equal(token.length, 43)
  assert.equal(
    hasValidCreatorAgentBearer({headers:{authorization:`Bearer ${token}`}}, token),
    true,
  )
  assert.equal(
    hasValidCreatorAgentBearer({headers:{authorization:`Bearer ${'x'.repeat(43)}`}}, token),
    false,
  )
  assert.equal(hasValidCreatorAgentBearer({headers:{}}, token), false)
  assert.equal(hasValidCreatorAgentBearer({headers:{authorization:`Bearer ${token}`}}, ''), false)
})

test('artifact URLs carry a bounded signature that rejects tampering and expiry', () => {
  const now = 1_800_000_000_000
  const path = '/api/creator-agent/artifacts/12345678-1234-4234-8234-123456789abc'
  const signed = signArtifactUrl(path, token, now)
  const url = new URL(signed, 'https://spur.example')
  assert.equal(hasValidArtifactSignature(url.pathname, url.searchParams, token, now), true)
  assert.equal(hasValidArtifactSignature(url.pathname, url.searchParams, 'x'.repeat(43), now), false)
  assert.equal(hasValidArtifactSignature(url.pathname, url.searchParams, token, now + 31 * 24 * 60 * 60 * 1000), false)
  url.searchParams.set('signature', '0'.repeat(64))
  assert.equal(hasValidArtifactSignature(url.pathname, url.searchParams, token, now), false)
})
