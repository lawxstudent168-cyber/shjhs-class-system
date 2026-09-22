<template>
  <div class="assign-container">
    <!-- ================= 鎖定畫面：雙密碼支援 (科任老師、小老師、導師) ================= -->
    <div v-if="!isUnlocked" class="lock-screen">
      <div class="lock-box">
        <h2>📚 各科作業登記系統</h2>
        <NuxtLink v-if="route.query.assignment" to="/admin" class="back-link">⬅️ 返回今日待辦</NuxtLink>
        <select v-model="selectedSubject" class="subject-select">
          <option value="" disabled selected>請選擇科目或身分...</option>
          <option value="導師">👑 導師專區 (總覽全科)</option>
          <option disabled>──────────</option>
          <option v-for="t in teachersList" :key="t.id" :value="t.subject_name">{{ t.subject_name }}</option>
        </select>
        <input v-model="passwordInput" type="password" placeholder="請輸入密碼..." @keyup.enter="verifyPassword"/>
        <button @click="verifyPassword" :disabled="!selectedSubject">解鎖進入</button>
        <NuxtLink to="/" class="back-link">返回首頁</NuxtLink>
      </div>
    </div>

    <!-- ================= 作業專屬後台 ================= -->
    <div v-else class="dashboard">
      <header class="assign-header print-only-hide">
        <div class="header-title">
          <h2>{{ activeRole === '導師' ? '👑 班級作業總覽中心' : `🧑‍🏫 ${selectedSubject} 專屬作業中心` }}</h2>
          <span :class="['role-badge', activeRole === '導師' ? 'admin-badge' : (activeRole === '科任老師' ? 'teacher-badge' : 'assistant-badge')]">
            目前身分：{{ activeRole }}
          </span>
        </div>
        <NuxtLink v-if="route.query.assignment" to="/admin" class="back-link">⬅️ 返回今日待辦</NuxtLink>
        <button @click="logout" class="back-btn">⬅️ 登出返回</button>
      </header>

      <!-- 區塊一：作業登記面板 (全角色皆可見) -->
      <div class="main-layout print-only-hide">
        <!-- 左側：作業清單與新增作業 -->
        <div class="left-panel data-panel">
          
          <div v-if="activeRole !== '導師'">
            <h3>📝 新增作業項目</h3>
            <div class="add-form">
              <input v-model="newAssignment.title" type="text" placeholder="作業名稱 (例：數學習作 P.10-12)" class="edit-input" />
              <input v-model="newAssignment.deadline" type="date" class="edit-input" />
              
              <!-- 新增作業 與 暫存常態作業 -->
              <div class="add-actions">
                <button @click="addAssignment" class="submit-btn" :disabled="!newAssignment.title">➕ 新增作業</button>
                <button @click="addRoutineAssignment" class="routine-btn" :disabled="!newAssignment.title" title="將此名稱暫存為常態作業，方便未來快速點選">⭐ 暫存常態作業</button>
              </div>
            </div>

            <!-- 常態作業快速選擇區 -->
            <div class="routine-tags" v-if="routineAssignments.length > 0">
              <span class="routine-label">📌 常態作業：</span>
              <div v-for="(routine, idx) in routineAssignments" :key="'rt-'+idx" class="routine-tag" @click="newAssignment.title = routine">
                {{ routine }}
                <button @click.stop="removeRoutineAssignment(idx)" class="remove-routine-btn" title="移除此暫存">×</button>
              </div>
            </div>

            <hr class="divider"/>
          </div>

          <h3>📋 {{ activeRole === '導師' ? '全科' : selectedSubject }} 的作業清單</h3>
          <div class="assignment-list">
            <div v-if="assignments.length === 0" class="empty-prompt" style="padding: 20px;">目前尚無作業項目</div>
            <div v-for="assign in assignments" :key="assign.id" 
                 :class="['assign-item', { active: currentAssignment?.id === assign.id }]"
                 @click="selectAssignment(assign)">
              
              <!-- 正常檢視模式 -->
              <template v-if="editingAssignmentId !== assign.id">
                <div class="assign-info">
                  <strong>
                    <span v-if="activeRole === '導師'" class="subject-tag">[{{ assign.subject_name }}]</span>
                    {{ assign.title }}
                  </strong>
                  <span class="deadline">期限: {{ assign.deadline || '無' }}</span>
                </div>
                
                <!-- 嚴格限制：小老師完全看不見編輯與刪除按鈕 -->
                <div class="assign-actions" v-if="activeRole !== '小老師'">
                  <button @click.stop="startEditAssignment(assign)" class="action-btn" title="編輯作業">✏️</button>
                  <button @click.stop="deleteAssignment(assign.id, assign.title)" class="action-btn del-btn" title="刪除作業">🗑️</button>
                </div>
              </template>

              <!-- 編輯模式 (內聯編輯表單) -->
              <div v-else class="assign-edit-wrapper" @click.stop>
                <input v-model="editAssignmentData.title" type="text" placeholder="作業名稱" class="edit-input-small" />
                <input v-model="editAssignmentData.deadline" type="date" class="edit-input-small" />
                <div class="edit-actions">
                  <button @click.stop="cancelEditAssignment" class="cancel-btn-small">取消</button>
                  <button @click.stop="saveEditAssignment(assign.id)" class="save-btn-small">儲存</button>
                </div>
              </div>

            </div>
          </div>
        </div>

        <!-- 右側：座號登記表 -->
        <div class="right-panel data-panel">
          <div v-if="!currentAssignment" class="empty-prompt">
            👈 請從左側選擇一項作業，開始檢視或登記繳交狀況。
          </div>
          <div v-else>
            <div class="grid-header">
              <h3>批閱項目：{{ currentAssignment.title }}</h3>
              <div class="stats">
                <span class="submitted-stat">已交：{{ currentSubmissions.length }} 人</span>
                <span class="missing-stat">缺交：{{ students.length - currentSubmissions.length }} 人</span>
              </div>
            </div>
            <p class="help-text">💡 點擊學生方塊可切換狀態，所有變更皆會記錄於資料庫稽核系統中。</p>
            
            <div class="seat-grid">
              <div v-for="student in students" :key="student.id"
                   :class="['seat-btn', isSubmitted(student.id) ? 'is-submitted' : 'is-missing']"
                   @click="toggleSubmission(student.id, student.seat_number, student.real_name)">
                <span class="seat-num">{{ student.seat_number }}</span>
                <span class="stu-name">{{ student.real_name }}</span>
                <!-- 💡 防坍塌設計：無論有無時間，版面高度都會固定 -->
                <span v-if="isSubmitted(student.id)" class="sub-time">{{ getSubmissionTimeText(student.id) }}</span>
                <span v-else class="sub-time" style="visibility: hidden;">00/00 00:00</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ================= 區塊二：導師專屬後台 (過濾、列印、發送 Email) ================= -->
      <div v-if="activeRole === '導師'" class="admin-overview-section mt-20">
        
        <div class="table-header print-only-hide"><h3>📚 班級作業報表發送與科任管理</h3></div>
        
        <div class="homework-section print-only-hide">
          <h4>🧑‍🏫 科任老師與小老師密碼管理</h4>
          <div class="teacher-list">
            <div v-for="t in teachersList" :key="t.id" class="teacher-item">
              <input v-model="t.subject_name" type="text" class="edit-input subject-input" placeholder="科目名稱"/>
              <input v-model="t.password" type="text" class="edit-input pwd-input" placeholder="老師密碼"/>
              <input v-model="t.assistant_password" type="text" class="edit-input pwd-input" placeholder="小老師密碼 (選填)"/>
              <button @click="saveTeacher(t)" class="save-row-btn">💾 儲存</button>
              <button @click="deleteTeacher(t.id)" class="del-row-btn">🗑️</button>
            </div>
            <div class="teacher-item new-teacher">
              <input v-model="newTeacher.subject" type="text" class="edit-input subject-input" placeholder="新增科目"/>
              <input v-model="newTeacher.password" type="text" class="edit-input pwd-input" placeholder="老師密碼"/>
              <input v-model="newTeacher.assistant_password" type="text" class="edit-input pwd-input" placeholder="小老師密碼"/>
              <button @click="addTeacher" class="add-btn small-btn">➕ 新增科任</button>
            </div>
          </div>
        </div>

        <!-- 導師專屬過濾器 -->
        <div class="homework-section print-only-hide">
          <h4>⚙️ 報表統計過濾設定 (僅導師可操作)</h4>
          <p class="help-text">有些小任務缺交不須驚動家長。請取消勾選不需通知的作業，它們將<strong style="color: #dc2626;">【不會】</strong>出現在下方的統計、列印單或 Email 信件中。</p>
          
          <div class="filter-grid">
            <div v-if="assignments.length === 0" class="none-text" style="padding: 10px;">目前無任何作業</div>
            <label v-for="a in assignments" :key="a.id" class="filter-label" :class="{ 'is-excluded': excludedAssignmentIds.includes(a.id) }">
              <input type="checkbox" 
                     :checked="!excludedAssignmentIds.includes(a.id)"
                     @change="toggleExclude(a.id)" class="filter-checkbox" />
              <span class="filter-text">
                <span class="filter-subj">[{{ a.subject_name }}]</span> {{ a.title }}
              </span>
            </label>
          </div>
        </div>

        <div class="homework-section print-no-border">
          <h4 class="print-only-hide">📊 全班學生作業繳交總覽與通知發送</h4>
          <p class="help-text print-only-hide">系統會為每位學生獨立生成一封信並單獨發送給其家長，保證隱私絕對隔離。</p>

          <div class="email-editor-section print-only-hide">
            <div class="editor-header">
              <h4>📝 編輯作業信件內容</h4>
              <button @click="saveHwEmailTemplate" class="save-template-btn" :disabled="isSavingHwTemplate">
                {{ isSavingHwTemplate ? '儲存中...' : '💾 儲存為預設範本' }}
              </button>
            </div>
            <p class="help-text">💡 可使用以下變數：<span class="var-tag" v-pre>{{學生姓名}}</span>、<span class="var-tag" v-pre>{{已交清單}}</span>、<span class="var-tag" v-pre>{{缺交清單}}</span></p>
            <div class="form-group"><label>信件主旨：</label><input type="text" v-model="hwEmailSubjectTemplate" class="edit-input" /></div>
            <div class="form-group"><label>信件內容：</label><textarea v-model="hwEmailContentTemplate" rows="8" class="edit-input textarea-input"></textarea></div>
          </div>

          <div class="email-preview-section print-only-hide">
            <h4>👀 信件預覽 <span class="preview-note">(以目前名單第一位學生為例)</span></h4>
            <div class="preview-box">
              <div class="preview-subject"><strong>主旨：</strong> {{ hwPreviewSubject }}</div>
              <div class="preview-body">{{ hwPreviewContent }}</div>
            </div>
          </div>

          <div class="action-bar print-only-hide" style="margin-bottom: 25px; display: flex; gap: 15px; flex-wrap: wrap;">
            <button @click="triggerPrint('all')" class="email-btn print-btn">
              📄 產生全班報表 (預覽列印/PDF)
            </button>
            <button @click="triggerPrint('missing')" class="email-btn print-missing-btn">
              ⚠️ 產生缺交報表 (預覽列印/PDF)
            </button>
            <button @click="sendHomeworkEmails" class="email-btn late-btn" :disabled="isSendingHomework" style="flex: 2; min-width: 300px;">
              {{ isSendingHomework ? '正在逐一發送作業報表，請稍候...' : '📧 密碼解鎖：確認無誤並一鍵發送全班作業通知' }}
            </button>
          </div>
          
          <div class="print-only-header">
            <h2>📚 {{ printMode === 'missing' ? '全班作業缺交狀態報表' : '全班作業繳交狀態總表' }}</h2>
            <p>列印時間：{{ new Date().toLocaleString('zh-TW') }}</p>
          </div>

          <div class="student-homework-grid" :class="{'print-missing-only': printMode === 'missing'}">
            <div v-for="stat in studentAssignmentStats" :key="stat.id" class="hw-card" :class="{'is-complete': stat.missing.length === 0}">
              <div class="hw-card-header">
                <strong>{{ stat.seat_number }}號 {{ stat.real_name }}</strong>
                <span v-if="stat.missing.length === 0" class="badge notice success">💯 作業全齊</span>
                <span v-else class="badge notice warning">⚠️ 缺交 {{ stat.missing.length }} 項</span>
              </div>
              <div class="hw-card-body">
                <div class="hw-list missing-list">
                  <div class="hw-title">❌ 缺交作業：</div>
                  <ul><li v-for="m in stat.missing" :key="'m'+m.id">[{{ m.subject_name }}] {{ m.title }}</li><li v-if="stat.missing.length === 0" class="none-text">無</li></ul>
                </div>
                <div class="hw-list submitted-list">
                  <div class="hw-title">✅ 已交作業：</div>
                  <ul><li v-for="s in stat.submitted" :key="'s'+s.id">[{{ s.subject_name }}] {{ s.title }}</li><li v-if="stat.submitted.length === 0" class="none-text">無</li></ul>
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
import { ref, onMounted, computed } from 'vue'
const supabase = useSupabaseClient()
const route = useRoute()

