import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { advanceSpecialMessageGate } from '../app/utils/specialMessageGate.js'

test('special message entrance unlocks only on the seventh timely tap and resets after the window', () => {
  let state = { count: 0, lastTap: 0 }
  for (let tap = 1; tap <= 6; tap++) {
    state = advanceSpecialMessageGate(state, 1000 + tap * 100)
    assert.equal(state.unlocked, false)
  }
  state = advanceSpecialMessageGate(state, 1700)
  assert.equal(state.unlocked, true)
  assert.equal(state.count, 0)

  state = advanceSpecialMessageGate({ count: 6, lastTap: 1000 }, 10_000)
  assert.equal(state.unlocked, false)
  assert.equal(state.count, 1)
})

test('homepage setting button opens the guarded special-message route after the tap gate', async () => {
  const component = await readFile(new URL('../components/home/HomeActionButtons.vue', import.meta.url), 'utf8')
  assert.match(component, />設定<\/button>/)
  assert.match(component, /advanceSpecialMessageGate/)
  assert.match(component, /special_message_entry/)
  assert.match(component, /navigateTo\('\/special-message'\)/)
})

test('special message page uses birthday-only server verification without IP or location checks', async () => {
  const page = await readFile(new URL('../app/pages/special-message.vue', import.meta.url), 'utf8')
  assert.match(page, /authMethod: 'birthday-only'/)
  assert.match(page, /pattern="\[0-9\]\{8\}"/)
  assert.doesNotMatch(page, /ipify|ip_rules|checkSchoolNetwork/)
  assert.doesNotMatch(page, /2013|生日|八碼/)
  assert.match(page, /chat-type="學生"/)
  assert.match(page, /is_read_by_teacher: false/)
  assert.match(page, /teacher_msg_notify_email/)
  assert.match(page, /@media-sent="recordMediaMessage"/)
})
