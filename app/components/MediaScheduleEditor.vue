<template>
  <section class="media-editor" :class="tone">
    <div class="library-header">
      <div>
        <h4>{{ icon }} {{ title }}清單</h4>
        <strong>目前共有 {{ normalized.library.length }} 個有效{{ itemLabel }}</strong>
      </div>
      <div class="header-actions">
        <button type="button" @click="copyLastWeek">📋 複製上週清單</button>
        <button type="button" class="danger-btn" :disabled="!normalized.library.length" @click="clearAllUrls">🗑 網址全部清空</button>
      </div>
    </div>

    <div class="add-row">
      <input v-model="newUrl" type="url" :placeholder="`貼上 YouTube ${itemLabel}或播放清單網址`" :disabled="isLoading" @keyup.enter="addUrl" />
      <button type="button" :disabled="isLoading" @click="addUrl">{{ isLoading ? '⏳ 讀取中…' : '➕ 載入網址' }}</button>
    </div>
    <p v-if="newUrl && !isSupportedUrl" class="error-text">請輸入 YouTube 單支影片或播放清單網址。</p>
    <p v-if="loadMessage" class="load-message">{{ loadMessage }}</p>

    <ol v-if="normalized.library.length" class="playlist">
      <li v-for="(url, index) in normalized.library" :key="url">
        <b>播放 #{{ index + 1 }}</b>
        <span class="video-info"><strong>{{ displayTitle(url) }}</strong><small>{{ url }}</small></span>
        <button type="button" :aria-label="`移除播放 ${index + 1}`" @click="removeUrl(url)">×</button>
      </li>
    </ol>
    <p v-else class="empty-text">尚未加入{{ itemLabel }}。</p>

    <div class="arrange-row">
      <label>自動排列起始日 <input v-model="startDate" type="date" /></label>
      <button type="button" :disabled="!normalized.library.length" @click="autoArrange">🔢 依清單順序自動排列（跳過週末）</button>
    </div>

    <div class="calendar-toolbar">
      <button type="button" aria-label="上個月" @click="month = shiftMediaMonth(month, -1)">‹</button>
      <strong>{{ monthLabel }}</strong>
      <button type="button" aria-label="下個月" @click="month = shiftMediaMonth(month, 1)">›</button>
    </div>
    <div class="calendar-grid weekdays"><span v-for="day in weekdays" :key="day">{{ day }}</span></div>
    <div class="calendar-grid dates">
      <template v-for="(date, index) in days" :key="date || `blank-${index}`">
        <span v-if="!date" class="blank"></span>
        <button v-else type="button" :class="{ selected: selectedDate === date, weekend: isWeekend(date), scheduled: normalized.calendar[date] }"
          @click="selectDate(date)">
          <b>{{ Number(date.slice(-2)) }}</b>
          <small v-if="normalized.calendar[date]" :title="displayTitle(normalized.calendar[date].url)">
            #{{ normalized.calendar[date].order || normalized.library.indexOf(normalized.calendar[date].url) + 1 }} {{ displayTitle(normalized.calendar[date].url) }}
          </small>
          <small v-else-if="isWeekend(date)">隨機舊片</small>
        </button>
      </template>
    </div>

    <div v-if="selectedDate" class="date-editor">
      <strong>{{ selectedDate }} {{ isWeekend(selectedDate) ? '（週末自動隨機播放舊片）' : '' }}</strong>
      <select v-if="!isWeekend(selectedDate)" :value="normalized.calendar[selectedDate]?.url || ''" @change="setSelected($event.target.value)">
        <option value="">不播放</option>
        <option v-for="(url, index) in normalized.library" :key="url" :value="url">播放 #{{ index + 1 }}｜{{ displayTitle(url) }}</option>
      </select>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { autoArrangeMedia, copyPreviousWeek, extractYouTubePlaylistId, extractYouTubeVideoId, mediaCalendarDays, normalizeMediaSchedule, setMediaForDate, shiftMediaMonth } from '../utils/mediaSchedule.js'
import { taiwanDateISO } from '../utils/examSchedule.js'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  title: { type: String, required: true },
  itemLabel: { type: String, default: '影片' },
  icon: { type: String, default: '📺' },
  tone: { type: String, default: 'video' },
  nestedLegacy: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])
const today = taiwanDateISO()
const month = ref(today.slice(0, 7))
const startDate = ref(today)
const selectedDate = ref(today)
const newUrl = ref('')
const isLoading = ref(false)
const loadMessage = ref('')
const metadataAttempts = new Set()
const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const normalized = computed(() => normalizeMediaSchedule(props.modelValue, { nestedLegacy: props.nestedLegacy }))
const days = computed(() => mediaCalendarDays(month.value))
const monthLabel = computed(() => { const [year, value] = month.value.split('-'); return `${year} 年 ${Number(value)} 月` })
const isSupportedUrl = computed(() => Boolean(extractYouTubeVideoId(newUrl.value) || extractYouTubePlaylistId(newUrl.value)))
const isWeekend = date => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())
const clearedLegacy = () => props.nestedLegacy
  ? { videos: Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, ''])) }
  : Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, '']))
const update = value => emit('update:modelValue', { ...props.modelValue, ...clearedLegacy(), calendar: value.calendar, library: value.library, titles: value.titles || {} })
const displayTitle = url => normalized.value.titles[url] || '名稱讀取中／尚未取得'

