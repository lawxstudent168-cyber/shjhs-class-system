import test from 'node:test'
import assert from 'node:assert/strict'
import { attendanceStatusOrder, nextAttendanceStatus, parseAttendanceStatus, formatAttendanceStatus } from '../app/utils/attendanceStatus.js'
import { summarizeExamAttendance } from '../app/utils/examAttendance.js'

test('attendance cycles in requested order, including saved times and legacy leave', () => {
  let status = '未到'
  const seen = [status]
  for (let i = 1; i < attendanceStatusOrder.length; i++) {
    status = nextAttendanceStatus(status)
    seen.push(status)
  }
  assert.deepEqual(seen, ['未到', '已到', '遲到', '全天請假', '晚到請假', '早退請假', '部份公假'])
  assert.equal(nextAttendanceStatus('部份公假(離班 14:00)'), '未到')
  assert.equal(nextAttendanceStatus('遲到_08:15'), '全天請假')
  assert.equal(nextAttendanceStatus('請假'), '晚到請假')
  assert.equal(nextAttendanceStatus('早退請假(14:00)'), '部份公假')
})

test('partial public leave preserves direction and time across history edits', () => {
  for (const direction of ['入班', '離班']) {
    const saved = formatAttendanceStatus('部份公假', '10:30', direction)
    const parsed = parseAttendanceStatus(saved)
    assert.deepEqual(parsed, { base: '部份公假', time: '10:30', direction })
    assert.equal(formatAttendanceStatus(parsed.base, parsed.time, parsed.direction), saved)
  }
  for (const time of ['', '24:00', '12:60', 'abc', '8:00']) assert.throws(() => formatAttendanceStatus('部份公假', time, '入班'))
  assert.throws(() => formatAttendanceStatus('部份公假', '10:30', '其他'))
})

test('existing timed attendance keeps its database format', () => {
  for (const status of ['遲到_08:15', '晚到請假(10:00)', '早退請假(14:00)', '全天請假', '已到', '未到']) {
    const { base, time, direction } = parseAttendanceStatus(status)
    assert.equal(formatAttendanceStatus(base, time, direction), status)
  }
})

test('exam summaries count partial public leave as leave rather than absent', () => {
  const summary = summarizeExamAttendance([{ id: 's1', seat_number: 1 }], [{ student_id: 's1', status: '部份公假(離班 14:00)' }])
  assert.equal(summary.absent, 0)
  assert.equal(summary.leave, 1)
  assert.deepEqual(summary.leaveSeats, [1])
})
