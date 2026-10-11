<template>
  <div class="exams-page">
    <!-- 🔒 鎖定畫面 -->
    <div v-if="!isLoggedIn" class="login-container">
      <div class="login-card">
        <h2>🎓 大考日程管理系統</h2>
        <p class="subtitle">此區域僅限導師進入</p>
        <div class="form-group">
          <label>請輸入導師後台密碼：</label>
          <input 
            v-model="passwordInput" 
            type="password" 
            placeholder="支援動態密碼..." 
            class="form-control" 
            @keyup.enter="handleLogin"
          />
        </div>
        <button @click="handleLogin" class="btn-submit" :disabled="isLoggingIn">
          {{ isLoggingIn ? '驗證中...' : '解鎖進入' }}
        </button>
        <div class="back-link">
          <NuxtLink to="/">⬅️ 返回首頁</NuxtLink>
        </div>
      </div>
    </div>

    <!-- 📝 編輯區 -->
    <div v-else class="workspace">
      <header class="workspace-header">
        <h2>🎓 大考 (段考/模擬考) 日程管理</h2>
        <div class="header-actions">
          <button @click="saveExamData" class="btn-save" :disabled="isSaving">
            {{ isSaving ? '⏳ 儲存中...' : '💾 儲存所有設定' }}
          </button>
          <button @click="logout" class="btn-logout">登出</button>
        </div>
      </header>

      <div class="settings-card">
        <div class="toggle-setting-box">
          <label class="toggle-label">
            <input type="checkbox" v-model="examData.isExamModeEnabled" />
            ✅ 允許首頁顯示「切換大考模式」按鈕 (僅限褐名單 IP 可見)
          </label>
          <p class="setting-desc">關閉此選項後，即使設定了考程，首頁也不會出現切換按鈕，適合平時隱藏功能。</p>
        </div>

        <div class="display-day-setting">
          <label class="main-label" for="display-day">🏠 首頁大考看板要顯示哪一天？</label>
          <select id="display-day" v-model.number="examData.displayDay" class="form-control day-select">
            <option :value="1">第一天</option>
            <option :value="2">第二天</option>
          </select>
          <p class="setting-desc">手動指定，儲存後首頁只顯示所選日期的標題、考程和考前提醒；不會依照今天日期自動切換。</p>
          <p v-if="!examData.days[examData.displayDay - 1].periods.length" class="setting-warning">目前選擇的日期還沒有考試節次，首頁不會顯示大考看板按鈕。</p>
        </div>

        <div class="font-settings">
          <h3>🔠 看板右側與考前提醒文字大小</h3>
          <div class="font-settings-grid">
            <label v-for="(setting, key) in examFontSettings" :key="key" class="font-setting">
              <span>{{ setting.label }}：{{ examData.fontSizes[key] }} px</span>
              <input v-model.number="examData.fontSizes[key]" type="range" :min="setting.min" :max="setting.max" step="2" />
            </label>
          </div>
          <p class="setting-desc">拖曳後可在下方看板預覽，按「儲存所有設定」才會更新首頁。</p>
        </div>

        <div class="theme-selector-box">
          <label class="main-label">🎨 選擇大考看板主題風格：</label>
          <div class="theme-grid">
            <div 
              v-for="(theme, key) in examThemes" 
              :key="key" 
              class="theme-item" 
              :class="{ 'is-selected': examData.theme === key }"
              :style="{ backgroundColor: theme.bg, borderColor: theme.border }"
              @click="examData.theme = key"
            >
              <div class="theme-name" :style="{ color: theme.title }">{{ theme.name }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="exam-editor-card">
        <div class="day-tabs" role="group" aria-label="選擇編輯的考試日期">
          <button v-for="day in [1, 2]" :key="day" type="button" class="day-tab"
            :class="{ 'is-active': editingDay === day }" :aria-pressed="editingDay === day"
            @click="editingDay = day">{{ day === 1 ? '第一天' : '第二天' }}</button>
        </div>
        <p class="editing-hint">目前編輯：第 {{ editingDay }} 天。兩天的標題、節次及提醒分開儲存；首頁顯示日期由上方設定指定。</p>
        <div class="form-group">
          <label class="main-label">第 {{ editingDay }} 天大考標題名稱：</label>
          <input type="text" v-model="editedDay.title" class="form-control title-input" :placeholder="`例：新化國中第一次段考 第${editingDay}天`" />
        </div>

        <div class="periods-container">
          <div class="periods-header">
            <h3>考試節次與時間清單</h3>
            <button @click="addPeriod" class="btn-add">➕ 新增一節考試</button>
          </div>
          
          <table class="periods-table">
            <thead>
              <tr>
                <th width="60">順序</th>
                <th width="200">考試科目</th>
                <th>開始時間</th>
                <th>結束時間</th>
                <th width="120">正式考試<br><span style="font-size:0.8rem;font-weight:normal">(啟用倒數)</span></th>
                <th width="80">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="editedDay.periods.length === 0">
                <td colspan="6" class="empty-msg">目前無任何考試節次，請點擊右上方新增。</td>
              </tr>
              <tr v-for="(period, index) in editedDay.periods" :key="index">
                <td><strong>{{ index + 1 }}</strong></td>
                <td><input type="text" v-model="period.subject" class="form-control text-center" placeholder="例：國文" /></td>
                <td><input type="time" v-model="period.startTime" class="form-control time-ctrl" /></td>
                <td><input type="time" v-model="period.endTime" class="form-control time-ctrl" /></td>
                <td>
                  <label class="checkbox-label">
                    <input type="checkbox" v-model="period.isExam" class="big-checkbox" />
                  </label>
                </td>
                <td><button @click="removePeriod(index)" class="btn-delete">🗑️</button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 💡 新增：大考提醒事項編輯區 -->
        <div class="notes-container">
          <div class="periods-header">
            <h3>📝 考前提醒事項 (將顯示於看板右下角)</h3>
            <div class="io-actions">
              <button @click="saveNotesTemplate" class="btn-outline">💾 暫存為範本</button>
              <button @click="loadNotesTemplate" class="btn-outline">📥 載入範本</button>
              <button @click="exportNotes('json')" class="btn-outline">📤 匯出 JSON</button>
              <button @click="exportNotes('csv')" class="btn-outline">📤 匯出 CSV</button>
              <label class="btn-outline" style="cursor: pointer;">
                📥 匯入檔案
                <input type="file" accept=".json,.csv" style="display:none" @change="importNotes" />
              </label>
            </div>
          </div>
          
          <div class="notes-list">
            <div v-for="(note, idx) in editedDay.notes" :key="'note-'+idx" class="note-edit-row">
              <span class="note-idx">{{ idx + 1 }}.</span>
              <input type="text" v-model="editedDay.notes[idx]" class="form-control" placeholder="輸入提醒事項... (例：手機請關機並放至教室前後)" />
              <button @click="removeNote(idx)" class="btn-delete">🗑️</button>
            </div>
            <div v-if="editedDay.notes.length === 0" class="empty-msg" style="text-align: left; padding: 10px 0 !important;">目前無提醒事項。</div>
            <button @click="addNote" class="btn-add mt-10">➕ 新增提醒事項</button>
          </div>
        </div>
      </div>

      <div class="preview-section-wrapper">
        <div class="preview-header">
          <h3>👀 預覽第 {{ editingDay }} 天大考看板</h3>
          <div class="mock-controls">
            <label>測試假定時間：</label>
            <input type="time" v-model="mockTime" class="form-control mock-input" />
            <span class="mock-desc">(可任意調整時間來觀察下方看板的變化)</span>
          </div>
        </div>

        <div class="preview-scale-container">
          <div class="exam-dashboard-preview" :style="currentThemeStyles">
            <h1 class="exam-main-title">{{ editedDay.title || '尚未設定標題' }}</h1>
            
            <div class="exam-split-layout">
              <div class="exam-left-panel">
                <table class="exam-table">
                  <thead>
                    <tr>
                      <th width="80">節次</th>
                      <th>考科</th>
                      <th>開始</th>
                      <th>結束</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(p, i) in previewStatus.periods" :key="i" :class="{ 'active-row': p.isActive }">
                      <td>第 {{ i + 1 }} 節</td>
                      <td class="font-bold">{{ p.subject }}</td>
                      <td class="font-mono">{{ p.startTime }}</td>
                      <td class="font-mono">{{ p.endTime }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="exam-right-panel">
                <div class="clock-label">目前時間 (預覽假定)</div>
                <div class="exam-clock">{{ mockTime }}:00</div>

                <div class="exam-status-display">
                  <div v-if="previewStatus.state === 'WAITING'" class="status-text waiting">⏳ 準備中...</div>
                  <div v-else-if="previewStatus.state === 'FINISHED'" class="status-text finished">🎉 今日全數結束</div>
                  
                  <div v-else-if="previewStatus.state === 'TESTING'" class="status-text testing">
                    <div class="status-label">✏️ 目前進行</div>
                    <div class="status-subject">{{ previewStatus.current.subject }}</div>
                    
                    <div v-if="previewStatus.current.isExam" class="countdown-wrapper">
                      <div class="countdown-label">距離本節結束還有</div>
                      <div class="exam-countdown" :class="{ 'text-danger': previewCountdownMinutes < 5 }">
                        {{ previewCountdownText }}
                      </div>
                    </div>
                    <div v-else class="study-mode-text">📖 溫書自習中</div>
                  </div>
                  
                  <div v-else-if="previewStatus.state === 'BREAK'" class="status-text break">
                    <div class="status-label">☕ 休息時間</div>
                    <div class="status-next" v-if="previewStatus.next">
                      下一節：<span class="highlight">{{ previewStatus.next.subject }}</span> 
                      <br>
                      <span class="next-time">({{ previewStatus.next.startTime }} 開始)</span>
                    </div>
                  </div>
                </div>

                <!-- 💡 新增：大考提醒事項展示區 -->
                <div class="exam-notes-display" v-if="editedDay.notes.length > 0">
                  <h4 class="notes-title">⚠️ 考前提醒</h4>
                  <ul class="notes-list-preview">
                    <li v-for="(note, idx) in editedDay.notes" :key="'p-note-'+idx">{{ note }}</li>
                  </ul>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { examFontSettings, examFontStyles, normalizeExamSchedule } from '../utils/examSchedule.js'
const supabase = useSupabaseClient()

const isLoggedIn = ref(false)
const isLoggingIn = ref(false)
const passwordInput = ref('')
const isSaving = ref(false)

const mockTime = ref('08:30')
const editingDay = ref(1)

const examThemes = {
  midnight: { name: '午夜藍 (Midnight)', bg: '#0f172a', border: '#334155', title: '#f8fafc', clock: '#fbbf24', text: '#cbd5e1', accent: '#3b82f6', success: '#10b981', danger: '#ef4444', panelBg: '#1e293b' },
  blackboard: { name: '經典黑板 (Blackboard)', bg: '#1a3627', border: '#5b3a1a', title: '#ffffff', clock: '#fbbf24', text: '#e2e8f0', accent: '#fca5a5', success: '#a7f3d0', danger: '#f87171', panelBg: '#234a36' },
  slate: { name: '沉穩灰 (Slate)', bg: '#334155', border: '#64748b', title: '#f8fafc', clock: '#38bdf8', text: '#f1f5f9', accent: '#818cf8', success: '#34d399', danger: '#f87171', panelBg: '#475569' },
  matcha: { name: '抹茶綠 (Matcha)', bg: '#2f3e36', border: '#5b6a5a', title: '#ecfdf5', clock: '#a7f3d0', text: '#d1fae5', accent: '#6ee7b7', success: '#10b981', danger: '#fca5a5', panelBg: '#3b4d45' },
  burgundy: { name: '勃根地紅 (Burgundy)', bg: '#450a0a', border: '#7f1d1d', title: '#fee2e2', clock: '#fca5a5', text: '#fecaca', accent: '#f87171', success: '#a7f3d0', danger: '#fbbf24', panelBg: '#591111' },
  ocean: { name: '深海湛藍 (Ocean)', bg: '#083344', border: '#164e63', title: '#cffafe', clock: '#67e8f9', text: '#a5f3fc', accent: '#22d3ee', success: '#34d399', danger: '#fca5a5', panelBg: '#114358' },
  mocha: { name: '摩卡棕 (Mocha)', bg: '#3e2723', border: '#784315', title: '#fef3c7', clock: '#fde047', text: '#fde68a', accent: '#fbbf24', success: '#6ee7b7', danger: '#fca5a5', panelBg: '#5c3a21' },
  purple: { name: '星空紫 (Purple)', bg: '#2e1065', border: '#4c1d95', title: '#ede9fe', clock: '#c4b5fd', text: '#ddd6fe', accent: '#a78bfa', success: '#6ee7b7', danger: '#fca5a5', panelBg: '#3b187d' },
  retro: { name: '復古紙質 (Retro)', bg: '#e7e5e4', border: '#94a3b8', title: '#1c1917', clock: '#b45309', text: '#44403c', accent: '#78350f', success: '#15803d', danger: '#b91c1c', panelBg: '#f5f5f4' },
  minimal: { name: '極簡白 (Minimal)', bg: '#ffffff', border: '#cbd5e1', title: '#0f172a', clock: '#0284c7', text: '#334155', accent: '#3b82f6', success: '#16a34a', danger: '#dc2626', panelBg: '#f8fafc' }
}

const defaultExamData = {
  isExamModeEnabled: true,
  theme: 'midnight',
  displayDay: 1,
  days: [
    {
      title: '新化國中第一次段考 第一天',
      periods: [
        { subject: '溫書', startTime: '07:30', endTime: '08:15', isExam: false },
        { subject: '國文', startTime: '08:20', endTime: '09:05', isExam: true },
        { subject: '溫書', startTime: '09:15', endTime: '10:00', isExam: false },
        { subject: '數學', startTime: '10:10', endTime: '10:55', isExam: true }
      ],
      notes: []
    },
    { title: '新化國中第一次段考 第二天', periods: [], notes: [] }
  ]
}

const examData = ref(normalizeExamSchedule(defaultExamData))
const editedDay = computed(() => examData.value.days[editingDay.value - 1])

const currentThemeStyles = computed(() => {
  const t = examThemes[examData.value.theme] || examThemes.midnight
  return {
    '--ex-bg': t.bg,
    '--ex-border': t.border,
    '--ex-title': t.title,
    '--ex-clock': t.clock,
    '--ex-text': t.text,
    '--ex-accent': t.accent,
    '--ex-success': t.success,
    '--ex-danger': t.danger,
    '--ex-panel-bg': t.panelBg,
    ...examFontStyles(examData.value)
  }
})

const previewStatus = computed(() => {
  if (!editedDay.value.periods.length) return { state: 'WAITING', periods: [] }

  if (!mockTime.value) return { state: 'WAITING', periods: [] }
  
  const [mh, mm] = mockTime.value.split(':').map(Number)
  const mockMins = mh * 60 + mm

  let current = null
  let next = null
  let state = 'WAITING'

  const periods = JSON.parse(JSON.stringify(editedDay.value.periods))

  for (let i = 0; i < periods.length; i++) {
    const p = periods[i]
    if (!p.startTime || !p.endTime) continue
    
    const [sh, sm] = p.startTime.split(':').map(Number)
    const [eh, em] = p.endTime.split(':').map(Number)
    const startMins = sh * 60 + sm
    const endMins = eh * 60 + em

    p.isActive = false

    if (mockMins >= startMins && mockMins <= endMins) {
      state = 'TESTING'
      current = p
      p.isActive = true
      if (i + 1 < periods.length) next = periods[i + 1]
      break
    }

    if (mockMins < startMins) {
      if (state !== 'TESTING') {
        state = i === 0 ? 'WAITING' : 'BREAK'
        next = p
      }
      break
    }
  }

  const lastP = periods[periods.length - 1]
  if (lastP && lastP.endTime) {
    const [lsh, lsm] = lastP.endTime.split(':').map(Number)
    if (!current && !next && mockMins >= (lsh * 60 + lsm)) {
       state = 'FINISHED'
    }
  }

  return { state, current, next, periods }
})

const previewCountdownMinutes = computed(() => {
  if (previewStatus.value.state !== 'TESTING' || !previewStatus.value.current) return 999
  const [mh, mm] = mockTime.value.split(':').map(Number)
  const [eh, em] = previewStatus.value.current.endTime.split(':').map(Number)
  return (eh * 60 + em) - (mh * 60 + mm)
})

const previewCountdownText = computed(() => {
  const diffMins = previewCountdownMinutes.value
  if (diffMins <= 0) return '00:00'
  return `${String(diffMins).padStart(2, '0')}:00`
})


onMounted(async () => {
  if (sessionStorage.getItem('exams_admin_logged_in') === 'true') {
    isLoggedIn.value = true
    await fetchExamData()
  }
})

const handleLogin = async () => {
  if (!passwordInput.value) return
  isLoggingIn.value = true
  
  try {
    const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'admin_password').maybeSingle()
    let expectedPwd = '168168168' 
    if (data?.setting_value) {
      const config = data.setting_value
      if (config.type === 'dynamic') {
        const d = new Date(); const yy = String(d.getFullYear()).slice(2); const mm = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0')
        expectedPwd = `${yy}${mm}${dd}59`
      } else if (config.type === 'custom' && config.custom_pwd) { expectedPwd = config.custom_pwd }
    }
    if (passwordInput.value === expectedPwd || passwordInput.value === '168168168') {
      isLoggedIn.value = true
      sessionStorage.setItem('exams_admin_logged_in', 'true')
      await fetchExamData()
    } else alert('❌ 密碼錯誤！')
  } catch (e) {
    if (passwordInput.value === '168168168') { isLoggedIn.value = true; sessionStorage.setItem('exams_admin_logged_in', 'true'); await fetchExamData() }
    else alert('驗證發生錯誤。')
  } finally { isLoggingIn.value = false; passwordInput.value = '' }
}

const logout = () => { sessionStorage.removeItem('exams_admin_logged_in'); isLoggedIn.value = false; navigateTo('/') }

const fetchExamData = async () => {
  const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'exam_schedule_data').maybeSingle()
  if (data?.setting_value) {
    examData.value = normalizeExamSchedule(data.setting_value)
  } else {
    examData.value = normalizeExamSchedule(defaultExamData)
  }
}

