<template>
  <section class="media-editor" :class="tone">
    <div class="library-header">
      <div>
        <h4>{{ icon }} {{ title }}清單</h4>
        <strong>目前共有 {{ normalized.library.length }} 個有效{{ itemLabel }}</strong>
      </div>
      <button type="button" @click="copyLastWeek">📋 複製上週清單</button>
    </div>

    <div class="add-row">
      <input v-model="newUrl" type="url" :placeholder="`貼上 YouTube ${itemLabel}網址`" @keyup.enter="addUrl" />
      <button type="button" @click="addUrl">➕ 加入清單</button>
    </div>
    <p v-if="newUrl && !extractYouTubeVideoId(newUrl)" class="error-text">網址格式不正確。</p>

    <ol v-if="normalized.library.length" class="playlist">
      <li v-for="(url, index) in normalized.library" :key="url">
        <b>播放 #{{ index + 1 }}</b><span>{{ url }}</span>
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
          <small v-if="normalized.calendar[date]">#{{ normalized.calendar[date].order || normalized.library.indexOf(normalized.calendar[date].url) + 1 }}</small>
          <small v-else-if="isWeekend(date)">隨機舊片</small>
        </button>
      </template>
    </div>

    <div v-if="selectedDate" class="date-editor">
      <strong>{{ selectedDate }} {{ isWeekend(selectedDate) ? '（週末自動隨機播放舊片）' : '' }}</strong>
      <select v-if="!isWeekend(selectedDate)" :value="normalized.calendar[selectedDate]?.url || ''" @change="setSelected($event.target.value)">
        <option value="">不播放</option>
        <option v-for="(url, index) in normalized.library" :key="url" :value="url">播放 #{{ index + 1 }}｜{{ url }}</option>
      </select>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { autoArrangeMedia, copyPreviousWeek, extractYouTubeVideoId, mediaCalendarDays, normalizeMediaSchedule, setMediaForDate, shiftMediaMonth } from '../utils/mediaSchedule.js'
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
const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const normalized = computed(() => normalizeMediaSchedule(props.modelValue, { nestedLegacy: props.nestedLegacy }))
const days = computed(() => mediaCalendarDays(month.value))
const monthLabel = computed(() => { const [year, value] = month.value.split('-'); return `${year} 年 ${Number(value)} 月` })
const isWeekend = date => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())
const update = value => emit('update:modelValue', { ...props.modelValue, calendar: value.calendar, library: value.library })

const addUrl = () => {
  const url = newUrl.value.trim()
  if (!extractYouTubeVideoId(url)) return
  const value = normalizeMediaSchedule(props.modelValue, { nestedLegacy: props.nestedLegacy })
  if (!value.library.includes(url)) value.library.push(url)
  update(value)
  newUrl.value = ''
}
const removeUrl = url => {
  const value = normalizeMediaSchedule(props.modelValue, { nestedLegacy: props.nestedLegacy })
  value.library = value.library.filter(item => item !== url)
  for (const [date, entry] of Object.entries(value.calendar)) if (entry.url === url) delete value.calendar[date]
  update(value)
}
const autoArrange = () => update(autoArrangeMedia(props.modelValue, startDate.value, { nestedLegacy: props.nestedLegacy }))
const copyLastWeek = () => update(copyPreviousWeek(props.modelValue, startDate.value, { nestedLegacy: props.nestedLegacy }))
const selectDate = date => { selectedDate.value = date }
const setSelected = url => update(setMediaForDate(props.modelValue, selectedDate.value, url, { nestedLegacy: props.nestedLegacy }))
</script>

<style scoped>
.media-editor { margin: 20px 0 28px; padding: 18px; border: 1px solid #cbd5e1; border-radius: 10px; background: #f8fafc; }
.media-editor.song { background: #fff7fb; border-color: #fbcfe8; }
.library-header, .add-row, .arrange-row, .calendar-toolbar, .date-editor { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
h4 { margin: 0 0 5px; color: #1e293b; font-size: 1.15rem; }
button { border: 0; border-radius: 6px; padding: 9px 12px; background: #475569; color: white; font-weight: bold; cursor: pointer; }
button:disabled { opacity: .5; cursor: not-allowed; }
.song button { background: #db2777; }
.add-row { margin-top: 15px; }
.add-row input { flex: 1; min-width: 240px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; }
.error-text { color: #dc2626; margin: 6px 0; }
.empty-text { color: #94a3b8; font-style: italic; }
.playlist { margin: 14px 0; padding-left: 28px; }
.playlist li { display: grid; grid-template-columns: 90px minmax(0, 1fr) 34px; align-items: center; gap: 8px; margin: 7px 0; }
.playlist span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #475569; }
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
.dates small { font-size: .68rem; }
.date-editor { margin-top: 12px; padding: 12px; background: white; border-radius: 8px; }
.date-editor select { flex: 1; min-width: 260px; }
@media (max-width: 700px) { .playlist li { grid-template-columns: 75px minmax(0, 1fr) 30px; } .media-editor { padding: 12px; } .dates button { min-height: 48px; } }
</style>
