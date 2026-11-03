import { isValidExamDate, taiwanDateISO } from './examSchedule.js'

export function extractYouTubeVideoId(url) {
  if (typeof url !== 'string') return null
  const match = url.match(/^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|[?&]v=)([^#&?]*).*/)
  return match?.[1]?.length === 11 ? match[1] : null
}

const validUrl = url => typeof url === 'string' && Boolean(extractYouTubeVideoId(url.trim()))
const entryUrl = entry => typeof entry === 'string' ? entry : typeof entry?.url === 'string' ? entry.url : ''

export function normalizeMediaSchedule(value, { nestedLegacy = false } = {}) {
  const source = value && typeof value === 'object' ? value : {}
  const legacySource = nestedLegacy && source.videos && typeof source.videos === 'object' ? source.videos : source
  const legacy = Object.fromEntries(Array.from({ length: 7 }, (_, day) => {
    const url = legacySource[day]
    return [day, validUrl(url) ? url.trim() : '']
  }))
  const calendar = {}
  for (const [date, entry] of Object.entries(source.calendar || {})) {
    const url = entryUrl(entry).trim()
    if (!isValidExamDate(date) || !validUrl(url)) continue
    const order = Number(entry?.order)
    calendar[date] = { url, ...(Number.isInteger(order) && order > 0 ? { order } : {}) }
  }
  const library = []
  for (const candidate of [...(Array.isArray(source.library) ? source.library : []), ...Object.values(calendar).map(entry => entry.url), ...Object.values(legacy)]) {
    const url = entryUrl(candidate).trim()
    if (validUrl(url) && !library.includes(url)) library.push(url)
  }
  return { calendar, library, legacy }
}

const weekdayUTC = date => new Date(`${date}T00:00:00Z`).getUTCDay()
const shiftDate = (date, amount) => {
  const parsed = new Date(`${date}T00:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() + amount)
  return parsed.toISOString().slice(0, 10)
}

export function nextSchoolDay(date) {
  let next = shiftDate(date, 1)
  while ([0, 6].includes(weekdayUTC(next))) next = shiftDate(next, 1)
  return next
}

export function mondayOfWeek(date) {
  const day = weekdayUTC(date)
  return shiftDate(date, day === 0 ? -6 : 1 - day)
}

export function resolveMediaForDate(value, date = taiwanDateISO(), options = {}) {
  const normalized = normalizeMediaSchedule(value, options)
  const weekday = weekdayUTC(date)
  if ([0, 6].includes(weekday)) {
    const past = Object.entries(normalized.calendar)
      .filter(([scheduledDate]) => scheduledDate < date)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, entry]) => entry.url)
    const unique = [...new Set(past)]
    if (!unique.length) return ''
    const seed = [...date].reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) >>> 0, 0)
    return unique[seed % unique.length]
  }
  if (normalized.calendar[date]) return normalized.calendar[date].url
  if (Object.keys(normalized.calendar).length) return ''
  return normalized.legacy[weekday] || ''
}

export function addMediaToLibrary(value, url, options = {}) {
  const normalized = normalizeMediaSchedule(value, options)
  const clean = String(url || '').trim()
  if (!validUrl(clean)) return normalized
  if (!normalized.library.includes(clean)) normalized.library.push(clean)
  return normalized
}

export function autoArrangeMedia(value, startDate, options = {}) {
  const normalized = normalizeMediaSchedule(value, options)
  if (!isValidExamDate(startDate)) return normalized
  let date = startDate
  while ([0, 6].includes(weekdayUTC(date))) date = nextSchoolDay(date)
  for (const scheduledDate of Object.keys(normalized.calendar)) if (scheduledDate >= date) delete normalized.calendar[scheduledDate]
  normalized.library.forEach((url, index) => {
    normalized.calendar[date] = { url, order: index + 1 }
    date = nextSchoolDay(date)
  })
  return normalized
}

export function setMediaForDate(value, date, url, options = {}) {
  const normalized = normalizeMediaSchedule(value, options)
  if (!isValidExamDate(date) || [0, 6].includes(weekdayUTC(date))) return normalized
  const clean = String(url || '').trim()
  if (!validUrl(clean)) delete normalized.calendar[date]
  else {
    if (!normalized.library.includes(clean)) normalized.library.push(clean)
    const order = normalized.library.indexOf(clean) + 1
    normalized.calendar[date] = { url: clean, order }
  }
  return normalized
}

export function copyPreviousWeek(value, targetDate, options = {}) {
  const normalized = normalizeMediaSchedule(value, options)
  if (!isValidExamDate(targetDate)) return normalized
  const targetMonday = mondayOfWeek(targetDate)
  const previousMonday = shiftDate(targetMonday, -7)
  for (let offset = 0; offset < 5; offset++) {
    const sourceDate = shiftDate(previousMonday, offset)
    const target = shiftDate(targetMonday, offset)
    if (normalized.calendar[sourceDate]) normalized.calendar[target] = { ...normalized.calendar[sourceDate] }
    else delete normalized.calendar[target]
  }
  return normalized
}

export function delayMediaSchedule(value, fromDate = taiwanDateISO(), options = {}) {
  const normalized = normalizeMediaSchedule(value, options)
  const calendar = Object.fromEntries(Object.entries(normalized.calendar).filter(([date]) => date < fromDate))
  for (const [date, entry] of Object.entries(normalized.calendar).filter(([date]) => date >= fromDate).sort(([a], [b]) => a.localeCompare(b))) {
    calendar[nextSchoolDay(date)] = { ...entry }
  }
  normalized.calendar = calendar
  return normalized
}

export function mediaCalendarDays(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) return []
  const [year, monthNumber] = month.split('-').map(Number)
  const first = new Date(Date.UTC(year, monthNumber - 1, 1))
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return [...Array(first.getUTCDay()).fill(null), ...Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)]
}

export function shiftMediaMonth(month, amount) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber - 1 + amount, 1)).toISOString().slice(0, 7)
}

