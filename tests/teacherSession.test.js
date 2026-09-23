import test from 'node:test'
import assert from 'node:assert/strict'
import { dynamicTeacherPassword, correctTeacherPassword, makeTeacherSession, validTeacherSession, TEACHER_SESSION_MS } from '../server/utils/teacherSession.js'

const config = { personalHomeSecret: 'fixture-signing-secret-at-least-thirty-two-characters' }
test('teacher login rejects missing configuration and the former universal password', () => {
  assert.throws(() => correctTeacherPassword('anything', {}))
  assert.equal(correctTeacherPassword('168168168', config), false)
  assert.equal(correctTeacherPassword(undefined, config), false)
  assert.equal(correctTeacherPassword(dynamicTeacherPassword(), config), true)
})
test('teacher cookie rejects forgery, expiry and signing secret rotation', () => {
  const now = Date.now(), token = makeTeacherSession(config, now)
  assert.equal(validTeacherSession(token, config, now), true)
  assert.equal(validTeacherSession(token, config, now + TEACHER_SESSION_MS), false)
  assert.equal(validTeacherSession(token.replace(/.$/, token.endsWith('a') ? 'b' : 'a'), config, now), false)
  assert.equal(validTeacherSession('true', config, now), false)
  assert.equal(validTeacherSession(token, { ...config, personalHomeSecret: 'another-signing-secret-at-least-thirty-two-characters' }, now), false)
})
test('dynamic password follows Taipei midnight, rejects yesterday and invalidates old sessions', () => {
  const before = Date.parse('2026-12-31T15:59:59Z')
  const after = Date.parse('2026-12-31T16:00:00Z')
  assert.equal(dynamicTeacherPassword(before), '26123159')
  assert.equal(dynamicTeacherPassword(after), '27010159')
  assert.equal(correctTeacherPassword('26123159', config, before), true)
  assert.equal(correctTeacherPassword('26123159', config, after), false)
  assert.equal(correctTeacherPassword('27010159', config, after), true)
  assert.equal(validTeacherSession(makeTeacherSession(config, before), config, after), false)
})
