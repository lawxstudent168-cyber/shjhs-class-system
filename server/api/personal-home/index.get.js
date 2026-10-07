import { serverSupabaseClient } from '#supabase/server'
import { authorizePersonalStudent } from '../../utils/personalHomeSession.js'
import { loadPersonalOverview } from '../../utils/personalHomeData.js'
import { personalSecret, privateResponse, requirePersonalSession } from '../../utils/personalHomeHttp.js'

export default defineEventHandler(async event => {
  privateResponse(event)
  const session = requirePersonalSession(event, personalSecret(useRuntimeConfig(event)))
  const studentId = authorizePersonalStudent(session, getQuery(event).studentId)
  if (!studentId) throw createError({ statusCode: 403, statusMessage: 'Student access denied' })
  try {
    const db = await serverSupabaseClient(event)
    const [overview, children] = await Promise.all([
      loadPersonalOverview(db, studentId, session.role),
      db.from('students').select('id,real_name,seat_number').in('id', session.studentIds).order('seat_number')
    ])
    if (children.error) throw children.error
    return { ...overview, children: children.data.map(s => ({ id: String(s.id), name: s.real_name, seatNumber: s.seat_number })) }
  } catch (error) {
    if (error.statusCode === 401) throw error
    throw createError({ statusCode: 503, statusMessage: 'Unable to load personal home' })
  }
})
