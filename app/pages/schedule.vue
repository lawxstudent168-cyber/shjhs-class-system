<template>
  <div class="schedule-page">
    <!-- 🔒 鎖定畫面 -->
    <div v-if="!isLoggedIn" class="login-container">
      <div class="login-card">
        <h2>🗓️ 班級課表管理</h2>
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

    <!-- 🗓️ 課表編輯區 -->
    <div v-else class="workspace">
      <header class="workspace-header">
        <h2>🗓️ 班級課表管理系統</h2>
        <div class="header-actions">
          <button @click="saveSchedule" class="btn-save" :disabled="isSaving">
            {{ isSaving ? '⏳ 儲存中...' : '💾 儲存並發布' }}
          </button>
          <button @click="logout" class="btn-logout">登出</button>
        </div>
      </header>

      <!-- 💡 大螢幕展示按鈕與首頁顯示設定 -->
      <div class="settings-section">
        <div class="settings-left">
          <h3 style="margin: 0 0 10px 0; color: #1e293b;">⚙️ 首頁顯示設定</h3>
          
          <label class="switch-label">
            <input type="checkbox" v-model="indexSettings.isVisible" class="large-checkbox" />
            <span style="font-weight: bold;">在首頁顯示「開啟大螢幕課表展示」按鈕</span>
          </label>
          
          <div class="visibility-options" :class="{ 'disabled-options': !indexSettings.isVisible }">
            <label><input type="radio" v-model="indexSettings.visibility" value="both" :disabled="!indexSettings.isVisible"> 內外網皆顯示</label>
            <label><input type="radio" v-model="indexSettings.visibility" value="inside" :disabled="!indexSettings.isVisible"> 僅在褐名單「內」顯示 (校內)</label>
            <label><input type="radio" v-model="indexSettings.visibility" value="outside" :disabled="!indexSettings.isVisible"> 僅在褐名單「外」顯示 (校外)</label>
          </div>

          <!-- 💡 新增：老師名稱隱私開關 -->
          <label class="switch-label" style="margin-top: 15px;">
            <input type="checkbox" v-model="indexSettings.teacherOnlyInBrownlist" class="large-checkbox" />
            <span style="font-weight: bold;">大課表「僅在褐名單內 (校內)」才顯示老師名稱</span>
          </label>
          <p style="font-size: 0.85rem; color: #64748b; margin: 5px 0 0 30px;">(打勾後，在校外網路查看大課表時，將自動隱藏教師姓名)</p>
        </div>
        
        <div class="settings-right">
          <button @click="openLargeSchedule" class="btn-large-preview">🖥️ 開啟大螢幕課表展示</button>
          <p style="font-size: 0.85rem; color: #64748b; margin-top: 5px;">適合投放至班級大平板或電子黑板</p>
        </div>
      </div>

      <div class="tips">
        💡 提示：請設定每節課的開始與結束時間 (24小時制，如 08:15)。首頁會自動根據當下時間顯示目前與下一節課。留空表示該時段沒有特定課程。
      </div>

      <!-- 👀 預覽首頁課表動態 -->
      <div class="preview-section">
        <h3>👀 預覽首頁顯示</h3>
        <div class="mock-controls">
          <label>假設今天是：</label>
          <select v-model="mockDay" class="mock-input">
            <option :value="1">星期一</option>
            <option :value="2">星期二</option>
            <option :value="3">星期三</option>
            <option :value="4">星期四</option>
            <option :value="5">星期五</option>
          </select>
          <label>假設時間：</label>
          <input type="time" v-model="mockTime" class="mock-input" />
        </div>
        
        <div v-if="previewDisplay" class="schedule-ticker">
          <div class="current-class">
            <span class="pulse-dot" v-if="previewDisplay.current.status === '上課中'"></span>
            <strong>{{ previewDisplay.current.label }}：</strong>
            <span class="subject-text">{{ previewDisplay.current.subject }}</span>
            <span class="teacher-text" v-if="previewDisplay.current.teacher">({{ previewDisplay.current.teacher }})</span>
          </div>
          <div class="next-class" v-if="previewDisplay.next">
            <strong>下節課：</strong>
            <span>{{ previewDisplay.next.subject }}</span>
          </div>
        </div>
        <div v-else class="schedule-ticker empty-ticker">
          （非上課日或設定無效，首頁將不會顯示課表提示）
        </div>
      </div>

      <div class="schedule-container">
        <table class="schedule-table">
          <thead>
            <tr>
              <th width="100">節次</th>
              <th width="140">時間設定</th>
              <th>星期一</th>
              <th>星期二</th>
              <th>星期三</th>
              <th>星期四</th>
              <th>星期五</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(period, pIndex) in scheduleData.periods" :key="'p-'+pIndex">
              <td class="period-name"><strong>{{ period.name }}</strong></td>
              <td class="time-inputs">
                <input type="time" v-model="period.startTime" class="time-ctrl" />
                <span>-</span>
                <input type="time" v-model="period.endTime" class="time-ctrl" />
              </td>
              <td v-for="day in 5" :key="'d-'+day">
                <div class="subject-input-group">
                  <input type="text" v-model="period.days[day-1].subject" placeholder="科目名稱" class="subject-input" />
                  <input type="text" v-model="period.days[day-1].teacher" placeholder="老師(選填)" class="teacher-input" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 💡 全螢幕大字體課表展示 Modal (後台預覽用) -->
    <div v-if="showLargeSchedule" class="large-schedule-overlay">
      <div class="large-header">
        <h1 class="large-title">📅 班級課表</h1>
        <button class="btn-close-large" @click="showLargeSchedule = false">✖ 關閉展示</button>
      </div>

      <div class="large-schedule-content">
        <!-- 桌機/平板：完整網格 -->
        <div class="desktop-grid">
          <div class="grid-header time-header">節次 / 時間</div>
          <div class="grid-header">星期一</div>
          <div class="grid-header">星期二</div>
          <div class="grid-header">星期三</div>
          <div class="grid-header">星期四</div>
          <div class="grid-header">星期五</div>
          
          <template v-for="(period, pIdx) in scheduleData.periods" :key="'lg-'+pIdx">
            <div class="grid-cell time-cell">
              <div class="p-name">{{ period.name }}</div>
              <div class="p-time">{{ period.startTime }} - {{ period.endTime }}</div>
            </div>
            <div v-for="day in 5" :key="'lgc-'+day" class="grid-cell subject-cell" :class="{'empty-cell': !period.days[day-1].subject}">
              <div class="cell-subject">{{ period.days[day-1].subject || '-' }}</div>
              <div class="cell-teacher" v-if="period.days[day-1].teacher">{{ period.days[day-1].teacher }}</div>
            </div>
          </template>
        </div>

        <!-- 手機：單日卡片清單 -->
        <div class="mobile-view">
          <div class="mobile-day-selector">
             <button v-for="d in 5" :key="'btn-'+d" 
                     :class="{active: mobileDay === d}" 
                     @click="mobileDay = d">星期{{ ['一','二','三','四','五'][d-1] }}</button>
          </div>
          <div class="mobile-list">
            <div v-for="(period, pIdx) in scheduleData.periods" :key="'ml-'+pIdx" class="mobile-card">
              <div class="m-time-box">
                <span class="m-name">{{ period.name }}</span>
                <span class="m-time">{{ period.startTime }} - {{ period.endTime }}</span>
              </div>
              <div class="m-subject-box" :class="{'m-empty': !period.days[mobileDay-1].subject}">
                 <div class="m-subject">{{ period.days[mobileDay-1].subject || '無課程' }}</div>
                 <div class="m-teacher" v-if="period.days[mobileDay-1].teacher">{{ period.days[mobileDay-1].teacher }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { beginVisitorSession, endVisitorSession, resumeVisitorSession } from '../utils/visitorTrackingClient.js'
import { ref, computed, onMounted } from 'vue'
const supabase = useSupabaseClient()

const isLoggedIn = ref(false)
const isLoggingIn = ref(false)
const passwordInput = ref('')
const isSaving = ref(false)

const mockDay = ref(1) // 1=星期一
const mockTime = ref('08:10')

// 大螢幕展示狀態與手機版日期
const showLargeSchedule = ref(false)
const mobileDay = ref(new Date().getDay() >= 1 && new Date().getDay() <= 5 ? new Date().getDay() : 1)

// 💡 首頁按鈕設定狀態 (加入 teacherOnlyInBrownlist)
const indexSettings = ref({
  isVisible: true,
  visibility: 'both', 
  teacherOnlyInBrownlist: true // 預設開啟保護
})

// 預設課表，包含早掃與午掃時間
const defaultSchedule = {
  periods: [
    { name: '早修', startTime: '07:30', endTime: '08:00', days: Array(5).fill().map(() => ({ subject: '', teacher: '' })) },
    { name: '早掃時間', startTime: '08:00', endTime: '08:15', days: Array(5).fill().map(() => ({ subject: '', teacher: '' })) },
    { name: '第一節', startTime: '08:20', endTime: '09:05', days: Array(5).fill().map(() => ({ subject: '', teacher: '' })) },
    { name: '第二節', startTime: '09:15', endTime: '10:00', days: Array(5).fill().map(() => ({ subject: '', teacher: '' })) },
    { name: '第三節', startTime: '10:10', endTime: '10:55', days: Array(5).fill().map(() => ({ subject: '', teacher: '' })) },
    { name: '第四節', startTime: '11:05', endTime: '11:50', days: Array(5).fill().map(() => ({ subject: '', teacher: '' })) },
    { name: '午餐和午掃', startTime: '11:50', endTime: '12:25', days: Array(5).fill().map(() => ({ subject: '', teacher: '' })) },
    { name: '午休', startTime: '12:25', endTime: '13:00', days: Array(5).fill().map(() => ({ subject: '', teacher: '' })) },
    { name: '第五節', startTime: '13:10', endTime: '13:55', days: Array(5).fill().map(() => ({ subject: '', teacher: '' })) },
    { name: '第六節', startTime: '14:05', endTime: '14:50', days: Array(5).fill().map(() => ({ subject: '', teacher: '' })) },
    { name: '第七節', startTime: '15:05', endTime: '15:50', days: Array(5).fill().map(() => ({ subject: '', teacher: '' })) },
    { name: '第八節', startTime: '16:00', endTime: '16:45', days: Array(5).fill().map(() => ({ subject: '', teacher: '' })) }
  ]
}

const scheduleData = ref(JSON.parse(JSON.stringify(defaultSchedule)))

const previewDisplay = computed(() => {
  if (!scheduleData.value || !scheduleData.value.periods) return null
  
  const currentDayIndex = mockDay.value - 1 
  if (currentDayIndex < 0 || currentDayIndex > 4) return null 
  
  if (!mockTime.value) return null
  const [nowH, nowM] = mockTime.value.split(':').map(Number)
  const nowMins = nowH * 60 + nowM
  
  let currentClass = { status: '下課中', label: '目前', subject: '休息時間', teacher: '' }
  let nextClass = null
  
  for (let i = 0; i < scheduleData.value.periods.length; i++) {
    const p = scheduleData.value.periods[i]
    if (!p.startTime || !p.endTime) continue
    
    const [sh, sm] = p.startTime.split(':').map(Number)
    const [eh, em] = p.endTime.split(':').map(Number)
    const startMins = sh * 60 + sm
    const endMins = eh * 60 + em
    
    const dayData = p.days[currentDayIndex]
    if (!dayData || !dayData.subject) continue
    
    if (nowMins >= startMins && nowMins <= endMins) {
      currentClass = { status: '上課中', label: p.name, subject: dayData.subject, teacher: dayData.teacher }
      
      for (let j = i + 1; j < scheduleData.value.periods.length; j++) {
        const nextP = scheduleData.value.periods[j]
        const nextDayData = nextP.days[currentDayIndex]
        if (nextDayData && nextDayData.subject) {
          nextClass = { subject: nextDayData.subject }
          break
        }
      }
      break
    }
    
    if (nowMins < startMins && !nextClass) {
      nextClass = { subject: dayData.subject }
    }
  }
  
  return { current: currentClass, next: nextClass }
})

onMounted(async () => {
  if (sessionStorage.getItem('schedule_admin_logged_in') === 'true') {
    void resumeVisitorSession('導師')
    isLoggedIn.value = true
    await fetchSchedule()
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
      sessionStorage.setItem('schedule_admin_logged_in', 'true'); void beginVisitorSession('導師', '導師密碼驗證')
      


      await fetchSchedule()
    } else {
      alert('❌ 密碼錯誤！')
    }
  } catch (e) {
    if (passwordInput.value === '168168168') { 
       isLoggedIn.value = true; 
       sessionStorage.setItem('schedule_admin_logged_in', 'true'); void beginVisitorSession('導師', '導師密碼驗證');

       await fetchSchedule() 
    }
    else alert('驗證發生錯誤。')
  } finally { isLoggingIn.value = false; passwordInput.value = '' }
}

const logout = () => { void endVisitorSession('導師登出'); sessionStorage.removeItem('schedule_admin_logged_in'); isLoggedIn.value = false; navigateTo('/') }

const fetchSchedule = async () => {
  // 載入課表資料
  const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'class_schedule_data').maybeSingle()
  
  if (data?.setting_value && data.setting_value.periods) {
    let loadedPeriods = data.setting_value.periods
    
    if (!loadedPeriods.find(p => p.name === '早掃時間')) {
      const idx = loadedPeriods.findIndex(p => p.name === '早修')
      if(idx !== -1) {
        loadedPeriods.splice(idx + 1, 0, { name: '早掃時間', startTime: '08:00', endTime: '08:15', days: Array(5).fill().map(() => ({ subject: '', teacher: '' })) })
      }
    }
    
    if (!loadedPeriods.find(p => p.name === '午餐和午掃') && !loadedPeriods.find(p => p.name === '午餐和午掃時間')) {
      const idx = loadedPeriods.findIndex(p => p.name === '第四節')
      if(idx !== -1) {
        loadedPeriods.splice(idx + 1, 0, { name: '午餐和午掃', startTime: '11:50', endTime: '12:25', days: Array(5).fill().map(() => ({ subject: '', teacher: '' })) })
      }
    }
    
    scheduleData.value.periods = loadedPeriods
  } else {
    scheduleData.value = JSON.parse(JSON.stringify(defaultSchedule))
  }

  // 載入首頁按鈕設定
  const { data: btnData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'schedule_button_settings').maybeSingle()
  if (btnData?.setting_value) {
    // 💡 確保讀取舊資料時保留預設值 (若無該欄位自動補上 true)
    indexSettings.value = { teacherOnlyInBrownlist: true, ...btnData.setting_value }
  }
}

