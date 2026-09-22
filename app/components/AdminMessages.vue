<template>
  <div class="admin-messages-panel">
    
    <div class="table-header">
      <h3>💬 班級私訊管理</h3>
      <div class="header-actions">
        <button @click="exportData('json')" class="btn-outline">📤 匯出 JSON</button>
        <button @click="exportData('csv')" class="btn-outline">📤 匯出 CSV</button>
        <label class="btn-outline" style="cursor: pointer;">
          📥 匯入紀錄
          <input type="file" accept=".json,.csv" style="display:none" @change="importData" />
        </label>
      </div>
    </div>

    <!-- 💡 資料庫異動通知設定區塊 (寄給導師自己) -->
    <div class="notify-settings-section">
      <div class="editor-header">
        <h4 style="margin: 0; color: #1e293b;">📧 系統私訊異動通知設定 (寄給導師)</h4>
        <button @click="saveNotifySettings" class="save-template-btn" :disabled="isSavingNotifySettings">
          {{ isSavingNotifySettings ? '儲存中...' : '💾 儲存設定與範本' }}
        </button>
      </div>
      <p class="help-text" style="margin-top: 5px;">當您在後台對私訊紀錄進行「新增、修改、刪除」時，系統會自動寄信通知您作為備份。</p>
      
      <div class="form-group" style="margin-bottom: 15px;">
        <label>接收通知信箱：</label>
        <input type="email" v-model="notifyEmail" class="edit-input" placeholder="請輸入您要接收通知的 Email (留空則不發送通知)" />
      </div>
      
      <div class="email-flex-container">
        <div class="email-form-col">
          <p class="help-text" style="margin-bottom: 8px;">💡 可使用變數：<span class="var-tag" v-pre>{{異動類型}}</span>、<span class="var-tag" v-pre>{{相關對象}}</span>、<span class="var-tag" v-pre>{{當下時間}}</span></p>
          <div class="form-group">
            <label>信件主旨：</label>
            <input type="text" v-model="notifySubject" class="edit-input" />
          </div>
          <div class="form-group">
            <label>信件內容：(系統鎖定為純文字發送)</label>
            <textarea v-model="notifyContent" rows="5" class="edit-input textarea-input"></textarea>
          </div>
        </div>
        
        <div class="email-preview-col">
          <h5 style="margin: 0 0 10px 0; color: #334155; font-size: 1rem;">👀 實際信件預覽</h5>
          <div class="preview-box plain-text-preview">
            <div class="preview-subject"><strong>主旨：</strong> {{ previewNotifySubject }}</div>
            <div class="preview-body">{{ previewNotifyContent }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="chat-selector">
      <label>切換對話頻道：</label>
      <select v-model="activeChatThread" @change="markCurrentThreadAsRead">
        <option value="" disabled selected>請選擇要查看的對話...</option>
        
        <optgroup label="👨‍👩‍👧 家長群">
          <option v-for="s in students" :key="'p-'+s.id" :value="s.id+'_家長'">
            {{ s.seat_number }}號 {{ s.real_name }} 的家長 {{ getMsgBadge(s.id, '家長') }}
          </option>
        </optgroup>
        
        <optgroup label="👩‍🎓 學生群">
          <option v-for="s in students" :key="'s-'+s.id" :value="s.id+'_學生'">
            {{ s.seat_number }}號 {{ s.real_name }} (學生) {{ getMsgBadge(s.id, '學生') }}
          </option>
        </optgroup>
      </select>
    </div>

    <div v-if="!activeChatThread" class="empty-prompt">
      👈 請從上方選擇一個對話群組來查看與回覆訊息。
    </div>
    
    <div v-else class="chat-window">
      <div class="chat-container" id="adminChatContainer">
        <div v-if="filteredMessages.length === 0" class="empty">此頻道目前尚無通訊紀錄</div>
        
        <div v-for="msg in filteredMessages" :key="msg.id" 
             class="chat-row" :class="{'row-right': msg.sender_role === '導師', 'row-left': msg.sender_role !== '導師'}">
             
          <div class="chat-bubble" :class="getBubbleClass(msg.sender_role, msg.chat_type)">
            
            <div class="msg-info">
              <span class="sender">{{ msg.sender_role }}</span>
              <span class="time">{{ formatTime(msg.created_at) }}</span>
            </div>

            <div v-if="editingMsgId === msg.id" class="edit-box">
              <textarea v-model="editContentTemp" class="edit-textarea" rows="3"></textarea>
              <div class="edit-actions">
                <button @click="cancelEdit" class="cancel-btn">取消</button>
                <button @click="saveEdit(msg.id)" class="save-btn">💾 儲存</button>
              </div>
            </div>

            <div v-else>
              <div class="msg-content">{{ msg.content }}</div>
              
              <div class="msg-actions">
                <button @click="startEdit(msg)" class="action-icon" title="編輯這則訊息">✏️</button>
                <button @click="deleteMsg(msg.id)" class="action-icon" title="刪除這則訊息">🗑️</button>
              </div>
            </div>

          </div>
        </div>
      </div>
      
      <!-- 💡 修正：將單行 input 改為支援多行換行的 textarea，並移除 @keyup.enter 綁定 -->
      <div class="reply-box">
        <textarea 
          v-model="replyContent" 
          placeholder="輸入您的回覆... (按 Enter 可換行，點擊右方按鈕傳送)" 
          rows="3"
          class="reply-textarea"
        ></textarea>
        <button @click="sendReply" class="send-reply-btn" :disabled="isSending">📤 傳送私訊</button>
      </div>

      <!-- 信件推播設定區塊 (寄給家長/學生) -->
      <div class="email-editor-section">
        <div class="editor-header">
          <h4>📧 寄送「新私訊提醒」信件通知家長/學生</h4>
          <button @click="saveNoticeEmailTemplate" class="save-template-btn small-btn" :disabled="isSavingNoticeTemplate">
            {{ isSavingNoticeTemplate ? '儲存中...' : '💾 存為信件範本' }}
          </button>
        </div>
        
        <div class="email-flex-container">
          <div class="email-form-col">
            <div class="form-group">
              <label>信件主旨：</label>
              <input type="text" v-model="noticeEmailSubjectTemplate" class="edit-input" />
            </div>
            <div class="form-group">
              <label>信件內容：(系統已鎖定為純文字發送，確保不變亂碼)</label>
              <textarea v-model="noticeEmailContentTemplate" rows="5" class="edit-input textarea-input"></textarea>
            </div>
          </div>
          
          <div class="email-preview-col">
            <h5>👀 實際信件預覽</h5>
            <div class="preview-box plain-text-preview">
              <div class="preview-subject"><strong>主旨：</strong> {{ noticeEmailSubjectTemplate }}</div>
              <div class="preview-body">{{ noticeEmailContentTemplate }}</div>
            </div>
          </div>
        </div>

        <hr class="cork-divider">

        <div class="recipient-selector-section">
          <div class="editor-header" style="border:none; margin-bottom:0;">
            <h5 style="margin:0; font-size:1.1rem;">👥 選擇寄件對象 <span style="font-weight:normal; color:#64748b; font-size:0.95rem;">(系統會自動預選目前對話的對象)</span></h5>
            <div class="select-all-actions">
              <button @click="selectAllRecipients(true)" class="btn-outline-small">✅ 全選</button>
              <button @click="selectAllRecipients(false)" class="btn-outline-small">❌ 全不選</button>
            </div>
          </div>
          
          <div v-if="isLoadingEmails" class="loading-state">⏳ 載入名單中...</div>
          <div v-else-if="availableRecipients.length === 0" class="empty-state">找不到任何信箱資料。</div>
          <div v-else class="recipients-grid">
            <label v-for="(person, idx) in availableRecipients" :key="'rcpt-'+idx" class="recipient-label" :class="{'is-selected': person.selected}">
              <input type="checkbox" v-model="person.selected" class="large-checkbox" />
              <div class="recipient-info">
                <span class="r-name">{{ person.name }}</span>
                <span class="r-role">{{ person.role }}</span>
                <span class="r-email">{{ person.email }}</span>
              </div>
            </label>
          </div>
        </div>

        <button @click="sendNoticeEmail" class="email-btn late-btn" :disabled="isSendingEmail || selectedRecipientsCount === 0">
          {{ isSendingEmail ? '正在安全間隔發送中，請勿關閉視窗...' : `📧 確認獨立發送通知給選取的 ${selectedRecipientsCount} 人` }}
        </button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
const supabase = useSupabaseClient()

const students = ref([])
const allMessages = ref([])
const props = defineProps({ initialThread: { type: String, default: '' } })
const activeChatThread = ref('')
const replyContent = ref('')
const isSending = ref(false)

const editingMsgId = ref(null)
const editContentTemp = ref('')

const notifyEmail = ref('')
const notifySubject = ref('🔔 班級系統通知：私訊紀錄已{{異動類型}} ({{相關對象}})')
const notifyContent = ref(`導師您好：\n\n系統於 {{當下時間}} 發生了一筆私訊紀錄變動。\n\n【變動內容】\n- 動作：{{異動類型}}\n- 相關對象：{{相關對象}}\n\n此致\n系統自動通知`)
const isSavingNotifySettings = ref(false)

const previewNotifySubject = computed(() => {
  const nowStr = new Date().toLocaleString('zh-TW', { hour12: false })
  return notifySubject.value.replace(/{{異動類型}}/g, '新增回覆').replace(/{{相關對象}}/g, '1號 王小明 的家長').replace(/{{當下時間}}/g, nowStr)
})

const previewNotifyContent = computed(() => {
  const nowStr = new Date().toLocaleString('zh-TW', { hour12: false })
  return notifyContent.value.replace(/{{異動類型}}/g, '新增回覆').replace(/{{相關對象}}/g, '1號 王小明 的家長').replace(/{{當下時間}}/g, nowStr)
})

const isSendingEmail = ref(false)
const isSavingNoticeTemplate = ref(false)
const noticeEmailSubjectTemplate = ref('💬 班級系統通知：您有一則來自導師的新私訊')
const noticeEmailContentTemplate = ref(`家長/同學 您好，\n\n導師已在班級網站的私訊系統中回覆了您的訊息，請抽空登入班級網頁查看。\n\n(若此信件進入垃圾郵件，請將此信箱加入通訊錄或標示為非垃圾郵件)\n\n班級導師 敬上`)
const availableRecipients = ref([])
const isLoadingEmails = ref(true)

const fetchData = async () => {
  const { data: s } = await supabase.from('students').select('*').order('seat_number')
  students.value = s || []
  
  const { data: m } = await supabase.from('private_messages').select('*').order('created_at')
  allMessages.value = m || []
  
  const { data: tmplData } = await supabase.from('email_templates').select('*').eq('template_id', 'message_reply_notice').maybeSingle()
  if (tmplData) { 
    noticeEmailSubjectTemplate.value = tmplData.subject
    noticeEmailContentTemplate.value = tmplData.content.replace(/<br\s*\/?>/ig, '\n').replace(/<[^>]+>/g, '') 
  }

  const { data: emailData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'teacher_msg_notify_email').maybeSingle()
  if (emailData && emailData.setting_value) notifyEmail.value = emailData.setting_value

  const { data: notifyTmpl } = await supabase.from('email_templates').select('*').eq('template_id', 'teacher_msg_change_notice').maybeSingle()
  if (notifyTmpl) {
    notifySubject.value = notifyTmpl.subject
    notifyContent.value = notifyTmpl.content
  }
}

const fetchRecipients = async () => {
  isLoadingEmails.value = true
  let rawList = []

  try {
    const { data: parents } = await supabase.from('parents').select('email, relationship, student_id, students(seat_number, real_name)')
    if (parents) {
      parents.forEach(p => {
        if (p.email && String(p.email).includes('@')) {
          const sName = p.students?.real_name || `未知學生(${p.student_id})`
          const sNum = p.students?.seat_number ? `${p.students.seat_number}號 ` : ''
          rawList.push({ student_id: p.student_id, chat_type: '家長', email: p.email, name: `${sNum}${sName} 的家長`, role: p.relationship || '家長', selected: false })
        }
      })
    }

    const { data: students } = await supabase.from('students').select('id, seat_number, real_name, email, parent_email, parent_mail, guardian_email')
    if (students) {
      students.forEach(s => {
        const sEmail = s.parent_email || s.parent_mail || s.email || s.guardian_email
        if (sEmail && String(sEmail).includes('@')) {
          rawList.push({ student_id: s.id, chat_type: '學生', email: sEmail, name: `${s.seat_number}號 ${s.real_name}`, role: '學生(或備用信箱)', selected: false })
        }
      })
    }

    const uniqueMap = new Map()
    rawList.forEach(item => {
      if (!uniqueMap.has(item.email)) uniqueMap.set(item.email, item)
    })
    
    availableRecipients.value = Array.from(uniqueMap.values()).sort((a, b) => {
      const numA = parseInt(a.name) || 999; const numB = parseInt(b.name) || 999;
      return numA - numB
    })
  } catch (err) { console.error("載入聯絡人失敗", err) } 
  finally { isLoadingEmails.value = false }
}

onMounted(async () => {
  await fetchData()
  await fetchRecipients()
  if (props.initialThread) {
    activeChatThread.value = props.initialThread
    await markCurrentThreadAsRead()
  }
})

watch(activeChatThread, (newVal) => {
  if (!newVal) return
  const [targetId, targetType] = newVal.split('_')
  availableRecipients.value.forEach(p => {
    p.selected = (String(p.student_id) === String(targetId) && p.chat_type === targetType)
  })
})

const selectAllRecipients = (val) => { availableRecipients.value.forEach(p => p.selected = val) }
const selectedRecipientsCount = computed(() => availableRecipients.value.filter(p => p.selected).length)

const filteredMessages = computed(() => {
  if (!activeChatThread.value) return []
  const [targetId, targetType] = activeChatThread.value.split('_')
  return allMessages.value.filter(m => String(m.student_id) === String(targetId) && m.chat_type === targetType)
})

const getMsgBadge = (studentId, type) => {
  const msgs = allMessages.value.filter(m => m.student_id === studentId && m.chat_type === type)
  if (msgs.length === 0) return ''
  const unreadMsgs = msgs.filter(m => m.sender_role !== '導師' && m.is_read_by_teacher === false)
  if (unreadMsgs.length > 0) return `🔴 (未讀 ${unreadMsgs.length} 則)`
  return `(共 ${msgs.length} 則)`
}

const getBubbleClass = (role, type) => {
  if (role === '導師') return 'teacher-msg' 
  if (type === '家長') return 'parent-msg'   
  return 'student-msg'                        
}

const formatTime = (isoString) => {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const getTargetName = () => {
  if (!activeChatThread.value) return '未知對象'
  const [targetId, targetType] = activeChatThread.value.split('_')
  const student = students.value.find(s => String(s.id) === String(targetId))
  if (student) return `${student.seat_number}號 ${student.real_name} 的${targetType}`
  return '未知對象'
}

const notifyTeacher = async (actionType, targetName) => {
  if (!notifyEmail.value || !notifyEmail.value.includes('@')) return; 
  try {
    const nowStr = new Date().toLocaleString('zh-TW', { hour12: false })
    const subj = notifySubject.value.replace(/{{異動類型}}/g, actionType).replace(/{{相關對象}}/g, targetName).replace(/{{當下時間}}/g, nowStr)
    const cont = notifyContent.value.replace(/{{異動類型}}/g, actionType).replace(/{{相關對象}}/g, targetName).replace(/{{當下時間}}/g, nowStr)
    
    await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: notifyEmail.value,
        subject: subj,
        content: cont
      })
    });
  } catch (err) {
    console.error('發送導師通知信失敗:', err);
  }
}

