export const examStatusPalette = {
  '--ex-status-present-bg': '#dcfce7', '--ex-status-present-text': '#14532d', '--ex-status-present-border': '#86efac',
  '--ex-status-leave-bg': '#fef9c3', '--ex-status-leave-text': '#713f12', '--ex-status-leave-border': '#fde047',
  '--ex-status-late-leave-bg': '#ffedd5', '--ex-status-late-leave-text': '#c2410c', '--ex-status-late-leave-border': '#fdba74',
  '--ex-status-early-leave-bg': '#f3e8ff', '--ex-status-early-leave-text': '#6b21a8', '--ex-status-early-leave-border': '#d8b4fe',
  '--ex-status-late-bg': '#dbeafe', '--ex-status-late-text': '#1e3a8a', '--ex-status-late-border': '#93c5fd',
  '--ex-status-absent-bg': '#fee2e2', '--ex-status-absent-text': '#991b1b', '--ex-status-absent-border': '#fca5a5'
}

export function examAttendanceKind(status) {
  if (status === '已到') return 'present'
  if (status === '請假' || status === '全天請假' || status === '全天公假' || status?.startsWith('部份公假')) return 'leave'
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
