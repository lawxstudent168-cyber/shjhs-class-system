<template>
  <div class="message-container">
    <div class="message-card">
      <div v-if="!isVerified" class="verify-section">
        <div class="card-header">
          <h2>💬 家長私訊導師</h2>
          <div class="security-notice">
            🔒 提醒家長：為維護資安與嚴格保護學生個資，請擇一方式進行身分驗證，完成後即可檢視與導師的對話紀錄。<br>
            （學生的身份證後4碼和生日已經建構完成，可用來認證登入。也可先用email綁定功能，或提供email給導師為您綁定，再用email前五碼即可進入和導師私訊或請假。）
          </div>
        </div>

        <form @submit.prevent="verifyIdentity" class="message-form">
          <div class="form-group">
            <label>👩‍🎓 選擇學生</label>
            <select v-model="selectedStudentId" required :disabled="isLoading">
              <option value="" disabled selected>請選擇座號與姓名...</option>
              <option v-for="student in students" :key="student.id" :value="student.id">
                {{ student.seat_number }}號 - {{ student.hidden_name }}
              </option>
            </select>
          </div>

          <div class="auth-method-toggle">
            <label :class="{ 'active': authMethod === 'id' }">
              <input type="radio" v-model="authMethod" value="id" />
              📝 生日 + 身分證
            </label>
            <label :class="{ 'active': authMethod === 'email' }">
              <input type="radio" v-model="authMethod" value="email" />
              📧 家長綁定的Email 前五碼
            </label>
          </div>

          <!-- 驗證方式一：生日與身分證後四碼 -->
          <template v-if="authMethod === 'id'">
            <div class="form-group">
              <label>🎂 學生生日</label>
              <input v-model="studentBirthday" type="password" placeholder="西元生日 (例: 20130514)" required :disabled="isLoading" />
            </div>
            <div class="form-group">
              <label>🪪 身分證後四碼</label>
              <input v-model="studentIdLast4" type="password" maxlength="4" placeholder="請輸入身分證後四碼" required :disabled="isLoading" />
            </div>
          </template>

          <!-- 驗證方式二：綁定的 Email 前五碼 -->
          <template v-if="authMethod === 'email'">
            <div class="form-group">
              <label>📧 綁定之 Email 前五碼</label>
              <input 
                v-model="emailPrefix" 
                type="text" 
                maxlength="5" 
                placeholder="請輸入 Email @ 前面的 5 個英數字" 
                required 
                :disabled="isLoading" 
              />
              <p class="input-hint">例如您的信箱為 abcde.fgh@gmail.com，請輸入 <strong>abcde</strong> (任一家長的email皆可)</p>
            </div>
          </template>

          <div v-if="sysMessage.text" :class="['message-box', sysMessage.type]">{{ sysMessage.text }}</div>

          <button type="submit" class="submit-btn" :disabled="isLoading">
            {{ isLoading ? '驗證中...' : '🔐 雙重驗證並進入' }}
          </button>
          <div style="text-align: center; margin-top: 15px;">
            <NuxtLink to="/" class="back-link">返回打卡首頁</NuxtLink>
          </div>
        </form>
      </div>

      <!-- 聊天室介面 -->
      <div v-else class="chat-section">
        <div class="chat-header">
          <h3>💬 與導師的私訊 ({{ verifiedStudentName }})</h3>
          <select v-if="verifiedChildren.length > 1" v-model="selectedStudentId" aria-label="切換孩子" @change="switchVerifiedChild">
            <option v-for="child in verifiedChildren" :key="child.id" :value="child.id">{{ child.seatNumber }}號 {{ child.name }}</option>
          </select>
          <button @click="logout" class="logout-btn">登出</button>
        </div>
        <div class="chat-history" id="chatContainer">
          <div v-if="chatMessages.length === 0" class="empty-chat">目前尚無對話紀錄，請在下方輸入訊息開始溝通。</div>
          <div v-for="msg in chatMessages" :key="msg.id" :class="['chat-bubble', msg.sender_role === '家長' ? 'my-msg' : 'teacher-msg']">
            <div class="msg-info">
              <span class="sender">{{ msg.sender_role === '家長' ? '我 (家長)' : '👨‍🏫 導師' }}</span>
              <span class="time">{{ formatTime(msg.created_at) }}</span>
            </div>
            <div class="msg-content">{{ msg.content }}</div>
          </div>
          <PrivateMediaThread :student-id="selectedStudentId" chat-type="家長" />
        </div>
        <form @submit.prevent="sendMessage" class="reply-form">
          <textarea v-model="newMessage" rows="2" placeholder="請輸入訊息..." required :disabled="isSending"></textarea>
          <button type="submit" class="send-btn" :disabled="isSending">{{ isSending ? '...' : '📤 傳送' }}</button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
