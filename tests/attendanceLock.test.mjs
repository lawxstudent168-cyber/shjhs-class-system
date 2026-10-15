import test from 'node:test'
import assert from 'node:assert/strict'
import { useAttendanceLock } from '../app/composables/useAttendanceLock.js'

test('one teacher unlock permits continuous edits until manually locked', async () => {
  const edits = []
  let prompts = 0
  const board = useAttendanceLock(async student => edits.push(student.id), () => prompts++)
  const first = { id: 1 }, second = { id: 2 }
  assert.equal(board.isAttendanceUnlocked.value, false)
  await board.requestAttendanceEdit(first)
  assert.deepEqual(edits, [])
  assert.equal(prompts, 1)
  assert.equal(await board.unlockAttendance('導師'), true)
  assert.deepEqual(edits, [1])
  await board.requestAttendanceEdit(second)
  await board.requestAttendanceEdit(first)
  assert.deepEqual(edits, [1, 2, 1])
  assert.equal(prompts, 1)
  board.lockAttendance()
  await board.requestAttendanceEdit(second)
  assert.equal(prompts, 2)
  assert.deepEqual(edits, [1, 2, 1])
  await board.unlockAttendance('teacher')
  assert.deepEqual(edits, [1, 2, 1, 2])
})

test('officer role cannot unlock attendance or execute a pending edit', async () => {
  const edits = []
  const board = useAttendanceLock(student => edits.push(student.id), () => {})
  await board.requestAttendanceEdit({ id: 1 })
  for (const role of ['學藝股長', '輔導股長', '', undefined]) {
    assert.equal(await board.unlockAttendance(role), false)
    assert.equal(board.isAttendanceUnlocked.value, false)
    assert.deepEqual(edits, [])
  }
})

test('cancel and explicit unlock do not replay a previously clicked student', async () => {
  const edits = []
  const board = useAttendanceLock(student => edits.push(student.id), () => {})
  await board.requestAttendanceEdit({ id: 1 })
  board.cancelAttendanceUnlock()
  await board.unlockAttendance('導師')
  assert.deepEqual(edits, [])
  board.lockAttendance()
  await board.requestAttendanceEdit({ id: 2 })
  board.requestAttendanceUnlock()
  await board.unlockAttendance('導師')
  assert.deepEqual(edits, [])
  assert.equal(board.isAttendanceUnlocked.value, true)
  assert.equal(useAttendanceLock(() => {}, () => {}).isAttendanceUnlocked.value, false)
})
