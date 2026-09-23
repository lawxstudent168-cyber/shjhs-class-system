// Execute the receiver's actual setup script with silent audio and deterministic timers.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../app/pages/student-broadcast.vue', import.meta.url), 'utf8')
  .match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
function harness(role = 'student') {
  const window = new EventTarget(), document = new EventTarget()
  document.hidden = false
  const timers = new Map(), calls = [], audio = []
  let mounted, unmount, pending, timerId = 0
  class SilentAudio {
    constructor() { this.state = 'running'; this.currentTime = 0; this.beeps = 0; audio.push(this) }
    async resume() {}
    async close() { this.state = 'closed' }
    createOscillator() { this.beeps++; return { frequency: {}, connect() {}, start() {}, stop() {}, disconnect() {} } }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} } }
  }
  window.AudioContext = SilentAudio
  const context = vm.createContext({ window, document, ref: value => ({ value }), useHead() {},
    onMounted: fn => { mounted = fn }, onBeforeUnmount: fn => { unmount = fn },
    broadcastStop: () => window.dispatchEvent(new Event('student-broadcast-stop')),
    setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id }, clearTimeout: id => timers.delete(id),
    $fetch: async (url, options) => {
      const body = options?.body
      calls.push(body?.action || 'overview')
      if (!body) return { role }
      if (body.action === 'status') return { id: 'device', label: 'Test phone', status: 'approved' }
      if (body.action === 'start') return { lease: 'test-lease', expires: new Date(Date.now() + 900000).toISOString() }
      if (body.action === 'poll') return await new Promise(resolve => { pending = resolve })
      return {}
    }
  })
  vm.runInContext(`${source}\nglobalThis.ui = { start, stop, listening, message, busy };`, context)
  return { ui: context.ui, mount: () => mounted(), unmount: () => unmount(), window, document, timers, audio, calls,
    respond: async message => { pending({ message }); await new Promise(resolve => setImmediate(resolve)) } }
}
test('mount and parent access never initialize audio', async () => {
  for (const role of ['parent', 'student']) {
    const h = harness(role); await h.mount()
    assert.equal(h.audio.length, 0)
    assert.equal(h.ui.listening.value, false)
    if (role === 'parent') assert.deepEqual(h.calls, ['overview'])
    h.unmount()
  }
})
test('stopping while a poll is in flight discards its late audio and text', async () => {
  const h = harness(); await h.mount(); await h.ui.start()
  h.ui.stop()
  await h.respond({ id: 'late', text: 'Must not play' })
  assert.equal(h.audio[0].state, 'closed')
  assert.equal(h.audio[0].beeps, 0)
  assert.equal(h.ui.message.value, '')
  assert.equal(h.timers.size, 0)
  h.unmount()
})
test('one short alert per message; background, offline, identity signal and unmount stop', async () => {
  for (const reason of ['hidden', 'offline', 'identity', 'pagehide', 'unmount', 'watchdog', 'expiry']) {
    const h = harness(); await h.mount(); await h.ui.start()
    await h.respond({ id: 'one', text: 'Test notification' })
    assert.equal(h.audio[0].beeps, 1)
    const poll = [...h.timers.values()].find(t => t.ms === 1000)
    poll.fn()
    await h.respond({ id: 'one', text: 'Test notification' })
    assert.equal(h.audio[0].beeps, 1)
    if (reason === 'hidden') { h.document.hidden = true; h.document.dispatchEvent(new Event('visibilitychange')) }
    if (reason === 'offline' || reason === 'pagehide') h.window.dispatchEvent(new Event(reason))
    if (reason === 'identity') h.window.dispatchEvent(new Event('student-broadcast-stop'))
    if (reason === 'unmount') h.unmount()
    if (reason === 'watchdog') [...h.timers.values()].find(t => t.ms === 5000).fn()
    if (reason === 'expiry') [...h.timers.values()].find(t => t.ms > 800000).fn()
    assert.equal(h.ui.listening.value, false, reason)
    assert.equal(h.audio[0].state, 'closed', reason)
    assert.equal(h.ui.message.value, '', reason)
    if (reason !== 'unmount') h.unmount()
  }
})
