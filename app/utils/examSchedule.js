export const examFontSettings = {
  title: { label: '最上方大考標題', min: 24, max: 100, default: 56 },
  attendance: { label: '出缺席資訊', min: 11, max: 28, default: 14 },
  clock: { label: '目前時間', min: 48, max: 160, default: 120 },
  subject: { label: '目前科目', min: 32, max: 112, default: 88 },
  countdown: { label: '剩餘時間', min: 48, max: 144, default: 104 },
  focusLabel: { label: '考試中左側標籤', min: 16, max: 40, default: 24 },
  seatNumber: { label: '座位表座號與講桌', min: 12, max: 48, default: 20 },
  notes: { label: '考前提醒文字', min: 16, max: 48, default: 24 }
}

export const examLeftTextSettings = {
  header: { label: '欄位名稱', min: 14, max: 48, default: 22 },
  period: { label: '節次', min: 16, max: 64, default: 29 },
  subject: { label: '考試科目', min: 16, max: 64, default: 29 },
  time: { label: '開始與結束時間', min: 16, max: 64, default: 29 }
}

const validColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : null

const emptyDay = () => ({ date: '', title: '', periods: [], notes: [] })

export function isValidExamDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

export function taiwanDateISO(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(now))
  const part = type => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function taiwanClockHHMMSS(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(now))
  const part = type => parts.find(item => item.type === type)?.value
  return `${part('hour')}:${part('minute')}:${part('second')}`
}

const clockMinutes = value => {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null
  const [hour, minute] = value.split(':').map(Number)
  return hour < 24 && minute < 60 ? hour * 60 + minute : null
}

export function examStatusAt(periods, time) {
  const result = { state: 'WAITING', current: null, next: null, periods: Array.isArray(periods) ? periods.map(period => ({ ...period, isActive: false })) : [] }
  const now = clockMinutes(time)
  if (now === null) return result
  let hasEnded = false
  for (let index = 0; index < result.periods.length; index++) {
    const period = result.periods[index]
    const start = clockMinutes(period.startTime)
    const end = clockMinutes(period.endTime)
    if (start === null || end === null || end <= start) continue
    if (now >= start && now < end) {
      period.isActive = true
      result.state = 'TESTING'
      result.current = period
      result.next = result.periods.slice(index + 1).find(next => clockMinutes(next.startTime) !== null) || null
      return result
    }
    if (now < start) {
      result.state = hasEnded ? 'BREAK' : 'WAITING'
      result.next = period
      return result
    }
    hasEnded = true
  }
  if (hasEnded) result.state = 'FINISHED'
  return result
}

export function examRemainingSeconds(endTime, clock) {
  const end = clockMinutes(endTime)
  if (end === null || !/^\d{2}:\d{2}:\d{2}$/.test(clock || '')) return 0
  const [hour, minute, second] = clock.split(':').map(Number)
  return Math.max(0, end * 60 - (hour * 3600 + minute * 60 + second))
}

export function hasValidExamDates(value) {
  const dates = value?.days?.map(day => day?.date)
  return Array.isArray(dates) && dates.length >= 2 &&
    isValidExamDate(dates[0]) && isValidExamDate(dates[1]) && dates[0] < dates[1]
}

export function normalizeExamSchedule(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const days = [0, 1].map(index => {
    // Existing single-day records become day one without changing the saved row first.
    const day = Array.isArray(source.days) ? source.days[index] : index === 0 ? source : null
    if (!day || typeof day !== 'object') return emptyDay()
    return {
      date: isValidExamDate(day.date) ? day.date : '',
      title: typeof day.title === 'string' ? day.title : '',
      periods: Array.isArray(day.periods) ? day.periods.map(period => ({ ...period })) : [],
      notes: Array.isArray(day.notes) ? [...day.notes] : []
    }
  })
  const fontSizes = Object.fromEntries(Object.entries(examFontSettings).map(([key, setting]) => {
    const size = Number(source.fontSizes?.[key])
    return [key, Number.isFinite(size) && size >= setting.min && size <= setting.max ? size : setting.default]
  }))
  const leftTextSizes = Object.fromEntries(Object.entries(examLeftTextSettings).map(([key, setting]) => {
    const size = Number(source.leftTextSizes?.[key])
    return [key, Number.isFinite(size) && size >= setting.min && size <= setting.max ? size : setting.default]
  }))
  const leftTextColors = Object.fromEntries(Object.keys(examLeftTextSettings).map(key =>
    [key, validColor(source.leftTextColors?.[key])]
  ))
  return {
    isExamModeEnabled: source.isExamModeEnabled !== false,
    theme: typeof source.theme === 'string' ? source.theme : 'midnight',
    displayMode: source.displayMode === 'automatic' ? 'automatic' : 'manual',
    displayDay: source.displayDay === 2 ? 2 : 1,
    days,
    fontSizes,
    leftTextSizes,
    leftTextColors
  }
}

export function displayedExamSchedule(value, todayISO = taiwanDateISO()) {
  const schedule = normalizeExamSchedule(value)
  // Before day two, keep day one visible; from day two onward, show day two.
  const selectedDay = schedule.displayMode === 'automatic' && hasValidExamDates(schedule)
    ? (todayISO >= schedule.days[1].date ? 2 : 1)
    : schedule.displayDay
  const day = schedule.days[selectedDay - 1]
  return { ...schedule, selectedDay, title: day.title, periods: day.periods, notes: day.notes }
}

export function examFontStyles(value) {
  const { fontSizes } = normalizeExamSchedule(value)
  return {
    '--ex-title-size': `${fontSizes.title}px`,
    '--ex-clock-size': `${fontSizes.clock}px`,
    '--ex-subject-size': `${fontSizes.subject}px`,
    '--ex-countdown-size': `${fontSizes.countdown}px`,
    '--ex-notes-size': `${fontSizes.notes}px`,
    '--ex-attendance-size': `${fontSizes.attendance}px`,
    '--ex-focus-label-size': `${fontSizes.focusLabel}px`,
    '--ex-seat-number-size': `${fontSizes.seatNumber}px`,
    '--ex-row-clock-size': `${Math.round(fontSizes.clock * 0.52)}px`,
    '--ex-row-clock-wide-size': `${Math.round(fontSizes.clock * 0.75)}px`,
    '--ex-row-subject-size': `${Math.round(fontSizes.subject * 0.7)}px`,
    '--ex-row-countdown-size': `${Math.round(fontSizes.countdown * 0.7)}px`,
    '--ex-next-subject-size': `${Math.round(fontSizes.subject * 0.65)}px`,
    '--ex-next-time-size': `${Math.round(fontSizes.clock * 0.25)}px`
  }
}

export function examLeftTextStyles(value, theme) {
  const { leftTextSizes, leftTextColors } = normalizeExamSchedule(value)
  const styles = {}
  for (const key of Object.keys(examLeftTextSettings)) {
    const color = leftTextColors[key]
    styles[`--ex-left-${key}-size`] = `${leftTextSizes[key]}px`
    styles[`--ex-left-${key}-color`] = color || (key === 'header' ? theme.title : theme.text)
    if (key !== 'header') styles[`--ex-left-${key}-active-color`] = color || theme.accent
  }
  return styles
}
