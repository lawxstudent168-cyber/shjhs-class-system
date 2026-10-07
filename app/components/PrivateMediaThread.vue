<template>
  <section v-if="studentId && chatType" class="media-thread" aria-label="私訊圖片與影片">
    <header><h4>圖片與影片</h4><button type="button" :disabled="busy" @click="load()">更新</button></header>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="loginRequired" class="hint">上傳及查看附件前，請先到 <NuxtLink :to="`/personal?verify=${chatType === '學生' ? 'student' : 'parent'}`">個人首頁驗證身分</NuxtLink>，再返回私訊。</p>
    <template v-else>
      <p v-if="loading" class="hint">正在載入附件…</p>
      <p v-else-if="!items.length" class="hint">此對話尚無圖片或影片。</p>
      <button v-if="items.length && hasMore" type="button" :disabled="loading" @click="load(true)">載入較早附件</button>
      <ol v-if="items.length" class="media-list">
        <li v-for="item in items" :key="item.id">
          <div class="meta">{{ item.senderRole }} · {{ formatTime(item.createdAt) }}</div>
          <img v-if="item.mimeType.startsWith('image/')" :src="item.url" alt="私訊圖片" loading="lazy" />
          <video v-else :src="item.url" controls playsinline preload="metadata">您的瀏覽器無法播放此影片。</video>
          <p v-if="item.caption" class="caption">{{ item.caption }}</p>
          <div v-if="teacher" class="teacher-actions">
            <input v-model="drafts[item.id]" maxlength="200" aria-label="附件說明" placeholder="附件說明" />
            <button type="button" :disabled="busy" @click="edit(item)">儲存說明</button>
            <label class="replace">替換檔案<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" :disabled="busy" @change="replace(item, $event)" /></label>
            <button type="button" class="danger" :disabled="busy" @click="remove(item)">刪除</button>
          </div>
        </li>
      </ol>
      <form @submit.prevent="send" class="upload-form">
        <strong>{{ teacher ? `傳送給這位${chatType === '家長' ? '家長' : '學生'}` : '傳送圖片或影片給導師' }}</strong>
        <label>選擇圖片或影片<input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" required :disabled="busy" @change="choose" /></label>
        <input v-model="caption" maxlength="200" :placeholder="teacher ? '附註（選填，可稍後修改）' : '附註（選填，上傳後不可修改）'" :disabled="busy" />
        <button type="submit" :disabled="busy || !file">{{ busy ? '上傳中…' : '傳送附件' }}</button>
        <p class="hint">圖片最多 20 MB，影片最多 50 MB。{{ teacher ? '只有這個對話頻道的對象能查看。' : '上傳後只有導師可以修改或刪除。' }}</p>
      </form>
    </template>
  </section>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'

