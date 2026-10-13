<template>
  <div class="admin-panel">
    
    <!-- ================= 📺 YouTube 影片輪播排程 ================= -->
    <div class="table-header">
      <h3>📺 首頁 YouTube 影片輪播排程設定</h3>
      <button @click="saveSchedule" class="save-btn" :disabled="isSaving">
        {{ isSaving ? '儲存中...' : '💾 儲存影片排程' }}
      </button>
    </div>

    <div class="info-box">
      <p>💡 <strong>說明：</strong> 請貼上任何 YouTube 網址。</p>
      <p>系統會根據「星期幾」自動在首頁播放對應的影片，且<strong>只有在「下課時間」才會自動播放，上課鐘響將自動暫停</strong>。</p>
      <p style="color: #ef4444; margin-top: 5px;">※ 留空代表該天不顯示影片區塊。</p>
    </div>

    <div class="sound-control-box">
      <label class="toggle-label">
        <input type="checkbox" v-model="scheduleData.isMuted" class="large-checkbox" />
        <span style="font-weight: bold; color: #1e293b;">🔇 影片預設靜音 (打勾為無聲，取消打勾則開放聲音)</span>
      </label>
      <p class="warning-text">⚠️ 注意：如果取消靜音 (開啟聲音)，為了遵守各大瀏覽器「防擾民」政策，影片在下課時可能會被瀏覽器強制阻擋自動播放，需由學生手動點擊畫面才能開始播放。</p>
    </div>

    <div class="blackout-settings">
      <h4>🔒 指定日期白天禁播（推薦影片與英語歌曲）</h4>
      <p>選定日期的台灣時間 07:30–16:45，即使課表顯示下課，首頁推薦影片與英語歌曲仍會暫停；教室可輸入導師密碼暫時解鎖。其他日期照原本課表播放。</p>
      <div class="blackout-controls">
        <label for="blackout-date">禁播日期</label>
        <input id="blackout-date" v-model="blackoutDateInput" type="date" class="blackout-date-input" />
        <button type="button" class="add-date-btn" :disabled="!blackoutDateInput" @click="addBlackoutDate">➕ 加入禁播日期</button>
      </div>
      <div v-if="scheduleData.blockedDates.length" class="blackout-dates">
        <span v-for="date in scheduleData.blockedDates" :key="date" class="blackout-date-chip">
          {{ date }} <button type="button" :aria-label="`移除 ${date} 禁播`" @click="removeBlackoutDate(date)">×</button>
        </span>
      </div>
      <p v-else class="blackout-empty">尚未指定禁播日期。</p>
      <p class="blackout-save-hint">新增或移除日期後，請按上方「儲存影片排程」才會生效。</p>
    </div>

    <div class="schedule-grid">
      <div v-for="(dayName, index) in daysMapping" :key="'yt-'+index" class="day-card" :class="{ 'is-today': index === String(currentDayIndex) }">
        <div class="day-header">
          <span class="day-badge">{{ dayName }}</span>
          <span v-if="index === String(currentDayIndex)" class="today-tag">👉 今天</span>
        </div>
        <div class="input-group">
          <label>YouTube 網址：</label>
          <input type="text" v-model="scheduleData.videos[index]" placeholder="請貼上 YouTube 網址..." class="yt-input" />
        </div>
        <div class="preview-box">
          <span v-if="extractVideoId(scheduleData.videos[index])" class="status-ok">✅ 網址正確</span>
          <span v-else-if="scheduleData.videos[index]" class="status-err">❌ 格式錯誤</span>
          <span v-else class="status-empty">🈳 不播放</span>
        </div>
      </div>
    </div>

    <hr class="section-divider" />

    <!-- ================= 🎵 今日推薦英語歌曲排程 ================= -->
    <div class="table-header">
      <h3>🎵 今日推薦英語歌曲排程設定</h3>
      <button @click="saveEnglishSongSettings" class="save-btn song-btn" :disabled="isSavingSong">
        {{ isSavingSong ? '儲存中...' : '💾 儲存歌曲設定' }}
      </button>
    </div>
    
    <div class="info-box-song">
      <p>💡 <strong>說明：</strong> 請貼上 YouTube 音樂網址。系統會根據「星期幾」自動在首頁左側播放對應的歌曲。</p>
      <p>這項模組同樣<strong>只有在「下課時間」才會自動播放，上課鐘響將自動暫停並變黑畫面</strong>。</p>
      <p>上方「指定日期白天禁播」也適用於英語歌曲，儲存影片排程後生效。</p>
      <p style="color: #ec4899; margin-top: 5px;">※ 留空代表該天不顯示歌曲區塊。</p>
    </div>

    <div class="dynamic-sort-box" style="margin-bottom: 20px;">
      <label class="icon-toggle" style="background: transparent; border: none; padding: 0;">
        <input type="checkbox" v-model="englishSongSchedule.isVisible" class="large-checkbox" />
        <span style="font-weight: bold; color: #db2777; font-size: 1.15rem;">顯示「今日推薦英語歌曲」面板</span>
      </label>
    </div>

    <div class="sound-control-box-song">
      <label class="toggle-label">
        <input type="checkbox" v-model="englishSongSchedule.isMuted" class="large-checkbox" />
        <span style="font-weight: bold; color: #1e293b;">🔇 歌曲預設靜音 (打勾為無聲，取消打勾則開放聲音)</span>
      </label>
      <p class="warning-text">⚠️ 注意：如果取消靜音，影片在下課時可能會被瀏覽器強制阻擋自動播放，需手動點擊。</p>
    </div>

    <div class="schedule-grid">
      <div v-for="(dayName, index) in daysMapping" :key="'song-'+index" class="day-card" :class="{ 'is-today-song': index === String(currentDayIndex) }">
        <div class="day-header">
          <span class="day-badge-song">{{ dayName }}</span>
          <span v-if="index === String(currentDayIndex)" class="today-tag-song">👉 今天</span>
        </div>
        <div class="input-group">
          <label>YouTube 音樂網址：</label>
          <input type="text" v-model="englishSongSchedule[index]" placeholder="請貼上 YouTube 音樂網址..." class="yt-input input-song" />
        </div>
        <div class="preview-box">
          <span v-if="extractVideoId(englishSongSchedule[index])" class="status-ok">✅ 網址正確</span>
          <span v-else-if="englishSongSchedule[index]" class="status-err">❌ 格式錯誤</span>
          <span v-else class="status-empty">🈳 不播放</span>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { isValidExamDate } from '../utils/examSchedule.js'
