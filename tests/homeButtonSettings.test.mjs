import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultRoleButtonSettings, effectiveHomeButtonSettings, homeButtonList, normalizeRoleButtonSettings } from '../app/utils/homeButtonSettings.js'

test('older saved role settings retain choices and gain the small seat map option', () => {
  const saved = { classroom: { showSeats: false, smallSeatMap: false }, parent: { parentMsg: false } }
  const normalized = normalizeRoleButtonSettings(saved)
  assert.equal(normalized.classroom.showSeats, false)
  assert.equal(normalized.classroom.smallSeatMap, false)
  assert.equal(normalized.classroom.showHygiene, true)
  assert.equal(normalized.parent.parentMsg, false)
  assert.equal(normalized.teacher.smallSeatMap, true)
  assert.deepEqual(Object.keys(defaultRoleButtonSettings.teacher).sort(), homeButtonList.map(button => button.key).sort())
})

test('role switches control the corresponding homepage buttons and global switches still override', () => {
  const roles = normalizeRoleButtonSettings({ classroom: {
    schedule: false, manageSchedule: true, showSeats: true, showHygiene: true,
    contactHistory: false, broadcast: false, smallSeatMap: true
  } })
  const shown = effectiveHomeButtonSettings(roles, {}, 'classroom')
  assert.equal(shown.schedule, false)
  assert.equal(shown.manageSchedule, true)
  assert.equal(shown.showSeats, true)
  assert.equal(shown.contactHistory, false)
  assert.equal(shown.broadcast, false)
  assert.equal(shown.smallSeatMap, true)
  const hidden = effectiveHomeButtonSettings(roles, { schedule: false, seats: false, hygiene: false, smallSeatMap: false }, 'classroom')
  assert.equal(hidden.manageSchedule, false)
  assert.equal(hidden.schedule, false)
  assert.equal(hidden.showSeats, false)
  assert.equal(hidden.showHygiene, false)
  assert.equal(hidden.smallSeatMap, false)
})
