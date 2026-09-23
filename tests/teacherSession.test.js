import test from 'node:test'
import assert from 'node:assert/strict'
import { correctTeacherPassword, makeTeacherSession, validTeacherSession, TEACHER_SESSION_MS } from '../server/utils/teacherSession.js'

const config = { teacherLoginPassword: 'fixture-teacher-password', personalHomeSecret: 'fixture-signing-secret-at-least-thirty-two-characters' }
test('teacher login rejects missing configuration and the former universal password', () => {
  assert.throws(() => correctTeacherPassword('anything', {}))
  assert.throws(() => correctTeacherPassword('short', { ...config, teacherLoginPassword: 'short' }))
  assert.equal(correctTeacherPassword('168168168', config), false)
  assert.equal(correctTeacherPassword(undefined, config), false)
  assert.equal(correctTeacherPassword(config.teacherLoginPassword, config), true)
})
test('teacher cookie rejects forgery, expiry and password or signing secret rotation', () => {
  const now = Date.now(), token = makeTeacherSession(config, now)
  assert.equal(validTeacherSession(token, config, now), true)
  assert.equal(validTeacherSession(token, config, now + TEACHER_SESSION_MS), false)
  assert.equal(validTeacherSession(token.replace(/.$/, token.endsWith('a') ? 'b' : 'a'), config, now), false)
  assert.equal(validTeacherSession('true', config, now), false)
  assert.equal(validTeacherSession(token, { ...config, teacherLoginPassword: 'another-fixture-password' }, now), false)
  assert.equal(validTeacherSession(token, { ...config, personalHomeSecret: 'another-signing-secret-at-least-thirty-two-characters' }, now), false)
})