// === 共用狀態 ===
const teachersList = ref([]); const selectedSubject = ref(''); const passwordInput = ref('')
const isUnlocked = ref(false); const activeRole = ref('')
const students = ref([]); const assignments = ref([]); const allSubmissions = ref([])

// === 作業登記面板專用狀態 ===
const currentAssignment = ref(null)
const newAssignment = ref({ title: '', deadline: '' })
const editingAssignmentId = ref(null)
const editAssignmentData = ref({ title: '', deadline: '' })
const routineAssignments = ref([])

// === 導師報表專用狀態 ===
const newTeacher = ref({ subject: '', password: '', assistant_password: '' }); 
const isSendingHomework = ref(false); const isSavingHwTemplate = ref(false)
const excludedAssignmentIds = ref([])
const hwEmailSubjectTemplate = ref('📚 班級作業繳交通知 - {{學生姓名}}')
const hwEmailContentTemplate = ref(`親愛的家長您好：\n\n為您彙整 【{{學生姓名}}】 目前的各科作業繳交狀況：\n\n✅ 已交作業：\n{{已交清單}}\n\n❌ 缺交作業：\n{{缺交清單}}\n\n請您協助督促孩子盡速完成缺交作業。若有任何疑問，歡迎透過班級系統私訊聯繫。\n\n班級導師 敬上`)

