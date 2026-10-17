<template>
  <div class="discipline-page">
    
    <!-- ================= 登入介面 ================= -->
    <div v-if="!isLoggedIn" class="login-container">
      <div class="login-card">
        <h2 class="title">🚨 秩序管理系統</h2>
        <p class="subtitle">請選擇您的身分並輸入對應密碼</p>
        
        <div class="form-group">
          <label>登入身分：</label>
          <select v-model="loginForm.role" class="form-control">
            <option value="discipline">風紀股長</option>
            <option value="subject">任課老師 / 小老師</option>
            <option value="teacher">導師 (最高權限)</option>
          </select>
        </div>

        <div v-if="loginForm.role === 'subject'" class="form-group">
          <label>任課科目 (必填)：</label>
          <select v-model="loginForm.subject" class="form-control">
            <option value="" disabled>請選擇科目...</option>
            <option v-for="t in teachersList" :key="t.id" :value="t.subject_name">
              {{ t.subject_name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>登入密碼：</label>
          <input 
            v-model="loginForm.password" 
            type="password" 
            placeholder="請輸入密碼" 
            class="form-control" 
            @keyup.enter="handleLogin" 
          />
        </div>

        <button @click="handleLogin" class="btn-submit" :disabled="isLoggingIn">
          {{ isLoggingIn ? '驗證中...' : '登入系統' }}
        </button>
        
        <div class="back-link">
          <NuxtLink to="/">⬅️ 返回首頁</NuxtLink>
        </div>
      </div>
    </div>

    <!-- ================= 主操作介面 ================= -->
    <div v-else class="main-content-wrapper">
      <header class="page-header">
        <h2>⚖️ 班級秩序與違規管理系統</h2>
        <div class="header-right">
          <span class="role-badge">目前身分：{{ userRole }}</span>
          <button @click="logout" class="btn-logout">登出返回</button>
        </div>
      </header>

      <div class="main-content">
        <!-- ================= 左側：登記/編輯違規 ================= -->
        <div class="left-col">
          <div class="card form-card">
            <!-- 💡 根據是否在編輯模式切換標題 -->
            <h3>{{ editingRecordId ? '✏️ 編輯違規紀錄' : '📝 登記違規行為' }}</h3>
            <div class="form-group">
              <label>👩‍🎓 選擇學生：</label>
              <select v-model="form.studentId" class="form-control">
                <option disabled value="">請選擇學生...</option>
                <option v-for="s in students" :key="s.id" :value="s.id">
                  {{ s.seat_number }}號 - {{ s.real_name }}
                </option>
              </select>
            </div>
            
            <div class="form-group">
              <label>⚠️ 違規項目：</label>
              <select v-model="form.violationName" class="form-control">
                <option disabled value="">請選擇違規項目...</option>
                <option v-for="v in violationTypes" :key="v.id" :value="v.name">
                  {{ v.name }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label>📅 發生日期：</label>
              <input type="date" v-model="form.violationDate" class="form-control" />
            </div>

            <div class="form-group">
              <label>⏰ 發生節數：</label>
              <select v-model="form.violationPeriod" class="form-control">
                <option value="" disabled selected>請選擇發生節數...</option>
                <option value="早自修">早自修</option>
                <option value="第1節">第1節</option>
                <option value="第2節">第2節</option>
                <option value="第3節">第3節</option>
                <option value="第4節">第4節</option>
                <option value="午休">午休</option>
                <option value="第5節">第5節</option>
                <option value="第6節">第6節</option>
                <option value="第7節">第7節</option>
                <option value="第8節">第8節</option>
                <option value="放學後">放學後</option>
              </select>
            </div>

            <!-- 💡 新增編輯模式的按鈕群組 -->
            <div class="form-actions">
              <button @click="submitRecord" class="btn-primary" 
                      :disabled="!form.studentId || !form.violationName || !form.violationDate || !form.violationPeriod || isSubmitting">
                {{ isSubmitting ? '處理中...' : (editingRecordId ? '儲存變更' : '送出登記') }}
              </button>
              <button v-if="editingRecordId" @click="cancelEdit" class="btn-cancel">取消編輯</button>
            </div>
          </div>

          <!-- 導師專屬：管理違規種類 -->
          <div v-if="userRole === '導師'" class="card manage-card">
            <h3>⚙️ 管理違規種類 (僅導師可見)</h3>
            <div class="add-type">
              <input v-model="newTypeName" type="text" placeholder="輸入新違規項目名稱..." class="form-control edit-input">
              <button @click="addViolationType" class="btn-add">新增</button>
            </div>
            <ul class="type-list">
              <li v-for="v in violationTypes" :key="v.id">
                <span>{{ v.name }}</span>
                <button @click="deleteViolationType(v.id)" class="btn-del-type">刪除</button>
              </li>
            </ul>
          </div>
        </div>

        <!-- ================= 右側：違規統計與紀錄 ================= -->
        <div class="right-col">
          <div class="card history-card">
            
            <div class="view-tabs">
              <button :class="['tab-btn', { active: viewMode === 'overview' }]" @click="viewMode = 'overview'">
                📊 統計總覽
              </button>
              <button :class="['tab-btn', { active: viewMode === 'calendar' }]" @click="viewMode = 'calendar'">
                📅 依日期/節數查詢
              </button>
            </div>
            
            <!-- 模式 1：統計總覽 -->
            <div v-if="viewMode === 'overview'">
              <div v-if="groupedRecords.length === 0" class="empty-state">
                目前班上表現優良，尚無違規紀錄！🎉
              </div>
              
              <div class="table-container" v-else>
                <table class="history-table">
                  <thead>
                    <tr>
                      <th>座號姓名</th>
                      <th>違規項目 (累計次數)</th>
                      <th>詳細發生時間</th>
                      <th>登記人</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="group in groupedRecords" :key="group.student_id + group.violation_name">
                      <td class="student-cell">
                        <span class="seat">{{ getStudentSeat(group.student_id) }}</span>
                        {{ getStudentName(group.student_id) }}
                      </td>
                      <td class="violation-cell">
                        {{ group.violation_name }} 
                        <span class="count-badge">共 {{ group.records.length }} 次</span>
                      </td>
                      <td class="time-cell">
                        <ul class="time-list">
                          <li v-for="rec in group.records" :key="rec.id" class="time-list-item">
                            {{ formatRecordTime(rec) }}
                            <!-- 💡 導師專屬：編輯與刪除按鈕 -->
                            <span v-if="userRole === '導師'" class="action-icons">
                              <button @click="editRecord(rec)" class="icon-btn edit-icon" title="編輯">✏️</button>
                              <button @click="deleteRecord(rec.id)" class="icon-btn del-icon" title="刪除">🗑️</button>
                            </span>
                          </li>
                        </ul>
                      </td>
                      <td>{{ group.records[0].recorded_by }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 模式 2：日期/節數查詢模式 -->
            <div v-else class="calendar-view">
              <div class="filter-bar">
                <div class="filter-group">
                  <label>篩選日期：</label>
                  <input type="date" v-model="searchDate" class="form-control" />
                </div>
                <div class="filter-group">
                  <label>篩選節數：</label>
                  <select v-model="searchPeriod" class="form-control">
                    <option value="">全天 (所有節數)</option>
                    <option value="早自修">早自修</option>
                    <option value="第1節">第1節</option>
                    <option value="第2節">第2節</option>
                    <option value="第3節">第3節</option>
                    <option value="第4節">第4節</option>
                    <option value="午休">午休</option>
                    <option value="第5節">第5節</option>
                    <option value="第6節">第6節</option>
                    <option value="第7節">第7節</option>
                    <option value="第8節">第8節</option>
                    <option value="放學後">放學後</option>
                  </select>
                </div>
              </div>

              <div v-if="filteredRecordsByDate.length === 0" class="empty-state">
                這個時段沒有任何違規紀錄喔！✨
              </div>

              <div class="table-container" v-else>
                <table class="history-table">
                  <thead>
                    <tr>
                      <th width="15%">節數</th>
                      <th width="20%">座號姓名</th>
                      <th width="35%">違規項目</th>
                      <th width="15%">登記人</th>
                      <!-- 💡 導師專屬：操作欄位 -->
                      <th width="15%" v-if="userRole === '導師'">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="rec in filteredRecordsByDate" :key="rec.id">
                      <td>
                        <span class="period-badge">{{ rec.violation_period || '未知' }}</span>
                      </td>
                      <td class="student-cell">
                        <span class="seat">{{ getStudentSeat(rec.student_id) }}</span>
                        {{ getStudentName(rec.student_id) }}
                      </td>
                      <td class="violation-cell">{{ rec.violation_name }}</td>
                      <td>{{ rec.recorded_by }}</td>
                      <!-- 💡 導師專屬：編輯與刪除按鈕 -->
                      <td v-if="userRole === '導師'" class="action-cell">
                        <button @click="editRecord(rec)" class="btn-edit-sm">編輯</button>
                        <button @click="deleteRecord(rec.id)" class="btn-del-sm">刪除</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
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

const getToday = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 💡 登入成功寫入日誌的共用函式
const logRoleVisit = roleName => beginVisitorSession(roleName, '密碼驗證')

// 登入狀態與清單
const isLoggedIn = ref(false)
const isLoggingIn = ref(false)
const loginForm = ref({ role: 'discipline', subject: '', password: '' })
const teachersList = ref([])

// 業務資料
const userRole = ref('')
const students = ref([])
const violationTypes = ref([])
const disciplineRecords = ref([])

// 💡 編輯狀態變數
const editingRecordId = ref(null)

const form = ref({ 
  studentId: '', 
  violationName: '', 
  violationDate: getToday(), 
  violationPeriod: '' 
})
const newTypeName = ref('')
const isSubmitting = ref(false)

const viewMode = ref('overview')
const searchDate = ref(getToday())
const searchPeriod = ref('')

onMounted(async () => {
  await fetchTeachers()
  const role = sessionStorage.getItem('discipline_role')
  if (role) {
    userRole.value = role
    isLoggedIn.value = true
    void resumeVisitorSession(userRole.value)
    await loadMainData()
  }
})

const fetchTeachers = async () => {
  const { data } = await supabase.from('subject_teachers').select('*').order('subject_name')
  if (data) teachersList.value = data
}

const handleLogin = async () => {
  if (!loginForm.value.password) {
    alert('請輸入密碼！')
    return
  }

  isLoggingIn.value = true
  try {
    if (loginForm.value.role === 'teacher' || loginForm.value.role === 'discipline') {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'board_officer_passwords')
        .maybeSingle()

      if (error) throw error
      const passwords = data?.setting_value || {}
      
      if (loginForm.value.password === passwords[loginForm.value.role]) {
        const roleName = loginForm.value.role === 'teacher' ? '導師' : '風紀股長'
        completeLogin(roleName)
      } else {
        alert('密碼錯誤，請重新輸入！')
      }
    } 
    else if (loginForm.value.role === 'subject') {
      if (!loginForm.value.subject) {
        alert('請選擇任課科目！')
        return
      }
      
      const teacherInfo = teachersList.value.find(t => t.subject_name === loginForm.value.subject)
      
      if (teacherInfo && loginForm.value.password === teacherInfo.password) {
        completeLogin(`科任老師 (${teacherInfo.subject_name})`)
      } else if (teacherInfo && teacherInfo.assistant_password && loginForm.value.password === teacherInfo.assistant_password) {
        completeLogin(`小老師 (${teacherInfo.subject_name})`)
      } else {
        alert('密碼錯誤！請確認老師或小老師密碼。')
      }
    }
  } catch (error) {
    console.error('登入驗證發生錯誤:', error)
    alert('系統驗證失敗，請稍後再試。')
  } finally {
    isLoggingIn.value = false
  }
}

const completeLogin = async (roleName) => {
  userRole.value = roleName
  sessionStorage.setItem('discipline_role', roleName)
  isLoggedIn.value = true
  loginForm.value.password = ''
  
  // 💡 驗證通過，寫入資料庫日誌
  await logRoleVisit(roleName)
  
  await loadMainData()
}

const logout = () => {
  void endVisitorSession('登出')
  sessionStorage.removeItem('discipline_role')
  isLoggedIn.value = false
}

const loadMainData = async () => {
  await Promise.all([
    fetchStudents(),
    fetchViolationTypes(),
    fetchRecords()
  ])
}

const fetchStudents = async () => {
  const { data } = await supabase.from('students').select('*').order('seat_number')
  if (data) students.value = data
}

const fetchViolationTypes = async () => {
  const { data } = await supabase.from('violation_types').select('*').order('created_at')
  if (data) violationTypes.value = data
}

const fetchRecords = async () => {
  const { data } = await supabase.from('discipline_records').select('*').order('created_at', { ascending: false })
  if (data) disciplineRecords.value = data
}

// 💡 進入編輯模式
const editRecord = (rec) => {
  editingRecordId.value = rec.id
  form.value.studentId = rec.student_id
  form.value.violationName = rec.violation_name
  // 處理舊資料沒有日期的狀況
  form.value.violationDate = rec.violation_date || rec.created_at.split('T')[0]
  form.value.violationPeriod = rec.violation_period || ''
  
  // 滾動到頁面頂端方便編輯
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// 💡 取消編輯，清空表單
const cancelEdit = () => {
  editingRecordId.value = null
  form.value.studentId = ''
  form.value.violationName = ''
  form.value.violationDate = getToday()
  form.value.violationPeriod = ''
}

// 💡 整合新增與更新的送出函式
const submitRecord = async () => {
  isSubmitting.value = true
  try {
    if (editingRecordId.value) {
      // 編輯更新模式
      const { error } = await supabase.from('discipline_records')
        .update({
          student_id: form.value.studentId,
          violation_name: form.value.violationName,
          violation_date: form.value.violationDate,
          violation_period: form.value.violationPeriod,
        })
        .eq('id', editingRecordId.value)
      
      if (error) throw error
      alert('✅ 違規紀錄更新成功！')
    } else {
      // 全新登入模式
      const { error } = await supabase.from('discipline_records').insert({
        student_id: form.value.studentId,
        violation_name: form.value.violationName,
        violation_date: form.value.violationDate,
        violation_period: form.value.violationPeriod,
        recorded_by: userRole.value
      })
      
      if (error) throw error
      alert('✅ 違規登記成功！')
    }
    
    cancelEdit() // 復原表單為預設狀態
    await fetchRecords()
  } catch (error) {
    alert('❌ 處理失敗：' + error.message)
  } finally {
    isSubmitting.value = false
  }
}

// 💡 刪除單筆紀錄
const deleteRecord = async (id) => {
  if (!confirm("確定要刪除這筆違規紀錄嗎？(此動作無法復原)")) return
  try {
    const { error } = await supabase.from('discipline_records').delete().eq('id', id)
    if (error) throw error
    alert('✅ 紀錄已刪除！')
    
    // 如果正在編輯該筆紀錄，一併取消編輯狀態
    if (editingRecordId.value === id) {
      cancelEdit()
    }
    await fetchRecords()
  } catch (error) {
    alert('❌ 刪除失敗：' + error.message)
  }
}

const addViolationType = async () => {
  if (!newTypeName.value.trim()) return
  const { error } = await supabase.from('violation_types').insert({ name: newTypeName.value.trim() })
  if (!error) {
    newTypeName.value = ''
    await fetchViolationTypes()
  } else {
    alert('新增失敗：' + error.message)
  }
}

const deleteViolationType = async (id) => {
  if (confirm("確定要刪除這個違規項目嗎？")) {
    const { error } = await supabase.from('violation_types').delete().eq('id', id)
    if (!error) await fetchViolationTypes()
  }
}

const getStudentName = (id) => students.value.find(s => s.id === id)?.real_name || '未知'
const getStudentSeat = (id) => students.value.find(s => s.id === id)?.seat_number || '?'

const formatTime = (isoString) => {
  const date = new Date(isoString)
  return `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
}

const formatRecordTime = (rec) => {
  if (rec.violation_date && rec.violation_period) {
    return `${rec.violation_date} (${rec.violation_period})`
  }
  return formatTime(rec.created_at)
}

const groupedRecords = computed(() => {
  const groups = {}
  disciplineRecords.value.forEach(record => {
    const key = `${record.student_id}_${record.violation_name}`
    if (!groups[key]) {
      groups[key] = {
        student_id: record.student_id,
        violation_name: record.violation_name,
        records: []
      }
    }
    groups[key].records.push(record)
  })
  
  return Object.values(groups).sort((a, b) => {
    return getStudentSeat(a.student_id) - getStudentSeat(b.student_id)
  })
})

const filteredRecordsByDate = computed(() => {
  return disciplineRecords.value.filter(rec => {
    const recDate = rec.violation_date || rec.created_at.split('T')[0]
    if (searchDate.value && recDate !== searchDate.value) return false
    if (searchPeriod.value && rec.violation_period !== searchPeriod.value) return false
    return true
  }).sort((a, b) => {
    return new Date(b.created_at) - new Date(a.created_at)
  })
})
</script>

<style scoped>
/* =========== 基礎設定 =========== */
.discipline-page {
  min-height: 100vh;
  background-color: #f1f5f9;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  padding: 20px;
}

/* =========== 登入卡片 =========== */
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
}
.login-card {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.05);
  width: 100%;
  max-width: 400px;
}
.title { text-align: center; color: #1e293b; margin-bottom: 5px; }
.subtitle { text-align: center; color: #64748b; margin-bottom: 25px; font-size: 0.95rem; }

/* =========== 共用表單與按鈕 =========== */
.form-group { margin-bottom: 15px; }
.form-group label { display: block; margin-bottom: 8px; font-weight: bold; color: #475569; }
.form-control {
  width: 100%;
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 1rem;
  box-sizing: border-box;
}
.form-control:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

.btn-submit, .btn-primary { 
  width: 100%; 
  background: #3b82f6; 
  color: white; 
  border: none; 
  padding: 12px; 
  border-radius: 6px; 
  font-weight: bold; 
  cursor: pointer; 
  font-size: 1.1rem; 
}
.btn-primary { background: #10b981; }
.btn-submit:disabled, .btn-primary:disabled { background: #9ca3af; cursor: not-allowed; }

/* 💡 新增：表單按鈕群組與取消按鈕 */
.form-actions { display: flex; gap: 10px; margin-top: 15px; }
.form-actions button { flex: 1; }
.btn-cancel { background: #94a3b8; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 1.1rem; transition: 0.2s;}
.btn-cancel:hover { background: #64748b; }

.back-link { text-align: center; margin-top: 20px; }
.back-link a { color: #64748b; text-decoration: none; font-weight: bold; }

/* =========== 主畫面佈局 =========== */
.main-content-wrapper { max-width: 1300px; margin: 0 auto; }
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1e293b;
  color: white;
  padding: 15px 25px;
  border-radius: 8px;
  margin-bottom: 20px;
}
.page-header h2 { margin: 0; }
.header-right { display: flex; align-items: center; gap: 15px; }
.role-badge { background: #3b82f6; padding: 5px 12px; border-radius: 20px; font-weight: bold; font-size: 0.9rem;}
.btn-logout { background: #ef4444; color: white; border: none; padding: 6px 15px; border-radius: 6px; cursor: pointer; font-weight: bold;}

.main-content {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.left-col { flex: 1; display: flex; flex-direction: column; gap: 20px; min-width: 350px;}
.right-col { flex: 2; min-width: 600px;}

.card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  border: 1px solid #e2e8f0;
}
.card h3 { margin-top: 0; color: #334155; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;}

/* =========== 分頁標籤 (Tabs) =========== */
.view-tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;}
.tab-btn { background: transparent; border: none; padding: 8px 16px; font-size: 1.1rem; font-weight: bold; color: #64748b; cursor: pointer; border-radius: 6px; transition: 0.2s;}
.tab-btn:hover { background: #f1f5f9; }
.tab-btn.active { background: #e0e7ff; color: #4f46e5; }

/* =========== 篩選列 =========== */
.filter-bar { display: flex; gap: 15px; margin-bottom: 20px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px dashed #cbd5e1;}
.filter-group { flex: 1; display: flex; flex-direction: column; gap: 5px;}
.filter-group label { font-size: 0.9rem; font-weight: bold; color: #475569;}

/* =========== 管理項目樣式 =========== */
.manage-card .add-type { display: flex; gap: 10px; margin-bottom: 15px; }
.edit-input { flex: 1; }
.btn-add { background: #3b82f6; color: white; border: none; padding: 0 15px; border-radius: 6px; cursor: pointer; font-weight: bold;}
.type-list { list-style: none; padding: 0; margin: 0; max-height: 250px; overflow-y: auto;}
.type-list li { display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 8px; border-radius: 6px;}
.btn-del-type { background: #ef4444; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.85rem;}

.empty-state { text-align: center; padding: 40px; color: #10b981; font-weight: bold; font-size: 1.2rem; background: #ecfdf5; border-radius: 8px; }

/* =========== 表格樣式 =========== */
.table-container { overflow-x: auto; }
.history-table { width: 100%; border-collapse: collapse; text-align: left; }
.history-table th { background: #f1f5f9; padding: 12px; font-weight: bold; color: #475569; border-bottom: 2px solid #cbd5e1; }
.history-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top;}
.student-cell { font-weight: bold; color: #1e293b; }
.seat { background: #cbd5e1; padding: 2px 8px; border-radius: 12px; font-size: 0.85rem; margin-right: 5px;}
.violation-cell { color: #b91c1c; font-weight: bold; }
.count-badge { background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 12px; font-size: 0.85rem; margin-left: 8px; }
.period-badge { background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; font-weight: bold;}
.time-list { margin: 0; padding-left: 15px; font-size: 0.9rem; color: #64748b;}

/* 💡 新增：清單與表格中的操作按鈕樣式 */
.time-list-item { display: flex; align-items: center; margin-bottom: 4px; }
.action-icons { margin-left: 10px; display: inline-flex; gap: 5px; }
.icon-btn { background: none; border: none; cursor: pointer; font-size: 0.9rem; opacity: 0.5; transition: 0.2s; padding: 0;}
.icon-btn:hover { opacity: 1; }
.action-cell { display: flex; gap: 5px; }
.btn-edit-sm { background: #f59e0b; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.85rem;}
.btn-edit-sm:hover { background: #d97706; }
.btn-del-sm { background: #ef4444; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.85rem;}
.btn-del-sm:hover { background: #dc2626; }

@media (max-width: 1024px) {
  .main-content { flex-direction: column; }
  .left-col, .right-col { width: 100%; min-width: 100%; }
}
</style>
