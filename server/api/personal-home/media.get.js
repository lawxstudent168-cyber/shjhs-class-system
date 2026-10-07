import { privateResponse } from '../../utils/personalHomeHttp.js'
import { authorizeMedia, mediaClient, mediaIdentity, mediaRow, MEDIA_BUCKET, MEDIA_TABLE } from '../../utils/privateMessageMedia.js'

export default defineEventHandler(async event => {
  privateResponse(event)
  const config = useRuntimeConfig(event)
  const identity = mediaIdentity(event, config)
  const db = mediaClient(config)
  const query = getQuery(event)

  if (query.mode === 'unread-counts') {
    if (identity.role !== 'teacher') throw createError({ statusCode: 403, statusMessage: 'Teacher access required' })
    const counts = {}
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from(MEDIA_TABLE).select('student_id,chat_type').is('read_at', null)
        .order('created_at').order('id').range(offset, offset + 499)
      if (error) throw createError({ statusCode: 503, statusMessage: 'Unable to load unread media' })
      for (const row of data) {
        const key = `${row.student_id}_${row.chat_type}`
        counts[key] = (counts[key] || 0) + 1
      }
      if (data.length < 500) break
    }
    return { counts }
  }

  if (query.mode === 'identity') {
    if (identity.role === 'teacher') return { role: 'teacher', students: [] }
    const { data, error } = await db.from('students').select('id,real_name,seat_number').in('id', identity.studentIds).order('seat_number')
    if (error) throw createError({ statusCode: 503, statusMessage: 'Unable to load identity' })
    return { role: identity.role, students: data.map(row => ({ id: String(row.id), name: row.real_name, seatNumber: row.seat_number })) }
  }

  const { studentId, chatType } = authorizeMedia(identity, query.studentId, query.chatType)
  const offset = query.offset === undefined ? 0 : Number(query.offset)
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) throw createError({ statusCode: 400, statusMessage: 'Invalid page' })
  const { data, error } = await db.from(MEDIA_TABLE).select('*').eq('student_id', studentId).eq('chat_type', chatType)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 99)
  if (error) throw createError({ statusCode: 503, statusMessage: 'Unable to load media' })
  const storage = db.storage.from(MEDIA_BUCKET)
  const media = await Promise.all(data.map(async row => {
    const { data: signed, error: signError } = await storage.createSignedUrl(row.object_path, 900)
    if (signError || !signed?.signedUrl) throw createError({ statusCode: 503, statusMessage: 'Unable to open media' })
    return mediaRow(row, signed.signedUrl)
  }))
  return { media: media.reverse(), hasMore: data.length === 100 }
})