const addPeriod = () => {
  editedDay.value.periods.push({ subject: '', startTime: '', endTime: '', isExam: true })
}

const removePeriod = (index) => {
  editedDay.value.periods.splice(index, 1)
}

// 💡 提醒事項操作邏輯
const addNote = () => {
  editedDay.value.notes.push('')
}

const removeNote = (index) => {
  editedDay.value.notes.splice(index, 1)
}

const saveNotesTemplate = () => {
  localStorage.setItem('exam_notes_template', JSON.stringify(editedDay.value.notes))
  alert('✅ 提醒事項已成功暫存至瀏覽器本機範本！')
}

const loadNotesTemplate = () => {
  const tmpl = localStorage.getItem('exam_notes_template')
  if (tmpl) {
    editedDay.value.notes = JSON.parse(tmpl)
    alert('✅ 本機範本載入成功！')
  } else {
    alert('❌ 找不到暫存的範本資料。')
  }
}

const exportNotes = (format) => {
  const notes = editedDay.value.notes
  let content = ''
  let mime = ''
  let filename = ''

  if (format === 'json') {
    content = JSON.stringify(notes, null, 2)
    mime = 'application/json'
    filename = 'exam_notes.json'
  } else if (format === 'csv') {
    content = "提醒事項\n" + notes.map(n => `"${String(n).replace(/"/g, '""')}"`).join('\n')
    mime = 'text/csv;charset=utf-8;'
    filename = 'exam_notes.csv'
  }

  const blob = new Blob([format === 'csv' ? '\uFEFF' + content : content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const importNotes = (e) => {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (event) => {
    const text = event.target.result
    if (file.name.endsWith('.json')) {
      try {
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed)) {
          editedDay.value.notes = parsed
          alert('✅ JSON 範本匯入成功！')
        } else {
          alert('❌ JSON 格式不正確 (內容必須為陣列)。')
        }
      } catch(err) {
        alert('❌ JSON 解析失敗。')
      }
    } else if (file.name.endsWith('.csv')) {
      try {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l)
        if (lines[0] && lines[0].includes('提醒事項')) lines.shift()
        
        const parsed = lines.map(l => {
          let str = l
          if (str.startsWith('"') && str.endsWith('"')) {
            str = str.slice(1, -1).replace(/""/g, '"')
          }
          return str
        }).filter(l => l)

        editedDay.value.notes = parsed
        alert('✅ CSV 範本匯入成功！')
      } catch(err) {
        alert('❌ CSV 解析失敗。')
      }
    } else {
      alert('❌ 不支援的檔案格式，請匯入 JSON 或 CSV。')
    }
    e.target.value = '' 
  }
  reader.readAsText(file)
}

