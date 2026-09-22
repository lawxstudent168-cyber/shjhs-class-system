<template>
  <section class="todos" :aria-busy="loading">
    <header class="todo-header">
      <div><h3>☀️ 導師今日待辦</h3><p>{{ today }} · 包含先前尚未處理的項目</p></div>
      <button :disabled="loading" @click="refresh">{{ loading ? '更新中…' : '重新整理' }}</button>
    </header>
    <p v-if="error" role="alert" class="error">{{ error }} <button @click="refresh">重試</button></p>
    <p v-else-if="loading" role="status">正在彙整班級待辦…</p>
    <template v-else-if="todos">
      <p class="updated" role="status">最後更新：{{ updatedAt }}。處理後返回此頁會重新載入。</p>
      <div class="summary">
        <a href="#todo-leaves"><strong>{{ todos.leaves.length }}</strong>則未讀請假通知</a>
        <a href="#todo-messages"><strong>{{ todos.messages.length }}</strong>則其他未讀訊息</a>
        <a href="#todo-homework"><strong>{{ todos.overdue.length }}</strong>項逾期作業 · {{ missingCount }} 人次未交</a>
      </div>
      <p v-if="!todos.leaves.length && !todos.messages.length && !todos.overdue.length" class="empty">目前沒有未讀通知或逾期未交作業。</p>
      <section id="todo-leaves" class="todo-section">
        <h4>📋 未讀請假通知（{{ todos.leaves.length }}）</h4>
        <p class="hint">開啟對話後依既有流程標為已讀；已讀不代表請假核准，出缺席仍須另行確認。</p>
        <button class="secondary" @click="$emit('open-attendance')">前往出缺席管理</button>
        <p v-if="!todos.leaves.length" class="empty">沒有未讀請假通知。</p>
        <article v-for="item in todos.leaves" :key="item.id">
          <div><strong>{{ item.studentLabel }}</strong><time>{{ formatTime(item.created_at) }}</time><p class="content">{{ item.content }}</p></div>
          <button @click="$emit('open-message', item)">查看請假對話</button>
        </article>
      </section>
      <section id="todo-messages" class="todo-section">
        <h4>💬 其他未讀訊息（{{ todos.messages.length }}）</h4>
        <p class="hint">依最早收到時間排列；此清單追蹤未讀狀態，不代表所有尚未回覆的訊息。</p>
        <p v-if="!todos.messages.length" class="empty">沒有其他未讀訊息。</p>
        <article v-for="item in todos.messages" :key="item.id">
          <div><strong>{{ item.studentLabel }} · {{ item.chat_type }}</strong><time>{{ formatTime(item.created_at) }}</time><p class="content">{{ item.content }}</p></div>
          <button @click="$emit('open-message', item)">查看並回覆</button>
        </article>
      </section>
      <section id="todo-homework" class="todo-section">
        <h4>📚 逾期未交作業（{{ todos.overdue.length }} 項）</h4>
        <p class="hint">截止日在今天以前且仍有人未交的作業；今天到期、無期限及全數繳交的作業不列入。包含不寄送家長通知的作業。</p>
        <p v-if="!todos.overdue.length" class="empty">沒有逾期未交作業。</p>
        <article v-for="item in todos.overdue" :key="item.id">
          <div><strong>[{{ item.subject_name }}] {{ item.title }}</strong><p>期限：{{ item.deadline }} · 未交 {{ item.missing.length }} 人</p>
            <details><summary>查看未交名單</summary><p>{{ item.missing.map(s => `${s.seat_number}號 ${s.real_name}`).join('、') }}</p></details>
          </div>
          <NuxtLink :to="{ path: '/assignments', query: { assignment: String(item.id) } }">前往作業登記</NuxtLink>
        </article>
      </section>
    </template>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { schoolDate, fetchAllRows, buildTeacherTodos } from '../utils/teacherTodos.js'
defineEmits(['open-message', 'open-attendance'])
const supabase = useSupabaseClient()
const today = ref(schoolDate())
const loading = ref(false)
const error = ref('')
const todos = ref(null)
const updatedAt = ref('')
let disposed = false
const missingCount = computed(() => todos.value?.overdue.reduce((sum, a) => sum + a.missing.length, 0) || 0)
const formatTime = value => new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })
async function refresh() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  todos.value = null
  today.value = schoolDate()
  try {
    const [students, messages, assignments, submissions] = await Promise.all([
      fetchAllRows(() => supabase.from('students').select('id,seat_number,real_name').order('id')),
      fetchAllRows(() => supabase.from('private_messages').select('id,student_id,chat_type,sender_role,content,created_at,is_read_by_teacher').eq('is_read_by_teacher', false).neq('sender_role', '導師').order('id')),
      fetchAllRows(() => supabase.from('assignments').select('id,subject_name,title,deadline').lt('deadline', today.value).order('id')),
      fetchAllRows(() => supabase.from('assignment_submissions').select('id,assignment_id,student_id').order('id'))
    ])
    if (disposed) return
    todos.value = buildTeacherTodos({ students, messages, assignments, submissions, today: today.value })
    updatedAt.value = formatTime(new Date())
  } catch (err) {
    if (!disposed) error.value = '待辦資料載入失敗，無法確認目前數量，請重試。'
  } finally {
    if (!disposed) loading.value = false
  }
}
onMounted(refresh)
onBeforeUnmount(() => { disposed = true })
</script>

<style scoped>
.todos { color: #1e293b; }
.todo-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
h3 { margin: 0; font-size: 1.5rem; } h4 { font-size: 1.15rem; margin: 0 0 12px; }
.todo-header p, .hint, .updated { color: #64748b; line-height: 1.6; }
button, article > a { border: 0; border-radius: 8px; padding: 11px 16px; background: #1d4ed8; color: white; font: inherit; text-decoration: none; cursor: pointer; flex-shrink: 0; }
button:disabled { opacity: .6; cursor: wait; } button:focus-visible, a:focus-visible, summary:focus-visible { outline: 3px solid #f59e0b; outline-offset: 3px; }
.summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0; }
.summary a { padding: 22px; border: 1px solid #cbd5e1; border-radius: 12px; background: #eff6ff; color: #1e3a8a; text-decoration: none; }
.summary strong { display: block; font-size: 2rem; margin-bottom: 8px; }
.todo-section { border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-top: 20px; scroll-margin-top: 20px; }
article { display: flex; align-items: center; justify-content: space-between; gap: 20px; border-top: 1px solid #e2e8f0; padding: 18px 0; }
article > div { min-width: 0; overflow-wrap: anywhere; } time { display: block; color: #64748b; font-size: .85rem; margin-top: 6px; }
.content { white-space: pre-wrap; max-height: 150px; overflow: auto; line-height: 1.6; }
.empty { background: #f8fafc; padding: 16px; border-radius: 8px; color: #475569; }
.error { padding: 16px; background: #fef2f2; color: #991b1b; } .secondary { background: #e2e8f0; color: #334155; }
summary { cursor: pointer; color: #1d4ed8; }
@media (max-width: 700px) { .summary { grid-template-columns: 1fr; } article { align-items: flex-start; flex-direction: column; } .todo-section { padding: 14px; } }
</style>
