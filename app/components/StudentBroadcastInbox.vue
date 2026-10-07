<template>
  <aside v-if="state.student && !blockedRoute" class="student-inbox" aria-label="學生廣播通知">
    <div class="heading"><strong>{{ state.student.seat_number }} 號 {{ state.student.real_name }} · 廣播</strong>
      <button @click="expanded = !expanded">{{ expanded ? '收合' : `展開（${state.messages.length}）` }}</button>
    </div>
    <template v-if="expanded">
      <p class="hint">文字自動接收；未讀通知保留 24 小時。</p>
      <button v-if="!state.sound" @click="receiver?.enableSound()">啟用新通知提示音</button>
      <button v-else @click="receiver?.mute()">關閉提示音</button>
      <p v-if="state.error" role="status">{{ state.error }}</p>
      <p v-if="!state.messages.length">目前沒有未讀廣播。</p>
      <ol v-else aria-live="polite">
        <li v-for="message in state.messages" :key="message.id">
          <time>{{ formatDate(message.created_at) }}</time><p>{{ message.text }}</p>
          <button @click="receiver?.acknowledge(message.id)">已讀</button>
        </li>
      </ol>
      <button class="quiet" @click="disconnect">解除此瀏覽器綁定</button>
    </template>
  </aside>
</template>
<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { createBroadcastReceiver } from '../utils/studentBroadcastReceiver.js'
import { broadcastStop } from '../utils/broadcastStop.js'
const route = useRoute()
const blockedRoute = computed(() => /^\/(parent-message|parent-bind|leave-application|admin|teacher-broadcast)(\/|$)/.test(route.path))
const parentRoute = computed(() => /^\/(parent-message|parent-bind|leave-application)(\/|$)/.test(route.path))
const state = ref({ student: null, messages: [], sound: false, error: '' }), expanded = ref(true)
let receiver, channel, alive = true
const api = body => $fetch('/api/personal-home/broadcast', { method: 'POST', body, retry: 0, timeout: 5000 })
const formatDate = value => new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
function createAudio() {
  const Constructor = window.AudioContext || window.webkitAudioContext
  if (!Constructor) return { resume: async () => { throw new Error('Unavailable') }, close() {} }
  const context = new Constructor()
  return {
    resume: () => context.resume(), running: () => context.state === 'running',
    close: () => { if (context.state !== 'closed') void context.close().catch(() => {}) },
    beep: () => {
      if (context.state !== 'running' || document.hidden || blockedRoute.value) return
      const oscillator = context.createOscillator(), gain = context.createGain()
      oscillator.connect(gain); gain.connect(context.destination); oscillator.frequency.value = 660
      gain.gain.setValueAtTime(0.07, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3)
      oscillator.start(); oscillator.stop(context.currentTime + 0.3)
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    }
  }
}
const reset = () => receiver?.reset()
const ready = () => { receiver?.reset(); receiver?.resume() }
const visibility = () => { if (document.hidden) receiver?.pause(); else receiver?.resume() }
async function disconnect() {
  const previous = state.value
  broadcastStop(); receiver?.reset()
  try { await api({ action: 'disconnect' }) }
  catch { if (alive) state.value = { ...previous, sound: false, messages: [], error: '解除未完成，請恢復連線後重試。' } }
}
function storage(event) {
  if (event.key === 'student-broadcast-stop' || event.key === 'visitor_known_identity' || event.key === null) reset()
  if (event.key === 'student-broadcast-ready') ready()
}
watch(blockedRoute, blocked => { if (blocked) receiver?.pause(); else receiver?.resume() })
async function leaveStudentIdentity() {
  broadcastStop()
  try { await api({ action: 'disconnect' }) } catch {}
}
watch(parentRoute, parent => { if (parent) void leaveStudentIdentity() })
onMounted(() => {
  receiver = createBroadcastReceiver({ request: api, update: value => { state.value = value }, createAudio, visible: () => !document.hidden && !blockedRoute.value })
  window.addEventListener('student-broadcast-stop', reset)
  window.addEventListener('student-broadcast-ready', ready)
  window.addEventListener('storage', storage)
  window.addEventListener('pagehide', reset)
  window.addEventListener('offline', visibilityOffline)
  window.addEventListener('online', visibility)
  document.addEventListener('visibilitychange', visibility)
  if (typeof BroadcastChannel !== 'undefined') { channel = new BroadcastChannel('student-broadcast-safety'); channel.onmessage = event => event.data === 'ready' ? ready() : reset() }
  if (parentRoute.value) void leaveStudentIdentity()
  else receiver.resume()
})
function visibilityOffline() { receiver?.pause() }
onBeforeUnmount(() => {
  alive = false; receiver?.reset(); channel?.close()
  window.removeEventListener('student-broadcast-stop', reset)
  window.removeEventListener('student-broadcast-ready', ready)
  window.removeEventListener('storage', storage)
  window.removeEventListener('pagehide', reset)
  window.removeEventListener('offline', visibilityOffline)
  window.removeEventListener('online', visibility)
  document.removeEventListener('visibilitychange', visibility)
})
</script>
<style scoped>
.student-inbox { position: fixed; bottom: 12px; right: 12px; z-index: 1000; width: min(360px, calc(100vw - 24px)); max-height: 65vh; overflow-y: auto; box-sizing: border-box; background: #fff; color: #183b35; border: 2px solid #17654f; border-radius: 12px; padding: 14px; box-shadow: 0 4px 24px #0002; font: 15px/1.6 system-ui, sans-serif; }
.heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; } button { cursor: pointer; padding: 8px; margin: 4px 0; border-radius: 6px; border: 1px solid #17654f; background: #edf6f1; color: #17654f; } .hint,time { font-size: 12px; color: #536b64; } ol { padding-left: 20px; } li { border-bottom: 1px solid #dbe8df; padding: 8px 0; } li p { white-space: pre-wrap; overflow-wrap: anywhere; } .quiet { background: #fff; }
</style>