const saveExamData = async () => {
  isSaving.value = true
  try {
    const { error } = await supabase.from('system_settings').upsert({
      setting_key: 'exam_schedule_data',
      setting_value: normalizeExamSchedule(examData.value)
    }, { onConflict: 'setting_key' })
    if (error) throw error
    alert('✅ 大考設定已成功儲存並同步！')
  } catch (err) {
    alert('❌ 儲存失敗：' + err.message)
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped>
.exams-page { min-height: 100vh; background: #f1f5f9; font-family: sans-serif; padding-bottom: 50px;}
.login-container { display: flex; justify-content: center; align-items: center; min-height: 80vh; padding: 20px; }
.login-card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; }
.subtitle { color: #64748b; margin-bottom: 20px; }
.form-group { margin-bottom: 20px; text-align: left; }
.form-control { width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit;}
.text-center { text-align: center; }
.btn-submit { width: 100%; padding: 12px; background: #dc2626; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
.back-link { margin-top: 15px; }

.workspace { padding: 20px; max-width: 1000px; margin: 0 auto; }
.workspace-header { display: flex; justify-content: space-between; align-items: center; background: white; padding: 15px 25px; border-radius: 8px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); flex-wrap: wrap; gap: 15px; }
.workspace-header h2 { margin: 0; color: #991b1b; }
.header-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.btn-save { background: #10b981; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; }
.btn-logout { background: #ef4444; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; }

.settings-card { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 20px; }
.toggle-setting-box { border-bottom: 1px dashed #cbd5e1; padding-bottom: 20px; margin-bottom: 20px; }
.toggle-label { font-weight: bold; font-size: 1.1rem; color: #1e293b; cursor: pointer; display: flex; align-items: center; gap: 10px;}
.toggle-label input { transform: scale(1.3); cursor: pointer;}
.setting-desc { margin: 5px 0 0 32px; color: #64748b; font-size: 0.95rem; }
.display-day-setting { border-bottom: 1px dashed #cbd5e1; padding-bottom: 20px; margin-bottom: 20px; }
.day-select { max-width: 240px; background: white; font-size: 1rem; }
.display-day-setting .setting-desc, .font-settings .setting-desc { margin-left: 0; }
.setting-warning { color: #b45309; font-weight: bold; margin-bottom: 0; }
.font-settings h3 { margin: 0 0 15px; color: #334155; }
.font-settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px 24px; }
.font-setting { display: flex; flex-direction: column; gap: 8px; color: #334155; font-weight: bold; }
.font-setting input { width: 100%; cursor: pointer; }

.theme-selector-box { margin-top: 10px; }
.theme-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 15px; margin-top: 10px; }
.theme-item { border: 2px solid transparent; border-radius: 8px; padding: 15px 10px; text-align: center; cursor: pointer; transition: 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.1);}
.theme-item:hover { transform: translateY(-3px); box-shadow: 0 4px 8px rgba(0,0,0,0.2); }
.theme-item.is-selected { transform: scale(1.05); box-shadow: 0 0 0 3px #3b82f6, 0 4px 8px rgba(0,0,0,0.2); }
.theme-name { font-weight: bold; font-size: 0.95rem;}

.exam-editor-card { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 20px;}
.day-tabs { display: flex; gap: 10px; margin-bottom: 10px; }
.day-tab { padding: 10px 24px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; color: #334155; cursor: pointer; font-weight: bold; }
.day-tab.is-active { background: #991b1b; border-color: #991b1b; color: white; }
.editing-hint { margin: 0 0 20px; color: #64748b; }
.main-label { font-size: 1.1rem; font-weight: bold; color: #1e293b; margin-bottom: 8px; display: block;}
.title-input { font-size: 1.2rem; font-weight: bold; padding: 15px; background: #f8fafc; border: 1px dashed #94a3b8; }
.title-input:focus { background: white; border-color: #dc2626; outline: none; }

.periods-container { margin-top: 30px; }
.periods-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;}
.periods-header h3 { margin: 0; color: #334155; }
.btn-add { background: #3b82f6; color: white; border: none; padding: 8px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; }

.periods-table { width: 100%; border-collapse: collapse; text-align: center; }
.periods-table th, .periods-table td { border: 1px solid #e2e8f0; padding: 12px; }
.periods-table th { background: #f8fafc; color: #475569; }
.empty-msg { color: #94a3b8; font-style: italic; padding: 20px !important; text-align: center;}
.time-ctrl { font-family: monospace; font-size: 1.05rem; text-align: center; }
.checkbox-label { display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; cursor: pointer;}
.big-checkbox { transform: scale(1.8); cursor: pointer; }
.btn-delete { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: 0.2s; }
.btn-delete:hover { background: #fecaca; }

/* 💡 提醒事項 CSS */
.notes-container { margin-top: 30px; border-top: 2px dashed #e2e8f0; padding-top: 20px; }
.io-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.btn-outline { background: white; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; color: #475569; font-weight: bold; transition: 0.2s; }
.btn-outline:hover { background: #f8fafc; border-color: #94a3b8; }
.note-edit-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.note-idx { font-weight: bold; color: #64748b; width: 25px; text-align: right; }
.mt-10 { margin-top: 10px; }

.preview-section-wrapper { background: #1e293b; padding: 25px; border-radius: 12px; margin-top: 30px; }
.preview-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;}
.preview-header h3 { margin: 0; color: #f8fafc; }
.mock-controls { display: flex; align-items: center; gap: 10px; color: #cbd5e1; background: #334155; padding: 8px 15px; border-radius: 8px;}
.mock-input { padding: 4px; font-size: 1.1rem; border-radius: 4px; border: none; width: 120px; font-weight: bold; text-align: center;}
.mock-desc { font-size: 0.9rem; color: #94a3b8; }

.preview-scale-container { 
  width: 100%; 
  border-radius: 12px; 
  overflow: hidden; 
  zoom: 0.6; 
  border: 4px solid #475569;
}

.exam-dashboard-preview { 
  background-color: var(--ex-bg); 
  color: var(--ex-text); 
  padding: 40px; 
  display: flex; 
  flex-direction: column; 
  align-items: stretch;
  min-height: 800px;
}
.exam-main-title { font-size: 3rem; margin: 0 0 40px 0; color: var(--ex-title); letter-spacing: 2px; text-align: center; border-bottom: 2px solid var(--ex-border); padding-bottom: 20px;}
.exam-split-layout { display: flex; gap: 40px; flex: 1; align-items: flex-start; justify-content: center; }

.exam-left-panel { flex: 1; max-width: 800px; }
.exam-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 1.6rem; background: var(--ex-panel-bg); border-radius: 16px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.2);}
.exam-table th, .exam-table td { padding: 22px; text-align: center; border-bottom: 1px solid var(--ex-border); }
.exam-table th { background: var(--ex-border); color: var(--ex-title); font-weight: normal; font-size: 1.4rem; }
.exam-table tr:last-child td { border-bottom: none; }
.active-row { background: rgba(255,255,255,0.1); border-left: 5px solid var(--ex-accent);}
.active-row td { color: var(--ex-accent); font-weight: bold; border-bottom-color: transparent;}
.font-mono { font-family: monospace; }
.font-bold { font-weight: bold; letter-spacing: 1px; }

.exam-right-panel { flex: 1; max-width: 700px; background: var(--ex-panel-bg); border-radius: 20px; padding: 40px; text-align: center; border: 1px solid var(--ex-border); box-shadow: 0 10px 30px rgba(0,0,0,0.3); display: flex; flex-direction: column; justify-content: flex-start; align-items: center;}
.clock-label { font-size: 1.5rem; color: var(--ex-text); margin-bottom: 10px; opacity: 0.8;}
.exam-clock { font-size: var(--ex-clock-size, 120px); font-weight: bold; font-family: monospace; color: var(--ex-clock); margin-bottom: 30px; line-height: 1; }

.exam-status-display { width: 100%; border-top: 1px solid var(--ex-border); padding-top: 30px;}
.status-text { font-size: 2.5rem; font-weight: bold; }
.status-text.waiting { color: var(--ex-text); opacity: 0.7;}
.status-text.finished { color: var(--ex-success); }
.status-label { font-size: 1.5rem; color: var(--ex-text); margin-bottom: 10px; opacity: 0.8;}
.status-subject { font-size: var(--ex-subject-size, 88px); color: var(--ex-accent); letter-spacing: 5px; line-height: 1.2; margin: 10px 0 30px 0; overflow-wrap: anywhere;}
.countdown-wrapper { background: rgba(0,0,0,0.2); padding: 25px; border-radius: 16px; border: 1px solid var(--ex-border);}
.countdown-label { font-size: 1.5rem; color: var(--ex-text); margin-bottom: 10px; }
.exam-countdown { font-size: var(--ex-countdown-size, 104px); color: var(--ex-success); font-family: monospace; line-height: 1; }
.text-danger { color: var(--ex-danger) !important; animation: blink 1s infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }

.study-mode-text { font-size: 3rem; color: var(--ex-success); letter-spacing: 2px; margin-top: 20px; padding: 20px; border: 2px dashed var(--ex-success); border-radius: 12px; background: rgba(16, 185, 129, 0.1);}

.status-text.break .status-next { margin-top: 20px; font-size: 2rem; color: var(--ex-text); }
.status-text.break .highlight { color: var(--ex-success); font-size: var(--ex-next-subject-size, 57px); margin: 15px 0; display: block; overflow-wrap: anywhere;}
.next-time { font-size: var(--ex-next-time-size, 30px); color: var(--ex-text); font-family: monospace; opacity: 0.8;}

/* 💡 預覽區提醒事項 CSS */
.exam-notes-display { margin-top: 30px; background: rgba(255,255,255,0.05); border: 2px dashed var(--ex-border); border-radius: 12px; padding: 20px; text-align: left; width: 100%;}
.notes-title { font-size: calc(var(--ex-notes-size, 24px) + 5px); margin: 0 0 15px 0; color: var(--ex-danger); border-bottom: 1px dashed var(--ex-border); padding-bottom: 10px;}
.notes-list-preview { margin: 0; padding-left: 30px; font-size: var(--ex-notes-size, 24px); line-height: 1.6; color: var(--ex-text); }
.notes-list-preview li { margin-bottom: 8px; }
</style>
