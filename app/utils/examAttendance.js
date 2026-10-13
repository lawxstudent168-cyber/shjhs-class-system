export function examAttendanceKind(status) {
  if (status === '已到') return 'present'
  if (status === '請假' || status === '全天請假') return 'leave'
  if (status?.startsWith('晚到請假')) return 'late-leave'
  if (status?.startsWith('早退請假')) return 'early-leave'
  if (status?.startsWith('遲到')) return 'late'
  return 'absent'
}

export function examSeatStatusByNumber(students = [], attendances = []) {
  const statuses = new Map(attendances.map(record => [record.student_id, record.status]))
  const bySeat = {}
  for (const student of students) {
    const seat = String(student.seat_number ?? '').match(/\d+/)?.[0]
    if (seat !== undefined) bySeat[String(Number(seat))] = examAttendanceKind(statuses.get(student.id))
  }
  return bySeat
}

export function summarizeExamAttendance(students = [], attendances = []) {
  const statuses = new Map(attendances.map(record => [record.student_id, record.status || '未到']))
  const summary = {
    expected: students.length,
    present: 0,
    leave: 0,
    lateLeave: 0,
    earlyLeave: 0,
    late: 0,
    absent: 0,
    absentSeats: [],
    leaveSeats: []
  }

  for (const student of students) {
    const status = statuses.get(student.id) || '未到'
    const seat = student.seat_number
    const kind = examAttendanceKind(status)
    if (kind === 'present') summary.present++
    else if (kind === 'leave') {
      summary.leave++
      if (seat != null) summary.leaveSeats.push(seat)
    } else if (kind === 'late-leave') {
      summary.lateLeave++
      if (seat != null) summary.leaveSeats.push(seat)
    } else if (kind === 'early-leave') {
      summary.earlyLeave++
      if (seat != null) summary.leaveSeats.push(seat)
    } else if (kind === 'late') summary.late++
    else {
      summary.absent++
      if (seat != null) summary.absentSeats.push(seat)
    }
  }

  const bySeat = (a, b) => Number(a) - Number(b) || String(a).localeCompare(String(b), 'zh-TW')
  summary.absentSeats.sort(bySeat)
  summary.leaveSeats.sort(bySeat)
  return summary
}
