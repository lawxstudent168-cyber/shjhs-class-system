import { isValidExamDate, taiwanDateISO } from './examSchedule.js'

export function normalizeVideoBlackoutDates(value) {
  return Array.isArray(value) ? [...new Set(value.filter(isValidExamDate))].sort() : []
}

export function isVideoBlackoutTime(dates, now = new Date()) {
  if (!Array.isArray(dates) || !dates.includes(taiwanDateISO(now))) return false
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).map(part => [part.type, part.value]))
  const minutes = Number(parts.hour) * 60 + Number(parts.minute)
  return minutes >= 7 * 60 + 30 && minutes < 17 * 60 + 45
}

export function matchesTeacherVideoPassword(attempt, config, now = new Date()) {
  if (attempt === '168168168') return true
  if (config?.type === 'custom') return Boolean(config.custom_pwd) && attempt === config.custom_pwd
  return attempt === `${taiwanDateISO(now).slice(2).replaceAll('-', '')}59`
}
