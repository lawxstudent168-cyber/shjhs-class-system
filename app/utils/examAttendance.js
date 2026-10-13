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
    if (status === '已到') summary.present++
    else if (status === '請假' || status === '全天請假') {
      summary.leave++
      if (seat != null) summary.leaveSeats.push(seat)
    } else if (status.startsWith('晚到請假')) {
      summary.lateLeave++
      if (seat != null) summary.leaveSeats.push(seat)
    } else if (status.startsWith('早退請假')) {
      summary.earlyLeave++
      if (seat != null) summary.leaveSeats.push(seat)
    } else if (status.startsWith('遲到')) summary.late++
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
