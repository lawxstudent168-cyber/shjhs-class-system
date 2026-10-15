const clockPattern = /^([01]\d|2[0-3]):[0-5]\d$/

export function normalizeAttendanceLockTime(value) {
  return typeof value === 'string' && clockPattern.test(value) ? value : '08:00'
}

// Attendance hours follow the school's Taiwan clock, regardless of device timezone.
export function isAttendancePasswordFree(now = Date.now(), lockTime = '08:00') {
  const date = new Date(now)
  if (!Number.isFinite(date.getTime())) return false
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date)
  const part = type => parts.find(item => item.type === type)?.value
  if (!['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(part('weekday'))) return false
  return `${part('hour')}:${part('minute')}` < normalizeAttendanceLockTime(lockTime)
}
