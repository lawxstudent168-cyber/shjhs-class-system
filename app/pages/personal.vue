<template>
  <main class="personal-page">
    <div class="shell">
      <header class="page-header">
        <NuxtLink to="/" class="brand">班級生活 <span>／ 個人首頁</span></NuxtLink>
        <nav v-if="dashboard && !showLogin" aria-label="個人選單">
          <button v-if="dashboard.role === 'parent'" class="quiet" :disabled="loading" @click="startVerification('parent')">驗證另一位孩子</button>
          <button class="quiet" :disabled="loading" @click="logout">登出</button>
        </nav>
      </header>

      <p v-if="error" class="error" role="alert">{{ error }} <button v-if="!showLogin" class="quiet" :disabled="loading" @click="loadDashboard()">重新載入</button></p>
      <p v-if="loading" class="loading" role="status">{{ signingIn ? '正在驗證身分…' : '正在整理個人資料…' }}</p>

      <section v-if="showLogin" class="login-panel">
        <div class="login-intro">
          <p class="eyebrow">每天的班級大小事，一次看清楚</p>
          <h1>歡迎回到<br>你的個人首頁。</h1>
          <p>確認待交作業、查看老師的提醒，<br>為今天和明天做好準備。</p>
          <div class="intro-note">學生查看自己的學習事項；家長可驗證並切換孩子，掌握近期請假與到校紀錄。</div>
        </div>
        <form @submit.prevent="login">
          <h2>{{ dashboard ? '驗證另一位孩子' : '驗證身分' }}</h2>
          <fieldset :disabled="loading">
            <legend>您的身分</legend>
            <label class="role-option"><input v-model="form.role" type="radio" value="student"> 學生</label>
            <label class="role-option"><input v-model="form.role" type="radio" value="parent"> 家長</label>
          </fieldset>
          <label class="field">{{ form.role === 'parent' ? '孩子的座號' : '座號' }}<input v-model="form.seatNumber" inputmode="numeric" pattern="[0-9]{1,3}" maxlength="3" required :disabled="loading" placeholder="例如：12"></label>
          <label class="field">學生生日（西元 8 碼）<input v-model="form.birthday" type="password" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" autocomplete="off" required :disabled="loading" placeholder="例如：20130514"></label>
          <label class="field">學生身分證後五碼<input v-model="form.idLast5" type="password" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" autocomplete="off" required :disabled="loading" placeholder="請輸入後五碼"></label>
          <label v-if="form.role === 'parent'" class="field">已綁定的家長 Email<input v-model="form.email" type="email" autocomplete="email" maxlength="254" required :disabled="loading" placeholder="請輸入完整 Email"></label>
          <p class="muted">{{ form.role === 'parent' ? '同一個 Email 的孩子需逐一驗證，完成後可切換。' : '驗證資料與學生私訊功能使用的資料相同。' }}</p>
          <button class="primary full" :disabled="loading" type="submit">{{ signingIn ? '驗證中…' : '進入個人首頁' }}</button>
          <button v-if="dashboard" class="quiet full" type="button" :disabled="loading" @click="cancelVerification">返回個人首頁</button>
          <NuxtLink v-if="form.role === 'parent'" to="/parent-bind" class="text-link">尚未綁定 Email？前往家長綁定</NuxtLink>
        </form>
      </section>

      <template v-else-if="dashboard && !loading">
        <section class="welcome">
          <div><p class="eyebrow">{{ dashboard.today }} · {{ dashboard.role === 'parent' ? '家長專區' : '學生專區' }}</p>
            <h1>{{ dashboard.student.name }}{{ dashboard.role === 'parent' ? '的班級生活' : '，今天也加油！' }}</h1>
            <p>{{ dashboard.student.seatNumber }} 號 · 先看看需要完成的事，再讀讀老師的提醒。</p>
          </div>
          <div class="welcome-actions">
            <label v-if="dashboard.role === 'parent' && dashboard.children.length > 1" class="field">切換孩子
              <select v-model="selectedStudent" @change="loadDashboard(selectedStudent)"><option v-for="child in dashboard.children" :key="child.id" :value="child.id">{{ child.seatNumber }}號 {{ child.name }}</option></select>
            </label>
            <button class="quiet" @click="loadDashboard(selectedStudent)">重新整理</button>
            <span class="muted">更新於 {{ updatedAt }}</span>
          </div>
        </section>

        <div class="summary" aria-label="作業摘要">
          <a href="#my-assignments" @click="assignmentFilter = 'overdue'" class="urgent"><span>逾期未交</span><strong>{{ dashboard.counts.overdue }}<small>項</small></strong></a>
          <a href="#my-assignments" @click="assignmentFilter = 'dueToday'"><span>今天到期・尚未交</span><strong>{{ dueToday }}<small>項</small></strong></a>
          <a href="#my-assignments" @click="assignmentFilter = 'pending'"><span>全部待完成</span><strong>{{ dashboard.counts.overdue + dashboard.counts.pending }}<small>項</small></strong></a>
        </div>

        <nav class="quick-links" aria-label="常用功能">
          <NuxtLink v-if="dashboard.role === 'student'" to="/student-broadcast">學生手機廣播 ↗</NuxtLink>
          <NuxtLink :to="dashboard.role === 'parent' ? '/parent-message' : '/student-message'">私訊導師 ↗</NuxtLink>
          <NuxtLink v-if="dashboard.role === 'parent'" to="/leave-application">填寫請假通知 ↗</NuxtLink>
          <NuxtLink to="/">班級公共看板 ↗</NuxtLink>
        </nav>
        <p class="muted small">私訊與請假頁保留原有驗證程序。個人首頁只提供查閱，不會將訊息標為已讀。</p>

        <div class="columns">
          <div>
            <section id="my-assignments" class="card">
              <h2>我的作業</h2>
              <div class="filters" aria-label="篩選作業">
                <button v-for="filter in filters" :key="filter.value" :aria-pressed="assignmentFilter === filter.value" @click="assignmentFilter = filter.value">{{ filter.label }}</button>
              </div>
              <p v-if="!visibleAssignments.length" class="empty">{{ assignmentFilter === 'pending' ? '目前沒有待完成的作業。' : '這個分類目前沒有作業。' }}</p>
              <article v-for="item in visibleAssignments" :key="item.id" class="assignment">
                <div><span class="subject">{{ item.subject }}</span><h3>{{ item.title }}</h3><p class="muted">{{ item.deadline ? `截止：${item.deadline}` : '尚未設定截止日' }}</p></div>
                <span class="badge" :class="item.status">{{ statusLabels[item.status] }}</span>
              </article>
            </section>

            <section class="card">
              <h2>聯絡簿與提醒</h2>
              <div v-for="(day, index) in dashboard.reminders" :key="day.date" class="day-block">
                <h3>{{ index === 0 ? '今天' : '明天' }} <span class="muted">{{ day.date }}</span></h3>
                <p v-if="!day.contactItems.length && !day.notes.length" class="empty">老師尚未發布這一天的事項。</p>
                <ul v-else><li v-for="(item, i) in [...day.contactItems, ...day.notes]" :key="i" class="multiline">{{ item }}</li></ul>
              </div>
            </section>

            <section class="card">
              <h2>班級公告</h2>
              <p v-if="!dashboard.announcements.length" class="empty">目前沒有公告。</p>
              <article v-for="(notice, index) in dashboard.announcements" :key="`${notice.id}-${index}`" class="notice">
                <h3>{{ notice.title }}</h3><p v-if="notice.date" class="muted small">{{ formatTime(notice.date) }}</p>
                <p class="multiline">{{ notice.content }}</p>
                <a v-for="(link, i) in notice.links" :key="i" :href="link.url" target="_blank" rel="noopener noreferrer" class="text-link">{{ link.title }} ↗</a>
              </article>
            </section>
          </div>

          <aside>
            <section class="card">
              <h2>導師的訊息</h2><p class="muted small">最近 30 天 · {{ dashboard.role === 'parent' ? '家長' : '學生' }}對話</p>
              <p v-if="!dashboard.messages.length" class="empty">近期沒有導師訊息。</p>
              <article v-for="message in dashboard.messages" :key="message.id" class="notice"><time class="muted small">{{ formatTime(message.date) }}</time><p class="multiline">{{ message.content }}</p></article>
            </section>
            <section v-if="dashboard.role === 'parent'" class="card">
              <h2>請假通知進度</h2><p class="muted small">最近 30 天送出的通知。已讀不代表核准，仍須依學校規定補妥請假手續。</p>
              <p v-if="!dashboard.leaves.length" class="empty">近期沒有請假通知。</p>
              <article v-for="leave in dashboard.leaves" :key="leave.id" class="notice"><span class="badge" :class="leave.seen ? 'submitted' : 'pending'">{{ leave.seen ? '導師已讀' : '尚未讀取' }}</span><p class="multiline">{{ leave.content }}</p><time class="muted small">送出：{{ formatTime(leave.date) }}</time></article>
            </section>
            <section class="card">
              <h2>近期出缺席</h2><p class="muted small">最近 30 天的既有紀錄；沒有紀錄的日期不推定為缺席。</p>
              <p v-if="!dashboard.attendance.length" class="empty">近期尚無紀錄。</p>
              <ul v-else class="attendance"><li v-for="(record, i) in dashboard.attendance" :key="i"><time>{{ record.date }}</time><strong>{{ record.status }}</strong></li></ul>
            </section>
          </aside>
        </div>
      </template>
      <footer>使用共用裝置時，離開前請登出個人首頁。登入狀態最長保留 8 小時。</footer>
    </div>
  </main>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { broadcastStop } from '../utils/broadcastStop.js'
