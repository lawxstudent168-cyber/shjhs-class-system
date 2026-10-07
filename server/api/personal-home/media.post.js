import { privateResponse, checkPersonalRequest, personalSecret } from '../../utils/personalHomeHttp.js'
import { authorizeMedia, checkedMediaInfo, makeMediaTicket, mediaClient, mediaIdentity, mediaRow,
  newMediaPath, readMediaTicket, validateCaption, validateFile, MEDIA_BUCKET, MEDIA_TABLE } from '../../utils/privateMessageMedia.js'

const fail = (statusCode, statusMessage) => { throw createError({ statusCode, statusMessage }) }
const attempts = new Map()
function allowUpload(identity, studentId) {
  const key = `${identity.role}:${studentId}`
  const now = Date.now()
  for (const [id, entry] of attempts) if (entry.until < now) attempts.delete(id)
  if (attempts.size >= 5000 && !attempts.has(key)) fail(429, 'Upload limit reached')
  const entry = attempts.get(key) || { count: 0, until: now + 60 * 60 * 1000 }
  if (entry.count >= 20) fail(429, 'Upload limit reached')
  entry.count++
  attempts.set(key, entry)
}
async function getMedia(db, id) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) fail(400, 'Invalid media ID')
  const { data, error } = await db.from(MEDIA_TABLE).select('*').eq('id', id).maybeSingle()
  if (error) fail(503, 'Unable to load media')
  if (!data) fail(404, 'Media not found')
  return data
}
export default defineEventHandler(async event => {
  privateResponse(event)
  checkPersonalRequest(event)
  const config = useRuntimeConfig(event)
  const identity = mediaIdentity(event, config)
  const db = mediaClient(config)
  const storage = db.storage.from(MEDIA_BUCKET)
  const body = await readBody(event)
  if (!body || typeof body !== 'object') fail(400, 'Invalid request')

  if (body.action === 'prepare' || body.action === 'prepare-replacement') {
    const replacing = body.action === 'prepare-replacement'
    if (replacing && identity.role !== 'teacher') fail(403, 'Teacher access required')
    let target
    if (replacing) target = await getMedia(db, body.id)
    const studentId = replacing ? target.student_id : body.studentId
    const chatType = replacing ? target.chat_type : body.chatType
    authorizeMedia(identity, studentId, chatType, replacing)
    const type = String(body.type || '').toLowerCase()
    validateFile(type, body.size)
    const caption = replacing ? target.caption : validateCaption(body.caption || '')
    allowUpload(identity, studentId)
    const { id, path } = newMediaPath(type)
    const { data, error } = await storage.createSignedUploadUrl(path)
    if (error || !data?.token) fail(503, 'Unable to prepare upload')
    const ticket = makeMediaTicket({ id, path, type, size: body.size, caption, studentId, chatType,
      role: identity.role, replaceId: replacing ? target.id : null }, personalSecret(config))
    return { path, token: data.token, ticket, bucket: MEDIA_BUCKET }
  }

  if (body.action === 'complete') {
    const ticket = readMediaTicket(body.ticket, personalSecret(config))
    if (!ticket || ticket.role !== identity.role) fail(403, 'Upload authorization expired')
    authorizeMedia(identity, ticket.studentId, ticket.chatType, !!ticket.replaceId)
    if (ticket.replaceId && identity.role !== 'teacher') fail(403, 'Teacher access required')
    const { data: info, error: infoError } = await storage.info(ticket.path)
    if (infoError || !info) fail(400, 'Upload is not complete')
    checkedMediaInfo(info, ticket.type, ticket.size)
    if (ticket.replaceId) {
      const old = await getMedia(db, ticket.replaceId)
      if (old.student_id !== ticket.studentId || old.chat_type !== ticket.chatType) fail(403, 'Conversation changed')
      if (old.object_path === ticket.path) return { media: mediaRow(old, '') }
      const { data, error } = await db.from(MEDIA_TABLE).update({ object_path: ticket.path, mime_type: ticket.type,
        size_bytes: ticket.size, updated_at: new Date().toISOString() }).eq('id', old.id).eq('object_path', old.object_path).select().single()
      if (error || !data) fail(503, 'Unable to replace media')
      await storage.remove([old.object_path]).catch(() => {})
      return { media: mediaRow(data, '') }
    }
    const { data: existing } = await db.from(MEDIA_TABLE).select('*').eq('id', ticket.id).maybeSingle()
    if (existing) {
      if (existing.object_path !== ticket.path) fail(409, 'Upload already completed')
      return { media: mediaRow(existing, '') }
    }
    const { data, error } = await db.from(MEDIA_TABLE).insert({ id: ticket.id, student_id: ticket.studentId,
      chat_type: ticket.chatType, sender_role: identity.role === 'teacher' ? '導師' : ticket.chatType,
      object_path: ticket.path, mime_type: ticket.type, size_bytes: ticket.size, caption: ticket.caption,
      read_at: identity.role === 'teacher' ? new Date().toISOString() : null }).select().single()
    if (error || !data) fail(503, 'Unable to save media')
    return { media: mediaRow(data, '') }
  }

  if (body.action === 'edit' || body.action === 'delete') {
    if (identity.role !== 'teacher') fail(403, 'Teacher access required')
    const row = await getMedia(db, body.id)
    if (body.action === 'edit') {
      const caption = validateCaption(body.caption)
      const { data, error } = await db.from(MEDIA_TABLE).update({ caption, updated_at: new Date().toISOString() })
        .eq('id', row.id).select().single()
      if (error || !data) fail(503, 'Unable to edit media')
      return { media: mediaRow(data, '') }
    }
    const { error } = await db.from(MEDIA_TABLE).delete().eq('id', row.id)
    if (error) fail(503, 'Unable to delete media')
    const { error: storageError } = await storage.remove([row.object_path])
    return { deleted: true, storageCleanupPending: !!storageError }
  }
  if (body.action === 'mark-read') {
    if (identity.role !== 'teacher') fail(403, 'Teacher access required')
    const { studentId, chatType } = authorizeMedia(identity, body.studentId, body.chatType, true)
    const { error } = await db.from(MEDIA_TABLE).update({ read_at: new Date().toISOString() })
      .eq('student_id', studentId).eq('chat_type', chatType).is('read_at', null)
    if (error) fail(503, 'Unable to mark media as read')
    return { read: true }
  }
  fail(400, 'Unknown action')
})
