<template>
  <main class="receiver">
    <NuxtLink to="/personal">← 個人首頁</NuxtLink>
    <h1>學生手機廣播</h1>
    <p>僅限導師當面確認的學生專用手機。家長手機與共用手機請勿申請。</p>
    <p>通知以文字及短提示音呈現。保持本頁在前景；切換頁面、鎖定螢幕或離線會停止，每次最多 15 分鐘。</p>
    <p role="status">{{ notice }}</p>
    <template v-if="student">
      <form v-if="!device" @submit.prevent="enroll">
        <label>裝置名稱（例如：小明的手機）<input v-model="label" required maxlength="60"></label>
        <label><input v-model="confirmed" type="checkbox" required>這是我的專用手機，不是家長或共用手機</label>
        <button :disabled="busy || !confirmed">申請導師核准</button>
      </form>
      <section v-else>
        <p>{{ device.label }}：{{ statusLabels[device.status] }}</p>
        <p>請向導師出示核對碼：<strong>{{ device.id.slice(0, 8) }}</strong></p>
        <button v-if="!listening" :disabled="busy" @click="refresh">重新檢查核准狀態</button>
        <button v-if="device.status === 'approved' && !listening" :disabled="busy" @click="start">開始收聽（啟用提示音）</button>
        <button v-if="listening || busy" @click="stop">立即停止收聽</button>
      </section>
      <section v-if="message" class="message" aria-live="polite"><h2>導師通知</h2><p>{{ message }}</p></section>
    </template>
    <NuxtLink v-else-if="!busy" to="/personal">前往個人首頁，以學生身分驗證</NuxtLink>
  </main>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { broadcastStop } from '../utils/broadcastStop.js'
useHead({ title: '學生手機廣播', meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
const student = ref(false), device = ref(null), label = ref(''), confirmed = ref(false)
const busy = ref(true), listening = ref(false), notice = ref('正在驗證學生身分…'), message = ref('')
const statusLabels = { pending: '等待導師當面核准', approved: '已核准', revoked: '已撤銷，請聯絡導師' }
let audio, channel, timer, deadline, watchdog, lease = '', seen = '', generation = 0, disposed = false
const api = body => $fetch('/api/personal-home/broadcast', { method: 'POST', body, retry: 0, timeout: 4000 })
function stop() {
  generation++
  listening.value = false
  busy.value = false
  clearTimeout(timer); clearTimeout(deadline); clearTimeout(watchdog)
  if (audio) { void audio.close().catch(() => {}); audio = null }
  const previous = lease
  lease = ''; message.value = ''; seen = ''
  notice.value = '已停止收聽。需要時請再次按「開始收聽」。'
  if (previous) void api({ action: 'stop', lease: previous }).catch(() => {})
}
async function enroll() {
  if (!confirmed.value) return
  busy.value = true
  try { device.value = await api({ action: 'enroll', label: label.value }); notice.value = '請讓導師當面核對裝置與核對碼。' }
  catch { notice.value = '無法申請，請確認學生登入及系統設定。' }
  finally { busy.value = false }
}
async function refresh() {
  busy.value = true
  try { device.value = await api({ action: 'status' }); notice.value = statusLabels[device.value.status] }
  catch { notice.value = '無法確認權限，請重新以學生身分登入。' }
  finally { busy.value = false }
}
function beep() {
  if (!listening.value || document.hidden || !audio || audio.state !== 'running') return
  const oscillator = audio.createOscillator(), gain = audio.createGain()
  oscillator.connect(gain); gain.connect(audio.destination)
  oscillator.frequency.value = 660
  gain.gain.setValueAtTime(0.07, audio.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.3)
  oscillator.start(); oscillator.stop(audio.currentTime + 0.3)
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
}
async function poll(epoch) {
  if (epoch !== generation || !listening.value) return
  try {
    const result = await api({ action: 'poll', lease })
    if (epoch !== generation || document.hidden) return
    clearTimeout(watchdog)
    watchdog = setTimeout(stop, 5000)
    if (result.message && result.message.id !== seen) {
      seen = result.message.id; message.value = result.message.text; beep()
    }
    timer = setTimeout(() => poll(epoch), 1000)
  } catch { if (epoch === generation) { stop(); notice.value = '權限、連線或收聽期限已失效，已停止。' } }
}
async function start() {
  if (busy.value || document.hidden) return
  broadcastStop() // Stop other receiver tabs before opening this lease.
  const epoch = ++generation
  busy.value = true
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) throw new Error('Audio unavailable')
    audio = new AudioContext()
    await audio.resume() // Only in this explicit user gesture; never on mount.
    if (epoch !== generation) return
    if (audio.state !== 'running') throw new Error('Audio blocked')
    const result = await api({ action: 'start' })
    if (epoch !== generation || disposed || document.hidden) {
      void api({ action: 'stop', lease: result.lease }).catch(() => {})
      return
    }
    lease = result.lease; listening.value = true; message.value = ''; seen = ''
    notice.value = '收聽中，最多 15 分鐘。通知會顯示文字並播放短提示音。'
    deadline = setTimeout(stop, Math.max(0, Date.parse(result.expires) - Date.now()))
    watchdog = setTimeout(stop, 5000)
    void poll(epoch)
  } catch { if (epoch === generation) { stop(); notice.value = '無法開始收聽，請確認導師核准、網路及瀏覽器音訊權限。' } }
  finally { if (epoch === generation) busy.value = false }
}
function visibility() { if (document.hidden) stop() }
function storage(event) { if (event.key === 'student-broadcast-stop' || event.key === 'visitor_known_identity' || event.key === null) stop() }
onMounted(async () => {
  window.addEventListener('student-broadcast-stop', stop)
  window.addEventListener('storage', storage)
  window.addEventListener('pagehide', stop)
  window.addEventListener('offline', stop)
  document.addEventListener('visibilitychange', visibility)
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('student-broadcast-safety'); channel.onmessage = stop
  }
  try {
    const overview = await $fetch('/api/personal-home', { retry: 0, timeout: 4000 })
    if (disposed) return
    student.value = overview.role === 'student'
    notice.value = student.value ? '請申請裝置核准，或查看既有核准狀態。' : '家長身分無法使用手機廣播。'
    if (student.value) {
      try { device.value = await api({ action: 'status' }) } catch {}
    }
  } catch { notice.value = '請先到個人首頁以學生身分驗證。' }
  finally { busy.value = false }
})
onBeforeUnmount(() => {
  disposed = true; stop(); channel?.close()
  window.removeEventListener('student-broadcast-stop', stop)
  window.removeEventListener('storage', storage)
  window.removeEventListener('pagehide', stop)
  window.removeEventListener('offline', stop)
  document.removeEventListener('visibilitychange', visibility)
})
</script>

<style scoped>
.receiver { max-width: 640px; margin: 32px auto; padding: 24px; color: #183b35; font-family: system-ui, sans-serif; line-height: 1.7; }
h1 { font-size: 28px; } a { color: #17654f; } label { display: block; margin: 16px 0; }
input:not([type=checkbox]) { display: block; width: 100%; box-sizing: border-box; padding: 12px; }
button { background: #17654f; color: white; border: 0; border-radius: 8px; padding: 13px; margin: 8px 8px 8px 0; cursor: pointer; font-size: 16px; }
button:disabled { opacity: .5; } .message { background: #e6f3ed; padding: 20px; border-radius: 12px; overflow-wrap: anywhere; }
</style>
