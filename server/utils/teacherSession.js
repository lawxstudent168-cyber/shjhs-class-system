import { createHmac, timingSafeEqual } from 'node:crypto'
import { createError, getCookie, setCookie, deleteCookie } from 'h3'

const COOKIE = 'teacher_session'
const options = { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api' }
export const TEACHER_SESSION_MS = 2 * 60 * 60 * 1000
function credentials(config) {
  if (typeof config.teacherLoginPassword !== 'string' || config.teacherLoginPassword.length < 12 ||
      typeof config.personalHomeSecret !== 'string' || config.personalHomeSecret.length < 32) {
    throw createError({ statusCode: 503, statusMessage: 'Teacher login is not configured' })
  }
  return config.teacherLoginPassword
}
const sign = (data, config) => createHmac('sha256', config.personalHomeSecret).update(`teacher-session:${data}`).digest('hex')
export function correctTeacherPassword(password, config) {
  const expected = credentials(config)
  return typeof password === 'string' && password.length <= 1024 &&
    timingSafeEqual(Buffer.from(sign(password, config)), Buffer.from(sign(expected, config)))
}
export function makeTeacherSession(config, now = Date.now()) {
  const password = credentials(config)
  const expires = now + TEACHER_SESSION_MS
  return `${expires}.${sign(`${expires}:${password}`, config)}`
}
export function validTeacherSession(token, config, now = Date.now()) {
  const password = credentials(config)
  if (typeof token !== 'string' || !/^\d{13}\.[a-f0-9]{64}$/.test(token)) return false
  const [expiry, signature] = token.split('.')
  const expires = Number(expiry)
  return expires > now && expires <= now + TEACHER_SESSION_MS &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(sign(`${expires}:${password}`, config)))
}
export function requireTeacherSession(event, config) {
  if (!validTeacherSession(getCookie(event, COOKIE), config)) {
    throw createError({ statusCode: 401, statusMessage: 'Please sign in as teacher' })
  }
}
export function writeTeacherSession(event, config) {
  setCookie(event, COOKIE, makeTeacherSession(config), { ...options, maxAge: TEACHER_SESSION_MS / 1000 })
}
export function clearTeacherSession(event) { deleteCookie(event, COOKIE, options) }