const supabase = useSupabaseClient()
const route = useRoute()

const students = ref([])
const selectedStudentId = ref('')
const verifiedChildren = ref([])
const authMethod = ref('id') 

const studentBirthday = ref('')
const studentIdLast4 = ref('')
const emailPrefix = ref('')

const isLoading = ref(false)
const isSending = ref(false)
const isVerified = ref(false)
const verifiedStudentName = ref('')
const sysMessage = ref({ type: '', text: '' })
const chatMessages = ref([])
const newMessage = ref('')

// 💡 存放從資料庫抓取的導師信箱
const teacherEmail = ref('')

const checkSchoolNetwork = async () => {
  try {
    const res = await fetch('https://api.ipify.org?format=json')
    const { ip: clientIp } = await res.json()
    
    const { data: blacklists } = await supabase
      .from('ip_rules') 
      .select('ip_range') 
      .eq('rule_type', '黑名單')

    if (blacklists && blacklists.length > 0) {
      const isBlocked = blacklists.some(rule => {
        return rule.ip_range && clientIp.startsWith(rule.ip_range.trim())
      })
      
      if (isBlocked) {
        alert('🚫 學校網域限制：為維護上課專注度，校內網路禁止使用私訊功能。請回家或使用個人手機網路再進行操作！')
        navigateTo('/') 
      }
    }
  } catch (error) {
    console.error('IP 驗證發生錯誤:', error)
  }
}

const showMessage = (type, text) => { 
  sysMessage.value = { type, text }
  if (type === 'success') setTimeout(() => sysMessage.value = { type: '', text: '' }, 3000) 
}

const fetchStudents = async () => { 
  // 💡 在抓取時連同 real_name 一起拉出來，寄給導師的信件中會顯示真名
  const { data } = await supabase.from('students').select('id, seat_number, hidden_name, real_name').order('seat_number')
  if (data) students.value = data 

  // 💡 同時抓取後台 (AdminMessages.vue) 設定的導師私訊通知信箱
  const { data: emailData } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'teacher_msg_notify_email')
    .maybeSingle()
    
  if (emailData && emailData.setting_value) {
    teacherEmail.value = emailData.setting_value
  }
}

const extractAlphanumericPrefix = (email) => {
  if (!email || typeof email !== 'string') return ''
  const beforeAt = email.split('@')[0]
  return beforeAt.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5).toLowerCase()
}

const verifyIdentity = async () => {
  if (!selectedStudentId.value) {
    showMessage('error', '❌ 請先選擇學生！')
    return
  }

  isLoading.value = true
  sysMessage.value = { type: '', text: '' }

  try {
    const { data: stData, error: stError } = await supabase
      .from('students')
      .select('*')
      .eq('id', selectedStudentId.value)
      .single()

    if (stError || !stData) throw new Error('Student not found')

    let isValid = false

    if (authMethod.value === 'id') {
      const idStr = (stData.id_number || stData.id_last_5 || '').slice(-4)
      if (stData.birthday === studentBirthday.value && idStr === studentIdLast4.value) {
        isValid = true
      }
    } 
    else if (authMethod.value === 'email') {
      const userInputPrefix = emailPrefix.value.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5).toLowerCase()
      let emailsToCheck = []

      // 💡 正確抓取 parents 資料表中的信箱
      const { data: parentsData } = await supabase
        .from('parents')
        .select('email')
        .eq('student_id', selectedStudentId.value)
        
      if (parentsData) {
        emailsToCheck.push(...parentsData.map(p => p.email).filter(Boolean))
      }

      // 備用：若有額外的 parent_bindings 資料表
      const { data: bindings } = await supabase
        .from('parent_bindings')
        .select('email')
        .eq('student_id', selectedStudentId.value)
        
      if (bindings) {
        emailsToCheck.push(...bindings.map(b => b.email).filter(Boolean))
      }

      isValid = emailsToCheck.some(email => {
        return extractAlphanumericPrefix(email) === userInputPrefix
      })
    }

    if (!isValid) {
      showMessage('error', '❌ 驗證失敗：您輸入的資料錯誤或尚未綁定！')
      isLoading.value = false
      return
    }

    verifiedStudentName.value = stData.real_name
    isVerified.value = true
    await loadChatHistory()

  } catch (error) { 
    showMessage('error', '❌ 系統發生異常，請稍後再試。') 
  } finally { 
    isLoading.value = false 
  }
}

