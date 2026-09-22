import { createHmac, timingSafeEqual } from 'node:crypto'

export const PERSONAL_SESSION_SECONDS = 8 * 60 * 60

export function encodePersonalSession(session, secret) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function decodePersonalSession(token, secret, now = Date.now()) {
  try {
    if (typeof token !== 'string' || token.length > 3800) return null
    const [payload, signature, extra] = token.split('.')
    if (!payload || !signature || extra) return null
    const expected = createHmac('sha256', secret).update(payload).digest()
    const received = Buffer.from(signature, 'base64url')
    if (received.length !== expected.length || !timingSafeEqual(expected, received)) return null
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (session.version !== 1 || !Number.isFinite(session.expires) || session.expires <= now) return null
    if (!['student', 'parent'].includes(session.role) || !Array.isArray(session.studentIds)) return null
    if (!session.studentIds.length || session.studentIds.length > 10 || !session.studentIds.every(id => typeof id === 'string' && id.length > 0)) return null
    if (session.role === 'student' && session.studentIds.length !== 1) return null
    return session
  } catch { return null }
}

export function parentFingerprint(email, secret) {
  return createHmac('sha256', secret).update(email.trim().toLowerCase()).digest('hex')
}

export function authorizePersonalStudent(session, requestedId) {
  const id = requestedId === undefined ? session.studentIds[0] : requestedId
  if (typeof id !== 'string' || !session.studentIds.includes(id)) return null
  return id
}

export function extendPersonalSession(previous, identity, secret, now = Date.now()) {
  const parent = identity.role === 'parent' ? parentFingerprint(identity.email, secret) : null
  const ids = previous?.role === 'parent' && parent === previous.parent
    ? previous.studentIds.filter(id => id !== String(identity.studentId)) : []
  return {
    version: 1, role: identity.role, parent,
    studentIds: [String(identity.studentId), ...ids].slice(0, 10),
    expires: now + PERSONAL_SESSION_SECONDS * 1000
  }
}
