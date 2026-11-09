import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const ARTIFACT_PATH = /^\/api\/creator-agent\/artifacts\/([a-f0-9-]{36})$/i
const DEFAULT_ARTIFACT_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function validCreatorAgentToken(token) {
  return typeof token === 'string' && TOKEN_PATTERN.test(token)
}

export function hasValidCreatorAgentBearer(request, token) {
  if (!validCreatorAgentToken(token)) return false
  const authorization = request.headers?.authorization
  if (typeof authorization !== 'string') return false
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization)
  if (!match) return false
  const expected = Buffer.from(token, 'utf8')
  const provided = Buffer.from(match[1], 'utf8')
  return expected.length === provided.length && timingSafeEqual(expected, provided)
}

export function signArtifactUrl(path, token, now = Date.now()) {
  if (!validCreatorAgentToken(token)) return path
  const match = ARTIFACT_PATH.exec(path)
  if (!match) return path
  const expires = now + DEFAULT_ARTIFACT_TTL_MS
  const signature = createHmac('sha256', token)
    .update(`${match[1]}.${expires}`)
    .digest('hex')
  return `${path}?expires=${expires}&signature=${signature}`
}

export function hasValidArtifactSignature(path, searchParams, token, now = Date.now()) {
  if (!validCreatorAgentToken(token)) return false
  const match = ARTIFACT_PATH.exec(path)
  const expires = Number(searchParams.get('expires'))
  const signature = searchParams.get('signature')
  if (!match || !Number.isSafeInteger(expires) || expires <= now || expires > now + DEFAULT_ARTIFACT_TTL_MS) return false
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) return false
  const expected = createHmac('sha256', token)
    .update(`${match[1]}.${expires}`)
    .digest()
  const provided = Buffer.from(signature, 'hex')
  return expected.length === provided.length && timingSafeEqual(expected, provided)
}