const loadChatHistory = async () => { 
  const { data } = await supabase
    .from('private_messages')
    .select('*')
    .eq('student_id', selectedStudentId.value)
    .eq('chat_type', '家長')
    .order('created_at', { ascending: true })
    
  if (data) { 
    chatMessages.value = data
    scrollToBottom() 
  } 
}

// 💡 寄送通知信給導師的獨立函式
const notifyTeacher = async (messageContent) => {
  // 如果導師沒在後台設定信箱，就不寄送
  if (!teacherEmail.value || !teacherEmail.value.includes('@')) return; 
  
  try {
    const nowStr = new Date().toLocaleString('zh-TW', { hour12: false })
    
    // 從學生清單中找出對應的真實姓名 (因為導師看信件時不需要隱藏)
    const student = students.value.find(s => s.id === selectedStudentId.value)
    const studentNameInfo = student ? `${student.seat_number}號 ${student.real_name}` : '未知學生'

    const subject = `🔔 班級系統通知：有家長傳送了新私訊 (${studentNameInfo})`
    const content = `導師您好：\n\n系統紀錄顯示，於 ${nowStr} 收到了一則家長的新私訊。\n\n【私訊資訊】\n- 學生：${studentNameInfo}\n- 內容摘要：${messageContent}\n\n煩請抽空登入班級系統後台，進入「班級私訊管理」查看完整內容並進行回覆。\n\n此致\n系統自動通知`
    
    await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: teacherEmail.value,
        subject: subject,
        content: content
      })
    });
  } catch (err) {
    console.error('發送導師私訊通知信失敗:', err);
  }
}

const sendMessage = async () => {
  if (!newMessage.value.trim()) return
  isSending.value = true
  try {
    // 💡 先把訊息內容存進變數，稍後寄信會用到
    const contentToSend = newMessage.value
    
    await supabase.from('private_messages').insert({ 
      student_id: selectedStudentId.value, 
      sender_role: '家長', 
      chat_type: '家長', 
      content: contentToSend, 
      is_read_by_teacher: false 
    })
    
    newMessage.value = ''
    await loadChatHistory()
    
    // 💡 發送背景通知信給導師
    notifyTeacher(contentToSend)

  } catch (error) { 
    alert('傳送失敗') 
  } finally { 
    isSending.value = false 
  }
}

const switchVerifiedChild = async () => {
  const child = verifiedChildren.value.find(item => item.id === selectedStudentId.value)
  if (!child) return
  verifiedStudentName.value = child.name
  await loadChatHistory()
}

const logout = async () => {
  try { await $fetch('/api/personal-home/logout', { method: 'POST', body: {}, retry: 0 }) }
  catch { alert('登出尚未完成，請恢復連線後重試。'); return }
  isVerified.value = false
  verifiedChildren.value = []
  studentBirthday.value = ''
  studentIdLast4.value = ''
  emailPrefix.value = ''
  chatMessages.value = [] 
}

const formatTime = (isoString) => new Date(isoString).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
const scrollToBottom = () => { nextTick(() => { const c = document.getElementById('chatContainer'); if (c) c.scrollTop = c.scrollHeight }) }