useHead({ title: '學生與家長個人首頁', meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
const dashboard = ref(null)
const loading = ref(true)
const signingIn = ref(false)
const showLogin = ref(false)
const error = ref('')
const selectedStudent = ref('')
const updatedAt = ref('')
const assignmentFilter = ref('pending')
const form = reactive({ role: 'parent', seatNumber: '', birthday: '', idLast5: '', email: '' })
const filters = [{ value: 'pending', label: '待完成' }, { value: 'overdue', label: '逾期' }, { value: 'dueToday', label: '今天到期' }, { value: 'submitted', label: '已交' }, { value: 'all', label: '全部' }]
const statusLabels = { submitted: '已交', overdue: '逾期未交', pending: '待繳交' }
const dueToday = computed(() => dashboard.value?.assignments.filter(a => a.deadline === dashboard.value.today && a.status !== 'submitted').length || 0)
const visibleAssignments = computed(() => (dashboard.value?.assignments || []).filter(a => {
  if (assignmentFilter.value === 'all') return true
  if (assignmentFilter.value === 'pending') return a.status !== 'submitted'
  if (assignmentFilter.value === 'dueToday') return a.deadline === dashboard.value.today && a.status !== 'submitted'
  return a.status === assignmentFilter.value
}))
const formatTime = value => new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })
const statusOf = err => err.statusCode || err.response?.status
function clearCredentials() { form.birthday = ''; form.idLast5 = '' }

