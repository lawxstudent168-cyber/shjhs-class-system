import { isValidExamDate } from './examSchedule.js'

export const seatingModeKeys = ['normal', 'normalB', 'backup', 'backupB', 'exam', 'mock']
const validMode = mode => seatingModeKeys.includes(mode)

export function normalizeSeatingSchedule(value) {
  const starts = new Map()
  const specialDates = new Map()
  if (Array.isArray(value?.starts)) {
    for (const item of value.starts) {
      if (isValidExamDate(item?.date) && validMode(item?.mode)) starts.set(item.date, item.mode)
    }
  }
  if (Array.isArray(value?.specialDates)) {
    for (const item of value.specialDates) {
      if (isValidExamDate(item?.date) && ['exam', 'mock'].includes(item?.mode)) specialDates.set(item.date, item.mode)
    }
  }
  const sorted = entries => [...entries].sort(([a], [b]) => a.localeCompare(b)).map(([date, mode]) => ({ date, mode }))
  return { starts: sorted(starts), specialDates: sorted(specialDates) }
}

export function resolveSeatingMode(data, date) {
  const schedule = normalizeSeatingSchedule(data?.modeSchedule)
  let mode = validMode(data?.activeMode) ? data.activeMode : 'normal'
  for (const start of schedule.starts) {
    if (start.date > date) break
    mode = start.mode
  }
  return schedule.specialDates.find(item => item.date === date)?.mode || mode
}

export function resolveSeatingLayout(data, date) {
  if (!data || typeof data !== 'object') return { seats: [], isVisible: false, isRotated: false, settings: {} }
  const mode = resolveSeatingMode(data, date)
  const source = data.modes?.[mode] || data
  const seats = (Array.isArray(source.seats) ? source.seats : []).map(seat => seat.content !== undefined
    ? { id: seat.id, isHidden: seat.isHidden, seatNum: String(seat.content).split('\n')[0] || '', name: String(seat.content).split('\n')[1] || '', other: String(seat.content).split('\n').slice(2).join(' ') || '' }
    : seat)
  return { activeMode: mode, seats, isVisible: source.isVisible === true, isRotated: source.isRotated === true, settings: source.settings || {}, printData: source.printData || {} }
}

export function emptySeatingMode() {
  return {
    seats: Array.from({ length: 30 }, (_, index) => ({ id: index + 1, seatNum: '', name: '', other: '', isHidden: false })),
    isRotated: false,
    isVisible: true,
    settings: { numberSize: 16, numberColor: '#64748b', nameSize: 20, nameColor: '#e11d48', otherSize: 14, otherColor: '#94a3b8' },
    printData: { title: '', count: '', date: '', rolesLeft: '', rolesRight: '' }
  }
}
