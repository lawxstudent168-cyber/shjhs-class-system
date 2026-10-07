import test from 'node:test'
import assert from 'node:assert/strict'
import { hash, token, cleanText, validId } from '../server/utils/studentBroadcast.js'
test('browser tokens have entropy and only hashes are persisted', () => {
  const a = token(), b = token()
  assert.match(a, /^[a-f0-9]{64}$/)
  assert.notEqual(a, b)
  assert.notEqual(hash(a), a)
  assert.equal(hash(a), hash(a))
})
test('content and acknowledgement IDs are bounded', () => {
  assert.equal(cleanText('  今天帶課本  ', 200), '今天帶課本')
  for (const value of ['', ' ', {}, 'a'.repeat(201)]) assert.throws(() => cleanText(value, 200))
  assert.ok(validId('12345678-1234-1234-1234-123456789abc'))
  for (const id of ['child-a', 'x),student_id.neq.a', {}, undefined]) assert.equal(validId(id), false)
})
