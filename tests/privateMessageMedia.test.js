import test from 'node:test'
import assert from 'node:assert/strict'
import { authorizeMedia, checkedMediaInfo, makeMediaTicket, newMediaPath, readMediaTicket,
  validateCaption, validateFile } from '../server/utils/privateMessageMedia.js'
import { createMediaSession, decodeMediaSession, legacyDynamicPassword, matchesLegacyTeacherPassword,
  mediaSecret, verifyMediaIdentity } from '../server/utils/privateMediaAuth.js'

const secret = 'a-secret-longer-than-thirty-two-characters-for-tests'

test('only matching verified student or parent can access a conversation', () => {
  assert.deepEqual(authorizeMedia({ role: 'student', studentId: 's1' }, 's1', '學生'), { studentId: 's1', chatType: '學生' })
  assert.deepEqual(authorizeMedia({ role: 'parent', studentId: 's2' }, 's2', '家長'), { studentId: 's2', chatType: '家長' })
  assert.throws(() => authorizeMedia({ role: 'student', studentId: 's1' }, 's2', '學生'))
  assert.throws(() => authorizeMedia({ role: 'parent', studentId: 's1' }, 's1', '學生'))
  assert.throws(() => authorizeMedia({ role: 'student', studentId: 's1' }, 's1', '學生', true))
  assert.deepEqual(authorizeMedia({ role: 'teacher' }, 's2', '家長', true), { studentId: 's2', chatType: '家長' })
})

test('attachment session is signed and scoped without changing legacy passwords', () => {
  const token = createMediaSession({ role: 'parent', studentId: 's1' }, secret, 1000)
  assert.equal(decodeMediaSession(token, secret, 1001)?.studentId, 's1')
  assert.equal(decodeMediaSession(token, 'another-secret', 1001), null)
  assert.equal(decodeMediaSession(token, secret, 1000 + 8 * 60 * 60 * 1000), null)
  const now = Date.UTC(2026, 9, 7, 16, 30)
  assert.equal(legacyDynamicPassword(now, -480), '26100859')
  assert.equal(matchesLegacyTeacherPassword('26100859', { type: 'dynamic' }, -480, now), true)
  assert.equal(matchesLegacyTeacherPassword('custom', { type: 'custom', custom_pwd: 'custom' }, -480, now), true)
  assert.equal(matchesLegacyTeacherPassword('168168168', { type: 'custom', custom_pwd: 'custom' }, -480, now), true)
  assert.equal(matchesLegacyTeacherPassword('custom', { type: 'dynamic' }, -480, now), false)
  assert.equal(mediaSecret({ privateMediaSecret: '', privateMediaServiceKey: 'service-key-over-thirty-two-characters' }).length, 64)
  assert.throws(() => mediaSecret({ privateMediaSecret: '', privateMediaServiceKey: '' }))
})

test('attachment login accepts the original student and parent verification methods', async () => {
  const tables = {
    students: [{ id: 's1', birthday: '20130514', id_last_5: '12345', id_number: null }],
    parents: [{ student_id: 's1', email: 'abcde.parent@example.test' }],
    parent_bindings: []
  }
  const db = { from: table => ({ select: () => ({ eq: (key, value) => ({
    maybeSingle: async () => ({ data: tables[table]?.find(row => String(row[key]) === String(value)) || null, error: null }),
    then: resolve => resolve({ data: tables[table]?.filter(row => String(row[key]) === String(value)) || [], error: null })
  }) }) }) }
  assert.deepEqual(await verifyMediaIdentity(db, { role: 'student', studentId: 's1', birthday: '20130514', idLast5: '12345' }), { role: 'student', studentId: 's1' })
  assert.deepEqual(await verifyMediaIdentity(db, { role: 'student', authMethod: 'birthday-only', birthday: '20130514' }), { role: 'student', studentId: 's1' })
  assert.equal(await verifyMediaIdentity(db, { role: 'student', authMethod: 'birthday-only', birthday: '2013051' }), null)
  assert.equal(await verifyMediaIdentity(db, { role: 'student', authMethod: 'birthday-only', birthday: '20130515' }), null)
  assert.deepEqual(await verifyMediaIdentity(db, { role: 'parent', studentId: 's1', authMethod: 'id', birthday: '20130514', idLast4: '2345' }), { role: 'parent', studentId: 's1' })
  assert.deepEqual(await verifyMediaIdentity(db, { role: 'parent', studentId: 's1', authMethod: 'email', emailPrefix: 'abcde' }), { role: 'parent', studentId: 's1' })
  assert.equal(await verifyMediaIdentity(db, { role: 'parent', studentId: 's1', authMethod: 'email', emailPrefix: 'wrong' }), null)
})

test('upload tickets are scoped, signed and short lived', () => {
  const { id, path } = newMediaPath('video/mp4')
  const details = { id, path, type: 'video/mp4', size: 1200, caption: '', studentId: 's1', chatType: '學生', role: 'student', replaceId: null }
  const ticket = makeMediaTicket(details, secret, 1000)
  assert.equal(readMediaTicket(ticket, secret, 1001)?.path, path)
  assert.equal(readMediaTicket(ticket, 'different-secret', 1001), null)
  assert.equal(readMediaTicket(ticket, secret, 1000 + 15 * 60 * 1000 + 1), null)
  assert.equal(readMediaTicket(`${ticket}x`, secret, 1001), null)
})

test('media types, size, caption and stored object must match', () => {
  assert.equal(validateFile('image/jpeg', 1024).extension, 'jpg')
  assert.throws(() => validateFile('image/svg+xml', 1024))
  assert.throws(() => validateFile('video/mp4', 50 * 1024 * 1024 + 1))
  assert.equal(validateCaption('  課堂照片  '), '課堂照片')
  assert.throws(() => validateCaption('x'.repeat(201)))
  assert.doesNotThrow(() => checkedMediaInfo({ size: 1024, contentType: 'image/jpeg' }, 'image/jpeg', 1024))
  assert.throws(() => checkedMediaInfo({ size: 1025, contentType: 'image/jpeg' }, 'image/jpeg', 1024))
  assert.throws(() => checkedMediaInfo({ size: 1024, contentType: 'image/svg+xml' }, 'image/jpeg', 1024))
})
