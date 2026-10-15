import test from 'node:test'
import assert from 'node:assert/strict'
import { ref, effectScope } from 'vue'
import { normalizeAttendanceLockTime, isAttendancePasswordFree } from '../app/utils/attendanceAccess.js'
import { useAttendanceLock } from '../app/composables/useAttendanceLock.js'

test('Taiwan weekdays are free before cutoff, but exact cutoff and weekends require password', () => {
  for (const day of ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16']) {
    assert.equal(isAttendancePasswordFree(`${day}T07:59:59+08:00`), true)
    assert.equal(isAttendancePasswordFree(`${day}T08:00:00+08:00`), false)
    assert.equal(isAttendancePasswordFree(`${day}T09:00:00+08:00`), false)
  }
  for (const day of ['2026-10-17', '2026-10-18']) assert.equal(isAttendancePasswordFree(`${day}T07:00:00+08:00`), false)
  assert.equal(isAttendancePasswordFree('2026-10-11T23:59:00Z'), true) // Taiwan Monday 07:59
  assert.equal(isAttendancePasswordFree('invalid date'), false)
})

test('configured lock times override the default and malformed settings fall back to 08:00', () => {
  assert.equal(isAttendancePasswordFree('2026-10-16T08:09:00+08:00', '08:10'), true)
  assert.equal(isAttendancePasswordFree('2026-10-16T08:10:00+08:00', '08:10'), false)
  assert.equal(isAttendancePasswordFree('2026-10-16T07:45:00+08:00', '07:45'), false)
  for (const value of [null, undefined, '', '24:00', '08:60', {}, '8:00']) assert.equal(normalizeAttendanceLockTime(value), '08:00')
})

test('live clock enforces cutoff without reload and retains manual teacher unlocking afterward', async () => {
  const now = ref('2026-10-16T07:59:00+08:00')
  const deadline = ref('08:00')
  const edits = []
  let prompts = 0
  const scope = effectScope()
  const board = scope.run(() => useAttendanceLock(student => edits.push(student.id), () => prompts++, () => isAttendancePasswordFree(now.value, deadline.value)))
  try {
    await board.requestAttendanceEdit({ id: 1 })
    assert.deepEqual(edits, [1])
    assert.equal(prompts, 0)
    now.value = '2026-10-16T08:00:00+08:00'
    await board.requestAttendanceEdit({ id: 2 })
    assert.deepEqual(edits, [1])
    assert.equal(prompts, 1)
    await board.unlockAttendance('導師')
    await board.requestAttendanceEdit({ id: 3 })
    assert.deepEqual(edits, [1, 2, 3])
    assert.equal(prompts, 1)
    board.lockAttendance()
    await board.requestAttendanceEdit({ id: 4 })
    assert.equal(prompts, 2)
    assert.deepEqual(edits, [1, 2, 3])
    board.cancelAttendanceUnlock()
    deadline.value = '08:30'
    await board.requestAttendanceEdit({ id: 5 })
    assert.deepEqual(edits, [1, 2, 3, 5])
    now.value = '2026-10-16T08:30:00+08:00'
    assert.equal(board.isAttendanceUnlocked.value, false)
  } finally { scope.stop() }
})

test('manual morning lock requires a teacher and a new weekday starts a fresh free window', async () => {
  const free = ref(true)
  const scope = effectScope()
  const board = scope.run(() => useAttendanceLock(() => {}, () => {}, free))
  try {
    board.lockAttendance()
    assert.equal(board.isAttendanceUnlocked.value, false)
    assert.equal(await board.unlockAttendance('學藝股長'), false)
    await board.unlockAttendance('導師')
    free.value = false
    assert.equal(board.isAttendanceUnlocked.value, true)
    free.value = true
    free.value = false
    assert.equal(board.isAttendanceUnlocked.value, false)
  } finally { scope.stop() }
})

test('homepage loads the same attendance_lock_time saved by the admin panel', async () => {
  const { useHomeData } = await import('../app/composables/useHomeData.js')
  let requestedKeys = []
  const client = { from: table => {
    const data = table === 'system_settings' ? [{ setting_key: 'attendance_lock_time', setting_value: '08:25' }] : []
    const query = {
      select: () => query, eq: () => query, neq: () => query, order: () => query,
      in: (_, keys) => { requestedKeys = keys; return query },
      maybeSingle: async () => ({ data: null }),
      then: (resolve, reject) => Promise.resolve({ data, error: null }).then(resolve, reject)
    }
    return query
  } }
  const state = useHomeData(client, '2026-10-16', ref(true), ref(''), ref(''), ref([]), ref([]), ref([]), ref(Date.now()))
  assert.equal(state.attendanceLockTime.value, '08:00')
  await state.fetchData()
  assert.ok(requestedKeys.includes('attendance_lock_time'))
  assert.equal(state.attendanceLockTime.value, '08:25')
})