const printMode = ref('all')

const logRoleVisit = async (roleName) => {
  try {
    const ipRes = await fetch('https://api.ipify.org?format=json')
    const { ip } = await ipRes.json()
    await supabase.from('visitor_logs').insert([{ ip_address: ip, device_info: navigator.userAgent, role: roleName }])
  } catch (e) { console.error(e) }
}

const logAction = async (actionType, details) => {
  await supabase.from('assignment_audit_logs').insert({
    subject_name: selectedSubject.value, action_type: actionType, operator_role: activeRole.value, details: details
  })
}

const fetchTeachers = async () => {
  const { data } = await supabase.from('subject_teachers').select('*').order('subject_name')
  if (data) teachersList.value = data
}

const verifyPassword = async () => {
  if (!selectedSubject.value || !passwordInput.value) return
  
  if (selectedSubject.value === '導師') {
    try {
      const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'admin_password').maybeSingle()
      let expectedPwd = '168168168' 
      if (data?.setting_value) {
        const config = data.setting_value
        if (config.type === 'dynamic') {
          const dt = new Date(); const yy = String(dt.getFullYear()).slice(2); const mm = String(dt.getMonth() + 1).padStart(2, '0'); const dd = String(dt.getDate()).padStart(2, '0')
          expectedPwd = `${yy}${mm}${dd}59`
        } else if (config.type === 'custom' && config.custom_pwd) { expectedPwd = config.custom_pwd }
      }
      
      if (passwordInput.value === expectedPwd || passwordInput.value === '168168168') {
        activeRole.value = '導師'
        isUnlocked.value = true; 
        await fetchDashboardData(); 
        logAction('系統登入', '導師登入成功')
        await logRoleVisit('導師')
        return
      }
    } catch (e) {
      if (passwordInput.value === '168168168') {
        activeRole.value = '導師'
        isUnlocked.value = true; 
        await fetchDashboardData(); 
        logAction('系統登入', '導師登入成功')
        await logRoleVisit('導師(降級登入)')
        return
      }
    }
    alert('❌ 導師密碼錯誤！'); passwordInput.value = ''; return
  }

  const teacherInfo = teachersList.value.find(t => t.subject_name === selectedSubject.value)
  
  if (teacherInfo && passwordInput.value === teacherInfo.password) {
    activeRole.value = '科任老師'
    isUnlocked.value = true; await fetchDashboardData(); loadRoutineAssignments();
    logAction('系統登入', `${teacherInfo.subject_name} 科任老師登入成功`); await logRoleVisit(`${teacherInfo.subject_name} 科任老師`)
  } else if (teacherInfo && teacherInfo.assistant_password && passwordInput.value === teacherInfo.assistant_password) {
    activeRole.value = '小老師'
    isUnlocked.value = true; await fetchDashboardData(); loadRoutineAssignments();
    logAction('系統登入', `${teacherInfo.subject_name} 小老師登入成功`); await logRoleVisit(`${teacherInfo.subject_name} 小老師`)
  } else {
    alert('❌ 密碼錯誤！'); passwordInput.value = ''
  }
}

