import test from 'node:test'
import assert from 'node:assert/strict'
import { attendanceSeatingLayout } from '../app/utils/attendanceSeating.js'

test('seat layout follows physical slots and keeps unplaced students available', () => {
  const students = [
    { id: 1, seat_number: 1 },
    { id: 2, seat_number: 2 },
    { id: 3, seat_number: 3 }
  ]
  const chart = { seats: [
    { id: 1, seatNum: '2號' },
    { id: 2, seatNum: '', isHidden: true },
    { id: 3, seatNum: '01號' },
    { id: 4, seatNum: '2號' }
  ] }
  const result = attendanceSeatingLayout(students, chart)
  assert.deepEqual(result.slots.map(slot => slot.student?.id ?? null), [2, null, 1, null])
  assert.deepEqual(result.unplaced.map(student => student.id), [3])
})

test('hidden or missing seating chart cannot remove students from attendance', () => {
  const students = [{ id: 1, seat_number: 1 }]
  assert.deepEqual(attendanceSeatingLayout(students, {}).unplaced, students)
  assert.deepEqual(attendanceSeatingLayout(students, { seats: [{ id: 1, seatNum: '1號', isHidden: true }] }).unplaced, students)
})