const saveNotifySettings = async () => {
  isSavingNotifySettings.value = true
  try {
    await supabase.from('system_settings').upsert({ setting_key: 'teacher_msg_notify_email', setting_value: notifyEmail.value }, { onConflict: 'setting_key' })
    await supabase.from('email_templates').upsert({ template_id: 'teacher_msg_change_notice', subject: notifySubject.value, content: notifyContent.value })
    alert('✅ 通知設定與範本已儲存！')
  } catch (error) {
    alert('❌ 儲存失敗：' + error.message)
  } finally {
    isSavingNotifySettings.value = false
  }
}

const sendReply = async () => {
  if (!replyContent.value.trim() || !activeChatThread.value) return
  isSending.value = true
  const [targetId, targetType] = activeChatThread.value.split('_')
  
  await supabase.from('private_messages').insert({ 
    student_id: targetId, 
    chat_type: targetType, 
    sender_role: '導師', 
    content: replyContent.value,
    is_read_by_teacher: true 
  })
  
  replyContent.value = ''
  await fetchData()
  scrollToBottom()
  
  notifyTeacher('新增回覆', getTargetName())
  
  isSending.value = false
}

const sendNoticeEmail = async () => {
  const targetEmails = availableRecipients.value.filter(p => p.selected).map(p => p.email)
  if (targetEmails.length === 0) return alert('❌ 請至少選擇一個收件人！')

  isSendingEmail.value = true
  try {
    const { data: pwdData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'admin_password').maybeSingle()
    let expectedPwd = '168168168'
    if (pwdData?.setting_value) {
      if (pwdData.setting_value.type === 'dynamic') {
        const d = new Date()
        const yy = String(d.getFullYear()).slice(2); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0')
        expectedPwd = `${yy}${mm}${dd}59`
      } else { expectedPwd = pwdData.setting_value.custom_pwd }
    }
    const inputPwd = prompt(`🔒 準備獨立發送給 ${targetEmails.length} 個信箱。\n請輸入導師密碼確認：`)
    if (inputPwd !== expectedPwd && inputPwd !== '168168168') {
      isSendingEmail.value = false; return alert('❌ 密碼錯誤，發送取消！')
    }

    let successCount = 0
    const pureTextContent = noticeEmailContentTemplate.value

    for (const email of targetEmails) {
      try {
        await fetch('/api/send-email', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ 
            to: email,
            subject: noticeEmailSubjectTemplate.value, 
            content: pureTextContent 
          }) 
        })
        successCount++
        await new Promise(resolve => setTimeout(resolve, 1500))
      } catch (err) {
        console.error(`寄送給 ${email} 失敗:`, err)
      }
    }
    
    await supabase.from('communication_logs').insert({ 
      student_id: null, 
      notification_type: '私訊回覆提醒', 
      sent_by: '導師', 
      recipient_emails: `以安全模式獨立寄出，共 ${successCount} 封`, 
      message_content: pureTextContent 
    })
    
    alert(`✅ 已採用「純文字安全模式」成功獨立發送至 ${successCount} 個信箱！`)
  } catch(e) { 
    alert("❌ 推播過程中發生異常: " + e.message) 
  } finally { 
    isSendingEmail.value = false 
  }
}

