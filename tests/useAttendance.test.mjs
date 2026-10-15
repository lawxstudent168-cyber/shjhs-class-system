import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope } from 'vue'
import { useAttendance } from '../app/composables/useAttendance.js'

test('partial public leave persists both directions, counts correctly, and cancellation does not write', async () => {
  const writes = []
  let failWrite = false
  const alerts = []
  const oldClient = globalThis.useSupabaseClient
  const oldAlert = globalThis.alert
  globalThis.alert = message => alerts.push(message)
  globalThis.useSupabaseClient = () => ({ from: () => ({
    select: () => {
      const query = { eq: () => query, maybeSingle: async () => ({ data: { id: 1 }, error: null }) }
      return query
    },
    update: payload => ({ eq: async () => {
      if (failWrite) return { error: { message: 'write denied' } }
      writes.push(payload)
      return { error: null }
    } })
  }) })
  const scope = effectScope()
  try {
    const attendance = scope.run(() => useAttendance('2026-10-15'))
    const student = { id: 's1', real_name: '測試學生' }
    attendance.allStudents.value = [student]
    for (const direction of ['入班', '離班']) {
      attendance.todayAttendances.value = [{ student_id: 's1', status: '早退請假(14:00)' }]
      const pending = attendance.toggleAttendanceLogic(student, true, '', true)
      assert.equal(attendance.attendanceTimeRequest.value.student.id, 's1')
      attendance.finishAttendanceTime({ direction, time: '10:30' })
      await pending
      assert.equal(writes.at(-1).status, `部份公假(10:30 ${direction})`)
      assert.equal(attendance.partialPublicLeaveCount.value, 1)
      assert.equal(attendance.absentCount.value, 0)
    }
    attendance.todayAttendances.value[0].status = '早退請假(14:00)'
    const pending = attendance.toggleAttendanceLogic(student, true, '', true)
    attendance.finishAttendanceTime()
    await pending
    assert.equal(writes.length, 2)
    assert.equal(attendance.todayAttendances.value[0].status, '早退請假(14:00)')
    for (const [status, next] of [['已到', '遲到'], ['全天請假', '晚到請假'], ['晚到請假(10:00)', '早退請假']]) {
      attendance.todayAttendances.value[0].status = status
      const pendingTime = attendance.toggleAttendanceLogic(student, true, '', true)
      assert.equal(attendance.attendanceTimeRequest.value.status, next)
      attendance.finishAttendanceTime({ time: '09:30' })
      await pendingTime
      assert.match(writes.at(-1).status, /09:30/)
    }
    attendance.todayAttendances.value[0].status = '部份公假(14:00 離班)'
    await attendance.toggleAttendanceLogic(student, true, '', true)
    assert.equal(writes.at(-1).status, '全天公假')
    assert.equal(attendance.fullPublicLeaveCount.value, 1)
    assert.equal(attendance.absentCount.value, 0)
    await attendance.toggleAttendanceLogic(student, true, '', true)
    assert.equal(writes.at(-1).status, '未到')
    attendance.todayAttendances.value[0].status = '早退請假(14:00)'
    failWrite = true
    const failing = attendance.toggleAttendanceLogic(student, true, '', true)
    attendance.finishAttendanceTime({ direction: '離班', time: '14:30' })
    await failing
    assert.equal(attendance.todayAttendances.value[0].status, '早退請假(14:00)')
    assert.match(alerts.at(-1), /write denied/)
  } finally {
    scope.stop()
    if (oldClient === undefined) delete globalThis.useSupabaseClient
    else globalThis.useSupabaseClient = oldClient
    if (oldAlert === undefined) delete globalThis.alert
    else globalThis.alert = oldAlert
  }
})
