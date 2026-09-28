import { privateResponse, checkPersonalRequest } from '../utils/personalHomeHttp.js'
import { allRows, broadcastStore, cleanText, validId } from '../utils/studentBroadcast.js'
import { requireTeacherSession } from '../utils/teacherSession.js'

export default defineEventHandler(async event => {
  privateResponse(event)
  checkPersonalRequest(event)
  const config = useRuntimeConfig(event)
  requireTeacherSession(event, config)
  const body = await readBody(event)
  if (!['list', 'send'].includes(body?.action)) throw createError({ statusCode: 400, statusMessage: 'Unknown action' })
  const students = await allRows(config, 'students', { select: 'id,seat_number,real_name', order: 'seat_number.asc,id.asc' })
  if (body.action === 'list') {
    const clients = await allRows(config, 'student_broadcast_clients', {
      select: 'id,student_id,last_seen_at', disabled_at: 'is.null', expires_at: `gt.${new Date().toISOString()}`, order: 'id.asc'
    })
    return students.map(student => {
      const bound = clients.filter(client => client.student_id === String(student.id))
      return { ...student, browsers: bound.length, lastSeen: bound.map(client => client.last_seen_at).filter(Boolean).sort().at(-1) || null }
    })
  }
  const text = cleanText(body.text, 200)
  if (!validId(body.requestId)) throw createError({ statusCode: 400, statusMessage: 'Request ID required' })
  let recipients
  if (body.all === true) recipients = students
  else {
    if (!Array.isArray(body.studentIds) || !body.studentIds.length || body.studentIds.length > 500 || !body.studentIds.every(id => typeof id === 'string')) throw createError({ statusCode: 400, statusMessage: 'Select students' })
    const ids = [...new Set(body.studentIds)]
    recipients = students.filter(student => ids.includes(String(student.id)))
    if (recipients.length !== ids.length) throw createError({ statusCode: 400, statusMessage: 'Unknown student' })
  }
  if (!recipients.length) throw createError({ statusCode: 400, statusMessage: 'No students' })
  const created = Date.now()
  const messages = recipients.map(student => ({
    broadcast_id: body.requestId, student_id: String(student.id), text,
    created_at: new Date(created).toISOString(), expires_at: new Date(created + 86400000).toISOString()
  }))
  // One atomic insert; retries with the same request ID cannot duplicate recipients.
  await broadcastStore(config, 'student_broadcast_inbox', 'POST',
    { on_conflict: 'broadcast_id,student_id' }, messages, 'resolution=ignore-duplicates,return=representation')
  return { queued: recipients.length }
})
