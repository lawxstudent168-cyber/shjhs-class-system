import test from 'node:test'
import assert from 'node:assert/strict'
import { authorizeMedia, checkedMediaInfo, makeMediaTicket, newMediaPath, readMediaTicket,
  validateCaption, validateFile } from '../server/utils/privateMessageMedia.js'

const secret = 'a-secret-longer-than-thirty-two-characters-for-tests'

test('only matching verified student or parent can access a conversation', () => {
  assert.deepEqual(authorizeMedia({ role: 'student', studentIds: ['s1'] }, 's1', '學生'), { studentId: 's1', chatType: '學生' })
  assert.deepEqual(authorizeMedia({ role: 'parent', studentIds: ['s1', 's2'] }, 's2', '家長'), { studentId: 's2', chatType: '家長' })
  assert.throws(() => authorizeMedia({ role: 'student', studentIds: ['s1'] }, 's2', '學生'))
  assert.throws(() => authorizeMedia({ role: 'parent', studentIds: ['s1'] }, 's1', '學生'))
  assert.throws(() => authorizeMedia({ role: 'student', studentIds: ['s1'] }, 's1', '學生', true))
  assert.deepEqual(authorizeMedia({ role: 'teacher', studentIds: [] }, 's2', '家長', true), { studentId: 's2', chatType: '家長' })
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