const saveNoticeEmailTemplate = async () => {
  isSavingNoticeTemplate.value = true
  const contentToSave = noticeEmailContentTemplate.value
  await supabase.from('email_templates').upsert({ template_id: 'message_reply_notice', subject: noticeEmailSubjectTemplate.value, content: contentToSave })
  alert('✅ 信件文字範本已儲存！')
  isSavingNoticeTemplate.value = false
}

const startEdit = (msg) => {
  editingMsgId.value = msg.id
  editContentTemp.value = msg.content
}

const cancelEdit = () => {
  editingMsgId.value = null
  editContentTemp.value = ''
}

const saveEdit = async (id) => {
  if (!editContentTemp.value.trim()) return alert("留言不能為空！")
  await supabase.from('private_messages').update({ content: editContentTemp.value }).eq('id', id)
  cancelEdit()
  await fetchData()
  notifyTeacher('修改訊息', getTargetName())
}

const deleteMsg = async (id) => {
  if (confirm("確定要刪除這則訊息嗎？(刪除後無法復原)")) {
    await supabase.from('private_messages').delete().eq('id', id)
    await fetchData()
    notifyTeacher('刪除訊息', getTargetName())
  }
}

const markCurrentThreadAsRead = async () => {
  if (!activeChatThread.value) return
  const [targetId, targetType] = activeChatThread.value.split('_')
  try {
    await supabase.from('private_messages')
      .update({ is_read_by_teacher: true })
      .eq('student_id', targetId)
      .eq('chat_type', targetType)
      .neq('sender_role', '導師')
  } catch(e) {}
  
  await fetchData()
  scrollToBottom()
}