async function loadDashboard(id, initial = false) {
  loading.value = true
  error.value = ''
  dashboard.value = null
  try {
    const data = await $fetch('/api/personal-home', { query: id ? { studentId: id } : undefined, retry: 0 })
    dashboard.value = data
    selectedStudent.value = data.student.id
    showLogin.value = false
    updatedAt.value = new Date().toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })
  } catch (err) {
    if (statusOf(err) === 401) {
      showLogin.value = true
      selectedStudent.value = ''
      if (!initial) error.value = '登入已失效，請重新驗證身分。'
    } else {
      error.value = '暫時無法載入個人首頁，請稍後重試。若持續發生，請聯繫導師確認系統設定。'
    }
  } finally { loading.value = false }
}

async function login() {
  broadcastStop()
  if (loading.value) return
  loading.value = true
  signingIn.value = true
  error.value = ''
  try {
    const result = await $fetch('/api/personal-home/session', { method: 'POST', body: { ...form }, retry: 0 })
    dashboard.value = null
    assignmentFilter.value = 'pending'
    signingIn.value = false
    await loadDashboard(result.studentId)
    await nextTick()
    window.scrollTo({ top: 0 })
  } catch (err) {
    error.value = statusOf(err) === 429 ? '嘗試次數過多，請 15 分鐘後再試。'
      : statusOf(err) === 401 ? '驗證失敗，請確認座號、生日、身分證後五碼與家長綁定資料。'
        : '暫時無法驗證，請稍後重試或聯繫導師。'
  } finally { clearCredentials(); loading.value = false; signingIn.value = false }
}

function startVerification(role) {
  broadcastStop()
  clearCredentials()
  form.role = role
  form.seatNumber = ''
  error.value = ''
  showLogin.value = true
}
function cancelVerification() { clearCredentials(); error.value = ''; showLogin.value = false }
async function logout() {
  broadcastStop()
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/personal-home/logout', { method: 'POST', body: {}, retry: 0 })
    dashboard.value = null
    selectedStudent.value = ''
    form.email = ''
    form.seatNumber = ''
    clearCredentials()
    showLogin.value = true
  } catch { error.value = '登出未完成，請恢復連線後再按一次登出。' }
  finally { loading.value = false }
}
onMounted(() => loadDashboard(undefined, true))
</script>

