import { randomUUID } from 'node:crypto'
import { privateResponse, checkPersonalRequest } from '../utils/personalHomeHttp.js'
import { deviceStore, cleanText } from '../utils/studentBroadcast.js'
import { requireTeacherSession } from '../utils/teacherSession.js'

export default defineEventHandler(async event => {
  privateResponse(event)
  checkPersonalRequest(event)
  const config = useRuntimeConfig(event)
  requireTeacherSession(event, config)
  const body = await readBody(event)
  const store = (method, filters, data) => deviceStore(config, method, filters, data)
  if (body?.action === 'list') {
    return await store('GET', { select: 'id,student_id,label,status,created_at,expires_at,heartbeat_at', order: 'created_at.desc', limit: '500' })
  }
  if (!/^[a-f0-9-]{36}$/.test(body?.id || '')) throw createError({ statusCode: 400, statusMessage: 'Select a device' })
  if (['approve', 'revoke'].includes(body.action)) {
    if (body.action === 'approve' && body.confirmStudentOnly !== true) throw createError({ statusCode: 400, statusMessage: 'Student-only device confirmation required' })
    const rows = await store('PATCH', { id: `eq.${body.id}` }, {
      status: body.action === 'approve' ? 'approved' : 'revoked', lease_hash: null, session_hash: null,
      expires_at: null, heartbeat_at: null, message_id: null, message_text: null
    })
    return { updated: rows.length }
  }
  if (body.action === 'send') {
    const text = cleanText(body.text, 200)
    const now = Date.now()
    const rows = await store('PATCH', { id: `eq.${body.id}`, status: 'eq.approved', expires_at: `gt.${new Date(now).toISOString()}`, heartbeat_at: `gt.${new Date(now - 5000).toISOString()}` }, {
      message_id: randomUUID(), message_text: text, message_expires_at: new Date(now + 5000).toISOString()
    })
    return { delivered: rows.length }
  }
  throw createError({ statusCode: 400, statusMessage: 'Unknown action' })
})
