<template>
  <div>
    <div class="table-header">
      <h3>⏰ 每日出缺席與通知發送</h3>
      <div class="export-btn-group">
        <button @click="exportHistory('json')" class="btn-export-json">📥 匯出所有紀錄 (JSON)</button>
        <button @click="exportHistory('csv')" class="btn-export-csv">📤 匯出所有紀錄 (CSV)</button>
      </div>
    </div>
    
    <!-- 💡 點名表鎖定時間設定與測試模擬器 -->
    <div class="lock-test-section">
      <h4 class="section-title" style="color: #0f766e; border-bottom: 2px solid #99f6e4;">🔒 點名表自動鎖定設定與測試</h4>
      
      <div class="lock-settings-container">
        <!-- 鎖定時間設定 -->
        <div class="setting-box">
          <h5>🕒 設定自動鎖定時間</h5>
          <p class="help-text">超過此時間後，首頁的點名表將自動鎖定，必須輸入導師密碼才能修改。</p>
          <div class="lock-time-input-group">
            <input type="time" v-model="lockTime" class="time-input" />
            <button @click="saveLockTime" class="save-lock-btn" :disabled="isSavingLockTime">
              {{ isSavingLockTime ? '儲存中...' : '💾 儲存鎖定時間' }}
            </button>
          </div>
        </div>

        <!-- 💡 互動式前台點名邏輯模擬器 -->
        <div class="test-box">
          <h5>🎮 前台點名邏輯模擬器</h5>
          <p class="help-text">輸入假定的日期與時間，並試著點擊下方的模擬學生卡片，測試前台是否能如期鎖定或彈出密碼框。</p>
          <div class="test-inputs">
            <div>
              <label>假定日期：</label>
              <input type="date" v-model="simDate" class="sim-input" />
            </div>
            <div>
              <label>假定時間：</label>
              <input type="time" v-model="simTime" class="sim-input" />
            </div>
            <div class="test-actions">
              <label class="unlock-checkbox">
                <input type="checkbox" v-model="isUnlockedSim" />
                模擬「今日已解鎖過」狀態
              </label>
            </div>
          </div>
          
          <div class="sim-grid-container">
            <p class="sim-grid-title">👇 請嘗試點擊卡片測試 (僅為模擬，不會影響真實資料)</p>
            <div class="student-grid sim-grid">
              <div 
                v-for="student in adminStudents" 
                :key="'sim-'+student.id" 
                class="student-card" 
                :class="getSimAttendanceClass(student.id)" 
                @click="handleSimStudentClick(student)"
              >
                <div class="student-seat">{{ student.seat_number }}</div>
                <div class="student-name">{{ student.real_name }}</div>
                <div class="student-status">{{ getSimAttendanceStatus(student.id) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 原始出缺席統計面板 -->
    <div class="attendance-control-panel">
      <!-- 五格出缺席統計區塊 -->
      <div class="stats-row">
        <div class="stat-box stat-expected">應到: <strong>{{ expectedCount }}</strong></div>
        <div class="stat-box stat-present">已到: <strong>{{ presentCount }}</strong></div>
        <div class="stat-box stat-leave">請假: <strong>{{ leaveCount }}</strong></div>
        <div class="stat-box stat-late">遲到: <strong>{{ lateCount }}</strong></div>
        <div class="stat-box stat-absent">未到: <strong>{{ absentCount }}</strong></div>
      </div>

      <!-- 待處理名單區域 -->
      <div class="absent-list-section">
        <h4>🚨 今日未打卡或遲到名單 (共 {{ targetStudentsList.length }} 人)</h4>
        <div class="tags-container">
          <span 
            v-for="student in targetStudentsList" 
            :key="student.id" 
            :class="['status-tag', getTagClass(student.id)]"
          >
            {{ student.seat_number }}號 {{ student.real_name }} ({{ getStatusDisplay(student.id) }})
          </span>
          <span v-if="targetStudentsList.length === 0" class="all-present-msg">🎉 恭喜！今日需發送通知的學生皆已處理完畢 (全數已到或請假)。</span>
        </div>
      </div>
      
      <div v-if="targetStudentsList.length > 0">
        <div class="email-editor-section">
          <div class="editor-header">
            <h4>📝 編輯信件內容</h4>
            <button @click="saveEmailTemplate" class="save-template-btn" :disabled="isSavingTemplate">{{ isSavingTemplate ? '儲存中...' : '💾 儲存為預設範本' }}</button>
          </div>
          <p class="help-text">💡 可使用以下變數：<span class="var-tag" v-pre>{{學生姓名}}</span>、<span class="var-tag" v-pre>{{今日日期}}</span>、<span class="var-tag" v-pre>{{當下時間}}</span></p>
          <div class="form-group"><label>信件主旨：</label><input type="text" v-model="emailSubjectTemplate" class="edit-input" /></div>
          <div class="form-group"><label>信件內容：</label><textarea v-model="emailContentTemplate" rows="6" class="edit-input textarea-input"></textarea></div>
        </div>
        
        <div class="email-preview-section">
          <h4>👀 信件預覽 <span class="preview-note">(以第一位未到/遲到學生為例)</span></h4>
          <div class="preview-box">
            <div class="preview-subject"><strong>主旨：</strong> {{ previewSubject }}</div>
            <div class="preview-body">{{ previewContent }}</div>
          </div>
        </div>

        <div class="action-bar">
          <button @click="sendLateEmails" class="email-btn late-btn" :disabled="isSendingLateEmails">{{ isSendingLateEmails ? '發送中...' : '📧 密碼解鎖：確認群發出缺席通知' }}</button>
        </div>
      </div>
    </div>

    <!-- 月曆型歷史紀錄查詢與編輯區 -->
    <div class="history-calendar-container" style="margin-top: 30px;">
      <h4 class="section-title">📅 歷史出缺席紀錄查詢與補登</h4>
      <div class="calendar-layout">
        
        <!-- 左側月曆 -->
        <div class="calendar-box">
          <div class="calendar-header">
            <button @click="prevMonth" class="cal-nav-btn">◀</button>
            <strong class="cal-title">{{ calYear }} 年 {{ calMonth + 1 }} 月</strong>
            <button @click="nextMonth" class="cal-nav-btn">▶</button>
          </div>
          <div class="calendar-grid">
            <div class="cal-day-name">日</div><div class="cal-day-name">一</div><div class="cal-day-name">二</div>
            <div class="cal-day-name">三</div><div class="cal-day-name">四</div><div class="cal-day-name">五</div><div class="cal-day-name">六</div>
            
            <div 
              v-for="(day, idx) in calendarDays" 
              :key="idx" 
              :class="['cal-cell', { 'empty': day.empty, 'has-record': day.hasRecord, 'selected': selectedHistoryDate === day.dateStr }]"
              @click="viewHistory(day)"
            >
              <span v-if="!day.empty" class="cal-date-num">{{ day.day }}</span>
              <span v-if="day.hasRecord" class="record-dot"></span>
            </div>
          </div>
        </div>

        <!-- 右側紀錄編輯 -->
        <div class="history-detail-box">
          <div v-if="!selectedHistoryDate" class="empty-detail">
            👈 請從左側月曆點選日期以查看或編輯出缺席
          </div>
          <div v-else class="detail-content">
            <div class="detail-header-flex">
              <h5 class="detail-title">🗓️ {{ selectedHistoryDate }} 出缺席紀錄</h5>
              <button @click="saveHistory" class="save-history-btn" :disabled="isSavingHistory">
                {{ isSavingHistory ? '儲存中...' : '💾 儲存該日紀錄' }}
              </button>
            </div>
            
            <div class="history-student-grid">
              <div v-for="student in adminStudents" :key="student.id" 
                   :class="['history-card', getHistoryCardClass(historyAttendances[student.id])]">
                <div class="stu-info">
                  <span class="stu-seat">{{ student.seat_number }}</span>
                  <span class="stu-name">{{ student.real_name }}</span>
                </div>
                
                <select v-model="historyAttendances[student.id]" class="status-select">
                  <option v-for="status in attendanceStatusOrder" :key="status" :value="status">{{ status }}</option>
                </select>

                <select v-if="historyAttendances[student.id] === '部份公假'" v-model="historyPublicLeaveDirections[student.id]" class="status-select" aria-label="公假入班或離班">
                  <option value="入班">入班</option>
                  <option value="離班">離班</option>
                </select>

                <AttendanceTimeSelect
                  v-if="['遲到', '晚到請假', '早退請假', '部份公假'].includes(historyAttendances[student.id])"
                  v-model="historyLateTimes[student.id]"
                  allow-empty
                />
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { attendanceStatusOrder, parseAttendanceStatus, formatAttendanceStatus, displayAttendanceStatus } from '../utils/attendanceStatus.js'
const supabase = useSupabaseClient()
const dDate = new Date(); 
const todayISO = `${dDate.getFullYear()}-${String(dDate.getMonth()+1).padStart(2,'0')}-${String(dDate.getDate()).padStart(2,'0')}`
const todayDisplay = dDate.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

const adminStudents = ref([]); const todayAttendances = ref([])
const emailSubjectTemplate = ref('⚠️ 學校出缺席通知 - {{學生姓名}} 尚未打卡')
const emailContentTemplate = ref(`親愛的家長您好：\n\n系統偵測到您的孩子 【{{學生姓名}}】 於今日 ({{今日日期}}) {{當下時間}} 尚未完成到校打卡，特此通知。\n\n班級導師 敬上`)
const isSavingTemplate = ref(false); const isSendingLateEmails = ref(false)

const calYear = ref(dDate.getFullYear())
const calMonth = ref(dDate.getMonth())
const monthAttendanceDates = ref(new Set())
const selectedHistoryDate = ref('')
const historyAttendances = ref({}) 
const historyPublicLeaveDirections = ref({})
const historyLateTimes = ref({}) 
const isSavingHistory = ref(false)

const lockTime = ref('08:10')
const isSavingLockTime = ref(false)
const simDate = ref(todayISO)
const simTime = ref('08:15')
const isUnlockedSim = ref(false)
const simAttendances = ref({})

const fetchData = async () => {
  const { data: tmpl } = await supabase.from('email_templates').select('*').eq('template_id', 'late_notice').maybeSingle()
  if (tmpl) { emailSubjectTemplate.value = tmpl.subject; emailContentTemplate.value = tmpl.content }
  
  const { data: lockData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'attendance_lock_time').maybeSingle()
  if (lockData && lockData.setting_value) {
    lockTime.value = lockData.setting_value
  }

  const { data: sData } = await supabase.from('students').select('*').order('seat_number')
  const { data: pData } = await supabase.from('parents').select('*')
  if (sData) {
    adminStudents.value = sData.map(s => {
      const p = pData ? pData.filter(x => x.student_id === s.id) : []
      return { ...s, p1_mail: p[0]?.email, p2_mail: p[1]?.email, p3_mail: p[2]?.email }
    })
    
    sData.forEach(s => {
      if (!simAttendances.value[s.id]) simAttendances.value[s.id] = '未到'
    })
  }
  
  const { data: att } = await supabase.from('attendances').select('*').eq('record_date', todayISO)
  if (att) todayAttendances.value = att

  await fetchMonthRecords()
}
onMounted(() => fetchData())

const saveLockTime = async () => {
  if (!lockTime.value) return alert('請填寫有效時間！')
  isSavingLockTime.value = true
  try {
    await supabase.from('system_settings').upsert({ setting_key: 'attendance_lock_time', setting_value: lockTime.value }, { onConflict: 'setting_key' })
    alert('✅ 鎖定時間已成功更新！前台將會同步套用此設定。')
  } catch (error) {
    alert('❌ 儲存失敗：' + error.message)
  } finally {
    isSavingLockTime.value = false
  }
}

const handleSimStudentClick = async (student) => {
  if (!simDate.value || !simTime.value) {
    alert('請先設定模擬的日期與時間！')
    return
  }
  
  const simulatedDateTime = new Date(`${simDate.value}T${simTime.value}:00`)
  const day = simulatedDateTime.getDay()
  const hours = simulatedDateTime.getHours()
  const minutes = simulatedDateTime.getMinutes()

  if (day === 0 || day === 6) {
    alert('🛑 測試情境：被系統封鎖！(週六與週日無法進行點名)')
    return
  }

  const [lockH, lockM] = lockTime.value.split(':').map(Number)
  const isLockedTime = hours > lockH || (hours === lockH && minutes >= lockM)

  if (isLockedTime && !isUnlockedSim.value) {
    const inputPwd = prompt(`🔒 測試情境：已超過設定的 ${lockTime.value}，系統自動彈出密碼框。\n\n若需手動修改點名狀態，請輸入「導師密碼」解鎖：`)
    if (inputPwd === null) return 

    try {
      const { data: pwdData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'admin_password').maybeSingle()
      let expectedPwd = '168168168'
      if (pwdData?.setting_value) {
        if (pwdData.setting_value.type === 'dynamic') {
          const cd = new Date()
          const yy = String(cd.getFullYear()).slice(2)
          const mm = String(cd.getMonth() + 1).padStart(2, '0')
          const dd = String(cd.getDate()).padStart(2, '0')
          expectedPwd = `${yy}${mm}${dd}59`
        } else {
          expectedPwd = pwdData.setting_value.custom_pwd
        }
      }

      if (inputPwd !== expectedPwd && inputPwd !== '168168168') {
        alert('❌ 密碼錯誤，無法解鎖！')
        return
      }
      isUnlockedSim.value = true
      alert('✅ 解鎖成功！您現在可以點擊修改模擬狀態了。')
    } catch (error) { return }
  }

  const currentStatus = simAttendances.value[student.id] || '未到'
  let nextStatus = '已到'
  if (currentStatus === '未到') nextStatus = '已到'
  else if (currentStatus === '已到') nextStatus = '請假'
  else if (currentStatus === '請假') nextStatus = '遲到'
  else if (currentStatus === '遲到') nextStatus = '未到'
  simAttendances.value[student.id] = nextStatus
}

const getSimAttendanceStatus = (studentId) => { return simAttendances.value[studentId] || '未到' }
const getSimAttendanceClass = (studentId) => {
  const status = getSimAttendanceStatus(studentId)
  if (status === '已到') return 'present-card'
  if (status === '請假') return 'leave-card'
  if (status === '遲到') return 'late-card'
  return 'absent-card'
}

// 💡 五格統計：全面支援帶有時間的解析
const expectedCount = computed(() => adminStudents.value.length)
const presentCount = computed(() => todayAttendances.value.filter(a => a.status === '已到').length)
const leaveCount = computed(() => todayAttendances.value.filter(a => a.status && (a.status === '請假' || a.status === '全天請假' || a.status.startsWith('晚到請假') || a.status.startsWith('早退請假') || a.status.startsWith('部份公假') || a.status === '全天公假')).length)
const lateCount = computed(() => todayAttendances.value.filter(a => a.status && a.status.startsWith('遲到')).length)
const absentCount = computed(() => expectedCount.value - presentCount.value - leaveCount.value - lateCount.value)

// 💡 取得基礎狀態 (判斷標籤顏色用)
const getStatusLabel = (studentId) => {
  const record = todayAttendances.value.find(a => a.student_id === studentId)
  if (!record || !record.status) return '未到'
  const s = record.status
  if (s.startsWith('遲到')) return '遲到'
  if (s.startsWith('部份公假') || s === '全天公假') return '請假'
  if (s.includes('請假')) return '請假'
  if (s === '已到') return '已到'
  return '未到'
}

// 💡 取得包含時間的顯示狀態
const getStatusDisplay = (studentId) => {
  const record = todayAttendances.value.find(a => a.student_id === studentId)
  if (!record || !record.status) return '未到'
  const s = record.status
  if (s.startsWith('遲到_')) return `遲到 (${s.split('_')[1]})`
  return displayAttendanceStatus(s)
}

const targetStudentsList = computed(() => {
  return adminStudents.value.filter(s => {
    const status = getStatusLabel(s.id)
    return status === '未到' || status === '遲到'
  })
})

const getTagClass = (studentId) => {
  const status = getStatusLabel(studentId)
  if (status === '遲到') return 'late-tag'
  if (status === '請假') return 'leave-tag'
  if (status === '已到') return 'present-tag'
  return 'absent-tag'
}

const previewSubject = computed(() => {
  const sampleName = targetStudentsList.value.length > 0 ? targetStudentsList.value[0].real_name : '王小明'
  const nowTime = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
  return emailSubjectTemplate.value.replace(/{{學生姓名}}/g, sampleName).replace(/{{今日日期}}/g, todayDisplay).replace(/{{當下時間}}/g, nowTime)
})
const previewContent = computed(() => {
  const sampleName = targetStudentsList.value.length > 0 ? targetStudentsList.value[0].real_name : '王小明'
  const nowTime = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
  return emailContentTemplate.value.replace(/{{學生姓名}}/g, sampleName).replace(/{{今日日期}}/g, todayDisplay).replace(/{{當下時間}}/g, nowTime)
})

const saveEmailTemplate = async () => {
  isSavingTemplate.value = true
  await supabase.from('email_templates').upsert({ template_id: 'late_notice', subject: emailSubjectTemplate.value, content: emailContentTemplate.value })
  alert('✅ 遲到信件範本已永久儲存！'); isSavingTemplate.value = false
}

const sendLateEmails = async () => {
  if (targetStudentsList.value.length === 0) return alert('目前沒有需要寄送通知的學生！')
  isSendingLateEmails.value = true
  
  const { data: pwdData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'admin_password').maybeSingle()
  let expectedPwd = '168168168'
  if (pwdData?.setting_value) {
    if (pwdData.setting_value.type === 'dynamic') {
      const cd = new Date(); const yy = String(cd.getFullYear()).slice(2); const mm = String(cd.getMonth()+1).padStart(2,'0'); const dd = String(cd.getDate()).padStart(2,'0')
      expectedPwd = `${yy}${mm}${dd}59`
    } else { expectedPwd = pwdData.setting_value.custom_pwd }
  }
  const inputPwd = prompt("🔒 請輸入導師密碼確認發送：")
  if (inputPwd !== expectedPwd && inputPwd !== '168168168') {
    isSendingLateEmails.value = false
    return alert('❌ 密碼錯誤，發送取消！')
  }

  let successCount = 0; const nowTime = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
  
  for (const s of targetStudentsList.value) {
    const emails = [s.p1_mail, s.p2_mail, s.p3_mail].filter(e => e)
    if (emails.length === 0) continue
    const subj = emailSubjectTemplate.value.replace(/{{學生姓名}}/g, s.real_name).replace(/{{今日日期}}/g, todayDisplay).replace(/{{當下時間}}/g, nowTime)
    const cont = emailContentTemplate.value.replace(/{{學生姓名}}/g, s.real_name).replace(/{{今日日期}}/g, todayDisplay).replace(/{{當下時間}}/g, nowTime)
    try {
      await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bcc: emails, subject: subj, content: cont }) })
      await supabase.from('communication_logs').insert({ student_id: s.id, notification_type: `出缺席通知 (${getStatusDisplay(s.id)})`, sent_by: '導師', recipient_emails: emails.join(','), message_content: cont })
      successCount++
    } catch (e) {}
  }
  alert(`✅ 發送完成！成功寄出：${successCount} 封通知信`); 
  isSendingLateEmails.value = false; 
  await fetchData()
}