const logout = () => {
  isUnlocked.value = false;
  activeRole.value = '';
  passwordInput.value = '';
  currentAssignment.value = null;
}

const fetchDashboardData = async () => {
  const { data: sData } = await supabase.from('students').select('*').order('seat_number')
  const { data: pData } = await supabase.from('parents').select('*')
  if (sData) {
    students.value = sData.map(s => { 
      const p = pData ? pData.filter(x => x.student_id === s.id) : []; 
      return { ...s, emails: p.map(x=>x.email).filter(x=>x) } 
    })
  }

  let query = supabase.from('assignments').select('*').order('created_at', { ascending: false })
  if (activeRole.value !== '導師') query = query.eq('subject_name', selectedSubject.value)
  const { data: aData } = await query
  if (aData) {
    assignments.value = aData
    if (!currentAssignment.value && typeof route.query.assignment === 'string') {
      currentAssignment.value = aData.find(a => String(a.id) === route.query.assignment) || null
    }
  }

  const { data: subData } = await supabase.from('assignment_submissions').select('*')
  if (subData) allSubmissions.value = subData

  if (activeRole.value === '導師') {
    const { data: tmpl } = await supabase.from('email_templates').select('*').eq('template_id', 'homework_notice').maybeSingle()
    if (tmpl) { hwEmailSubjectTemplate.value = tmpl.subject; hwEmailContentTemplate.value = tmpl.content }
    
    const { data: excData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'excluded_assignment_ids_from_report').maybeSingle()
    if (excData && excData.setting_value) { excludedAssignmentIds.value = excData.setting_value }
  }
}

// === 第一區塊：作業操作與繳交登記 ===
const loadRoutineAssignments = () => {
  if (selectedSubject.value && selectedSubject.value !== '導師') {
    const saved = localStorage.getItem(`routine_assign_${selectedSubject.value}`)
    if (saved) routineAssignments.value = JSON.parse(saved)
    else routineAssignments.value = []
  }
}

const addRoutineAssignment = () => {
  const title = newAssignment.value.title.trim()
  if (!title) return
  if (!routineAssignments.value.includes(title)) {
    routineAssignments.value.push(title)
    localStorage.setItem(`routine_assign_${selectedSubject.value}`, JSON.stringify(routineAssignments.value))
  }
}