<style scoped>
.personal-page { min-height: 100vh; background: #f4f7f6; color: #243b38; font-family: system-ui, sans-serif; padding: 24px; }
.personal-page * { box-sizing: border-box; } .shell { max-width: 1120px; margin: auto; }
.page-header, .welcome, .page-header nav { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.page-header { padding: 10px 0 28px; border-bottom: 1px solid #dce6e2; }
.brand { font-size: 1.15rem; font-weight: 750; color: #17594d; text-decoration: none; } .brand span { color: #526962; font-weight: 400; }
h1 { font-size: clamp(1.8rem, 4vw, 2.7rem); line-height: 1.35; letter-spacing: -.035em; margin: 12px 0; } h2 { font-size: 1.2rem; margin: 0 0 18px; } h3 { font-size: 1rem; margin: 8px 0; } p, li { line-height: 1.75; }
.eyebrow { color: #327869; font-size: .9rem; letter-spacing: .06em; } .muted { color: #5c706a; } .small { font-size: .85rem; }
.welcome { margin: 32px 0; align-items: flex-start; } .welcome-actions { display: grid; gap: 10px; min-width: 170px; }
button, select, input { font: inherit; } button { cursor: pointer; } button:disabled { cursor: wait; opacity: .55; }
button, .quick-links a { border-radius: 9px; padding: 10px 16px; } .primary { border: 1px solid #17654f; background: #17654f; color: white; font-weight: 650; }
.quiet { background: white; color: #215b4e; border: 1px solid #bdd1c9; } .full { width: 100%; margin-top: 12px; }
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 3px solid #b57924; outline-offset: 3px; }
.login-panel { display: grid; grid-template-columns: 1fr 1fr; background: white; border: 1px solid #dce6e2; border-radius: 20px; overflow: hidden; margin: 40px auto; }
.login-intro { padding: 48px; background: #e4eee8; } .intro-note { border-top: 1px solid #bbcec3; margin-top: 50px; padding-top: 22px; line-height: 1.8; color: #4d6b5f; }
form { padding: 36px; } fieldset { border: 0; padding: 0; margin: 0 0 18px; } legend { margin-bottom: 10px; } .role-option { display: inline-flex; gap: 6px; margin-right: 24px; }
.field { display: grid; gap: 8px; font-size: .9rem; margin-bottom: 16px; } input:not([type=radio]), select { width: 100%; min-width: 0; border: 1px solid #b9cbc3; border-radius: 8px; padding: 11px; background: #fff; color: #243b38; }
.text-link { display: block; color: #1d6958; margin-top: 14px; overflow-wrap: anywhere; }
.summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.summary a { border: 1px solid #d5e3dc; border-radius: 14px; padding: 22px; background: white; text-decoration: none; color: #285b4c; }
.summary .urgent { background: #fbf0e8; border-color: #efdbcc; color: #894b25; } .summary strong { display: block; font-size: 2.5rem; margin-top: 8px; } .summary small { font-size: .85rem; margin-left: 10px; font-weight: 400; }
.quick-links { display: flex; flex-wrap: wrap; gap: 12px; margin: 24px 0 8px; } .quick-links a { background: #e4ede8; text-decoration: none; color: #205c49; }
.columns { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: 24px; margin-top: 26px; }
.card { padding: 26px; border: 1px solid #dce6e2; border-radius: 14px; background: white; margin-bottom: 24px; scroll-margin-top: 20px; overflow-wrap: anywhere; }
.filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; } .filters button { border: 0; background: #f0f4f2; color: #526962; font-size: .85rem; padding: 8px 12px; } .filters button[aria-pressed=true] { background: #246a54; color: white; }
.assignment { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 18px 0; border-top: 1px solid #e8eeeb; } .assignment > div { min-width: 0; } .assignment p { margin: 5px 0 0; font-size: .85rem; } .subject { font-size: .8rem; color: #536b62; }
.badge { display: inline-block; white-space: nowrap; border-radius: 6px; padding: 5px 8px; font-size: .75rem; } .pending { background: #f5f0dc; color: #746222; } .overdue { background: #f9e8e0; color: #8a4326; } .submitted { background: #e4f0e9; color: #276344; }
.notice, .day-block { border-top: 1px solid #e8eeeb; padding: 18px 0 6px; } .day-block h3 span { font-size: .85rem; font-weight: 400; margin-left: 6px; } ul { padding-left: 20px; } .multiline { white-space: pre-wrap; overflow-wrap: anywhere; }
.empty { color: #62756e; background: #f6f8f7; padding: 15px; border-radius: 8px; } .attendance { list-style: none; padding: 0; } .attendance li { display: flex; gap: 12px; justify-content: space-between; padding: 12px 0; border-top: 1px solid #e8eeeb; font-size: .9rem; } .attendance strong { text-align: right; }
.error { background: #fff0ec; color: #973d28; border: 1px solid #f0cabe; border-radius: 10px; padding: 16px; } .loading { padding: 24px 0; color: #42675a; } footer { padding: 20px 0; color: #62756e; text-align: center; font-size: .8rem; }
@media(max-width: 760px) { .personal-page { padding: 16px; } .login-panel, .columns { grid-template-columns: 1fr; } .login-intro { padding: 28px; } .intro-note { margin-top: 22px; } form { padding: 24px; } .summary { gap: 8px; } .summary a { padding: 14px 10px; font-size: .8rem; } .summary strong { font-size: 2rem; } .card { padding: 20px; } .welcome-actions { width: 100%; } .page-header nav { gap: 8px; } }
@media(prefers-reduced-motion: no-preference) { button, a { transition: background-color .15s; } }
</style>