onMounted(async () => {
  await checkSchoolNetwork() 
  await fetchStudents()
  try {
    const identity = await $fetch('/api/personal-home/media', { query: { mode: 'identity' }, retry: 0 })
    if (identity.role === 'parent' && identity.students.length) {
      verifiedChildren.value = identity.students
      const requested = String(route.query.studentId || '')
      const child = identity.students.find(item => item.id === requested) || identity.students[0]
      selectedStudentId.value = child.id
      verifiedStudentName.value = child.name
      isVerified.value = true
      await loadChatHistory()
    }
  } catch {}
})
</script>

<style scoped>
.message-container { min-height: 100vh; display: flex; justify-content: center; align-items: center; background-color: #f0fdf4; padding: 10px; font-family: 'sans-serif'; }
.message-card { background: white; width: 100%; max-width: 500px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); overflow: hidden; border-top: 8px solid #10b981; }
.verify-section { padding: 30px; }
.card-header { text-align: center; margin-bottom: 25px; }
.card-header h2 { color: #047857; margin-bottom: 15px; font-size: 1.6rem; }

.security-notice { background-color: #fef2f2; color: #991b1b; padding: 12px 15px; border-radius: 8px; font-size: 0.9rem; line-height: 1.5; border: 1px solid #fecaca; text-align: left; }

.auth-method-toggle { display: flex; gap: 10px; margin-bottom: 20px; background: #f1f5f9; padding: 5px; border-radius: 10px; }
.auth-method-toggle label { flex: 1; text-align: center; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold; color: #64748b; transition: all 0.2s; font-size: 0.95rem; }
.auth-method-toggle label input { display: none; }
.auth-method-toggle label.active { background: white; color: #10b981; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

.form-group { margin-bottom: 20px; }
.form-group label { display: block; margin-bottom: 8px; font-weight: bold; color: #374151; }
select, input { width: 100%; padding: 12px 15px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 1.1rem; background-color: #f9fafb; box-sizing: border-box; }
select:focus, input:focus { outline: none; border-color: #10b981; background-color: white; }
.input-hint { font-size: 0.85rem; color: #6b7280; margin-top: 6px; }

.submit-btn { width: 100%; padding: 14px; background-color: #10b981; color: white; border: none; border-radius: 8px; font-size: 1.2rem; font-weight: bold; cursor: pointer; transition: 0.2s; margin-top: 10px; }
.message-box { padding: 12px; border-radius: 8px; margin-bottom: 20px; text-align: center; font-weight: bold; }
.message-box.error { background-color: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
.back-link { color: #10b981; text-decoration: none; font-weight: bold; font-size: 0.9rem; }

.chat-section { display: flex; flex-direction: column; height: 80vh; max-height: 650px; }
.chat-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: #ecfdf5; border-bottom: 1px solid #d1fae5; }
.chat-header h3 { margin: 0; color: #065f46; font-size: 1.1rem; }
.logout-btn { background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.9rem; cursor: pointer; }
.chat-history { flex: 1; overflow-y: auto; padding: 20px; background: #f8fafc; display: flex; flex-direction: column; gap: 15px; }
.empty-chat { text-align: center; color: #94a3b8; font-size: 0.95rem; margin-top: 50px; }
.chat-bubble { max-width: 80%; padding: 10px 14px; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
.my-msg { background: #dbeafe; align-self: flex-end; border-bottom-right-radius: 2px; }
.teacher-msg { background: #dcfce7; align-self: flex-start; border-bottom-left-radius: 2px; }
.msg-info { display: flex; justify-content: space-between; gap: 15px; margin-bottom: 4px; font-size: 0.75rem; color: #64748b; }
.my-msg .sender { color: #1d4ed8; font-weight: bold; }
.teacher-msg .sender { color: #15803d; font-weight: bold; }
.msg-content { font-size: 1.05rem; color: #1e293b; line-height: 1.4; white-space: pre-wrap; word-break: break-all; }
.reply-form { display: flex; gap: 10px; padding: 15px; background: white; border-top: 1px solid #e2e8f0; }
.reply-form textarea { flex: 1; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 1rem; resize: none; font-family: inherit; }
.reply-form textarea:focus { outline: none; border-color: #10b981; }
.send-btn { background: #10b981; color: white; border: none; padding: 0 20px; border-radius: 8px; font-weight: bold; cursor: pointer; white-space: nowrap; }
</style>
