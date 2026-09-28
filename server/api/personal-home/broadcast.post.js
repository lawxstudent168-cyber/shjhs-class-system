import { personalSecret, privateResponse, checkPersonalRequest, readPersonalSession } from '../../utils/personalHomeHttp.js'
import { broadcastStore, requireBroadcastBrowser, forgetBroadcastBrowser, validId } from '../../utils/studentBroadcast.js'

export default defineEventHandler(async event => {
  privateResponse(event)
  checkPersonalRequest(event)
  const config = useRuntimeConfig(event)
  const body = await readBody(event)
  if (body?.action === 'disconnect') {
    await forgetBroadcastBrowser(event, config)
    return { disconnected: true }
  }
  if (!['inbox', 'ack'].includes(body?.action)) throw createError({ statusCode: 400, statusMessage: 'Unknown action' })
  const session = readPersonalSession(event, personalSecret(config))
  if (session?.role === 'parent') throw createError({ statusCode: 403, statusMessage: 'Student identity required' })
  const client = await requireBroadcastBrowser(event, config)
  if (session && (session.role !== 'student' || session.studentIds[0] !== client.student_id)) {
    throw createError({ statusCode: 403, statusMessage: 'Identity changed' })
  }
  const [student] = await broadcastStore(config, 'students', 'GET', { select: 'id,seat_number,real_name', id: `eq.${client.student_id}`, limit: '1' })
  if (!student) throw createError({ statusCode: 403, statusMessage: 'Student no longer available' })
  if (body.action === 'ack') {
    if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 50 || !body.ids.every(validId)) throw createError({ statusCode: 400, statusMessage: 'Invalid message IDs' })
    await broadcastStore(config, 'student_broadcast_inbox', 'PATCH', {
      student_id: `eq.${client.student_id}`, id: `in.(${body.ids.join(',')})`, read_at: 'is.null'
    }, { read_at: new Date().toISOString() })
    return { acknowledged: true }
  }
  const messages = await broadcastStore(config, 'student_broadcast_inbox', 'GET', {
    select: 'id,text,created_at,expires_at', student_id: `eq.${client.student_id}`, read_at: 'is.null',
    expires_at: `gt.${new Date().toISOString()}`, order: 'created_at.asc,id.asc', limit: '50'
  })
  return { student, messages, serverTime: new Date().toISOString() }
})
