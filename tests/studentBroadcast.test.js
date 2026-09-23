import test from 'node:test'
import assert from 'node:assert/strict'
import { requireStudent, validLease, hash, token, cleanText } from '../server/utils/studentBroadcast.js'

test('parents and ambiguous identities never obtain a student broadcast identity', () => {
  for (const session of [null, { role: 'parent', studentIds: ['a'] }, { role: 'student', studentIds: ['a', 'b'] }]) assert.throws(() => requireStudent(session))
  assert.equal(requireStudent({ role: 'student', studentIds: ['a'] }), 'a')
})
test('leases fail closed on revocation, expiry, session change or token mismatch', () => {
  const lease = token(), now = Date.now()
  const row = { status: 'approved', lease_hash: hash(lease), session_hash: 'session-a', expires_at: new Date(now + 1000).toISOString() }
  assert.ok(validLease(row, 'session-a', lease, now))
  assert.equal(validLease(row, 'session-a', lease, now + 1000), false)
  assert.equal(validLease(row, 'session-b', lease, now), false)
  assert.equal(validLease(row, 'session-a', token(), now), false)
  assert.equal(validLease({ ...row, status: 'revoked' }, 'session-a', lease, now), false)
  assert.equal(validLease(row, 'session-a', undefined, now), false)
})
test('broadcast content is bounded plain text', () => {
  assert.equal(cleanText('  今天帶課本  ', 200), '今天帶課本')
  for (const text of ['', ' ', {}, 'a'.repeat(201)]) assert.throws(() => cleanText(text, 200))
})