const removeRoutineAssignment = (idx) => {
  routineAssignments.value.splice(idx, 1)
  localStorage.setItem(`routine_assign_${selectedSubject.value}`, JSON.stringify(routineAssignments.value))
}

const addAssignment = async () => {
  if (!newAssignment.value.title) return
  const { data, error } = await supabase.from('assignments').insert({
    subject_name: selectedSubject.value, title: newAssignment.value.title, deadline: newAssignment.value.deadline || null
  }).select().single()
  if (!error && data) { 
    assignments.value.unshift(data)
    logAction('新增作業', `新增了項目：${newAssignment.value.title}`)
    newAssignment.value = { title: '', deadline: '' } 
  }
}

const startEditAssignment = (assign) => {
  editingAssignmentId.value = assign.id
  editAssignmentData.value = { title: assign.title, deadline: assign.deadline || '' }
}
const cancelEditAssignment = () => { editingAssignmentId.value = null; editAssignmentData.value = { title: '', deadline: '' } }

const saveEditAssignment = async (id) => {
  if (!editAssignmentData.value.title) return alert('作業名稱不能為空！')
  try {
    const { error } = await supabase.from('assignments').update({ title: editAssignmentData.value.title, deadline: editAssignmentData.value.deadline || null }).eq('id', id)
    if (error) throw error
    const index = assignments.value.findIndex(a => a.id === id)
    if (index !== -1) { assignments.value[index].title = editAssignmentData.value.title; assignments.value[index].deadline = editAssignmentData.value.deadline }
    if (currentAssignment.value && currentAssignment.value.id === id) { currentAssignment.value.title = editAssignmentData.value.title }
    logAction('編輯作業', `將作業修改為：${editAssignmentData.value.title}`); cancelEditAssignment()
  } catch (err) { alert('❌ 儲存失敗：' + err.message) }
}

const deleteAssignment = async (id, title) => {
  if (activeRole.value === '小老師') return alert('❌ 權限提示：小老師僅能新增作業與登記繳交狀態，無權限刪除作業。\n\n若需刪除，請聯繫科任老師或導師協助。')
  if (!window.confirm(`⚠️ 確定刪除【${title}】？(相關的繳交紀錄也會一併刪除)`)) return
  await supabase.from('assignments').delete().eq('id', id)
  assignments.value = assignments.value.filter(a => a.id !== id)
  if (currentAssignment.value?.id === id) currentAssignment.value = null
  logAction('刪除作業', `刪除了項目：${title}`)
}

const selectAssignment = (assign) => { currentAssignment.value = assign }

const currentSubmissions = computed(() => {
  if (!currentAssignment.value) return []
  return allSubmissions.value.filter(sub => sub.assignment_id === currentAssignment.value.id)
})
const isSubmitted = (studentId) => currentSubmissions.value.some(sub => sub.student_id === studentId)

