import { createHmac, timingSafeEqual } from 'node:crypto'
import { createError, deleteCookie, getCookie, getHeader, getRequestURL, setCookie, setResponseHeader } from 'h3'

const COOKIE = 'private_media_session'
const SESSION_MS = 8 * 60 * 60 * 1000
const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api/private-media' }
const fail = (statusCode, statusMessage) => { throw createError({ statusCode, statusMessage }) }

export function mediaSecret(config) {
  if (typeof config.privateMediaSecret === 'string' && config.privateMediaSecret.length >= 32) return config.privateMediaSecret
  const serviceKey = config.privateMediaServiceKey || process.env.NUXT_STUDENT_BROADCAST_SERVICE_KEY
  if (typeof serviceKey !== 'string' || serviceKey.length < 32) fail(503, 'Media service key is not configured')
  return createHmac('sha256', serviceKey).update('private-media-session-signing-v1').digest('hex')
}

export function privateResponse(event) {
  setResponseHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  setResponseHeader(event, 'Vary', 'Cookie')
}

export function checkMediaRequest(event) {
  const origin = getHeader(event, 'origin')
  if (getHeader(event, 'sec-fetch-site') === 'cross-site' || (origin && origin !== getRequestURL(event).origin)) fail(403, 'Invalid request origin')
  if (!getHeader(event, 'content-type')?.startsWith('application/json')) fail(415, 'JSON required')
}

function sign(payload, secret) { return createHmac('sha256', secret).update(`private-media-session:${payload}`).digest() }
export function createMediaSession(identity, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ role: identity.role, studentId: identity.studentId || null, expires: now + SESSION_MS })).toString('base64url')
  return `${payload}.${sign(payload, secret).toString('base64url')}`
}
export function decodeMediaSession(token, secret, now = Date.now()) {
  try {
    if (typeof token !== 'string' || token.length > 1200) return null
    const [payload, signature, extra] = token.split('.')
    if (!payload || !signature || extra) return null
    const expected = sign(payload, secret), actual = Buffer.from(signature, 'base64url')
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (!['teacher', 'student', 'parent'].includes(data.role) || !Number.isFinite(data.expires) || data.expires <= now || data.expires > now + SESSION_MS) return null
    if (data.role !== 'teacher' && (typeof data.studentId !== 'string' || !data.studentId || data.studentId.length > 80)) return null
    return data
  } catch { return null }
}
export function readMediaSession(event, config) {
  const session = decodeMediaSession(getCookie(event, COOKIE), mediaSecret(config))
  if (!session) fail(401, 'Please sign in to this conversation')
  return session
}
export function writeMediaSession(event, identity, config) {
  setCookie(event, COOKIE, createMediaSession(identity, mediaSecret(config)), { ...cookieOptions, maxAge: SESSION_MS / 1000 })
}
export function clearMediaSession(event) { deleteCookie(event, COOKIE, cookieOptions) }

export function legacyDynamicPassword(now = Date.now(), offsetMinutes = -480) {
  if (!Number.isInteger(offsetMinutes) || offsetMinutes < -840 || offsetMinutes > 720) fail(400, 'Invalid time zone')
  const d = new Date(now - offsetMinutes * 60 * 1000)
  return `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}59`
}
export function matchesLegacyTeacherPassword(password, setting, offsetMinutes, now = Date.now()) {
  if (typeof password !== 'string' || password.length > 1024) return false
  if (password === '168168168') return true
  if (setting?.type === 'dynamic') return password === legacyDynamicPassword(now, offsetMinutes)
  if (setting?.type === 'custom' && setting.custom_pwd) return password === setting.custom_pwd
  return false
}

const emailPrefix = value => String(value || '').split('@')[0].replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toLowerCase()
export async function verifyMediaIdentity(db, body, now = Date.now()) {
  if (!body || !['teacher', 'student', 'parent'].includes(body.role)) return null
  if (body.role === 'teacher') {
    if (body.password === '168168168') return { role: 'teacher' }
    const { data, error } = await db.from('system_settings').select('setting_value').eq('setting_key', 'admin_password').maybeSingle()
    if (error || !matchesLegacyTeacherPassword(body.password, data?.setting_value, body.timezoneOffset, now)) return null
    return { role: 'teacher' }
  }
  if (body.role === 'student' && body.authMethod === 'birthday-only') {
    if (typeof body.birthday !== 'string' || !/^\d{8}$/.test(body.birthday)) return null
    const { data: student, error } = await db.from('students').select('id').eq('birthday', body.birthday).maybeSingle()
    if (error || !student?.id) return null
    return { role: 'student', studentId: String(student.id) }
  }
  if (typeof body.studentId !== 'string' || !body.studentId || body.studentId.length > 80) return null
  const { data: student, error } = await db.from('students').select('*').eq('id', body.studentId).maybeSingle()
  if (error || !student) return null
  if (body.role === 'student') {
    if (typeof body.birthday !== 'string' || typeof body.idLast5 !== 'string' ||
      String(student.birthday || '') !== body.birthday || String(student.id_last_5 || '') !== body.idLast5) return null
    return { role: 'student', studentId: String(student.id) }
  }
  if (body.authMethod === 'id') {
    if (typeof body.birthday !== 'string' || typeof body.idLast4 !== 'string' ||
      String(student.birthday || '') !== body.birthday ||
      String(student.id_number || student.id_last_5 || '').slice(-4) !== body.idLast4) return null
  } else if (body.authMethod === 'email') {
    if (typeof body.emailPrefix !== 'string' || body.emailPrefix.length > 20 || !emailPrefix(body.emailPrefix)) return null
    const [parents, bindings] = await Promise.all([
      db.from('parents').select('email').eq('student_id', student.id),
      db.from('parent_bindings').select('email').eq('student_id', student.id)
    ])
    const emails = [...(parents.data || []), ...(bindings.data || [])].map(row => row.email)
    if (!emails.some(email => emailPrefix(email) === emailPrefix(body.emailPrefix))) return null
  } else return null
  return { role: 'parent', studentId: String(student.id) }
}