const saveSchedule = async () => {
  isSaving.value = true
  try {
    // 儲存課表
    await supabase.from('system_settings').upsert({
      setting_key: 'class_schedule_data',
      setting_value: scheduleData.value
    }, { onConflict: 'setting_key' })

    // 儲存首頁按鈕設定
    await supabase.from('system_settings').upsert({
      setting_key: 'schedule_button_settings',
      setting_value: indexSettings.value
    }, { onConflict: 'setting_key' })
    
    alert('✅ 課表與顯示設定已成功儲存並同步！')
  } catch (err) {
    alert('❌ 儲存失敗：' + err.message)
  } finally {
    isSaving.value = false
  }
}

const openLargeSchedule = () => {
  showLargeSchedule.value = true
  // 開啟全螢幕時，確保手機版預設日期正確
  mobileDay.value = new Date().getDay() >= 1 && new Date().getDay() <= 5 ? new Date().getDay() : 1
}
</script>

<style scoped>
.schedule-page { min-height: 100vh; background: #f1f5f9; font-family: sans-serif; padding-bottom: 50px;}
.login-container { display: flex; justify-content: center; align-items: center; min-height: 80vh; padding: 20px; }
.login-card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; }
.subtitle { color: #64748b; margin-bottom: 20px; }
.form-group { margin-bottom: 20px; text-align: left; }
.form-control { width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; }
.btn-submit { width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
.back-link { margin-top: 15px; }

.workspace { padding: 20px; max-width: 1400px; margin: 0 auto; }
.workspace-header { 
  display: flex; justify-content: space-between; align-items: center; 
  background: white; padding: 15px 25px; border-radius: 8px; margin-bottom: 15px; 
  box-shadow: 0 2px 4px rgba(0,0,0,0.05); flex-wrap: wrap; gap: 15px;
}
.workspace-header h2 { margin: 0; color: #1e3a8a; }

.header-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.btn-save { background: #10b981; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; }
.btn-logout { background: #ef4444; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; }

/* 首頁設定與大螢幕按鈕區塊 */
.settings-section {
  display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;
  background: #f8fafc; padding: 20px 25px; border-radius: 8px; border: 2px dashed #94a3b8; margin-bottom: 20px;
}
.settings-left { flex: 1; min-width: 300px; }
.switch-label { display: flex; align-items: center; gap: 10px; font-size: 1.1rem; color: #334155; cursor: pointer; margin-bottom: 10px;}
.large-checkbox { transform: scale(1.3); cursor: pointer; }
.visibility-options { display: flex; gap: 15px; margin-left: 30px; margin-top: 10px; flex-wrap: wrap;}
.visibility-options label { color: #475569; font-weight: bold; cursor: pointer; }
.disabled-options { opacity: 0.5; pointer-events: none; }
.settings-right { text-align: center; }
.btn-large-preview { background: #8b5cf6; color: white; border: none; padding: 15px 25px; border-radius: 8px; font-weight: bold; font-size: 1.1rem; cursor: pointer; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.3); transition: 0.2s transform;}
.btn-large-preview:hover { transform: scale(1.02); background: #7c3aed;}

.tips { background: #fffbeb; color: #b45309; padding: 10px 15px; border-radius: 6px; border: 1px dashed #fcd34d; margin-bottom: 20px; font-size: 0.95rem; line-height: 1.5; }

/* 預覽區塊樣式 */
.preview-section { background: white; padding: 15px 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
.preview-section h3 { margin: 0 0 10px 0; font-size: 1.1rem; color: #475569; }
.mock-controls { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; }
.mock-input { padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-weight: bold; color: #1e293b; }

.schedule-ticker { 
  background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 10px 15px;
  display: flex; justify-content: center; gap: 20px; align-items: center; flex-wrap: wrap;
}
.empty-ticker { color: #94a3b8; font-style: italic; }
.current-class { color: #0f766e; font-size: 1.1rem; display: flex; align-items: center; gap: 6px;}
.pulse-dot { width: 10px; height: 10px; background-color: #10b981; border-radius: 50%; animation: pulse 2s infinite; }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); } 70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
.subject-text { font-weight: bold; color: #047857;}
.teacher-text { font-size: 0.95rem; color: #475569; }
.next-class { color: #64748b; font-size: 1rem; border-left: 2px solid #cbd5e1; padding-left: 20px; }

.schedule-container { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow-x: auto; }
.schedule-table { width: 100%; min-width: 1000px; border-collapse: collapse; text-align: center; }
.schedule-table th, .schedule-table td { border: 1px solid #cbd5e1; padding: 10px; }
.schedule-table th { background: #f8fafc; color: #334155; font-size: 1.1rem; }
.period-name { background: #f1f5f9; color: #0f172a; }

.time-inputs { display: flex; align-items: center; justify-content: center; gap: 5px; }
.time-ctrl { padding: 4px; border: 1px solid #94a3b8; border-radius: 4px; font-family: monospace; font-size: 0.9rem;}

.subject-input-group { display: flex; flex-direction: column; gap: 5px; }
.subject-input { padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-weight: bold; text-align: center; color: #1e293b;}
.subject-input:focus { border-color: #3b82f6; outline: none; background: #eff6ff;}
.teacher-input { padding: 4px; border: 1px dashed #cbd5e1; border-radius: 4px; font-size: 0.85rem; text-align: center; color: #64748b;}

/* 全螢幕大課表樣式 (Responsive) */
.large-schedule-overlay { 
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
  background: #f8fafc; z-index: 9999; display: flex; flex-direction: column; overflow-y: auto; 
}
.large-header { 
  padding: 15px 30px; background: #1e293b; color: white; 
  display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 10; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}
.large-title { margin: 0; font-size: 1.8rem; letter-spacing: 2px;}
.btn-close-large { background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 1.1rem; font-weight: bold; cursor: pointer; }

.large-schedule-content { padding: 20px; flex: 1; max-width: 1600px; margin: 0 auto; width: 100%; box-sizing: border-box;}

/* 桌機版網格 */
.desktop-grid { display: grid; grid-template-columns: 180px repeat(5, 1fr); gap: 15px; }
.grid-header { background: #e2e8f0; color: #0f172a; font-size: 1.5rem; font-weight: bold; padding: 15px; text-align: center; border-radius: 8px;}
.time-header { background: #94a3b8; color: white; }

.grid-cell { background: white; border: 2px solid #cbd5e1; border-radius: 8px; padding: 15px; text-align: center; display: flex; flex-direction: column; justify-content: center; min-height: 100px;}
.time-cell { background: #f1f5f9; border-color: #94a3b8; }
.p-name { font-size: 1.4rem; font-weight: bold; color: #334155; margin-bottom: 5px;}
.p-time { font-size: 1.1rem; color: #64748b; font-family: monospace; font-weight: bold;}

.subject-cell { box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
.empty-cell { background: #f8fafc; border-style: dashed; opacity: 0.6; }
.cell-subject { font-size: 2.2rem; font-weight: bold; color: #0f766e; margin-bottom: 5px; }
.cell-teacher { font-size: 1.3rem; color: #0369a1; font-weight: bold;}

/* 手機版隱藏 */
.mobile-view { display: none; }

/* RWD: 手機與小平板切換至卡片模式 */
@media (max-width: 900px) {
  .desktop-grid { display: none; }
  .mobile-view { display: block; }
  
  .mobile-day-selector { display: flex; overflow-x: auto; gap: 10px; padding-bottom: 15px; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0;}
  .mobile-day-selector button { flex: 1; min-width: 80px; padding: 12px; background: white; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 1.1rem; font-weight: bold; color: #475569;}
  .mobile-day-selector button.active { background: #3b82f6; color: white; border-color: #2563eb; }

  .mobile-list { display: flex; flex-direction: column; gap: 12px; }
  .mobile-card { display: flex; background: white; border: 2px solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05);}
  .m-time-box { background: #f1f5f9; width: 120px; padding: 15px 10px; display: flex; flex-direction: column; justify-content: center; align-items: center; border-right: 2px solid #cbd5e1;}
  .m-name { font-size: 1.2rem; font-weight: bold; color: #334155; margin-bottom: 5px;}
  .m-time { font-size: 0.95rem; color: #64748b; font-weight: bold;}
  
  .m-subject-box { flex: 1; padding: 15px; display: flex; flex-direction: column; justify-content: center; align-items: center;}
  .m-empty { background: #f8fafc; opacity: 0.6; }
  .m-subject { font-size: 1.8rem; font-weight: bold; color: #0f766e; text-align: center;}
  .m-teacher { font-size: 1.1rem; color: #0369a1; font-weight: bold; margin-top: 5px;}
}
</style>
