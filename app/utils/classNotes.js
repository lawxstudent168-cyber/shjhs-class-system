import { isValidExamDate, taiwanDateISO } from './examSchedule.js'

export function normalizeClassNotes(value) {
  const entries = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.entries(value).flatMap(([date, items]) => Array.isArray(items)
        ? items.map(content => ({ date, content })) : [])
      : []
  return entries
    .filter(item => item && isValidExamDate(item.date) && typeof item.content === 'string' && item.content.trim())
    .map(item => ({ date: item.date, content: item.content.trim() }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function weeklyClassNotes(value, now = Date.now()) {
  const today = typeof now === 'string' ? now : taiwanDateISO(now)
  const end = new Date(`${today}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 6)
  const lastDay = end.toISOString().slice(0, 10)
  return normalizeClassNotes(value).filter(item => item.date >= today && item.date <= lastDay)
}

export function classNoteDateLabel(date) {
  if (!isValidExamDate(date)) return ''
  const parsed = new Date(`${date}T00:00:00Z`)
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][parsed.getUTCDay()]
  return `${parsed.getUTCMonth() + 1}/${parsed.getUTCDate()}（週${weekday}）`
}