import { normalizeVideoBlackoutDates } from '../utils/videoBlackout.js'

const supabase = useSupabaseClient()

const daysMapping = { 1: '星期一', 2: '星期二', 3: '星期三', 4: '星期四', 5: '星期五', 6: '星期六', 0: '星期日' }
const currentDayIndex = new Date().getDay()

// 📺 YouTube 影片狀態
const isSaving = ref(false)
const scheduleData = ref({ 
  videos: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
  isMuted: true,
  blockedDates: []
})
const blackoutDateInput = ref('')

// 🎵 英語歌曲狀態
const isSavingSong = ref(false)
const englishSongSchedule = ref({ 
  0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 
  isVisible: true, 
  isMuted: true 
})

const fetchSchedules = async () => {
  // 抓取影片排程
  const { data: ytData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'youtube_schedule_data').maybeSingle()
  if (ytData && ytData.setting_value) {
    if (ytData.setting_value.videos) {
      scheduleData.value = {
        ...scheduleData.value,
        ...ytData.setting_value,
        blockedDates: normalizeVideoBlackoutDates(ytData.setting_value.blockedDates)
      }
    } else {
      scheduleData.value.videos = { ...scheduleData.value.videos, ...ytData.setting_value }
    }
  }

  // 抓取歌曲排程
  const { data: songData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'english_song_schedule_data').maybeSingle()
  if (songData && songData.setting_value) {
    englishSongSchedule.value = { ...englishSongSchedule.value, ...songData.setting_value }
  }
}

onMounted(() => {
  fetchSchedules()
})

const addBlackoutDate = () => {
  if (!isValidExamDate(blackoutDateInput.value)) return alert('請選擇有效日期。')
  scheduleData.value.blockedDates = normalizeVideoBlackoutDates([...scheduleData.value.blockedDates, blackoutDateInput.value])
  blackoutDateInput.value = ''
}

const removeBlackoutDate = (date) => {
  scheduleData.value.blockedDates = scheduleData.value.blockedDates.filter(value => value !== date)
}

const saveSchedule = async () => {
  isSaving.value = true
  const { error } = await supabase.from('system_settings').upsert(
    { setting_key: 'youtube_schedule_data', setting_value: scheduleData.value },
    { onConflict: 'setting_key' }
  )
  if (!error) alert('✅ YouTube 影片排程已成功更新！首頁將自動生效。')
  else alert('❌ 儲存失敗')
  isSaving.value = false
}

const saveEnglishSongSettings = async () => {
  isSavingSong.value = true
  const { error } = await supabase.from('system_settings').upsert(
    { setting_key: 'english_song_schedule_data', setting_value: englishSongSchedule.value }, 
    { onConflict: 'setting_key' }
  )
  if (!error) alert('✅ 英語歌曲設定成功！首頁將自動生效。')
  else alert('❌ 儲存失敗')
  isSavingSong.value = false
}

const extractVideoId = (url) => {
  if (!url) return null
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  return (match && match[2].length === 11) ? match[2] : null
}
</script>

