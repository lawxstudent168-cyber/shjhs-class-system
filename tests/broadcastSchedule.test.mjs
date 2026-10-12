import test from 'node:test'
import assert from 'node:assert/strict'
import { dueBroadcastSchedules, normalizeBroadcastSchedule, taiwanBroadcastClock } from '../app/utils/broadcastSchedule.mjs'

const clock = { date: '2026-10-12', weekday: 1, time: '08:00', second: 0 }
const schedule = (text, repeatType, extra = {}) => ({ isActive: true, time: '08:00', text, repeatType, ...extra })

test('existing schedules remain ordinary daily schedules', () => {
  const old = normalizeBroadcastSchedule({ isActive: true, time: '08:00', text: 'old' })
  assert.equal(old.repeatType, 'daily')
  assert.deepEqual(dueBroadcastSchedules([old], clock).map(item => item.text), ['old'])
})

test('Taiwan clock determines date and weekday across UTC date boundary', () => {
  assert.deepEqual(taiwanBroadcastClock(new Date('2026-10-11T16:00:05Z')), clockWithSecond(5))
})

function clockWithSecond(second) { return { ...clock, time: '00:00', second } }

test('active special date suppresses ordinary daily even before special broadcast time', () => {
  const regular = schedule('regular', 'daily')
  const special = schedule('special', 'special', { dates: [clock.date], time: '09:00' })
  const weekly = schedule('weekly', 'weekly', { weekdays: [1] })
  assert.deepEqual(dueBroadcastSchedules([regular, special, weekly], clock).map(item => item.text), ['weekly'])
  assert.deepEqual(dueBroadcastSchedules([regular, special, weekly], { ...clock, time: '09:00' }).map(item => item.text), ['special'])
})

test('disabled or other-date specials do not suppress regular daily', () => {
  const regular = schedule('regular', 'daily')
  const disabled = schedule('disabled', 'special', { dates: [clock.date], isActive: false })
  const future = schedule('future', 'special', { dates: ['2026-10-13'] })
  assert.deepEqual(dueBroadcastSchedules([regular, disabled, future], clock).map(item => item.text), ['regular'])
})

test('special date only overrides schedules for the same receiving device', () => {
  const regular = schedule('regular', 'daily', { targetIP: '702' })
  const special = schedule('special', 'special', { dates: [clock.date], targetIP: '701' })
  assert.deepEqual(dueBroadcastSchedules([regular, special], clock, target => target === '702').map(item => item.text), ['regular'])
  assert.deepEqual(dueBroadcastSchedules([regular, special], clock, target => target === '701').map(item => item.text), ['special'])
})

test('weekly schedule runs only on selected weekdays', () => {
  const weekly = schedule('weekly', 'weekly', { weekdays: [2, 4] })
  assert.deepEqual(dueBroadcastSchedules([weekly], clock), [])
  assert.deepEqual(dueBroadcastSchedules([weekly], { ...clock, weekday: 2 }).map(item => item.text), ['weekly'])
})
