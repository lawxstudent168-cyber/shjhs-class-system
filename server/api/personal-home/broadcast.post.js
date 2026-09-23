import { personalSecret, privateResponse, checkPersonalRequest, requirePersonalSession } from '../../utils/personalHomeHttp.js'
import { hash, token, requireStudent, validLease, cleanText, deviceStore, LEASE_MS } from '../../utils/studentBroadcast.js'

const cookie = 'student_broadcast_device'
export default defineEventHandler(async event => {
  privateResponse(event)
  checkPersonalRequest(event)
  const config = useRuntimeConfig(event)
  const studentId = requireStudent(requirePersonalSession(event, personalSecret(config)))
  const body = await readBody(event)
  const sessionHash = hash(getCookie(event, 'personal_home_session'))
  let deviceToken = getCookie(event, cookie)
  const store = (method, filters, data) => deviceStore(config, method, filters, data)
  let row
  if (/^[a-f0-9]{64}$/.test(deviceToken || '')) {
    ;[row] = await store('GET', { token_hash: `eq.${hash(deviceToken)}`, student_id: `eq.${studentId}`, limit: '1' })
  }
  if (body?.action === 'enroll') {
    if (!row) {
      const label = cleanText(body.label, 60)
      deviceToken = token()
      ;[row] = await store('POST', {}, { token_hash: hash(deviceToken), student_id: studentId, label })
      setCookie(event, cookie, deviceToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/personal-home', maxAge: 90 * 86400 })
    }
    return { id: row.id, status: row.status, label: row.label }
  }
  if (!row) throw createError({ statusCode: 403, statusMessage: 'Register this device first' })
  if (body?.action === 'status') return { id: row.id, status: row.status, label: row.label }
  const base = { id: `eq.${row.id}`, status: 'eq.approved' }
  if (body?.action === 'start') {
    if (row.status !== 'approved') throw createError({ statusCode: 403, statusMessage: 'Teacher approval required' })
    const lease = token()
    const expires = new Date(Date.now() + LEASE_MS).toISOString()
    const rows = await store('PATCH', base, { lease_hash: hash(lease), session_hash: sessionHash, expires_at: expires, heartbeat_at: new Date().toISOString(), message_id: null, message_text: null, message_expires_at: null })
    if (!rows.length) throw createError({ statusCode: 403, statusMessage: 'Device revoked' })
    return { lease, expires }
  }
  if (!validLease(row, sessionHash, body?.lease)) throw createError({ statusCode: 403, statusMessage: 'Listening session ended' })
  const guarded = { ...base, lease_hash: `eq.${hash(body.lease)}`, session_hash: `eq.${sessionHash}`, expires_at: `gt.${new Date().toISOString()}` }
  if (body.action === 'stop') {
    await store('PATCH', guarded, { lease_hash: null, session_hash: null, expires_at: null, heartbeat_at: null, message_text: null, message_id: null })
    return { stopped: true }
  }
  if (body.action !== 'poll') throw createError({ statusCode: 400, statusMessage: 'Unknown action' })
  const [current] = await store('PATCH', guarded, { heartbeat_at: new Date().toISOString() })
  if (!current) throw createError({ statusCode: 403, statusMessage: 'Listening session ended' })
  return {
    expires: current.expires_at,
    message: current.message_id && Date.parse(current.message_expires_at) > Date.now()
      ? { id: current.message_id, text: current.message_text } : null
  }
})
