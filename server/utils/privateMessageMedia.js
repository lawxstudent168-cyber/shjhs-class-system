import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createError, getCookie } from 'h3'
import { authorizePersonalStudent } from './personalHomeSession.js'
import { personalSecret, readPersonalSession } from './personalHomeHttp.js'
import { validTeacherSession } from './teacherSession.js'

export const MEDIA_BUCKET = 'private-message-media'
export const MEDIA_TABLE = 'private_message_media'
export const MEDIA_TYPES = Object.freeze({
  'image/jpeg': { extension: 'jpg', max: 20 * 1024 * 1024 },
  'image/png': { extension: 'png', max: 20 * 1024 * 1024 },
  'image/webp': { extension: 'webp', max: 20 * 1024 * 1024 },
  'image/gif': { extension: 'gif', max: 20 * 1024 * 1024 },
  'video/mp4': { extension: 'mp4', max: 50 * 1024 * 1024 },
  'video/webm': { extension: 'webm', max: 50 * 1024 * 1024 },
  'video/quicktime': { extension: 'mov', max: 50 * 1024 * 1024 }
})
const fail = (statusCode, statusMessage) => { throw createError({ statusCode, statusMessage }) }
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export function validateFile(type, size) {
  const media = MEDIA_TYPES[type]
  if (!media || !Number.isSafeInteger(size) || size < 1 || size > media.max) fail(400, 'Unsupported media type or size')
  return media
}
export function validateCaption(value) {
  if (typeof value !== 'string' || value.length > 200) fail(400, 'Caption is too long')
  return value.trim()
}
export function mediaClient(config) {
  if (!config.studentBroadcastSupabaseUrl || !config.studentBroadcastServiceKey) fail(503, 'Media storage is not configured')
  return createClient(config.studentBroadcastSupabaseUrl, config.studentBroadcastServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
}
export function mediaIdentity(event, config) {
  const secret = personalSecret(config)
  if (validTeacherSession(getCookie(event, 'teacher_session'), config)) return { role: 'teacher', studentIds: [] }
  const session = readPersonalSession(event, secret)
  if (!session) fail(401, 'Please verify your identity')
  return { role: session.role, studentIds: session.studentIds }
}
export function authorizeMedia(identity, studentId, chatType, teacherOnly = false) {
  if (typeof studentId !== 'string' || !studentId || studentId.length > 80 || !['家長', '學生'].includes(chatType)) fail(400, 'Invalid conversation')
  if (identity.role === 'teacher') return { studentId, chatType }
  if (teacherOnly || identity.role !== (chatType === '家長' ? 'parent' : 'student') ||
    !authorizePersonalStudent(identity, studentId)) fail(403, 'Conversation access denied')
  return { studentId, chatType }
}
const signature = (payload, secret) => createHmac('sha256', secret).update(`private-media:${payload}`).digest()
export function makeMediaTicket(details, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ ...details, expires: now + 15 * 60 * 1000 })).toString('base64url')
  return `${payload}.${signature(payload, secret).toString('base64url')}`
}
export function readMediaTicket(ticket, secret, now = Date.now()) {
  try {
    if (typeof ticket !== 'string' || ticket.length > 2500) return null
    const [payload, signatureText, extra] = ticket.split('.')
    if (!payload || !signatureText || extra) return null
    const actual = Buffer.from(signatureText, 'base64url')
    const expected = signature(payload, secret)
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!uuid(data.id) || typeof data.path !== 'string' || !data.path.startsWith(`${data.id}/`) ||
      !MEDIA_TYPES[data.type] || !Number.isSafeInteger(data.size) || data.size < 1 ||
      data.size > MEDIA_TYPES[data.type].max || !Number.isFinite(data.expires) || data.expires < now ||
      data.expires > now + 15 * 60 * 1000 || !['parent', 'student', 'teacher'].includes(data.role) ||
      !['家長', '學生'].includes(data.chatType) || typeof data.studentId !== 'string' ||
      (data.replaceId && !uuid(data.replaceId))) return null
    return data
  } catch { return null }
}
export function newMediaPath(type) {
  const id = randomUUID()
  return { id, path: `${id}/${randomUUID()}.${MEDIA_TYPES[type].extension}` }
}
export function checkedMediaInfo(info, type, size) {
  const storedSize = Number(info?.size ?? info?.metadata?.size)
  const storedType = String(info?.contentType ?? info?.content_type ?? info?.mimetype ?? info?.metadata?.mimetype ?? '').split(';')[0].toLowerCase()
  if (storedSize !== size || storedType !== type) fail(400, 'Uploaded media does not match request')
}
export function mediaRow(row, signedUrl) {
  return { id: row.id, studentId: row.student_id, chatType: row.chat_type, senderRole: row.sender_role,
    mimeType: row.mime_type, size: row.size_bytes, caption: row.caption, createdAt: row.created_at,
    updatedAt: row.updated_at, url: signedUrl }
}
