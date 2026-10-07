<template>
  <section class="student-broadcast">
    <h3>學生手機廣播</h3>
    <p>依學生發送文字與提示音。開著網站的學生會自動接收，離線學生下次開啟時補收，通知保留 24 小時。</p>
    <button :disabled="busy" @click="load">更新學生清單</button>
    <p role="status">{{ notice }}</p>
    <form v-if="loaded" @submit.prevent="send">
      <label><input v-model="all" type="checkbox" :disabled="busy">發送全班（包含目前未上線或尚未綁定的學生）</label>
      <div class="students">
        <label v-for="student in students" :key="student.id">
          <input v-model="selected" type="checkbox" :value="String(student.id)" :disabled="busy || all">
          <strong>{{ student.seat_number }} 號 {{ student.real_name }}</strong>
          <span>{{ student.browsers ? `已綁定 ${student.browsers} 個瀏覽器` : '尚未綁定，驗證後可補收' }}</span>
          <small v-if="student.lastSeen">最近連線：{{ lastSeen(student.lastSeen) }}</small>
        </label>
      </div>
      <p v-if="!students.length">尚無學生名單。</p>
      <label>廣播內容（最多 200 字）<textarea v-model="text" maxlength="200" required rows="3" :disabled="busy" /></label>
      <button :disabled="busy || !students.length || (!all && !selected.length) || !text.trim()">發送給{{ all ? '全班' : selected.length + ' 位學生' }}</button>
    </form>
    <p>送出代表訊息已保存，不代表學生已讀或聽見。學生第一次使用需在個人首頁驗證身分，之後自動接收；提示音依瀏覽器授權啟用。</p>
  </section>
</template>
<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
const students = ref([]), loaded = ref(false), selected = ref([]), all = ref(false), text = ref(''), notice = ref(''), busy = ref(false)
let epoch = 0, pending
const api = body => $fetch('/api/student-broadcast-admin', { method: 'POST', body, retry: 0, timeout: 10000 })
const lastSeen = value => new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
async function run(fn) {
  if (busy.value) return
  const current = epoch
  busy.value = true
  try { await fn(current) } catch (error) {
    if (current === epoch) notice.value = (error?.statusCode || error?.response?.status) === 401
      ? '導師登入已到期，請重新整理並登入。' : '操作未確認完成，請檢查連線後重試；相同內容的重試不會重複送出。'
  } finally { if (current === epoch) busy.value = false }
}
const load = () => run(async current => {
  const result = await api({ action: 'list' })
  if (current !== epoch) return
  students.value = result; loaded.value = true; notice.value = '學生清單已更新。可直接選擇學生發送。'
})
const send = () => run(async current => {
  const payload = { all: all.value, studentIds: [...selected.value].sort(), text: text.value.trim() }
  const signature = JSON.stringify(payload)
  if (!pending || pending.signature !== signature) pending = { signature, id: crypto.randomUUID() }
  const result = await api({ action: 'send', ...payload, requestId: pending.id })
  if (current !== epoch) return
  notice.value = `已保存給 ${result.queued} 位學生；未上線者可在有效期限內補收。`
  text.value = ''; pending = null
})
onMounted(load)
onBeforeUnmount(() => { epoch++ })
</script>
<style scoped>
.student-broadcast { border: 2px solid #17654f; border-radius: 12px; padding: 20px; margin-bottom: 28px; line-height: 1.6; }
label { display: block; margin: 12px 0; } textarea { display: block; width: 100%; max-width: 560px; box-sizing: border-box; padding: 10px; }
button { padding: 10px 14px; margin: 4px 8px 4px 0; cursor: pointer; }
.students { max-height: 360px; overflow-y: auto; border: 1px solid #dbe8df; padding: 12px; }
.students span,.students small { display: block; padding-left: 24px; color: #52665d; }
</style>
