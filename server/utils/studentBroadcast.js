import { createHash, randomBytes } from 'node:crypto'
import { createError, getCookie, setCookie, deleteCookie } from 'h3'

export const hash = value => createHash('sha256').update(String(value)).digest('hex')
export const token = () => randomBytes(32).toString('hex')
export const BINDING_SECONDS = 90 * 86400
const COOKIE = 'student_broadcast_browser'
const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/personal-home' }
export function cleanText(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw createError({ statusCode: 400, statusMessage: 'Invalid text length' })
  return value.trim()
}
export function configured(config) { return !!(config.studentBroadcastSupabaseUrl && config.studentBroadcastServiceKey) }
export function validId(value) { return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value) }

// Only these tables can be accessed through this server-only service client.
const tables = new Set(['students', 'student_broadcast_clients', 'student_broadcast_inbox'])
export async function broadcastStore(config, table, method, filters = {}, body, prefer = 'return=representation') {
  if (!tables.has(table) || !configured(config)) throw createError({ statusCode: 503, statusMessage: 'Broadcast unavailable' })
  const query = new URLSearchParams(filters)
  try {
    const response = await fetch(`${config.studentBroadcastSupabaseUrl.replace(/\/$/, '')}/rest/v1/${table}?${query}`, {
      method, headers: { apikey: config.studentBroadcastServiceKey, Authorization: `Bearer ${config.studentBroadcastServiceKey}`, 'Content-Type': 'application/json', Prefer: prefer },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(4000)
    })
    if (!response.ok) throw new Error('Database request failed')
    return await response.json()
  } catch { throw createError({ statusCode: 503, statusMessage: 'Broadcast unavailable' }) }
}
export async function allRows(config, table, filters) {
  const rows = []
  for (let offset = 0; ; offset += 500) {
    const page = await broadcastStore(config, table, 'GET', { ...filters, offset: String(offset), limit: '500' })
    if (!Array.isArray(page)) throw createError({ statusCode: 503, statusMessage: 'Broadcast unavailable' })
    rows.push(...page)
    if (page.length < 500) return rows
  }
}
export async function forgetBroadcastBrowser(event, config) {
  const previous = getCookie(event, COOKIE)
  if (previous) deleteCookie(event, COOKIE, options)
  // Invalidate the previous v1 device cookie as well.
  if (getCookie(event, 'student_broadcast_device')) deleteCookie(event, 'student_broadcast_device', options)
  if (/^[a-f0-9]{64}$/.test(previous || '') && configured(config)) {
    await broadcastStore(config, 'student_broadcast_clients', 'PATCH', { token_hash: `eq.${hash(previous)}` }, { disabled_at: new Date().toISOString() })
  }
}
export async function bindBroadcastBrowser(event, config, studentId) {
  // Rotate on every verified login, including when switching students.
  await forgetBroadcastBrowser(event, config)
  if (!configured(config)) return false
  const credential = token()
  await broadcastStore(config, 'student_broadcast_clients', 'POST', {}, {
    token_hash: hash(credential), student_id: String(studentId),
    expires_at: new Date(Date.now() + BINDING_SECONDS * 1000).toISOString(),
    last_seen_at: new Date().toISOString()
  })
  setCookie(event, COOKIE, credential, { ...options, maxAge: BINDING_SECONDS })
  return true
}
export async function requireBroadcastBrowser(event, config) {
  const credential = getCookie(event, COOKIE)
  if (!/^[a-f0-9]{64}$/.test(credential || '')) throw createError({ statusCode: 401, statusMessage: 'Student verification required' })
  const [client] = await broadcastStore(config, 'student_broadcast_clients', 'PATCH', {
    token_hash: `eq.${hash(credential)}`, disabled_at: 'is.null', expires_at: `gt.${new Date().toISOString()}`
  }, { last_seen_at: new Date().toISOString() })
  if (!client) throw createError({ statusCode: 401, statusMessage: 'Student verification required' })
  return client
}