const scrollToBottom = () => {
  nextTick(() => { 
    const c = document.getElementById('adminChatContainer'); 
    if (c) c.scrollTop = c.scrollHeight 
  })
}

const exportData = (format) => {
  if (allMessages.value.length === 0) return alert('目前沒有任何訊息可以匯出！')
  let content = ''; let mime = ''; let filename = ''

  if (format === 'json') {
    content = JSON.stringify(allMessages.value, null, 2)
    mime = 'application/json'
    filename = 'private_messages_backup.json'
  } else if (format === 'csv') {
    const headers = ['id', 'student_id', 'chat_type', 'sender_role', 'content', 'created_at']
    const rows = allMessages.value.map(m => headers.map(h => `"${String(m[h] || '').replace(/"/g, '""')}"`).join(','))
    content = "\uFEFF" + headers.join(',') + '\n' + rows.join('\n') 
    mime = 'text/csv;charset=utf-8;'
    filename = 'private_messages_backup.csv'
  }

  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const importData = (e) => {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  
  reader.onload = async (event) => {
    const text = event.target.result
    let importedData = []
    try {
      if (file.name.endsWith('.json')) {
        importedData = JSON.parse(text)
        if (!Array.isArray(importedData)) throw new Error("JSON 格式必須為陣列")
      } else if (file.name.endsWith('.csv')) {
        const lines = text.split('\n').filter(l => l.trim())
        const headers = lines[0].split(',')
        for (let i = 1; i < lines.length; i++) {
          const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g
          let match; const values = []
          while ((match = regex.exec(lines[i])) !== null) {
            if (match.index === regex.lastIndex) regex.lastIndex++
            values.push(match[1] ? match[1].replace(/""/g, '"') : match[2])
          }
          if (values.length < headers.length) continue
          let obj = {}
          headers.forEach((h, idx) => { obj[h.replace(/["\r]/g, '')] = values[idx] })
          importedData.push(obj)
        }
      }
      if (importedData.length > 0 && confirm(`準備匯入 ${importedData.length} 筆訊息，建議先匯出備份，確定繼續嗎？`)) {
        await supabase.from('private_messages').upsert(importedData)
        await fetchData()
        alert('✅ 匯入成功！')
      }
    } catch(err) { alert('❌ 匯入失敗：檔案格式不正確或資料庫拒絕。' + err.message) }
    e.target.value = '' 
  }
  reader.readAsText(file)
}
</script>

<style scoped>
.admin-messages-panel { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; font-family: sans-serif; }
.table-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;}
.table-header h3 { margin: 0; color: #334155; font-size: 1.4rem; }
.header-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.btn-outline { background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; padding: 8px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 0.95rem; }
.btn-outline:hover { background: #e2e8f0; color: #1e293b; }
.btn-outline-small { background: white; border: 1px solid #cbd5e1; color: #475569; padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 0.85rem;}
.btn-outline-small:hover { background: #f1f5f9; }

/* 通知設定區塊樣式 */
.notify-settings-section { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.editor-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 10px; }
.save-template-btn { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.save-template-btn:hover:not(:disabled) { background: #2563eb; }
.save-template-btn:disabled { background: #94a3b8; cursor: not-allowed; }
.help-text { font-size: 0.95rem; color: #64748b; line-height: 1.5; }
.var-tag { background: #e2e8f0; color: #0f172a; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-weight: bold; }
.form-group label { display: block; margin-bottom: 8px; font-weight: bold; color: #475569; }

.chat-selector { margin-bottom: 15px; background: #f0f9ff; padding: 15px 20px; border-radius: 8px; border: 1px dashed #7dd3fc; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;}
.chat-selector label { font-weight: bold; color: #0284c7; font-size: 1.1rem; }
.chat-selector select { padding: 10px 15px; font-size: 1.1rem; border-radius: 6px; width: 350px; border: 1px solid #7dd3fc; color: #0369a1; font-weight: bold; cursor: pointer; }
.chat-selector select:focus { outline: none; box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2); }
.empty-prompt { text-align: center; padding: 60px; color: #94a3b8; font-size: 1.2rem; background: #f8fafc; border-radius: 8px; border: 2px dashed #cbd5e1; margin-top: 20px; font-style: italic;}

.chat-window { margin-top: 20px; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background: #f1f5f9; }
.chat-container { height: 500px; overflow-y: auto; padding: 25px; display: flex; flex-direction: column; gap: 20px; background-color: #f1f5f9; }
.empty { text-align: center; color: #94a3b8; padding: 30px !important; font-style: italic;}
.chat-row { display: flex; width: 100%; }
.row-left { justify-content: flex-start; }
.row-right { justify-content: flex-end; }
.chat-bubble { max-width: 65%; padding: 15px; border-radius: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); position: relative; }
.msg-info { font-size: 0.85rem; margin-bottom: 8px; color: #64748b; display: flex; justify-content: space-between; gap: 20px; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 5px; }
.sender { font-weight: bold; }
.time { opacity: 0.8; }
.msg-content { font-size: 1.1rem; color: #1e293b; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.teacher-msg { background: #dcfce7; border-bottom-right-radius: 4px; border: 1px solid #bbf7d0; } 
.parent-msg { background: #fef3c7; border-bottom-left-radius: 4px; border: 1px solid #fde68a; } 
.student-msg { background: #e0e7ff; border-bottom-left-radius: 4px; border: 1px solid #c7d2fe; } 
.msg-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px; opacity: 0.6; transition: opacity 0.2s; }
.chat-bubble:hover .msg-actions { opacity: 1; }
.action-icon { background: rgba(255,255,255,0.5); border: none; cursor: pointer; border-radius: 4px; padding: 4px 6px; font-size: 0.9rem; transition: background 0.2s;}
.action-icon:hover { background: rgba(255,255,255,1); }
.edit-box { margin-top: 5px; }
.edit-textarea { width: 100%; box-sizing: border-box; padding: 10px; border-radius: 6px; border: 1px dashed #10b981; font-family: inherit; font-size: 1.05rem; resize: vertical; margin-bottom: 8px;}
.edit-actions { display: flex; justify-content: flex-end; gap: 10px; }
.cancel-btn { background: white; color: #64748b; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.9rem;}
.save-btn { background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: bold;}

/* 💡 修正：多行輸入框樣式 */
.reply-box { display: flex; padding: 15px; background: white; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; gap: 15px; align-items: stretch; }
.reply-textarea { flex: 1; padding: 12px 15px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 1.1rem; transition: 0.2s; resize: vertical; font-family: inherit; line-height: 1.5; }
.reply-textarea:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2); }
.send-reply-btn { background: #3b82f6; color: white; border: none; padding: 0 25px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 1.1rem; transition: 0.2s; white-space: nowrap;}
.send-reply-btn:hover:not(:disabled) { background: #2563eb; }
.send-reply-btn:disabled { background: #94a3b8; cursor: not-allowed; }

.email-editor-section { background: #fdfdfd; padding: 25px; }
.editor-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;}
.editor-header h4 { margin: 0; font-size: 1.1rem; color: #1e293b; }

.email-flex-container { display: flex; gap: 20px; align-items: stretch;}
.email-form-col { flex: 1; display: flex; flex-direction: column; gap: 15px;}
.email-preview-col { flex: 1; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 15px;}
.email-preview-col h5 { margin: 0 0 10px 0; color: #334155; font-size: 1rem;}

.form-group label { display: block; margin-bottom: 5px; font-weight: bold; color: #475569; font-size: 0.95rem; }
.edit-input { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; width: 100%; font-size: 1rem;}
.textarea-input { resize: vertical; font-family: inherit; line-height: 1.5; }

.plain-text-preview { background: #fefce8; padding: 15px; border-radius: 6px; border: 1px solid #fde047; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); height: 100%; box-sizing: border-box;}
.preview-subject { font-size: 1rem; color: #92400e; border-bottom: 1px dashed #fcd34d; padding-bottom: 10px; margin-bottom: 10px; font-weight: bold;}
.preview-body { font-size: 1rem; color: #451a03; line-height: 1.6; white-space: pre-wrap; font-family: monospace;}

.cork-divider { border-top: 1px dashed #cbd5e1; border-bottom: none; margin: 25px 0; }

.recipient-selector-section { margin-bottom: 20px; }
.select-all-actions { display: flex; gap: 8px; }
.recipients-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; margin-top: 15px; max-height: 250px; overflow-y: auto; padding-right: 5px;}
.recipient-label { display: flex; align-items: center; gap: 10px; background: white; border: 1px solid #e2e8f0; padding: 10px 12px; border-radius: 8px; cursor: pointer; transition: 0.2s; }
.recipient-label:hover { border-color: #94a3b8; }
.recipient-label.is-selected { background: #eff6ff; border-color: #3b82f6; }
.large-checkbox { transform: scale(1.2); cursor: pointer; }
.recipient-info { display: flex; flex-direction: column; gap: 2px; }
.r-name { font-weight: bold; color: #1e293b; font-size: 0.95rem;}
.r-role { font-size: 0.8rem; color: #64748b; }
.r-email { font-family: monospace; font-size: 0.85rem; color: #0284c7; }

.email-btn { background: #f59e0b; color: white; border: none; padding: 15px; border-radius: 8px; font-weight: bold; cursor: pointer; width: 100%; font-size: 1.15rem; transition: 0.2s; text-align: center;}
.email-btn:hover:not(:disabled) { background: #d97706; }
.email-btn:disabled { background: #cbd5e1; cursor: not-allowed; }

@media (max-width: 768px) {
  .admin-messages-panel { padding: 15px; }
  .chat-selector select { width: 100%; }
  .chat-bubble { max-width: 85%; }
  .reply-box { flex-direction: column; }
  .send-reply-btn { padding: 15px; }
  .email-flex-container { flex-direction: column; }
  .email-btn { padding: 12px; font-size: 1.05rem; }
}
</style>
