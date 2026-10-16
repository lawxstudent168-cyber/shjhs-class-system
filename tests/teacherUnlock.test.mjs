import test from 'node:test'
import assert from 'node:assert/strict'
import { matchesTeacherUnlockPassword, passwordModalRole } from '../app/utils/teacherUnlock.js'

const now = Date.parse('2026-10-16T07:00:00+08:00')

test('teacher unlock accepts current Taiwan YYMMDD+59, universal password and existing custom password', () => {
  for (const password of ['26101659', '168168168', 'existing-custom']) {
    assert.equal(matchesTeacherUnlockPassword(password, 'existing-custom', now), true)
    assert.equal(passwordModalRole(password, 'attendance', { teacher: 'existing-custom' }, now), '導師')
  }
  for (const password of ['26101559', '26101759', '2026101659', 'wrong', '', null]) {
    assert.equal(matchesTeacherUnlockPassword(password, 'existing-custom', now), false)
  }
})

test('daily password changes at Taiwan midnight without reloading the page', () => {
  const before = Date.parse('2026-10-16T15:59:59Z')
  const after = Date.parse('2026-10-16T16:00:00Z')
  assert.equal(passwordModalRole('26101659', 'attendance', {}, before), '導師')
  assert.equal(passwordModalRole('26101759', 'attendance', {}, after), '導師')
  assert.equal(passwordModalRole('26101659', 'attendance', {}, after), null)
})

test('teacher-only unlock rejects officer passwords and teacher credentials win matching officer passwords', () => {
  const passwords = { academic: 'academic', counseling: 'counseling' }
  for (const target of ['attendance', 'emergency']) {
    assert.equal(passwordModalRole('academic', target, passwords, now), null)
    assert.equal(passwordModalRole('counseling', target, passwords, now), null)
    assert.equal(passwordModalRole('26101659', target, { academic: '26101659' }, now), '導師')
    assert.equal(passwordModalRole('168168168', target, { counseling: '168168168' }, now), '導師')
  }
  assert.equal(passwordModalRole('academic', 'contact', passwords, now), '學藝股長')
  assert.equal(passwordModalRole('counseling', 'classNotes', passwords, now), '輔導股長')
})
