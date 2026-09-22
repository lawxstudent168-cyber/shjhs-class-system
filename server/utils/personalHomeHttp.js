import { createError, getCookie, setCookie, deleteCookie, setResponseHeader, getHeader, getRequestURL } from 'h3'
import { decodePersonalSession, encodePersonalSession, PERSONAL_SESSION_SECONDS } from './personalHomeSession.js'

const COOKIE = 'personal_home_session'
const options = { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api/personal-home' }

export function personalSecret(config) {
  if (typeof config.personalHomeSecret !== 'string' || config.personalHomeSecret.length < 32) {
    throw createError({ statusCode: 503, statusMessage: 'Personal home is not configured' })
  }
  return config.personalHomeSecret
}

export function privateResponse(event) {
  setResponseHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  setResponseHeader(event, 'Vary', 'Cookie')
}

export function checkPersonalRequest(event) {
  const origin = getHeader(event, 'origin')
  if (getHeader(event, 'sec-fetch-site') === 'cross-site' || (origin && origin !== getRequestURL(event).origin)) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid request origin' })
  }
  if (!getHeader(event, 'content-type')?.startsWith('application/json')) {
    throw createError({ statusCode: 415, statusMessage: 'JSON required' })
  }
}

export function readPersonalSession(event, secret) {
  return decodePersonalSession(getCookie(event, COOKIE), secret)
}

export function requirePersonalSession(event, secret) {
  const session = readPersonalSession(event, secret)
  if (!session) throw createError({ statusCode: 401, statusMessage: 'Please verify your identity' })
  return session
}

export function writePersonalSession(event, session, secret) {
  setCookie(event, COOKIE, encodePersonalSession(session, secret), { ...options, maxAge: PERSONAL_SESSION_SECONDS })
}

export function clearPersonalSession(event) { deleteCookie(event, COOKIE, options) }
