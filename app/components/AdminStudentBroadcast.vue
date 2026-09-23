<template>
  <section class="student-broadcast">
    <h3>學生手機廣播（獨立通道）</h3>
    <p>只向已核准、正在專用頁收聽的學生裝置送出文字及提示音。此處不會發送到教室首頁或家長頁面。</p>
    <form @submit.prevent="load">
      <label>手機廣播管理金鑰 <input v-model="key" type="password" autocomplete="off" required></label>
      <button :disabled="busy">解鎖／更新清單</button>
      <button type="button" @click="lock">鎖定</button>
    </form>
    <p role="status">{{ notice }}</p>
    <template v-if="unlocked">
      <p>核准前，請當面核對学生、手機及八碼核對碼。裝置名稱由申請者填寫，不代表已驗證。</p>
      <label><input v-model="confirmed" type="checkbox">我已當面確認本次要核准的裝置是學生專用，非家長或共用手機</label>
      <ul>
        <li v-for="device in devices" :key="device.id">
          <strong>{{ device.label }}</strong> · 學生 ID {{ device.student_id }} · 核對碼 {{ device.id.slice(0, 8) }}
          <p>{{ labels[device.status] }} · {{ active(device) ? '最近 5 秒有連線' : '未在收聽' }}</p>
          <button v-if="device.status !== 'approved'" :disabled="busy || !confirmed" @click="change(device.id, 'approve')">核准這台裝置</button>
          <button v-if="device.status !== 'revoked'" :disabled="busy" @click="change(device.id, 'revoke')">撤銷</button>
        </li>
      </ul>
      <p v-if="!devices.length">尚無裝置申請。</p>
      <form @submit.prevent="send">
        <label>接收裝置
          <select v-model="target" required><option value="">請選擇正在收聽的學生手機</option><option v-for="device in devices.filter(active)" :key="device.id" :value="device.id">{{ device.label }}（{{ device.id.slice(0, 8) }}）</option></select>
        </label>
        <label>廣播文字（最多 200 字）<textarea v-model="text" maxlength="200" required rows="3" /></label>
        <button :disabled="busy || !target || !text.trim()">發送至這台學生手機</button>
      </form>
      <p>送出筆數表示伺服器已接受，不代表學生已聽見。通知 5 秒後失效；連續發送以最新一則為準，不補播歷史通知。</p>
    </template>
  </section>
</template>
<script setup>
import { ref, onBeforeUnmount } from 'vue'
const key = ref(''), devices = ref([]), unlocked = ref(false), confirmed = ref(false), target = ref(''), text = ref(''), notice = ref(''), busy = ref(false)
const labels = { pending: '待核准', approved: '已核准', revoked: '已撤銷' }
let epoch = 0
const active = d => d.status === 'approved' && Date.parse(d.expires_at) > Date.now() && Date.parse(d.heartbeat_at) > Date.now() - 5000
const api = body => $fetch('/api/student-broadcast-admin', { method: 'POST', headers: { 'x-broadcast-key': key.value }, body, retry: 0, timeout: 5000 })
function lock() { epoch++; key.value = ''; devices.value = []; unlocked.value = false; confirmed.value = false; target.value = ''; text.value = ''; notice.value = ''; busy.value = false }
async function run(fn) {
  if (busy.value) return
  const current = epoch
  busy.value = true
  try { await fn(current) } catch { if (current === epoch) { devices.value = []; unlocked.value = false; notice.value = '操作失敗。請檢查管理金鑰、部署設定及連線。' } }
  finally { if (current === epoch) busy.value = false }
}
async function refresh(current) { const result = await api({ action: 'list' }); if (current === epoch) { devices.value = result; unlocked.value = true } }
const load = () => run(async current => { await refresh(current); if (current === epoch) notice.value = '清單已更新。學生開始收聽後，請再更新一次。' })
const change = (id, action) => run(async current => {
  await api({ action, id, confirmStudentOnly: confirmed.value })
  if (current !== epoch) return
  confirmed.value = false; notice.value = action === 'approve' ? '已核准；學生仍須主動開始收聽。' : '已撤銷，接收端於下一次權限檢查停止。'
  await refresh(current)
})
const send = () => run(async current => {
  const result = await api({ action: 'send', id: target.value, text: text.value })
  if (current !== epoch) return
  notice.value = result.delivered ? '已送出 1 台。請與學生確認是否收到。' : '未送出：裝置未在收聽或核准已撤銷。'
  await refresh(current)
})
onBeforeUnmount(lock)
</script>
<style scoped>
.student-broadcast { border: 2px solid #17654f; border-radius: 12px; padding: 20px; margin-bottom: 28px; line-height: 1.6; }
label { display: block; margin: 12px 0; } input:not([type=checkbox]), select, textarea { display: block; width: 100%; max-width: 560px; box-sizing: border-box; padding: 10px; }
button { padding: 10px 14px; margin: 4px 8px 4px 0; cursor: pointer; } li { margin: 16px 0; overflow-wrap: anywhere; } ul { padding-left: 20px; }
</style>
