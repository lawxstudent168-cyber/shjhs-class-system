import { createHash, randomBytes } from 'node:crypto'
import { createError } from 'h3'

export const LEASE_MS = 15 * 60 * 1000
export const hash = value => createHash('sha256').update(String(value)).digest('hex')
export const token = () => randomBytes(32).toString('hex')
export function requireStudent(session) {
  if (session?.role !== 'student' || session.studentIds?.length !== 1) {
    throw createError({ statusCode: 403, statusMessage: 'Student identity required' })
  }
  return session.studentIds[0]
}
export function validLease(row, sessionHash, lease, now = Date.now()) {
  return row?.status === 'approved' && row.session_hash === sessionHash &&
    typeof lease === 'string' && /^[a-f0-9]{64}$/.test(lease) && row.lease_hash === hash(lease) &&
    Date.parse(row.expires_at) > now
}
export function cleanText(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid text length' })
  }
  return value.trim()
}

// Explicit server-only REST client; never expose this key to Nuxt public config.
export async function deviceStore(config, method, filters = {}, body) {
  const url = config.studentBroadcastSupabaseUrl
  const key = config.studentBroadcastServiceKey
  if (!url || !key) throw createError({ statusCode: 503, statusMessage: 'Broadcast is not configured' })
  const query = new URLSearchParams(filters)
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/student_broadcast_devices?${query}`, {
      method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(4000)
    })
    if (!response.ok) throw new Error('Database request failed')
    return await response.json()
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Broadcast unavailable; listening must stop' })
  }
}
