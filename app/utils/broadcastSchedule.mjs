export const BROADCAST_SCHEDULE_TYPES = ['daily', 'weekly', 'special']

export function scheduleType(schedule) {
  return BROADCAST_SCHEDULE_TYPES.includes(schedule?.repeatType) ? schedule.repeatType : 'daily'
}

export function normalizeBroadcastSchedule(schedule) {
  return {
    ...schedule,
    repeatType: scheduleType(schedule),
    weekdays: Array.isArray(schedule?.weekdays) ? schedule.weekdays.filter(day => Number.isInteger(day) && day >= 0 && day <= 6) : [],
    dates: Array.isArray(schedule?.dates) ? [...new Set(schedule.dates.filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort() : []
  }
}

export function taiwanBroadcastClock(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).map(part => [part.type, part.value]))
  const date = `${parts.year}-${parts.month}-${parts.day}`
  return {
    date,
    weekday: new Date(`${date}T00:00:00Z`).getUTCDay(),
    time: `${parts.hour}:${parts.minute}`,
    second: Number(parts.second)
  }
}

// A special-date schedule replaces regular daily schedules for its receiving device
// throughout that date. Weekly schedules continue to run independently.
export function dueBroadcastSchedules(schedules, clock, canReceive = () => true) {
  const active = (Array.isArray(schedules) ? schedules : []).filter(schedule =>
    schedule?.isActive && canReceive(schedule.targetIP)
  )
  const specialToday = active.some(schedule =>
    scheduleType(schedule) === 'special' && Array.isArray(schedule.dates) && schedule.dates.includes(clock.date)
  )
  return active.filter(schedule => {
    if (schedule.time !== clock.time) return false
    const type = scheduleType(schedule)
    if (type === 'special') return Array.isArray(schedule.dates) && schedule.dates.includes(clock.date)
    if (type === 'weekly') return Array.isArray(schedule.weekdays) && schedule.weekdays.includes(clock.weekday)
    return !specialToday
  }).sort((a, b) => {
    const order = { special: 0, weekly: 1, daily: 2 }
    return order[scheduleType(a)] - order[scheduleType(b)]
  })
}