const props = defineProps({ studentId: { type: [String, Number], default: '' }, chatType: { type: String, default: '' }, teacher: Boolean })
const emit = defineEmits(['media-read'])
const supabase = useSupabaseClient()
const items = ref([]), drafts = ref({}), error = ref(''), loading = ref(false), busy = ref(false)
const loginRequired = ref(false), file = ref(null), caption = ref(''), fileInput = ref(null), hasMore = ref(false)
let loadEpoch = 0
const api = body => $fetch('/api/personal-home/media', { method: 'POST', body, retry: 0, timeout: 15000 })
const formatTime = value => new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })
const status = err => err?.statusCode || err?.response?.status
function mediaError(err) {
  if (status(err) === 401) return '請先到個人首頁驗證身分。'
  if (status(err) === 403) return '目前身分無法查看此對話附件。'
  if (status(err) === 429) return '上傳次數過多，請稍後再試。'
  return '附件操作失敗，請檢查檔案、連線或儲存設定後重試。'
}
async function load(more = false) {
  if (!props.studentId || !props.chatType) return
  const current = ++loadEpoch
  const studentId = String(props.studentId), chatType = props.chatType
  const offset = more ? items.value.length : 0
  loading.value = true; error.value = ''
  try {
    const result = await $fetch('/api/personal-home/media', { query: { studentId, chatType, offset }, retry: 0 })
    if (current !== loadEpoch) return
    items.value = more ? [...result.media, ...items.value] : result.media
    hasMore.value = result.hasMore
    drafts.value = Object.fromEntries(items.value.map(item => [item.id, item.caption]))
    loginRequired.value = false
    if (props.teacher && !more) {
      try { await api({ action: 'mark-read', studentId, chatType }); emit('media-read') }
      catch { error.value = '附件已載入，但未讀狀態尚未更新。' }
    }
  } catch (err) {
    if (current !== loadEpoch) return
    items.value = []
    loginRequired.value = status(err) === 401
    error.value = mediaError(err)
  } finally { if (current === loadEpoch) loading.value = false }
}
function choose(event) { file.value = event.target.files?.[0] || null }
async function upload(selected, action, id) {
  if (!selected) return
  const start = await api({ action, id, studentId: String(props.studentId), chatType: props.chatType,
    type: selected.type, size: selected.size, caption: caption.value })
  const { error: uploadError } = await supabase.storage.from(start.bucket)
    .uploadToSignedUrl(start.path, start.token, selected, { contentType: selected.type })
  if (uploadError) throw uploadError
  await api({ action: 'complete', ticket: start.ticket })
  await load()
}
async function send() {
  if (!file.value || busy.value) return
  busy.value = true; error.value = ''
  try {
    await upload(file.value, 'prepare')
    file.value = null; caption.value = ''
    if (fileInput.value) fileInput.value.value = ''
  } catch (err) { error.value = mediaError(err) }
  finally { busy.value = false }
}
async function edit(item) {
  busy.value = true; error.value = ''
  try { await api({ action: 'edit', id: item.id, caption: drafts.value[item.id] || '' }); await load() }
  catch (err) { error.value = mediaError(err) }
  finally { busy.value = false }
}
async function replace(item, event) {
  const selected = event.target.files?.[0]
  event.target.value = ''
  if (!selected || busy.value) return
  busy.value = true; error.value = ''
  try { await upload(selected, 'prepare-replacement', item.id) }
  catch (err) { error.value = mediaError(err) }
  finally { busy.value = false }
}
async function remove(item) {
  if (!confirm('確定刪除這個附件？刪除後無法復原。')) return
  busy.value = true; error.value = ''
  try { await api({ action: 'delete', id: item.id }); await load() }
  catch (err) { error.value = mediaError(err) }
  finally { busy.value = false }
}
watch(() => [props.studentId, props.chatType], () => { loadEpoch++; items.value = []; hasMore.value = false; void load() })
onMounted(() => load())
</script>

<style scoped>
.media-thread { padding: 14px; margin: 12px 0; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; color: #1e293b; }
header,.teacher-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
header { justify-content: space-between; } h4 { margin: 0; } button,.replace { cursor: pointer; border: 1px solid #64748b; border-radius: 6px; padding: 7px 10px; background: #f8fafc; color: #1e293b; font: inherit; }
button:disabled { opacity: .55; cursor: wait; } .error { color: #b91c1c; } .hint,.meta { color: #64748b; font-size: .85rem; }
.media-list { list-style: none; padding: 0; margin: 12px 0; display: grid; gap: 14px; } li { border-top: 1px solid #e2e8f0; padding-top: 12px; }
img,video { display: block; max-width: min(100%, 480px); max-height: 340px; border-radius: 8px; background: #0f172a; } .caption { white-space: pre-wrap; overflow-wrap: anywhere; }
.upload-form { display: grid; gap: 8px; border-top: 1px solid #e2e8f0; padding-top: 12px; } .upload-form label { display: grid; gap: 6px; }
input { min-width: 0; max-width: 100%; box-sizing: border-box; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
.replace { position: relative; overflow: hidden; } .replace input { position: absolute; inset: 0; opacity: 0; width: 100%; cursor: pointer; }
.danger { color: #b91c1c; border-color: #fecaca; }
</style>
