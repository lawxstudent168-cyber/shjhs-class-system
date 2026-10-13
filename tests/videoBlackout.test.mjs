import test from 'node:test'
import assert from 'node:assert/strict'
import { isVideoBlackoutTime, matchesTeacherVideoPassword, normalizeVideoBlackoutDates } from '../app/utils/videoBlackout.js'

test('selected dates are unique, sorted, and valid', () => {
  assert.deepEqual(normalizeVideoBlackoutDates(['2026-10-14', '2026-10-13', '2026-10-13', '2026-02-30', 'bad']), ['2026-10-13', '2026-10-14'])
})

test('selected date blocks video from 07:30 until 16:45 Taiwan time', () => {
  const dates = ['2026-10-13']
  assert.equal(isVideoBlackoutTime(dates, new Date('2026-10-12T23:29:00Z')), false)
  assert.equal(isVideoBlackoutTime(dates, new Date('2026-10-12T23:30:00Z')), true)
  assert.equal(isVideoBlackoutTime(dates, new Date('2026-10-13T08:44:00Z')), true)
  assert.equal(isVideoBlackoutTime(dates, new Date('2026-10-13T08:45:00Z')), false)
  assert.equal(isVideoBlackoutTime(['2026-10-14'], new Date('2026-10-12T23:30:00Z')), false)
})

test('unlock follows configured teacher password mode without exposing a password hint', () => {
  const now = new Date('2026-10-12T23:30:00Z')
  assert.equal(matchesTeacherVideoPassword('26101359', { type: 'dynamic' }, now), true)
  assert.equal(matchesTeacherVideoPassword('26101259', { type: 'dynamic' }, now), false)
  assert.equal(matchesTeacherVideoPassword('class-secret', { type: 'custom', custom_pwd: 'class-secret' }, now), true)
  assert.equal(matchesTeacherVideoPassword('26101359', { type: 'custom', custom_pwd: 'class-secret' }, now), false)
  assert.equal(matchesTeacherVideoPassword('168168168', { type: 'custom', custom_pwd: 'class-secret' }, now), true)
})
