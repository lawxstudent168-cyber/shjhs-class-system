import test from 'node:test'
import assert from 'node:assert/strict'
import { emptySeatingMode, normalizeSeatingSchedule, resolveSeatingLayout, resolveSeatingMode } from '../app/utils/seatingSchedule.js'
import { readFileSync } from 'node:fs'
import { taiwanDateISO } from '../app/utils/examSchedule.js'

const data = {
  activeMode: 'normal',
  modes: Object.fromEntries(['normal', 'normalB', 'backup', 'backupB', 'exam', 'mock'].map(mode => [mode, {
    seats: [{ id: 1, seatNum: mode }], isVisible: true, isRotated: false, settings: {}
  }])),
  modeSchedule: {
    starts: [{ date: '2026-10-15', mode: 'backupB' }, { date: '2026-10-10', mode: 'normalB' }],
    specialDates: [{ date: '2026-10-13', mode: 'exam' }, { date: '2026-10-14', mode: 'exam' }, { date: '2026-10-20', mode: 'mock' }]
  }
}

test('start dates persist until the next change while exam dates override only their own days', () => {
  assert.equal(resolveSeatingMode(data, '2026-10-09'), 'normal')
  assert.equal(resolveSeatingMode(data, '2026-10-12'), 'normalB')
  assert.equal(resolveSeatingMode(data, '2026-10-13'), 'exam')
  assert.equal(resolveSeatingMode(data, '2026-10-14'), 'exam')
  assert.equal(resolveSeatingMode(data, '2026-10-15'), 'backupB')
  assert.equal(resolveSeatingMode(data, '2026-10-20'), 'mock')
  assert.equal(resolveSeatingMode(data, '2026-10-21'), 'backupB')
  assert.equal(resolveSeatingLayout(data, '2026-10-20').seats[0].seatNum, 'mock')
  assert.equal(resolveSeatingMode(data, taiwanDateISO('2026-10-14T15:59:00Z')), 'exam')
  assert.equal(resolveSeatingMode(data, taiwanDateISO('2026-10-14T16:00:00Z')), 'backupB')
})

test('invalid schedule entries are ignored and legacy single-layout data still displays', () => {
  assert.deepEqual(normalizeSeatingSchedule({
    starts: [{ date: '2026-02-30', mode: 'normal' }, { date: '2026-10-10', mode: 'unknown' }],
    specialDates: [{ date: '2026-10-13', mode: 'normal' }]
  }), { starts: [], specialDates: [] })
  const legacy = resolveSeatingLayout({ seats: [{ id: 1, content: '1號\n學生' }], isVisible: true }, '2026-10-13')
  assert.equal(legacy.seats[0].seatNum, '1號')
  assert.equal(legacy.seats[0].name, '學生')
})

test('clearing a mode removes its seat data and print template without deleting its grid', () => {
  const cleared = emptySeatingMode()
  assert.equal(cleared.seats.length, 30)
  assert.deepEqual(cleared.seats.map(seat => seat.id), Array.from({ length: 30 }, (_, index) => index + 1))
  assert.ok(cleared.seats.every(seat => !seat.seatNum && !seat.name && !seat.other))
  assert.equal(cleared.printData.title, '')
})

test('six and seven column layouts preserve their selected column count', () => {
  const seven = emptySeatingMode(7)
  assert.equal(seven.columnCount, 7)
  assert.equal(seven.seats.length, 35)
  const resolved = resolveSeatingLayout({ activeMode: 'normal', modes: { normal: seven } }, '2026-11-17')
  assert.equal(resolved.columnCount, 7)
  assert.equal(resolved.seats.length, 35)
  assert.equal(resolveSeatingLayout({ seats: Array.from({ length: 30 }, (_, id) => ({ id })) }, '2026-11-17').columnCount, 6)
})

test('seat editor and homepage render the saved six or seven columns dynamically', () => {
  const editor = readFileSync(new URL('../app/pages/seats.vue', import.meta.url), 'utf8')
  const homepage = readFileSync(new URL('../components/home/SeatingAndHygiene.vue', import.meta.url), 'utf8')
  const attendance = readFileSync(new URL('../components/home/AttendanceGrid.vue', import.meta.url), 'utf8')
  const examSeatMap = readFileSync(new URL('../components/home/ExamSeatMap.vue', import.meta.url), 'utf8')
  assert.match(editor, /六排/)
  assert.match(editor, /七排/)
  assert.match(editor, /changeColumnCount/)
  assert.match(editor, /gridColumnsStyle\(columnCount\)/)
  assert.match(homepage, /seatingColumnCount/)
  assert.match(attendance, /seatingGridStyle/)
  assert.match(attendance, /seatingChart\?\.columnCount === 7/)
  assert.match(examSeatMap, /seatGridStyle/)
  assert.match(examSeatMap, /seatingChart\?\.columnCount === 7/)
})
