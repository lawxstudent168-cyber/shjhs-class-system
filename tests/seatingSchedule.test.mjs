import test from 'node:test'
import assert from 'node:assert/strict'
import { emptySeatingMode, normalizeSeatingSchedule, resolveSeatingLayout, resolveSeatingMode } from '../app/utils/seatingSchedule.js'
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