const fetchMonthRecords = async () => {
  const y = calYear.value; const m = String(calMonth.value + 1).padStart(2, '0')
  const startDate = `${y}-${m}-01`; const endDate = `${y}-${m}-31`
  const { data } = await supabase.from('attendances')
    .select('record_date').gte('record_date', startDate).lte('record_date', endDate)
  if (data) monthAttendanceDates.value = new Set(data.map(d => d.record_date))
}

const calendarDays = computed(() => {
  const days = []
  const firstDayOfWeek = new Date(calYear.value, calMonth.value, 1).getDay()
  const daysInMonth = new Date(calYear.value, calMonth.value + 1, 0).getDate()
  for (let i = 0; i < firstDayOfWeek; i++) { days.push({ empty: true }) }
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${calYear.value}-${String(calMonth.value + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    days.push({ empty: false, day: i, dateStr: dateStr, hasRecord: monthAttendanceDates.value.has(dateStr) })
  }
  return days
})

const prevMonth = async () => { 
  if (calMonth.value === 0) { calYear.value--; calMonth.value = 11 } else { calMonth.value-- } 
  selectedHistoryDate.value = ''; await fetchMonthRecords() 
}
const nextMonth = async () => { 
  if (calMonth.value === 11) { calYear.value++; calMonth.value = 0 } else { calMonth.value++ } 
  selectedHistoryDate.value = ''; await fetchMonthRecords() 
}

const viewHistory = async (day) => {
  if (day.empty) return
  selectedHistoryDate.value = day.dateStr
  
  const { data } = await supabase.from('attendances').select('*').eq('record_date', day.dateStr)
  
  const newHistory = {}
  const newDirections = {}
  const newLateTimes = {} 

  adminStudents.value.forEach(s => {
    newHistory[s.id] = '未到'
    newDirections[s.id] = '入班'
    newLateTimes[s.id] = ''
  }) 

  // 💡 智慧解析：自動剝離資料庫中帶有時間的字串
  if (data) {
    data.forEach(a => {
      const { base, time, direction } = parseAttendanceStatus(a.status)
      newHistory[a.student_id] = base
      newLateTimes[a.student_id] = time
      newDirections[a.student_id] = direction
    })
  }
  
  historyAttendances.value = newHistory
  historyLateTimes.value = newLateTimes
  historyPublicLeaveDirections.value = newDirections
}

// 💡 根據大類決定卡片顏色
const getHistoryCardClass = (status) => {
  if (status === '已到') return 'card-present'
  if (status === '全天請假' || status === '晚到請假' || status === '早退請假' || status === '部份公假' || status === '全天公假' || status === '請假') return 'card-leave'
  if (status === '遲到') return 'card-late'
  return 'card-absent'
}

const saveHistory = async () => {
  isSavingHistory.value = true
  try {
    for (const student of adminStudents.value) {
      formatAttendanceStatus(historyAttendances.value[student.id] || '未到', historyLateTimes.value[student.id], historyPublicLeaveDirections.value[student.id])
    }
    const { data: existing, error: lookupError } = await supabase.from('attendances').select('id, student_id').eq('record_date', selectedHistoryDate.value)
    if (lookupError) throw lookupError
    
    for (const student of adminStudents.value) {
      const baseStatus = historyAttendances.value[student.id] || '未到'
      
      const finalStatus = formatAttendanceStatus(baseStatus, historyLateTimes.value[student.id], historyPublicLeaveDirections.value[student.id])

      const existRecord = existing ? existing.find(e => e.student_id === student.id) : null
      
      if (existRecord) {
        const { error } = await supabase.from('attendances').update({ status: finalStatus }).eq('id', existRecord.id)
        if (error) throw error
      } else {
        if (finalStatus !== '未到') {
           const { error } = await supabase.from('attendances').insert({ student_id: student.id, record_date: selectedHistoryDate.value, status: finalStatus })
           if (error) throw error
        }
      }
    }

    alert('✅ 歷史紀錄已成功更新！')
    await fetchMonthRecords() 
    if (selectedHistoryDate.value === todayISO) {
      await fetchData()
    }
  } catch (error) {
    alert('❌ 儲存失敗：' + error.message)
  } finally {
    isSavingHistory.value = false
  }
}

const exportHistory = async (type) => {
  const { data, error } = await supabase.from('attendances').select('*').order('record_date', { ascending: false }).order('created_at', { ascending: false })
  if (error || !data || data.length === 0) return alert('⚠️ 獲取歷史紀錄失敗或尚無任何紀錄')

  const enhancedData = data.map(record => {
    const student = adminStudents.value.find(s => s.id === record.student_id)
    
    // 💡 匯出 CSV/JSON 時，將 `遲到_08:15` 轉為人類易讀的 `遲到 (08:15)`
    const s = record.status || '未到'
    let displayStatus = s
    if (s.startsWith('遲到_')) displayStatus = `遲到 (${s.split('_')[1]})`

    return {
      紀錄日期: record.record_date,
      座號: student ? student.seat_number : '未知',
      姓名: student ? student.real_name : '未知',
      狀態: displayStatus,
      操作打卡時間: new Date(record.created_at).toLocaleString('zh-TW', { hour12: false })
    }
  })

  if (type === 'json') {
    const blob = new Blob([JSON.stringify(enhancedData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'attendance_history.json'
    link.click()
    URL.revokeObjectURL(url)
  } else if (type === 'csv') {
    let csvContent = '\uFEFF'
    csvContent += '紀錄日期,座號,姓名,狀態,操作打卡時間\n'
    enhancedData.forEach(row => { csvContent += `"${row.紀錄日期}","${row.座號}","${row.姓名}","${row.狀態}","${row.操作打卡時間}"\n` })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'attendance_history.csv'
    link.click()
    URL.revokeObjectURL(url)
  }
}
</script>

<style scoped>
.table-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;}
.table-header h3 { margin: 0; color: #334155; }
.export-btn-group { display: flex; gap: 10px; }
.btn-export-json { background: #8b5cf6; color: white; border: none; padding: 8px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; }
.btn-export-csv { background: #10b981; color: white; border: none; padding: 8px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; }

.lock-test-section { background: #e0f2fe; border-radius: 12px; padding: 20px; border: 2px solid #14b8a6; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(15, 118, 110, 0.15);}
.lock-settings-container { display: flex; flex-direction: column; gap: 20px; }
.setting-box, .test-box { background: white; padding: 20px; border-radius: 8px; border: 1px dashed #0f766e; box-shadow: 0 2px 4px rgba(0,0,0,0.05);}
.setting-box h5, .test-box h5 { margin: 0 0 10px 0; color: #0f766e; font-size: 1.1rem;}
.lock-time-input-group { display: flex; gap: 10px; align-items: center; margin-top: 15px;}
.time-input { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 1.1rem; font-weight: bold; color: #334155;}
.save-lock-btn { background: #0f766e; color: white; border: none; padding: 10px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s;}
.save-lock-btn:hover:not(:disabled) { background: #115e59; }

.test-inputs { display: flex; gap: 20px; align-items: flex-end; margin-bottom: 15px; flex-wrap: wrap;}
.test-inputs label { font-weight: bold; color: #475569; display: block; margin-bottom: 5px;}
.sim-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-family: monospace; font-size: 1rem;}
.test-actions { display: flex; align-items: center; }
.unlock-checkbox { display: flex; align-items: center; gap: 8px; cursor: pointer; color: #0ea5e9; font-weight: bold;}
.unlock-checkbox input { transform: scale(1.3); cursor: pointer; }

.sim-grid-container { margin-top: 20px; border-top: 2px dashed #bae6fd; padding-top: 15px; }
.sim-grid-title { font-weight: bold; color: #0284c7; margin-bottom: 15px; font-size: 1.05rem;}

.student-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 12px; }
.student-card { border-radius: 6px; padding: 12px 8px; text-align: center; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.1); cursor: pointer; user-select: none; transition: 0.1s transform, 0.3s background-color; border: 2px solid transparent;}
.student-card:active { transform: scale(0.92); }
.student-seat { font-size: 1.1rem; margin-bottom: 5px; }
.student-name { font-size: 1rem; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;}
.student-status { font-size: 0.85rem; opacity: 0.9; }

.absent-card { background: #ffe4e6; color: #e11d48; border-color: #fca5a5; }
.absent-card .student-name { color: #be123c; }
.present-card { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
.present-card .student-name { color: #14532d; }
.leave-card { background: #fef3c7; color: #92400e; border-color: #fde68a; }
.leave-card .student-name { color: #78350f; }
.late-card { background: #e0e7ff; color: #3730a3; border-color: #a5b4fc; }
.late-card .student-name { color: #312e81; }

.attendance-control-panel { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; }

.stats-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
.stat-box { flex: 1; padding: 12px; border-radius: 6px; text-align: center; font-size: 1.05rem; font-weight: bold; min-width: 80px; }
.stat-expected { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
.stat-present { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
.stat-leave { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
.stat-late { background: #e0e7ff; color: #3730a3; border: 1px solid #a5b4fc; }
.stat-absent { background: #ffe4e6; color: #e11d48; border: 1px solid #fca5a5; }

.absent-list-section { background: white; border-radius: 8px; padding: 15px; margin-bottom: 20px; border: 1px dashed #f59e0b; }
.absent-list-section h4 { margin: 0 0 15px 0; color: #b45309; }
.tags-container { display: flex; flex-wrap: wrap; gap: 10px; }

.status-tag { padding: 6px 12px; border-radius: 20px; font-weight: bold; font-size: 0.95rem; border: 1px solid transparent; }
.absent-tag { background: #ffe4e6; color: #e11d48; border-color: #fca5a5; }
.late-tag { background: #e0e7ff; color: #3730a3; border-color: #a5b4fc; }
.leave-tag { background: #fef3c7; color: #92400e; border-color: #fde68a; }
.present-tag { background: #dcfce7; color: #166534; border-color: #bbf7d0; }

.all-present-msg { color: #16a34a; font-weight: bold; font-size: 1.1rem; padding: 5px; }
.email-editor-section { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
.editor-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 10px; }
.editor-header h4 { margin: 0; color: #334155; }
.save-template-btn { background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; }
.var-tag { background: #e2e8f0; color: #0f172a; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-weight: bold; }
.help-text { font-size: 0.95rem; color: #64748b; margin-bottom: 20px; line-height: 1.5; }
.form-group { margin-bottom: 15px; } .form-group label { display: block; margin-bottom: 8px; font-weight: bold; color: #475569; }
.edit-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; box-sizing: border-box; width: 100%; }
.textarea-input { resize: vertical; font-family: inherit; line-height: 1.5; }
.email-preview-section { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
.preview-box { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }
.preview-subject { font-size: 1.1rem; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 12px; }
.preview-body { font-size: 1rem; color: #334155; line-height: 1.6; white-space: pre-wrap; }
.late-btn { background: #ef4444; width: 100%; font-size: 1.2rem; padding: 15px; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }

.history-calendar-container { background: white; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; }
.section-title { margin: 0 0 20px 0; color: #1e293b; font-size: 1.3rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px;}
.calendar-layout { display: flex; gap: 20px; flex-wrap: wrap; }
.calendar-box { flex: 1; min-width: 300px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
.history-detail-box { flex: 2; min-width: 350px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }

.calendar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.cal-nav-btn { background: white; border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; color: #475569; }
.cal-title { font-size: 1.2rem; color: #1e293b; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; text-align: center; }
.cal-day-name { font-weight: bold; color: #64748b; padding-bottom: 10px; }
.cal-cell { height: 50px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; background: white; border: 1px solid #e2e8f0; transition: all 0.2s; }
.cal-cell:not(.empty):hover { background: #e0e7ff; border-color: #a5b4fc; }
.cal-cell.empty { background: transparent; border-color: transparent; cursor: default; }
.cal-cell.selected { background: #3b82f6; color: white; border-color: #2563eb; }
.cal-cell.selected .record-dot { background: white; }
.cal-date-num { font-weight: bold; font-size: 1.1rem; }
.record-dot { width: 6px; height: 6px; background: #10b981; border-radius: 50%; margin-top: 4px; }

.empty-detail { text-align: center; color: #94a3b8; margin-top: 50px; font-size: 1.1rem; }
.detail-header-flex { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px; margin-bottom: 15px;}
.detail-title { margin: 0; font-size: 1.2rem; color: #1e293b; }
.save-history-btn { background: #3b82f6; color: white; border: none; padding: 8px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; }
.save-history-btn:disabled { background: #94a3b8; cursor: not-allowed;}

.history-student-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.history-card { display: flex; flex-direction: column; gap: 8px; padding: 10px; border-radius: 8px; border: 2px solid transparent; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: 0.2s background-color;}
.stu-info { display: flex; justify-content: space-between; align-items: center; font-weight: bold;}
.stu-seat { color: #64748b; font-size: 0.9rem;}
.status-select { padding: 4px; border-radius: 4px; border: 1px solid #cbd5e1; font-weight: bold; text-align: center; outline: none; background: white; transition: 0.2s color;}

.late-time-input { margin-top: 2px; padding: 4px; border: 1px solid #cbd5e1; border-radius: 4px; outline: none; font-family: monospace; text-align: center; width: 100%; box-sizing: border-box;}

.card-absent { background: #ffe4e6; border-color: #fca5a5; }
.card-absent .stu-name { color: #e11d48; }
.card-absent .status-select { color: #e11d48; }

.card-present { background: #dcfce7; border-color: #bbf7d0; }
.card-present .stu-name { color: #16a34a; }
.card-present .status-select { color: #16a34a; }

.card-leave { background: #fef3c7; border-color: #fde68a; }
.card-leave .stu-name { color: #b45309; }
.card-leave .status-select { color: #b45309; }

.card-late { background: #e0e7ff; border-color: #a5b4fc; }
.card-late .stu-name { color: #4f46e5; }
.card-late .status-select { color: #4f46e5; }

@media (max-width: 768px) {
  .calendar-layout { flex-direction: column; }
  .test-inputs { flex-direction: column; gap: 10px; align-items: stretch;}
  .test-actions { margin-top: 10px;}
}
</style>
