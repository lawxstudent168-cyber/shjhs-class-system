export const examStatusPalette = {
  '--ex-status-present-bg': '#dcfce7', '--ex-status-present-text': '#166534', '--ex-status-present-border': '#86efac',
  '--ex-status-leave-bg': '#fee2e2', '--ex-status-leave-text': '#b91c1c', '--ex-status-leave-border': '#dc2626',
  '--ex-status-late-leave-bg': '#ffe4e6', '--ex-status-late-leave-text': '#9f1239', '--ex-status-late-leave-border': '#e11d48',
  '--ex-status-early-leave-bg': '#fff1f2', '--ex-status-early-leave-text': '#9f1239', '--ex-status-early-leave-border': '#fb7185',
  '--ex-status-late-bg': '#dbeafe', '--ex-status-late-text': '#1d4ed8', '--ex-status-late-border': '#93c5fd',
  '--ex-status-absent-bg': '#fecaca', '--ex-status-absent-text': '#7f1d1d', '--ex-status-absent-border': '#b91c1c'
}

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
