import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeExamAttendance } from '../app/utils/examAttendance.js'

test('exam header uses homepage attendance categories and shows seats only for absent and leave', () => {
  const students = [3, 1, 10, 2, 6, 5, 4, 7].map(number => ({ id: number, seat_number: number }))
  const attendances = [
    { student_id: 1, status: '已到' },
    { student_id: 2, status: '全天請假' },
    { student_id: 3, status: '晚到請假(10:00)' },
    { student_id: 4, status: '早退請假(14:00)' },
    { student_id: 5, status: '遲到_08:15' },
    { student_id: 6, status: '請假' }
  ]
  assert.deepEqual(summarizeExamAttendance(students, attendances), {
    expected: 8,
    present: 1,
    leave: 2,
    lateLeave: 1,
    earlyLeave: 1,
    late: 1,
    absent: 2,
    absentSeats: [7, 10],
    leaveSeats: [2, 3, 4, 6]
  })
})

test('records outside the homepage student list do not change exam counts', () => {
  assert.equal(summarizeExamAttendance([{ id: 1, seat_number: 1 }], [{ student_id: 2, status: '已到' }]).absent, 1)
})