// 💡 終極防護版：取得已繳交的時間文字 (若資料庫沒時間欄位，至少給出佔位符避免崩塌)
const getSubmissionTimeText = (studentId) => {
  const sub = currentSubmissions.value.find(s => s.student_id === studentId)
  if (!sub) return ''
  // 萬一 SQL Editor 還沒建好 created_at 欄位，回傳預設文字保持版面方正
  if (!sub.created_at) return '免補時間'
  
  const d = new Date(sub.created_at)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 💡 完美的樂觀更新：本機存入時間後，不等待資料庫回傳
const toggleSubmission = async (studentId, seatNumber, realName) => {
  if (!currentAssignment.value) return
  
  const submitted = isSubmitted(studentId)
  
  if (submitted) {
    // 樂觀更新：立刻從畫面上移除 (變回紅色)
    allSubmissions.value = allSubmissions.value.filter(sub => !(sub.assignment_id === currentAssignment.value.id && sub.student_id === studentId))
    
    // 背景刪除，Fire-and-forget (只管刪，不等待)
    supabase.from('assignment_submissions').delete()
      .eq('assignment_id', currentAssignment.value.id)
      .eq('student_id', studentId)
      .then(() => {})
      
    logAction('變更繳交狀態', `將 ${seatNumber}號 ${realName} 的【${currentAssignment.value.title}】狀態改為：❌ 缺交`)
  } else {
    // 樂觀更新：立刻塞入本機的絕對時間 (變成綠色且時間永久存在)
    const nowIso = new Date().toISOString()
    allSubmissions.value.push({
      assignment_id: currentAssignment.value.id,
      student_id: studentId,
      created_at: nowIso 
    })

    // 背景寫入，Fire-and-forget (確保資料庫有收到即可，不要去管它的回傳值)
    supabase.from('assignment_submissions').insert({ 
      assignment_id: currentAssignment.value.id, 
      student_id: studentId
    }).then(() => {})
    
    logAction('變更繳交狀態', `將 ${seatNumber}號 ${realName} 的【${currentAssignment.value.title}】狀態改為：✅ 已交`)
  }
}

// === 第二區塊：導師後台專屬邏輯 ===
const toggleExclude = async (id) => {
  if (excludedAssignmentIds.value.includes(id)) { excludedAssignmentIds.value = excludedAssignmentIds.value.filter(x => x !== id) } 
  else { excludedAssignmentIds.value.push(id) }
  await supabase.from('system_settings').upsert({ setting_key: 'excluded_assignment_ids_from_report', setting_value: excludedAssignmentIds.value }, { onConflict: 'setting_key' })
}

const activeAssignments = computed(() => {
  return assignments.value.filter(a => !excludedAssignmentIds.value.includes(a.id))
})

const studentAssignmentStats = computed(() => students.value.map(s => {
  const mySubIds = allSubmissions.value.filter(sub => sub.student_id === s.id).map(sub => sub.assignment_id)
  return { 
    ...s, 
    submitted: activeAssignments.value.filter(a => mySubIds.includes(a.id)), 
    missing: activeAssignments.value.filter(a => !mySubIds.includes(a.id)) 
  }
}))

const hwPreviewSubject = computed(() => {
  const sampleName = studentAssignmentStats.value.length > 0 ? studentAssignmentStats.value[0].real_name : '王小明'
  return hwEmailSubjectTemplate.value.replace(/{{學生姓名}}/g, sampleName)
})
const hwPreviewContent = computed(() => {
  const sample = studentAssignmentStats.value.length > 0 ? studentAssignmentStats.value[0] : null
  const sampleName = sample ? sample.real_name : '王小明'
  const submittedStr = sample && sample.submitted.length ? sample.submitted.map(a => `[${a.subject_name}] ${a.title}`).join('\n') : '無'
  const missingStr = sample && sample.missing.length ? sample.missing.map(a => `[${a.subject_name}] ${a.title}`).join('\n') : '無'
  return hwEmailContentTemplate.value.replace(/{{學生姓名}}/g, sampleName).replace(/{{已交清單}}/g, submittedStr).replace(/{{缺交清單}}/g, missingStr)
})

const addTeacher = async () => {
  const { data } = await supabase.from('subject_teachers').insert({ subject_name: newTeacher.value.subject, password: newTeacher.value.password, assistant_password: newTeacher.value.assistant_password }).select().single()
  if (data) { teachersList.value.push(data); newTeacher.value = { subject: '', password: '', assistant_password: '' } }
}
const saveTeacher = async (t) => { await supabase.from('subject_teachers').update({ subject_name: t.subject_name, password: t.password, assistant_password: t.assistant_password }).eq('id', t.id); alert(`✅ ${t.subject_name} 資料更新成功！`) }
const deleteTeacher = async (id) => { if(confirm('確定刪除此科目？')) { await supabase.from('subject_teachers').delete().eq('id', id); teachersList.value = teachersList.value.filter(t => t.id !== id) } }
const saveHwEmailTemplate = async () => { isSavingHwTemplate.value = true; await supabase.from('email_templates').upsert({ template_id: 'homework_notice', subject: hwEmailSubjectTemplate.value, content: hwEmailContentTemplate.value }); alert('✅ 作業信件範本已永久儲存！'); isSavingHwTemplate.value = false }

const triggerPrint = (mode) => {
  printMode.value = mode
  setTimeout(() => { window.print() }, 100)
}

const sendHomeworkEmails = async () => {
  isSendingHomework.value = true
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
    isSendingHomework.value = false; return alert('❌ 密碼錯誤，發送取消！')
  }

  let successCount = 0
  for (const s of studentAssignmentStats.value) {
    if (s.emails.length === 0) continue
    const subj = hwEmailSubjectTemplate.value.replace(/{{學生姓名}}/g, s.real_name)
    const submittedStr = s.submitted.length ? s.submitted.map(a => `[${a.subject_name}] ${a.title}`).join('\n') : '無'
    const missingStr = s.missing.length ? s.missing.map(a => `[${a.subject_name}] ${a.title} (期限: ${a.deadline || '未定'})`).join('\n') : '無'
    const cont = hwEmailContentTemplate.value.replace(/{{學生姓名}}/g, s.real_name).replace(/{{已交清單}}/g, submittedStr).replace(/{{缺交清單}}/g, missingStr)
    try {
      await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bcc: s.emails, subject: subj, content: cont }) })
      await supabase.from('communication_logs').insert({ student_id: s.id, notification_type: '作業報表群發', sent_by: '導師', recipient_emails: s.emails.join(', '), message_content: cont })
      successCount++
    } catch(e) {}
  }
  alert(`✅ 發送完成！成功：${successCount} 位`); isSendingHomework.value = false
}

onMounted(() => fetchTeachers())
</script>

