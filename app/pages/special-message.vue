<template>
  <div class="message-container">
    <div class="message-card">
      <div v-if="!isVerified" class="verify-section">
        <div class="card-header"><h2>特別私訊</h2></div>
        <form class="message-form" @submit.prevent="verifyIdentity">
          <input v-model="accessCode" type="password" inputmode="numeric" maxlength="8" pattern="[0-9]{8}"
            autocomplete="off" aria-label="輸入資料" required :disabled="isLoading" />
          <div v-if="sysMessage" class="message-box error">{{ sysMessage }}</div>
          <button type="submit" class="submit-btn" :disabled="isLoading">{{ isLoading ? '驗證中…' : '進入' }}</button>
          <div class="back"><NuxtLink to="/">返回首頁</NuxtLink></div>
        </form>
      </div>

      <div v-else class="chat-section">
        <div class="chat-header"><h3>特別私訊（{{ verifiedStudentName }}）</h3><button type="button" @click="logout">登出</button></div>
        <div id="specialChatContainer" class="chat-history">
          <div v-if="chatMessages.length === 0" class="empty-chat">目前無對話紀錄。</div>
          <div v-for="msg in chatMessages" :key="msg.id" :class="['chat-bubble', msg.sender_role === '學生' ? 'my-msg' : 'teacher-msg']">
            <div class="msg-info"><span>{{ msg.sender_role === '學生' ? '我' : '導師' }}</span><span>{{ formatTime(msg.created_at) }}</span></div>
            <div class="msg-content">{{ msg.content }}</div>
          </div>
          <PrivateMediaThread :student-id="studentId" chat-type="學生" @media-sent="recordMediaMessage" />
        </div>
        <form class="reply-form" @submit.prevent="sendMessage">
          <textarea v-model="newMessage" rows="2" required :disabled="isSending" aria-label="私訊內容"></textarea>
          <button type="submit" :disabled="isSending">{{ isSending ? '…' : '傳送' }}</button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { beginVisitorSession, endVisitorSession, trackVisitorEvent } from '../utils/visitorTrackingClient.js'

const supabase = useSupabaseClient()
const accessCode = ref(''), isLoading = ref(false), isSending = ref(false), isVerified = ref(false)
const studentId = ref(''), verifiedStudentName = ref(''), seatNumber = ref(''), teacherEmail = ref('')
const chatMessages = ref([]), newMessage = ref(''), sysMessage = ref('')

const loadTeacherEmail = async () => {
  const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'teacher_msg_notify_email').maybeSingle()
  teacherEmail.value = typeof data?.setting_value === 'string' ? data.setting_value : ''
}
const scrollToBottom = () => nextTick(() => {
  const container = document.getElementById('specialChatContainer')
  if (container) container.scrollTop = container.scrollHeight
})
const loadChatHistory = async () => {
  const { data } = await supabase.from('private_messages').select('*').eq('student_id', studentId.value)
    .eq('chat_type', '學生').order('created_at', { ascending: true })
  if (data) { chatMessages.value = data; scrollToBottom() }
}
const notifyTeacher = async summary => {
  if (!teacherEmail.value.includes('@')) return
  const student = `${seatNumber.value ? `${seatNumber.value}號 ` : ''}${verifiedStudentName.value || '學生'}`
  try {
    await $fetch('/api/send-email', { method: 'POST', body: {
      to: teacherEmail.value,
      subject: `🔔 班級系統通知：${student}傳送了特別私訊`,
      content: `導師您好：\n\n${student}傳送了一則新的特別私訊。\n\n內容摘要：${summary}\n\n請登入班級系統後台查看。`
    }, retry: 0 })
  } catch { /* Message delivery must not be rolled back when optional email fails. */ }
}
const verifyIdentity = async () => {
  if (!/^\d{8}$/.test(accessCode.value)) { sysMessage.value = '資料不正確'; return }
  isLoading.value = true; sysMessage.value = ''
  try {
    const session = await $fetch('/api/private-media/session', { method: 'POST', body: {
      action: 'login', role: 'student', authMethod: 'birthday-only', birthday: accessCode.value
    }, retry: 0 })
    studentId.value = String(session.studentId)
    const { data } = await supabase.from('students').select('real_name,seat_number').eq('id', studentId.value).maybeSingle()
    verifiedStudentName.value = data?.real_name || '學生'
    seatNumber.value = data?.seat_number || ''
    isVerified.value = true; accessCode.value = ''
    await loadTeacherEmail()
    void beginVisitorSession(`${verifiedStudentName.value} 學生`, '特別私訊身分驗證')
    await loadChatHistory()
  } catch { sysMessage.value = '資料不正確' }
  finally { isLoading.value = false }
}
const saveStudentMessage = async content => {
  const { error } = await supabase.from('private_messages').insert({ student_id: studentId.value, sender_role: '學生',
    chat_type: '學生', content, is_read_by_teacher: false })
  if (error) throw error
  await loadChatHistory()
  void notifyTeacher(content)
}
const sendMessage = async () => {
  const content = newMessage.value.trim()
  if (!content || isSending.value) return
  isSending.value = true
  try {
    await saveStudentMessage(content)
    newMessage.value = ''
    void trackVisitorEvent({ kind: 'operation', label: '傳送特別私訊', outcome: '成功' })
  } catch { alert('傳送失敗') }
  finally { isSending.value = false }
}
const recordMediaMessage = async media => {
  const type = media?.mimeType?.startsWith('video/') ? '影片' : '圖片'
  const content = `📎 已傳送${type}${media?.caption ? `：${media.caption}` : ''}`
  try { await saveStudentMessage(content); void trackVisitorEvent({ kind: 'operation', label: `傳送特別私訊${type}`, outcome: '成功' }) }
  catch { alert('附件已上傳，但未讀提示建立失敗，請另傳一則文字通知導師。') }
}
const logout = async () => {
  try { await $fetch('/api/private-media/session', { method: 'POST', body: { action: 'logout' }, retry: 0 }) }
  catch { alert('登出尚未完成，請稍後重試。'); return }
  void endVisitorSession('特別私訊登出')
  isVerified.value = false; studentId.value = ''; chatMessages.value = []
}
const formatTime = value => new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

