import { createHash } from 'node:crypto'
import { privateResponse, checkPersonalRequest } from '../utils/personalHomeHttp.js'
import { correctTeacherPassword, requireTeacherSession, writeTeacherSession, clearTeacherSession } from '../utils/teacherSession.js'

// Per-instance backstop. Use Vercel rate limiting as well for shared deployments.
const attempts = new Map()
export default defineEventHandler(async event => {
  privateResponse(event)
  checkPersonalRequest(event)
  const body = await readBody(event)
  const config = useRuntimeConfig(event)
  if (body?.action === 'logout') {
    clearTeacherSession(event)
    return { authenticated: false }
  }
  if (body?.action === 'status') {
    requireTeacherSession(event, config)
    return { authenticated: true }
  }
  if (body?.action !== 'login') throw createError({ statusCode: 400, statusMessage: 'Unknown action' })
  const key = createHash('sha256').update(getRequestIP(event, { xForwardedFor: true }) || 'unknown').digest('hex')
  const now = Date.now()
  for (const [id, entry] of attempts) if (entry.until <= now) attempts.delete(id)
  if (attempts.size >= 5000 && !attempts.has(key)) throw createError({ statusCode: 429, statusMessage: 'Try again later' })
  const entry = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 }
  if (entry.count >= 10) throw createError({ statusCode: 429, statusMessage: 'Try again later' })
  entry.count++; attempts.set(key, entry)
  if (!correctTeacherPassword(body.password, config)) {
    clearTeacherSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Incorrect teacher password' })
  }
  attempts.delete(key)
  writeTeacherSession(event, config)
  return { authenticated: true }
})
