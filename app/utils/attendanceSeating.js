const seatNumberKey = value => {
  const match = String(value ?? '').match(/\d+/)
  return match ? String(Number(match[0])) : null
}

// Follow the saved physical slots, but keep every student available for attendance.
export function attendanceSeatingLayout(students = [], seatingChart = {}) {
  const byNumber = new Map()
  for (const student of students) {
    const key = seatNumberKey(student.seat_number)
    if (key && !byNumber.has(key)) byNumber.set(key, student)
  }

  const placedIds = new Set()
  const slots = (seatingChart?.seats || []).map((seat, index) => {
    const student = seat.isHidden ? null : byNumber.get(seatNumberKey(seat.seatNum))
    const availableStudent = student && !placedIds.has(student.id) ? student : null
    if (availableStudent) placedIds.add(availableStudent.id)
    return { key: seat.id ?? index, isHidden: Boolean(seat.isHidden), student: availableStudent }
  })

  return { slots, unplaced: students.filter(student => !placedIds.has(student.id)) }
}