const addUrl = async () => {
  const url = newUrl.value.trim()
  if (!extractYouTubeVideoId(url) && !extractYouTubePlaylistId(url)) return
  isLoading.value = true
  loadMessage.value = ''
  try {
    const result = await $fetch('/api/youtube/resolve', { method: 'POST', body: { url } })
    const value = normalizeMediaSchedule(props.modelValue, { nestedLegacy: props.nestedLegacy })
    let added = 0
    for (const item of result.items || []) {
      if (!value.library.includes(item.url)) { value.library.push(item.url); added++ }
      if (item.title) value.titles[item.url] = item.title
      metadataAttempts.add(item.url)
    }
    update(value)
    loadMessage.value = result.type === 'playlist'
      ? `✅ 已讀取播放清單：共 ${result.count} 部影片，本次新增 ${added} 部。`
      : `✅ 已載入「${result.items?.[0]?.title || 'YouTube 影片'}」。`
    newUrl.value = ''
  } catch (error) {
    loadMessage.value = `❌ ${error?.data?.statusMessage || error?.statusMessage || '無法讀取 YouTube 網址，請稍後再試。'}`
  } finally {
    isLoading.value = false
  }
}
const removeUrl = url => {
  const value = normalizeMediaSchedule(props.modelValue, { nestedLegacy: props.nestedLegacy })
  value.library = value.library.filter(item => item !== url)
  delete value.titles[url]
  for (const [date, entry] of Object.entries(value.calendar)) if (entry.url === url) delete value.calendar[date]
  update(value)
}
const clearAllUrls = () => {
  if (!window.confirm(`確定清空全部 ${normalized.value.library.length} 個${props.itemLabel}網址及月曆排程？此動作要按「儲存」才會寫入資料庫。`)) return
  update({ ...normalizeMediaSchedule({}, { nestedLegacy: props.nestedLegacy }), calendar: {}, library: [], titles: {} })
  loadMessage.value = '已清空全部網址；請按上方儲存按鈕完成。'
}
const autoArrange = () => update(autoArrangeMedia(props.modelValue, startDate.value, { nestedLegacy: props.nestedLegacy }))
const copyLastWeek = () => update(copyPreviousWeek(props.modelValue, startDate.value, { nestedLegacy: props.nestedLegacy }))
const selectDate = date => { selectedDate.value = date }
const setSelected = url => update(setMediaForDate(props.modelValue, selectedDate.value, url, { nestedLegacy: props.nestedLegacy }))

const hydrateMissingTitles = async () => {
  const missing = normalized.value.library.filter(url => !normalized.value.titles[url] && !metadataAttempts.has(url))
  for (const url of missing) {
    metadataAttempts.add(url)
    try {
      const result = await $fetch('/api/youtube/resolve', { method: 'POST', body: { url } })
      const item = result.items?.[0]
      if (!item?.title) continue
      const value = normalizeMediaSchedule(props.modelValue, { nestedLegacy: props.nestedLegacy })
      value.titles[url] = item.title
      update(value)
    } catch {}
  }
}
watch(() => normalized.value.library.join('|'), () => { void hydrateMissingTitles() }, { immediate: true })
</script>

<style scoped>
.media-editor { margin: 20px 0 28px; padding: 18px; border: 1px solid #cbd5e1; border-radius: 10px; background: #f8fafc; }
.media-editor.song { background: #fff7fb; border-color: #fbcfe8; }
.library-header, .header-actions, .add-row, .arrange-row, .calendar-toolbar, .date-editor { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
h4 { margin: 0 0 5px; color: #1e293b; font-size: 1.15rem; }
button { border: 0; border-radius: 6px; padding: 9px 12px; background: #475569; color: white; font-weight: bold; cursor: pointer; }
button:disabled { opacity: .5; cursor: not-allowed; }
.danger-btn, .song .danger-btn { background: #dc2626; }
.song button { background: #db2777; }
.add-row { margin-top: 15px; }
.add-row input { flex: 1; min-width: 240px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; }
.error-text { color: #dc2626; margin: 6px 0; }
.load-message { color: #0369a1; margin: 7px 0; font-weight: bold; }
.empty-text { color: #94a3b8; font-style: italic; }
.playlist { margin: 14px 0; padding-left: 28px; }
.playlist li { display: grid; grid-template-columns: 90px minmax(0, 1fr) 34px; align-items: center; gap: 8px; margin: 7px 0; }
.video-info { display: flex; flex-direction: column; min-width: 0; color: #1e293b; }
.video-info strong, .video-info small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.video-info small { color: #64748b; }
.playlist button { padding: 4px; background: #ef4444; }
.arrange-row { padding: 12px; background: white; border-radius: 8px; }
.arrange-row label { display: flex; align-items: center; gap: 8px; font-weight: bold; color: #334155; }
.arrange-row input, select { padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
.calendar-toolbar { margin: 18px 0 10px; }
.calendar-toolbar button { width: 38px; font-size: 1.3rem; padding: 5px; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 5px; }
.weekdays { text-align: center; color: #64748b; font-weight: bold; font-size: .85rem; margin-bottom: 5px; }
.dates button { min-height: 54px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: white; color: #334155; border: 1px solid #e2e8f0; padding: 4px; }
.dates button.weekend { background: #f1f5f9; color: #94a3b8; }
.dates button.scheduled { border-color: #3b82f6; background: #eff6ff; color: #1d4ed8; }
.song .dates button.scheduled { border-color: #ec4899; background: #fdf2f8; color: #be185d; }
.dates button.selected { box-shadow: inset 0 0 0 2px #f59e0b; }
.dates small { display: -webkit-box; overflow: hidden; -webkit-line-clamp: 2; -webkit-box-orient: vertical; max-width: 100%; font-size: .68rem; line-height: 1.15; }
.date-editor { margin-top: 12px; padding: 12px; background: white; border-radius: 8px; }
.date-editor select { flex: 1; min-width: 260px; }
@media (max-width: 700px) { .playlist li { grid-template-columns: 75px minmax(0, 1fr) 30px; } .media-editor { padding: 12px; } .dates button { min-height: 48px; } }
</style>
