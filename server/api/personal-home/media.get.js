import { privateResponse } from '../../utils/personalHomeHttp.js'
import { authorizeMedia, mediaClient, mediaIdentity, mediaRow, MEDIA_BUCKET, MEDIA_TABLE } from '../../utils/privateMessageMedia.js'

export default defineEventHandler(async event => {
  privateResponse(event)
  const config = useRuntimeConfig(event)
  const identity = mediaIdentity(event, config)
  const db = mediaClient(config)
  const query = getQuery(event)

  if (query.mode === 'identity') {
    if (identity.role === 'teacher') return { role: 'teacher', students: [] }
    const { data, error } = await db.from('students').select('id,real_name,seat_number').in('id', identity.studentIds).order('seat_number')
    if (error) throw createError({ statusCode: 503, statusMessage: 'Unable to load identity' })
    return { role: identity.role, students: data.map(row => ({ id: String(row.id), name: row.real_name, seatNumber: row.seat_number })) }
  }

  const { studentId, chatType } = authorizeMedia(identity, query.studentId, query.chatType)
  const { data, error } = await db.from(MEDIA_TABLE).select('*').eq('student_id', studentId).eq('chat_type', chatType)
    .order('created_at', { ascending: false }).limit(100)
  if (error) throw createError({ statusCode: 503, statusMessage: 'Unable to load media' })
  const storage = db.storage.from(MEDIA_BUCKET)
  const media = await Promise.all(data.map(async row => {
    const { data: signed, error: signError } = await storage.createSignedUrl(row.object_path, 900)
    if (signError || !signed?.signedUrl) throw createError({ statusCode: 503, statusMessage: 'Unable to open media' })
    return mediaRow(row, signed.signedUrl)
  }))
  return { media: media.reverse() }
})
