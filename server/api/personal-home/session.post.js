import { createHash } from 'node:crypto'
import { serverSupabaseClient } from '#supabase/server'
import { verifyPersonalCredentials } from '../../utils/personalHomeData.js'
import { extendPersonalSession } from '../../utils/personalHomeSession.js'
import { personalSecret, privateResponse, checkPersonalRequest, readPersonalSession, writePersonalSession } from '../../utils/personalHomeHttp.js'

// Per-instance backstop; shared deployments should also use Vercel rate limiting.
const attempts = new Map()
export default defineEventHandler(async event => {
  privateResponse(event)
  checkPersonalRequest(event)
  const secret = personalSecret(useRuntimeConfig(event))
  const body = await readBody(event)
  const key = createHash('sha256').update(`${getRequestIP(event, { xForwardedFor: true }) || 'unknown'}:${String(body?.seatNumber || '')}`).digest('hex')
  const now = Date.now()
  for (const [id, entry] of attempts) if (entry.until <= now) attempts.delete(id)
  if (attempts.size >= 5000 && !attempts.has(key)) throw createError({ statusCode: 429, statusMessage: 'Try again later' })
  const entry = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 }
  if (entry.count >= 10) throw createError({ statusCode: 429, statusMessage: 'Try again later' })
  entry.count++
  attempts.set(key, entry)
  let identity
  try { identity = await verifyPersonalCredentials(await serverSupabaseClient(event), body) }
  catch { throw createError({ statusCode: 503, statusMessage: 'Unable to verify identity' }) }
  if (!identity) throw createError({ statusCode: 401, statusMessage: 'Identity verification failed' })
  attempts.delete(key)
  const session = extendPersonalSession(readPersonalSession(event, secret), identity, secret)
  writePersonalSession(event, session, secret)
  return { studentId: identity.studentId }
})
