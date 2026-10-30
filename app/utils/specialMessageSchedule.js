const validDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

export function normalizeSpecialMessageDates(value) {
  const source = Array.isArray(value) ? value : value?.dates
  return [...new Set((Array.isArray(source) ? source : []).filter(validDate))].sort()
}

export function taiwanCalendarDate(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(now))
  const part = type => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function isSpecialMessageDateEnabled(value, now = Date.now()) {
  return normalizeSpecialMessageDates(value).includes(taiwanCalendarDate(now))
}

export function specialMessageCalendarDays(month) {
  if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) return []
  const [year, monthNumber] = month.split('-').map(Number)
  if (monthNumber < 1 || monthNumber > 12) return []
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)
  ]
}

export function shiftCalendarMonth(month, amount) {
  if (!/^\d{4}-\d{2}$/.test(month || '') || !Number.isInteger(amount)) return month
  const [year, monthNumber] = month.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + amount, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}