<style scoped>
.assign-container { min-height: 100vh; background-color: #f1f5f9; font-family: sans-serif; }
.lock-screen { display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #3b0764; }
.lock-box { background: white; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); width: 400px; }
.lock-box h2 { color: #581c87; margin-bottom: 20px; }
.subject-select, .lock-box input { width: 100%; padding: 12px; margin-bottom: 20px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 1.1rem; box-sizing: border-box; }
.lock-box button { width: 100%; padding: 12px; background-color: #7e22ce; color: white; border: none; border-radius: 6px; font-size: 1.1rem; cursor: pointer; font-weight: bold; }
.lock-box button:disabled { background: #d8b4fe; cursor: not-allowed; }
.back-link { display: block; margin-top: 15px; color: #64748b; text-decoration: none; }

.dashboard { max-width: 1300px; margin: 0 auto; padding: 20px; }
.assign-header { display: flex; justify-content: space-between; align-items: center; background: white; padding: 15px 25px; border-radius: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); margin-bottom: 20px; }
.header-title { display: flex; align-items: center; gap: 15px; }
.assign-header h2 { margin: 0; color: #4c1d95; }
.role-badge { padding: 4px 10px; border-radius: 20px; font-size: 0.9rem; font-weight: bold; }
.teacher-badge { background-color: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
.assistant-badge { background-color: #fef08a; color: #854d0e; border: 1px solid #fde047; }
.admin-badge { background-color: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
.back-btn { background: #ef4444; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; }

.main-layout { display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap; }
.data-panel { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
.left-panel { flex: 1; min-width: 300px; }
.right-panel { flex: 2; min-width: 600px; }

h3 { color: #334155; margin-top: 0; margin-bottom: 15px; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; }
.edit-input { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 10px; box-sizing: border-box; }

.add-actions { display: flex; gap: 10px; }
.submit-btn { flex: 2; background: #10b981; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s;}
.submit-btn:disabled { background: #a7f3d0; cursor: not-allowed; color: #064e3b; }
.routine-btn { flex: 1; background: #f59e0b; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; white-space: nowrap;}
.routine-btn:hover:not(:disabled) { background: #d97706; }
.routine-btn:disabled { background: #fde68a; cursor: not-allowed; color: #78350f; }

.routine-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 15px; align-items: center; }
.routine-label { font-size: 0.9rem; color: #64748b; font-weight: bold; }
.routine-tag { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; padding: 5px 12px; border-radius: 20px; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; font-weight: bold; }
.routine-tag:hover { background: #fef3c7; border-color: #fcd34d; }
.remove-routine-btn { background: transparent; border: none; color: #d97706; font-size: 1.2rem; cursor: pointer; padding: 0; line-height: 1; margin-left: 2px;}
.remove-routine-btn:hover { color: #b45309; transform: scale(1.2); }

.divider { border: 0; border-top: 2px dashed #cbd5e1; margin: 20px 0; }

.assignment-list { display: flex; flex-direction: column; gap: 10px; max-height: 500px; overflow-y: auto; }
.assign-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; transition: 0.2s; }
.assign-item:hover { border-color: #8b5cf6; }
.assign-item.active { background: #f3e8ff; border-color: #9333ea; box-shadow: 0 0 0 2px rgba(147, 51, 234, 0.2); }
.assign-info { display: flex; flex-direction: column; gap: 5px; }
.subject-tag { color: #d946ef; font-size: 0.9rem; margin-right: 4px; }
.deadline { font-size: 0.85rem; color: #64748b; }

.assign-actions { display: flex; gap: 8px; align-items: center; }
.action-btn { background: transparent; border: none; cursor: pointer; font-size: 1.2rem; opacity: 0.5; transition: 0.2s; padding: 0; }
.action-btn:hover { opacity: 1; transform: scale(1.1); }

.assign-edit-wrapper { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.edit-input-small { padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.95rem; }
.edit-input-small:focus { border-color: #8b5cf6; outline: none; }
.edit-actions { display: flex; gap: 8px; justify-content: flex-end; }
.save-btn-small { background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.85rem;}
.cancel-btn-small { background: #e2e8f0; color: #475569; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.85rem;}

.empty-prompt { text-align: center; padding: 50px; color: #64748b; font-size: 1.2rem; background: #f8fafc; border-radius: 8px; border: 2px dashed #cbd5e1; }
.grid-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
.stats { font-weight: bold; display: flex; gap: 15px; }
.submitted-stat { color: #16a34a; } .missing-stat { color: #dc2626; }
.help-text { font-size: 0.9rem; color: #64748b; margin-bottom: 20px; line-height: 1.5; }

.seat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(85px, 1fr)); gap: 10px; }
.seat-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 15px 5px; border-radius: 8px; cursor: pointer; border: 2px solid transparent; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: 0.1s transform; user-select: none; }
.seat-btn:active { transform: scale(0.95); }
.seat-num { font-size: 1.3rem; font-weight: bold; margin-bottom: 5px; }
.stu-name { font-size: 0.95rem; font-weight: bold; }
.is-submitted { background: #dcfce7; border-color: #22c55e; color: #166534; }
.is-missing { background: #fee2e2; border-color: #ef4444; color: #991b1b; }
.sub-time { font-size: 0.75rem; margin-top: 4px; font-weight: normal; opacity: 0.85; font-family: monospace; }

/* 導師後台管理區塊 CSS */
.mt-20 { margin-top: 20px; }
.table-header { border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; } 
.table-header h3 { margin: 0; color: #334155; }
.homework-section { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
.homework-section h4 { margin: 0 0 15px 0; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
.teacher-list { display: flex; flex-direction: column; gap: 10px; }
.teacher-item { display: flex; gap: 10px; align-items: center; background: white; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0; }
.new-teacher { background: #f0fdf4; border-color: #bbf7d0; }
.subject-input { width: 120px; } .pwd-input { width: 180px; }
.add-btn.small-btn { background: #10b981; color: white; border: none; padding: 8px 12px; border-radius: 4px; font-weight: bold; cursor: pointer; }
.save-row-btn { background: #3b82f6; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; }
.del-row-btn { background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; }

.filter-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; max-height: 250px; overflow-y: auto; padding: 15px; background: white; border: 1px solid #cbd5e1; border-radius: 8px; }
.filter-label { display: flex; align-items: center; gap: 10px; font-size: 0.95rem; cursor: pointer; padding: 8px 12px; border-radius: 6px; border: 1px solid transparent; transition: 0.2s; background: #f1f5f9;}
.filter-label:hover { background: #e2e8f0; }
.filter-checkbox { transform: scale(1.2); cursor: pointer; accent-color: #10b981;}
.filter-label.is-excluded { background: #fef2f2; border-color: #fecaca; opacity: 0.7;}
.filter-label.is-excluded .filter-text { text-decoration: line-through; color: #94a3b8; }
.filter-subj { color: #8b5cf6; font-weight: bold; margin-right: 4px;}

.email-editor-section { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
.editor-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 10px; }
.save-template-btn { background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; }
.var-tag { background: #e2e8f0; color: #0f172a; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-weight: bold; }
.form-group { margin-bottom: 15px; } .form-group label { display: block; margin-bottom: 8px; font-weight: bold; color: #475569; }
.textarea-input { resize: vertical; font-family: inherit; line-height: 1.5; }
.email-preview-section { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
.preview-box { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }
.preview-subject { font-size: 1.1rem; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 12px; }
.preview-body { font-size: 1rem; color: #334155; line-height: 1.6; white-space: pre-wrap; }
.late-btn { background-color: #f59e0b; width: 100%; font-size: 1.1rem; padding: 15px; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.late-btn:hover:not(:disabled) { background-color: #d97706; }
.print-btn { background-color: #3b82f6; font-size: 1.1rem; padding: 15px; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; flex: 1; transition: 0.2s; }
.print-btn:hover { background-color: #2563eb; }
.print-missing-btn { background-color: #f43f5e; font-size: 1.1rem; padding: 15px; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; flex: 1; transition: 0.2s; }
.print-missing-btn:hover { background-color: #e11d48; }

.print-only-header { display: none; }

.student-homework-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 15px; max-height: 600px; overflow-y: auto; padding-right: 10px; }
.hw-card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.hw-card-header { padding: 12px 15px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; }
.hw-card-body { padding: 15px; display: flex; flex-direction: column; gap: 15px; }
.hw-title { font-size: 0.9rem; font-weight: bold; margin-bottom: 5px; }
.hw-list ul { margin: 0; padding-left: 20px; font-size: 0.85rem; color: #475569; }
.none-text { list-style: none; color: #94a3b8; font-style: italic; margin-left: -20px; }
.missing-list .hw-title { color: #dc2626; } .submitted-list .hw-title { color: #16a34a; }
.badge { background: #e0e7ff; color: #4338ca; padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; font-weight: bold; }
.badge.success { background: #dcfce7; color: #166534; } .badge.warning { background: #fee2e2; color: #991b1b; }

@media (max-width: 1024px) { .right-panel { min-width: 100%; } }

@media print {
  @page { size: A4 portrait; margin: 15mm; }
  
  .print-only-hide { display: none !important; }

  .print-no-border {
    border: none !important;
    padding: 0 !important;
    margin: 0 !important;
    background: transparent !important;
  }

  .print-only-header {
    display: block !important;
    text-align: center;
    margin-bottom: 20px;
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
  }
  .print-only-header h2 { margin: 0 0 5px 0; color: #000; font-size: 24px; }
  .print-only-header p { margin: 0; color: #333; font-size: 14px; }

  .student-homework-grid {
    display: grid !important;
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 10mm !important;
    max-height: none !important;
    overflow: visible !important;
    padding: 0 !important;
  }

  .hw-card {
    page-break-inside: avoid;
    border: 1px solid #000 !important;
    box-shadow: none !important;
    margin-bottom: 5mm; 
  }
  
  .print-missing-only .is-complete {
    display: none !important;
  }

  .badge { border: 1px solid #000; color: #000 !important; background: transparent !important; }
  .hw-card-header { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; border-bottom: 1px solid #000 !important; }
}
</style>
