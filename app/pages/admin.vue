<template>
  <div class="admin-container">
    <div v-if="!isUnlocked" class="lock-screen">
      <div class="lock-box">
        <h2>🔒 導師專屬後台</h2>
        <input v-model="passwordInput" type="password" placeholder="請輸入密碼" @keyup.enter="verifyPassword" />
        <button :disabled="authBusy" @click="verifyPassword">{{ authBusy ? '驗證中…' : '登入' }}</button>
        <p v-if="authError" role="alert">{{ authError }}</p>
        <NuxtLink to="/" class="back-link">⬅️ 返回首頁</NuxtLink>
      </div>
    </div>

    <div v-else class="dashboard">
      <header class="admin-header">
        <h2>📊 班級數據中心 (導師專用)</h2>
        <div class="header-buttons">
          <button @click="currentTab = 'today'" :class="{ active: currentTab === 'today' }">☀️ 今日待辦</button>
          <button @click="currentTab = 'board'" :class="{ active: currentTab === 'board' }">📢 家長須知事項推播</button>          
          <button @click="currentTab = 'parentAnnouncements'" :class="{ active: currentTab === 'parentAnnouncements' }">📌 家長公佈欄</button>
          
          <!-- 💡 加入好文分享管理按鈕，排在公佈欄旁邊最直覺 -->
          <button @click="currentTab = 'goodArticles'" :class="{ active: currentTab === 'goodArticles' }">📖 好文分享管理</button>

          <button @click="currentTab = 'announcements'" :class="{ active: currentTab === 'announcements' }">📌 班級公佈欄</button>
          <button @click="currentTab = 'classNotes'" :class="{ active: currentTab === 'classNotes' }">⚡ 今日班級注意事項管理</button>
          <button @click="currentTab = 'contact'" :class="{ active: currentTab === 'contact' }">⭐ 今日聯絡簿管理</button>

          <button @click="todoThread = ''; currentTab = 'messages'" :class="{ active: currentTab === 'messages' }">💬 家長和學生私訊管理</button>
          <button @click="currentTab = 'attendance'" :class="{ active: currentTab === 'attendance' }">⏰ 學生遲到管理</button>
          <button @click="currentTab = 'homework'" :class="{ active: currentTab === 'homework' }">📚 作業繳交推播與科任密碼設定</button>
          <button @click="currentTab = 'students'" :class="{ active: currentTab === 'students' }">👩‍🎓 學生資料名單管理</button>
          <button @click="currentTab = 'security'" :class="{ active: currentTab === 'security' }">🛡️ 安全與 IP鎖定</button>
          
          <button @click="currentTab = 'audit'" :class="{ active: currentTab === 'audit' }">🕵️ 系統權限操作稽核</button>
          <button @click="currentTab = 'communication'" :class="{ active: currentTab === 'communication' }">📨 家長須知推播紀錄</button>
          <button @click="currentTab = 'officers'" :class="{ active: currentTab === 'officers' }">🔐 幹部職位密碼管理</button>
          
          <button @click="currentTab = 'settings'" :class="{ active: currentTab === 'settings' }">⚙️ 系統密碼設定</button>
          <button @click="currentTab = 'marqueeSettings'" :class="{ active: currentTab === 'marqueeSettings' }">📢 首頁跑馬燈設定</button>
          
          <button @click="currentTab = 'youtubeSchedule'" :class="{ active: currentTab === 'youtubeSchedule' }">📺 首頁輪播影片設定</button>
          
          <button @click="currentTab = 'broadcast'" :class="{ active: currentTab === 'broadcast' }">📢 遠端廣播與定時</button>
          
          <button @click="currentTab = 'backup'" :class="{ active: currentTab === 'backup' }">📦 系統備份</button>
          
          <button @click="currentTab = 'visitors'" :class="{ active: currentTab === 'visitors' }">👁️ 全網站訪客紀錄</button>
          <button @click="currentTab = 'visitor'" :class="{ active: currentTab === 'visitor' }">📦 訪客足跡進階追蹤</button>
          <button @click="currentTab = 'classroomTracker'" :class="{ active: currentTab === 'classroomTracker' }">🖥️ 教室電腦監視器</button>
          <button @click="currentTab = 'identityTracking'" :class="{ active: currentTab === 'identityTracking' }">🕵️ （家長與）實名足跡追蹤</button>
          <button @click="currentTab = 'indexButtons'" :class="{ active: currentTab === 'indexButtons' }">🎛️ 首頁按鈕控制</button>
          <button @click="currentTab = 'roleSettings'" :class="{ active: currentTab === 'roleSettings' }">🎯 首頁按鈕權限設定</button>

          <button @click="handleLogout" class="logout-btn">🚪 導師登出</button>
          <NuxtLink to="/" class="back-btn">⬅️ 返回前台</NuxtLink>
        </div>
      </header>

      <main class="data-table">
        <AdminTodayTodos v-if="currentTab === 'today'" @open-message="openTodoMessage" @open-attendance="currentTab = 'attendance'" />
        <AdminAttendance v-if="currentTab === 'attendance'" />
        <AdminHomework v-if="currentTab === 'homework'" />
        <AdminClassNotes v-if="currentTab === 'classNotes'" />
        <AdminContact v-if="currentTab === 'contact'" />
        <AdminBoard v-if="currentTab === 'board'" />
        <AdminParentAnnouncements v-if="currentTab === 'parentAnnouncements'" />
        
        <!-- 💡 掛載好文分享元件 -->
        <AdminGoodArticles v-if="currentTab === 'goodArticles'" />

        <AdminAnnouncements v-if="currentTab === 'announcements'" />
        <AdminMessages v-if="currentTab === 'messages'" :initial-thread="todoThread" />
        <AdminStudents v-if="currentTab === 'students'" />
        <AdminSecurity v-if="currentTab === 'security'" />
        <AdminVisitors v-if="currentTab === 'visitors'" />
        <AdminAudit v-if="currentTab === 'audit'" />
        <AdminCommunication v-if="currentTab === 'communication'" />
        <AdminOfficers v-if="currentTab === 'officers'" />
        
        <AdminClassroomTracker v-if="currentTab === 'classroomTracker'" />
        <AdminIdentityTracking v-if="currentTab === 'identityTracking'" />
        <AdminVisitorTracking v-if="currentTab === 'visitor'" />
        <AdminSettings v-if="currentTab === 'settings'" />
        <AdminMarqueeSettings v-if="currentTab === 'marqueeSettings'" />
        
        <AdminYouTubeSchedule v-if="currentTab === 'youtubeSchedule'" />
        
        <AdminBroadcast v-if="currentTab === 'broadcast'" />
        
        <AdminIndexButtons v-if="currentTab === 'indexButtons'" />
        <AdminRoleButtonSettings v-if="currentTab === 'roleSettings'" />
        <AdminBackup v-if="currentTab === 'backup'" />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const authBusy = ref(true)
