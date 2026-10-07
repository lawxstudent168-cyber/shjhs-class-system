import test from 'node:test'
import assert from 'node:assert/strict'
import { createBroadcastReceiver } from '../app/utils/studentBroadcastReceiver.js'

function harness() {
  const timers = new Map(), audio = [], pending = []
  let state, visible = true, id = 0
  const receiver = createBroadcastReceiver({
    request: body => new Promise((resolve, reject) => pending.push({ body, resolve, reject })),
    update: next => { state = next },
    visible: () => visible,
    setTimer: (fn, ms) => { timers.set(++id, { fn, ms }); return id },
    clearTimer: key => timers.delete(key),
    createAudio: () => {
      const item = { closed: false, beeps: 0, async resume() {}, running: () => true, close() { this.closed = true }, beep() { this.beeps++ } }
      audio.push(item); return item
    }
  })
  const response = async (messages = [], now = '2026-09-23T01:00:00Z') => {
    pending.shift().resolve({ student: { id: 'a', real_name: 'Test' }, messages, serverTime: now })
    await new Promise(resolve => setImmediate(resolve))
  }
  return { receiver, timers, audio, pending, response, state: () => state,
    hide: () => { visible = false; receiver.pause() },
    tick: () => { const [key, entry] = [...timers][0]; timers.delete(key); entry.fn() }
  }
}
test('automatic reception is silent until gesture; backlog stays silent and live messages beep once', async () => {
  const h = harness()
  h.receiver.resume()
  const old = { id: 'old', text: 'offline', created_at: '2026-09-22T12:00:00Z' }
  await h.response([old])
  assert.equal(h.audio.length, 0)
  assert.equal(h.state().messages[0].id, 'old')
  await h.receiver.enableSound()
  assert.equal(h.audio[0].beeps, 0)
  h.tick()
  const live = { id: 'live', text: 'new', created_at: '2026-09-23T01:00:01Z' }
  await h.response([old, live], '2026-09-23T01:00:02Z')
  assert.equal(h.audio[0].beeps, 1)
  h.tick(); await h.response([old, live], '2026-09-23T01:00:07Z')
  assert.equal(h.audio[0].beeps, 1)
  h.receiver.reset()
})
test('parent switch or unmount discards in-flight messages and audio', async () => {
  const h = harness(); h.receiver.resume(); await h.response()
  await h.receiver.enableSound()
  h.tick(); h.receiver.reset()
  await h.response([{ id: 'late', text: 'must not appear', created_at: '2026-09-23T01:00:01Z' }])
  assert.equal(h.state().student, null)
  assert.deepEqual(h.state().messages, [])
  assert.equal(h.audio[0].closed, true)
  assert.equal(h.audio[0].beeps, 0)
  assert.equal(h.timers.size, 0)
})
test('background cancels audio; 401 stops polling; transient failures retry silently', async () => {
  const h = harness(); h.receiver.resume(); await h.response(); await h.receiver.enableSound()
  h.hide()
  assert.equal(h.audio[0].closed, true)
  assert.equal(h.timers.size, 0)
  const retry = harness(); retry.receiver.resume()
  retry.pending.shift().reject({ statusCode: 503 })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(retry.timers.size, 1)
  retry.tick(); await retry.response([{ id: 'backlog', created_at: '2026-09-23T00:59:00Z' }])
  assert.equal(retry.audio.length, 0)
  retry.tick(); retry.pending.shift().reject({ statusCode: 403 })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(retry.state().student, null)
  assert.equal(retry.timers.size, 0)
})
test('acknowledgement updates only after success and stale acknowledgements cannot change a new identity', async () => {
  const h = harness(); h.receiver.resume(); await h.response([{ id: 'a' }])
  const ack = h.receiver.acknowledge('a')
  assert.equal(h.state().messages.length, 1)
  h.pending.shift().resolve({ acknowledged: true }); await ack
  assert.equal(h.state().messages.length, 0)
  h.receiver.reset()
  h.receiver.resume(); await h.response([{ id: 'new-student-message' }])
  const stale = h.receiver.acknowledge('new-student-message')
  const staleRequest = h.pending.shift()
  h.receiver.reset(); h.receiver.resume(); await h.response([{ id: 'other-student-message' }])
  staleRequest.resolve({ acknowledged: true }); await stale
  assert.equal(h.state().messages[0].id, 'other-student-message')
  h.receiver.reset()
})