<style scoped>
.admin-panel { background: white; border-radius: 8px; padding: 25px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.section-divider { border: 0; height: 2px; background: #e2e8f0; margin: 40px 0; border-top: 2px dashed #cbd5e1; }

.table-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; }
.table-header h3 { margin: 0; color: #1e293b; font-size: 1.4rem; }

/* 按鈕樣式 */
.save-btn { background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; font-size: 1rem; cursor: pointer; transition: 0.2s; }
.save-btn:hover:not(:disabled) { background: #059669; }
.save-btn:disabled { background: #94a3b8; cursor: not-allowed; }
.song-btn { background-color: #ec4899; }
.song-btn:hover:not(:disabled) { background-color: #db2777; }

/* 說明框樣式 */
.info-box { background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin-bottom: 15px; border-radius: 4px; }
.info-box p { margin: 5px 0; color: #166534; font-size: 0.95rem; }
.info-box-song { background: #fdf2f8; border-left: 4px solid #ec4899; padding: 15px; margin-bottom: 15px; border-radius: 4px; }
.info-box-song p { margin: 5px 0; color: #9d174d; font-size: 0.95rem; }

/* 音效控制樣式 */
.sound-control-box { background: #fffbeb; border: 1px solid #fcd34d; padding: 15px; margin-bottom: 25px; border-radius: 6px; }
.sound-control-box-song { background: #fffbeb; border: 1px solid #fcd34d; padding: 15px; margin-bottom: 25px; border-radius: 6px; }
.toggle-label { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.large-checkbox { transform: scale(1.3); cursor: pointer; }
.warning-text { margin: 8px 0 0 28px; color: #b45309; font-size: 0.9rem; font-weight: bold; }
.blackout-settings { background: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #e11d48; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
.blackout-settings h4 { margin: 0 0 8px; color: #9f1239; font-size: 1.1rem; }
.blackout-settings p { margin: 6px 0 12px; color: #475569; line-height: 1.5; }
.blackout-controls, .blackout-dates { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.blackout-controls label { font-weight: bold; color: #334155; }
.blackout-date-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
.add-date-btn { padding: 9px 13px; border: 0; border-radius: 6px; background: #e11d48; color: white; font-weight: bold; cursor: pointer; }
.add-date-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.blackout-dates { margin-top: 12px; }
.blackout-date-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; background: #ffe4e6; color: #9f1239; border-radius: 16px; font-weight: bold; }
.blackout-date-chip button { border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 1.15rem; }
.blackout-settings .blackout-empty, .blackout-settings .blackout-save-hint { font-size: 0.9rem; margin-bottom: 0; }

.dynamic-sort-box { background: #fdf2f8; border: 1px dashed #fbcfe8; padding: 15px 20px; border-radius: 8px; margin-bottom: 15px; }

/* 卡片排版 */
.schedule-grid { display: flex; flex-direction: column; gap: 15px; }
.day-card { display: flex; align-items: center; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; gap: 20px; transition: 0.2s; }
.day-card:hover { border-color: #94a3b8; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

/* 📺 影片卡片特效 */
.day-card.is-today { border-color: #3b82f6; background: #eff6ff; box-shadow: 0 0 0 1px #3b82f6; }
.day-badge { background: #475569; color: white; padding: 5px 12px; border-radius: 20px; font-weight: bold; font-size: 1rem; }
.is-today .day-badge { background: #3b82f6; }
.today-tag { color: #ef4444; font-size: 0.85rem; font-weight: bold; }

/* 🎵 歌曲卡片特效 */
.day-card.is-today-song { border-color: #ec4899; background: #fdf2f8; box-shadow: 0 0 0 1px #ec4899; }
.day-badge-song { background: #475569; color: white; padding: 5px 12px; border-radius: 20px; font-weight: bold; font-size: 1rem; }
.is-today-song .day-badge-song { background: #ec4899; }
.today-tag-song { color: #db2777; font-size: 0.85rem; font-weight: bold; }

.day-header { width: 100px; display: flex; flex-direction: column; align-items: center; gap: 8px; }

.input-group { flex: 1; display: flex; flex-direction: column; gap: 5px; }
.input-group label { font-size: 0.9rem; color: #64748b; font-weight: bold; }
.yt-input { width: 100%; padding: 10px 15px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 1rem; transition: 0.2s; }
.yt-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
.input-song:focus { border-color: #ec4899; box-shadow: 0 0 0 2px rgba(236, 72, 153, 0.2); }

.preview-box { width: 100px; text-align: center; font-weight: bold; font-size: 0.95rem; }
.status-ok { color: #10b981; }
.status-err { color: #ef4444; }
.status-empty { color: #94a3b8; }

@media (max-width: 768px) {
  .day-card { flex-direction: column; align-items: stretch; gap: 10px; }
  .day-header { width: 100%; flex-direction: row; justify-content: space-between; }
  .preview-box { width: 100%; text-align: left; margin-top: 5px; }
}
</style>