const supabase = useSupabaseClient()
const authError = ref('')
const teacherSession = body => $fetch('/api/teacher-session', { method: 'POST', body, retry: 0, timeout: 5000 })
const isUnlocked = ref(false)
const passwordInput = ref('')
const currentTab = ref('today')
const todoThread = ref('')
const openTodoMessage = (message) => {
  todoThread.value = `${message.student_id}_${message.chat_type}`
  currentTab.value = 'messages'
}

onMounted(async () => {
  // A browser storage flag alone never grants teacher access.
  sessionStorage.removeItem('main_admin_logged_in')
  try {
    await teacherSession({ action: 'status' })
    isUnlocked.value = true
  } catch {}
  finally { authBusy.value = false }
})

const verifyPassword = async () => {
  if (authBusy.value) return
  authBusy.value = true
  authError.value = ''
  try {
    await teacherSession({ action: 'login', password: passwordInput.value })
    isUnlocked.value = true
    // Preserve the existing best-effort teacher visit record after successful login.
    void (async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) })
        const { ip } = await response.json()
        await supabase.from('visitor_logs').insert([{ ip_address: ip, device_info: navigator.userAgent, role: '導師' }])
      } catch {}
    })()
  } catch (error) {
    const status = error?.statusCode || error?.response?.status
    authError.value = status === 429 ? '嘗試次數過多，請 15 分鐘後再試。'
      : status === 503 ? '登入服務暫時無法使用，請稍後再試。'
      : status === 401 ? '登入失敗，請確認密碼後重試。' : '無法登入，請確認連線後重試。'
  } finally {
    passwordInput.value = ''
    authBusy.value = false
  }
}

const handleLogout = async () => {
  if (authBusy.value) return
  authBusy.value = true
  try {
    await teacherSession({ action: 'logout' })
    isUnlocked.value = false
    passwordInput.value = ''
    for (const key of ['main_admin_logged_in', 'exams_admin_logged_in', 'hygiene_admin_logged_in', 'schedule_admin_logged_in']) {
      sessionStorage.removeItem(key)
    }
    await navigateTo('/')
  } catch {
    alert('登出尚未完成，請恢復連線後重試。')
  } finally { authBusy.value = false }
}
</script>

<style scoped>
.admin-container { min-height: 100vh; background-color: #f1f5f9; font-family: sans-serif; padding-bottom: 50px; }
.lock-screen { display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #1e293b; }
.lock-box { background: white; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); width: 400px; }
.lock-box h2 { margin-top: 0; margin-bottom: 25px; color: #1e293b; font-size: 1.5rem; }
.lock-box input { width: 100%; padding: 12px; margin-bottom: 20px; border: 1px solid #cbd5e1; border-radius: 6px; text-align: center; box-sizing: border-box; font-size: 1.1rem; }
.lock-box button { width: 100%; padding: 12px; background-color: #3b82f6; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 1.1rem; cursor: pointer; transition: 0.2s; }
.lock-box button:hover { background: #2563eb; }
.back-link { display: inline-block; margin-top: 20px; color: #64748b; text-decoration: none; font-weight: bold; font-size: 0.95rem; transition: color 0.2s; }
.back-link:hover { color: #3b82f6; }

.dashboard { max-width: 1400px; margin: 0 auto; padding: 20px; }
.admin-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; background: white; padding: 15px 25px; border-radius: 12px; flex-wrap: wrap; gap: 15px; }
.header-buttons button { padding: 8px 15px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; background: #e2e8f0; color: #475569; margin-right: 5px; margin-bottom: 5px; transition: 0.2s; }
.header-buttons button:hover { background: #cbd5e1; }
.header-buttons button.active { background: #3b82f6; color: white; }

.logout-btn { background: #f97316 !important; color: white !important; }
.logout-btn:hover { background: #ea580c !important; }

.back-btn { text-decoration: none; padding: 8px 15px; border-radius: 6px; font-weight: bold; background: #ef4444; color: white; display: inline-block; transition: 0.2s; }
.back-btn:hover { background: #dc2626; }
.data-table { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
</style>