onMounted(() => {
  const enteredAt = Number(sessionStorage.getItem('special_message_entry'))
  sessionStorage.removeItem('special_message_entry')
  if (!Number.isFinite(enteredAt) || Date.now() - enteredAt > 60_000) return navigateTo('/')
})
</script>

<style scoped>
.message-container { min-height: 100vh; display: flex; justify-content: center; align-items: center; background: #f5f3ff; padding: 10px; font-family: sans-serif; }
.message-card { width: 100%; max-width: 500px; overflow: hidden; background: white; border-radius: 16px; border-top: 8px solid #7c3aed; box-shadow: 0 10px 25px rgba(0,0,0,.1); }
.verify-section { padding: 36px 30px; } .card-header { text-align: center; margin-bottom: 28px; } h2 { color: #5b21b6; }
.message-form { display: grid; gap: 18px; } .message-form input { width: 100%; box-sizing: border-box; padding: 14px; border: 1px solid #c4b5fd; border-radius: 8px; font-size: 1.2rem; text-align: center; }
.submit-btn { padding: 14px; border: 0; border-radius: 8px; color: white; background: #7c3aed; font-size: 1.1rem; font-weight: bold; cursor: pointer; }
.message-box { padding: 10px; text-align: center; border-radius: 8px; } .error { color: #b91c1c; background: #fef2f2; }
.back { text-align: center; } .back a { color: #6d28d9; text-decoration: none; }
.chat-section { display: flex; flex-direction: column; height: 80vh; max-height: 680px; }
.chat-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: #ede9fe; }
.chat-header h3 { margin: 0; color: #5b21b6; } .chat-header button { padding: 7px 12px; border: 0; border-radius: 6px; color: white; background: #ef4444; }
.chat-history { flex: 1; overflow-y: auto; padding: 18px; background: #f8fafc; display: flex; flex-direction: column; gap: 13px; }
.empty-chat { text-align: center; color: #94a3b8; margin: 35px 0; }
.chat-bubble { max-width: 80%; padding: 10px 14px; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,.1); }
.my-msg { align-self: flex-end; background: #ede9fe; } .teacher-msg { align-self: flex-start; background: #dcfce7; }
.msg-info { display: flex; justify-content: space-between; gap: 14px; margin-bottom: 4px; color: #64748b; font-size: .75rem; }
.msg-content { white-space: pre-wrap; overflow-wrap: anywhere; color: #1e293b; }
.reply-form { display: flex; gap: 10px; padding: 14px; border-top: 1px solid #e2e8f0; }
.reply-form textarea { min-width: 0; flex: 1; resize: none; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; }
.reply-form button { padding: 0 18px; border: 0; border-radius: 8px; color: white; background: #7c3aed; font-weight: bold; }
</style>
