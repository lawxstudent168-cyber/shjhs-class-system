<template>
  <div class="admin-panel">
    <div class="table-header">
      <div><h3>📺 首頁 YouTube 影片月曆排程</h3><p>建立影片清單後，可依順序自動排入平日；週末會從過去播過的影片隨機選擇。</p></div>
      <button @click="saveSchedule" class="save-btn" :disabled="isSaving">{{ isSaving ? '儲存中…' : '💾 儲存影片排程' }}</button>
    </div>

    <div class="option-box"><label><input type="checkbox" v-model="scheduleData.isMuted" /> 🔇 影片預設靜音</label></div>

    <div class="blackout-settings">
      <h4>🔒 指定日期白天禁播（推薦影片與英語歌曲）</h4>
      <p>選定日期的台灣時間 07:30–16:45 暫停播放；原有導師密碼臨時解鎖功能保持不變。</p>
      <div class="blackout-controls">
        <input v-model="blackoutDateInput" type="date" />
        <button type="button" :disabled="!blackoutDateInput" @click="addBlackoutDate">➕ 加入禁播日期</button>
      </div>
      <div v-if="scheduleData.blockedDates.length" class="date-chips">
        <span v-for="date in scheduleData.blockedDates" :key="date">{{ date }} <button type="button" @click="removeBlackoutDate(date)">×</button></span>
      </div>
    </div>

    <MediaScheduleEditor v-model="scheduleData" title="推薦影片" item-label="影片" icon="📺" tone="video" nested-legacy />

    <hr />

    <div class="table-header song-header">
      <div><h3>🎵 英語歌曲月曆排程</h3><p>歌曲同樣支援清單、自動排序、月曆指定、複製上週與週末隨機播放。</p></div>
      <button @click="saveEnglishSongSettings" class="save-btn song-btn" :disabled="isSavingSong">{{ isSavingSong ? '儲存中…' : '💾 儲存歌曲排程' }}</button>
    </div>
    <div class="option-box song-options">
      <label><input type="checkbox" v-model="englishSongSchedule.isVisible" /> 顯示「今日推薦英語歌曲」</label>
      <label><input type="checkbox" v-model="englishSongSchedule.isMuted" /> 🔇 歌曲預設靜音</label>
    </div>

    <MediaScheduleEditor v-model="englishSongSchedule" title="英語歌曲" item-label="歌曲" icon="🎵" tone="song" />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import MediaScheduleEditor from './MediaScheduleEditor.vue'
import { isValidExamDate } from '../utils/examSchedule.js'
import { normalizeMediaSchedule } from '../utils/mediaSchedule.js'
import { normalizeVideoBlackoutDates } from '../utils/videoBlackout.js'

const supabase = useSupabaseClient()
const isSaving = ref(false)
const isSavingSong = ref(false)
const blackoutDateInput = ref('')
const scheduleData = ref({ videos: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' }, calendar: {}, library: [], isMuted: true, blockedDates: [] })
const englishSongSchedule = ref({ 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', calendar: {}, library: [], isVisible: true, isMuted: true })

const fetchSchedules = async () => {
  const [{ data: ytData }, { data: songData }] = await Promise.all([
    supabase.from('system_settings').select('setting_value').eq('setting_key', 'youtube_schedule_data').maybeSingle(),
    supabase.from('system_settings').select('setting_value').eq('setting_key', 'english_song_schedule_data').maybeSingle()
  ])
  if (ytData?.setting_value) {
    const raw = ytData.setting_value
    const normalized = normalizeMediaSchedule(raw, { nestedLegacy: true })
    scheduleData.value = { ...scheduleData.value, ...raw, videos: raw.videos || normalized.legacy, calendar: normalized.calendar, library: normalized.library, blockedDates: normalizeVideoBlackoutDates(raw.blockedDates) }
  }
  if (songData?.setting_value) {
    const raw = songData.setting_value
    const normalized = normalizeMediaSchedule(raw)
    englishSongSchedule.value = { ...englishSongSchedule.value, ...raw, calendar: normalized.calendar, library: normalized.library }
  }
}
onMounted(fetchSchedules)

const addBlackoutDate = () => {
  if (!isValidExamDate(blackoutDateInput.value)) return
  scheduleData.value.blockedDates = normalizeVideoBlackoutDates([...scheduleData.value.blockedDates, blackoutDateInput.value])
  blackoutDateInput.value = ''
}
const removeBlackoutDate = date => { scheduleData.value.blockedDates = scheduleData.value.blockedDates.filter(item => item !== date) }

const saveSchedule = async () => {
  isSaving.value = true
  const { error } = await supabase.from('system_settings').upsert({ setting_key: 'youtube_schedule_data', setting_value: scheduleData.value }, { onConflict: 'setting_key' })
  alert(error ? '❌ 儲存失敗' : `✅ 推薦影片月曆已儲存，共 ${scheduleData.value.library.length} 個影片。`)
  isSaving.value = false
}
const saveEnglishSongSettings = async () => {
  isSavingSong.value = true
  const { error } = await supabase.from('system_settings').upsert({ setting_key: 'english_song_schedule_data', setting_value: englishSongSchedule.value }, { onConflict: 'setting_key' })
  alert(error ? '❌ 儲存失敗' : `✅ 英語歌曲月曆已儲存，共 ${englishSongSchedule.value.library.length} 個歌曲。`)
  isSavingSong.value = false
}
</script>

<style scoped>
.admin-panel { background: white; border-radius: 10px; padding: 25px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
.table-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; }
.table-header h3 { margin: 0; color: #1e293b; font-size: 1.4rem; }
.table-header p { margin: 6px 0 0; color: #64748b; }
.save-btn { flex-shrink: 0; background: #10b981; color: white; border: 0; padding: 11px 18px; border-radius: 7px; font-weight: bold; cursor: pointer; }
.save-btn:disabled { opacity: .6; }
.song-btn { background: #db2777; }
.option-box { display: flex; gap: 20px; flex-wrap: wrap; margin: 18px 0; padding: 14px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; }
.option-box label { font-weight: bold; color: #334155; }
.song-options { background: #fdf2f8; border-color: #fbcfe8; }
.blackout-settings { padding: 16px; border: 1px solid #fecdd3; border-left: 4px solid #e11d48; border-radius: 8px; background: #fff7f8; }
.blackout-settings h4 { margin: 0 0 6px; color: #9f1239; }
.blackout-settings p { color: #64748b; }
.blackout-controls { display: flex; gap: 8px; }
.blackout-controls input, .blackout-controls button { padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
.blackout-controls button { background: #e11d48; color: white; border: 0; font-weight: bold; cursor: pointer; }
.date-chips { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }
.date-chips span { padding: 5px 9px; border-radius: 999px; background: #ffe4e6; color: #9f1239; font-weight: bold; }
.date-chips button { border: 0; background: transparent; color: inherit; cursor: pointer; }
hr { margin: 40px 0; border: 0; border-top: 2px dashed #cbd5e1; }
@media (max-width: 700px) { .admin-panel { padding: 14px; } .table-header { align-items: stretch; flex-direction: column; } .save-btn { width: 100%; } }
</style>
