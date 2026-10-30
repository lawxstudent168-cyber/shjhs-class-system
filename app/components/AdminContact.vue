<template>
  <div class="split-contact-container">
    <div class="table-header"><h3>⭐ 聯絡簿管理</h3></div>
    
    <!-- 編輯區塊 -->
    <div class="board-editor-container">
      <div class="editor-panel">
        <h4 class="section-title">📝 今日聯絡簿事項 (前台黑板)</h4>
        
        <div class="toggle-setting-box">
          <label class="toggle-label">
            <input type="checkbox" v-model="isHistoryVisibleOnIndex" @change="saveHistorySetting" />
            開放前台首頁讓家長查詢「近一週聯絡簿紀錄」
          </label>
        </div>

        <p class="help-text">用於記錄每日作業、明日攜帶物品。繳交期限可留空；有設定期限的項目會自動同步到班級注意事項。</p>
        <div class="notice-edit-list">
          <div v-for="(item, index) in contactBookItems" :key="'c-'+index" class="edit-input-wrapper edit-item">
            <span class="bullet">✏️</span>
            <input v-model="item.content" type="text" class="edit-input notice-input" placeholder="請輸入聯絡簿事項..." />
            <label class="due-field"><span>繳交期限（可留空）</span><input v-model="item.dueDate" :min="todayISO" type="date" class="due-input" /></label>
            <button @click="removeContactItem(index)" class="del-row-btn">🗑️</button>
          </div>
          <button @click="addContactItem" class="add-btn">➕ 新增聯絡簿事項</button>
        </div>

        <div class="officer-pwd-section">
          <h5>🔒 股長聯絡簿編輯密碼設定</h5>
          <div class="form-group">
            <label>學藝股長密碼：</label>
            <div class="pwd-input-group">
              <input type="text" v-model="officerPasswords.academic" class="edit-input" placeholder="尚未設定..." />
            </div>
          </div>
          <div class="form-group">
            <label>輔導股長密碼：</label>
            <div class="pwd-input-group">
              <input type="text" v-model="officerPasswords.counseling" class="edit-input" placeholder="尚未設定..." />
            </div>
          </div>
          <button @click="saveOfficerPasswords" class="save-template-btn small-btn pwd-btn" :disabled="isSavingPwd">
            {{ isSavingPwd ? '儲存中...' : '💾 儲存股長密碼' }}
          </button>
        </div>

        <div class="action-bar" style="margin-top: 20px;">
          <button @click="saveBoard" class="save-btn lg-btn" :disabled="isSavingBoard">
            {{ isSavingBoard ? '儲存中...' : '💾 儲存今日聯絡簿並同步至前台' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 歷史紀錄月曆查詢 -->
    <div class="history-calendar-container" style="margin-top: 30px;">
      <h4 class="section-title">📅 歷史聯絡簿查詢</h4>
      <div class="calendar-layout">
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

        <div class="history-detail-box">
          <div v-if="!selectedHistoryDate" class="empty-detail">👈 請從上方/左側月曆點選日期以查看歷史紀錄</div>
          <div v-else class="detail-content">
            <div class="detail-header-flex">
              <h5 class="detail-title">🗓️ {{ selectedHistoryDate }} 聯絡簿紀錄</h5>
              <button v-if="!isEditingHistory" @click="startEditHistory" class="edit-history-btn">✏️ 編輯</button>
            </div>
            
            <!-- 唯讀模式 -->
            <div v-if="!isEditingHistory">
              <div class="history-section">
                <div v-if="selectedHistoryContactItems.length > 0" class="history-list">
                  <div v-for="(c, i) in selectedHistoryContactItems" :key="'hc-'+i" class="history-item">
                    <span class="bullet">✏️</span> {{ contactItemContent(c) }}
                    <span v-if="contactItemDueDate(c)" class="history-due">期限：{{ classNoteDateLabel(contactItemDueDate(c)) }}</span>
                  </div>
                </div>
                <div v-else class="empty-text">當日無聯絡簿事項</div>
              </div>
            </div>

            <!-- 編輯模式 -->
            <div v-else class="history-edit-mode">
              <div class="history-section">
                <div class="notice-edit-list">
                  <div v-for="(c, i) in editHistoryContactItems" :key="'ehc-'+i" class="edit-input-wrapper edit-item">
                    <span class="bullet">✏️</span>
                    <input v-model="c.content" type="text" class="edit-input notice-input" />
                    <label class="due-field"><span>繳交期限（可留空）</span><input v-model="c.dueDate" type="date" class="due-input" /></label>
                    <button @click="removeHistoryContactItem(i)" class="del-row-btn">🗑️</button>
                  </div>
                  <button @click="addHistoryContactItem" class="add-btn">➕ 新增</button>
                </div>
              </div>
              <div class="edit-actions-row">
                <button @click="cancelEditHistory" class="cancel-btn">取消</button>
                <button @click="saveHistory" class="save-btn" :disabled="isSavingHistory">
                  {{ isSavingHistory ? '儲存中...' : '💾 儲存歷史紀錄' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { contactItemContent, contactItemDueDate, editableContactBookItems, normalizeContactBookItems, syncContactDeadlinesToClassNotes } from '../utils/contactBook.js'
import { classNoteDateLabel } from '../utils/classNotes.js'
import { taiwanDateISO } from '../utils/examSchedule.js'
const supabase = useSupabaseClient()
const todayISO = taiwanDateISO()
const [todayYear, todayMonth] = todayISO.split('-').map(Number)

const contactBookItems = ref([]) 
const officerPasswords = ref({ academic: '', counseling: '' }) 
const isHistoryVisibleOnIndex = ref(false)

const isSavingBoard = ref(false)
const isSavingPwd = ref(false)

const calYear = ref(todayYear); const calMonth = ref(todayMonth - 1)
const monthRecords = ref([])
const selectedHistoryDate = ref('')
const selectedHistoryContactItems = ref([])

const isEditingHistory = ref(false)
const isSavingHistory = ref(false)
const editHistoryContactItems = ref([])

const fetchData = async () => {
  const { data: boardData } = await supabase.from('contact_books').select('contact_items').eq('record_date', todayISO).maybeSingle()
  contactBookItems.value = editableContactBookItems(boardData?.contact_items)
  
  const { data: sysData } = await supabase.from('system_settings').select('*').in('setting_key', ['board_officer_passwords', 'contact_history_visible'])
  if (sysData) {
    const pwdData = sysData.find(s => s.setting_key === 'board_officer_passwords')
    if (pwdData) officerPasswords.value = pwdData.setting_value

    const histData = sysData.find(s => s.setting_key === 'contact_history_visible')
    if (histData) isHistoryVisibleOnIndex.value = histData.setting_value
  }

  await fetchMonthRecords()
}
onMounted(() => fetchData())

const saveHistorySetting = async () => {
  await supabase.from('system_settings').upsert({
    setting_key: 'contact_history_visible',
    setting_value: isHistoryVisibleOnIndex.value
  }, { onConflict: 'setting_key' })
}

const addContactItem = () => contactBookItems.value.push({ content: '', dueDate: '' })
const removeContactItem = (i) => contactBookItems.value.splice(i, 1)

const saveOfficerPasswords = async () => {
  isSavingPwd.value = true
  await supabase.from('system_settings').upsert({ 
    setting_key: 'board_officer_passwords', 
    setting_value: officerPasswords.value 
  }, { onConflict: 'setting_key' })
  alert('✅ 股長密碼已成功更新！')
  isSavingPwd.value = false
}

const saveBoard = async () => {
  isSavingBoard.value = true
  try {
    contactBookItems.value = await saveContactRecord(todayISO, contactBookItems.value)
    alert('✅ 聯絡簿已儲存；有期限的項目已同步到班級注意事項！')
    await fetchMonthRecords()
  } catch (error) {
    alert('❌ 儲存或同步失敗：' + error.message)
  } finally {
    isSavingBoard.value = false
  }
}

const saveContactRecord = async (recordDate, items) => {
  const cleaned = normalizeContactBookItems(items)
  const { error: contactError } = await supabase.from('contact_books').upsert({ record_date: recordDate, contact_items: cleaned }, { onConflict: 'record_date' })
  if (contactError) throw contactError
  const { data: notesData, error: notesReadError } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'class_notes_data').maybeSingle()
  if (notesReadError) throw notesReadError
  const syncedNotes = syncContactDeadlinesToClassNotes(notesData?.setting_value, cleaned, recordDate)
  const { error: notesSaveError } = await supabase.from('system_settings').upsert({ setting_key: 'class_notes_data', setting_value: syncedNotes }, { onConflict: 'setting_key' })
  if (notesSaveError) throw notesSaveError
  return editableContactBookItems(cleaned)
}

// 💡 修正了當月天數計算錯誤的問題
const fetchMonthRecords = async () => {
  const y = calYear.value; 
  const m = String(calMonth.value + 1).padStart(2, '0')
  
  // 動態取得該月份的最後一天 (避免 9月傳送 31號 導致資料庫報錯)
  const lastDay = new Date(y, calMonth.value + 1, 0).getDate()
  
  const startDate = `${y}-${m}-01`; 
  const endDate = `${y}-${m}-${String(lastDay).padStart(2, '0')}`
  
  const { data } = await supabase.from('contact_books')
    .select('record_date, contact_items')
    .gte('record_date', startDate)
    .lte('record_date', endDate)
    
  monthRecords.value = (data || []).map(record => ({ ...record, contact_items: normalizeContactBookItems(record.contact_items) }))

  // 如果目前有選中某個日期，確保它的詳細內容會跟著 monthRecords 同步更新
  if (selectedHistoryDate.value) {
    const match = monthRecords.value.find(r => r.record_date === selectedHistoryDate.value)
    selectedHistoryContactItems.value = match ? editableContactBookItems(match.contact_items) : []
  }
}

const calendarDays = computed(() => {
  const days = []
  const firstDayOfWeek = new Date(calYear.value, calMonth.value, 1).getDay()
  const daysInMonth = new Date(calYear.value, calMonth.value + 1, 0).getDate()
  for (let i = 0; i < firstDayOfWeek; i++) { days.push({ empty: true }) }
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${calYear.value}-${String(calMonth.value + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    const record = monthRecords.value.find(r => r.record_date === dateStr)
    const hasC = record && record.contact_items && record.contact_items.length > 0
    days.push({ empty: false, day: i, dateStr: dateStr, hasRecord: hasC, contactItems: record ? editableContactBookItems(record.contact_items) : [] })
  }
  return days
})

const prevMonth = async () => { if (calMonth.value === 0) { calYear.value--; calMonth.value = 11 } else { calMonth.value-- } selectedHistoryDate.value = ''; isEditingHistory.value = false; await fetchMonthRecords() }
const nextMonth = async () => { if (calMonth.value === 11) { calYear.value++; calMonth.value = 0 } else { calMonth.value++ } selectedHistoryDate.value = ''; isEditingHistory.value = false; await fetchMonthRecords() }

const viewHistory = (day) => {
  if (day.empty) return
  selectedHistoryDate.value = day.dateStr
  selectedHistoryContactItems.value = editableContactBookItems(day.contactItems)
  isEditingHistory.value = false
}

const startEditHistory = () => { editHistoryContactItems.value = editableContactBookItems(selectedHistoryContactItems.value); isEditingHistory.value = true }
const cancelEditHistory = () => { isEditingHistory.value = false }
const addHistoryContactItem = () => editHistoryContactItems.value.push({ content: '', dueDate: '' })
const removeHistoryContactItem = (i) => editHistoryContactItems.value.splice(i, 1)

const saveHistory = async () => {
  isSavingHistory.value = true
  try {
    const saved = await saveContactRecord(selectedHistoryDate.value, editHistoryContactItems.value)
    alert('✅ 歷史紀錄已更新；有期限的項目已同步到班級注意事項！')
    selectedHistoryContactItems.value = editableContactBookItems(saved); isEditingHistory.value = false
    await fetchMonthRecords()
    if (selectedHistoryDate.value === todayISO) { contactBookItems.value = editableContactBookItems(saved) }
  } catch (error) { alert('❌ 儲存失敗：' + error.message) } finally { isSavingHistory.value = false }
}
</script>

<style scoped>
.split-contact-container { font-family: sans-serif; }
.table-header { border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; } 
.table-header h3 { margin: 0; color: #334155; font-size: 1.4rem;}
.section-title { margin: 0 0 10px 0; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; font-size: 1.15rem; }

.toggle-setting-box { margin-bottom: 15px; padding: 10px; background: #f0fdfa; border: 1px dashed #0f766e; border-radius: 6px; }
.toggle-label { font-weight: bold; color: #0f766e; display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.95rem; }

.board-editor-container, .history-calendar-container { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; }
.editor-panel { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }

.notice-edit-list { display: flex; flex-direction: column; gap: 12px; }

.edit-item { display: flex; align-items: center; gap: 10px; }
.notice-input { flex: 1; font-size: 1.05rem; padding: 10px 12px; border: 1px solid #94a3b8; border-radius: 6px; width: 100%; box-sizing: border-box;}
.due-field { display: flex; flex-direction: column; gap: 3px; color: #64748b; font-size: .78rem; white-space: nowrap; }
.due-input { padding: 9px; border: 1px solid #94a3b8; border-radius: 6px; color: #334155; }
.add-btn { background: #e2e8f0; color: #334155; border: 1px dashed #94a3b8; padding: 8px; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 5px; width: 100%; }
.del-row-btn { background: #ef4444; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; }

.action-bar { display: flex; justify-content: center; padding-top: 15px; border-top: 2px dashed #cbd5e1; }
.lg-btn { font-size: 1.2rem; padding: 15px 30px; width: 100%; max-width: 600px; }
.save-btn { background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; padding: 10px 15px;} 
.cancel-btn { background: #64748b; color: white; border: none; padding: 10px 15px; border-radius: 8px; cursor: pointer; font-weight: bold; }

.officer-pwd-section { margin-top: 25px; padding-top: 15px; border-top: 2px dashed #cbd5e1; }
.officer-pwd-section h5 { margin: 0 0 10px 0; font-size: 1.05rem; color: #1e293b; }
.form-group { margin-bottom: 10px; } .form-group label { display: block; margin-bottom: 5px; font-weight: bold; color: #475569; font-size: 0.9rem; }
.edit-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; box-sizing: border-box; width: 100%; }
.pwd-input-group { display: flex; gap: 10px; }
.pwd-btn { margin-top: 10px; width: 100%; padding: 10px; font-size: 1rem; }
.save-template-btn.small-btn { padding: 6px 12px; font-size: 0.9rem; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; }
.help-text { font-size: 0.9rem; color: #64748b; margin-bottom: 15px; }

.calendar-layout { display: flex; gap: 20px; flex-wrap: nowrap; }
.calendar-box { flex: 1; min-width: 0; background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
.history-detail-box { flex: 1; min-width: 0; background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }

.calendar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.cal-nav-btn { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; color: #475569; }
.cal-title { font-size: 1.2rem; color: #1e293b; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; text-align: center; }
.cal-day-name { font-weight: bold; color: #64748b; padding-bottom: 10px; }
.cal-cell { height: 50px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; background: #f8fafc; border: 1px solid transparent; transition: all 0.2s; }
.cal-cell:not(.empty):hover { background: #e0e7ff; border-color: #a5b4fc; }
.cal-cell.empty { background: transparent; cursor: default; }
.cal-cell.selected { background: #3b82f6; color: white; border-color: #2563eb; }
.cal-cell.selected .record-dot { background: white; }
.cal-date-num { font-weight: bold; font-size: 1.1rem; }
.record-dot { width: 6px; height: 6px; background: #3b82f6; border-radius: 50%; margin-top: 4px; }

.detail-header-flex { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px; margin-bottom: 15px; }
.edit-history-btn { background: #f59e0b; color: white; border: none; padding: 5px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.9rem; }
.edit-actions-row { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px dashed #cbd5e1;}

.empty-detail { text-align: center; color: #94a3b8; margin-top: 50px; font-size: 1.1rem; }
.detail-title { margin: 0; font-size: 1.2rem; color: #1e293b; }
.history-section h6 { font-size: 1.05rem; color: #475569; margin: 0 0 10px 0; }
.history-list { display: flex; flex-direction: column; gap: 8px; }
.history-item { font-size: 1.05rem; color: #334155; line-height: 1.4; word-break: break-all; }
.history-due { display: block; margin-left: 1.6em; color: #0369a1; font-size: .88em; font-weight: bold; }
.empty-text { color: #94a3b8; font-style: italic; }

@media (max-width: 768px) {
  .calendar-layout { flex-direction: column; }
  .editor-panel, .calendar-box, .history-detail-box { padding: 15px; }
  .lg-btn { font-size: 1.05rem; padding: 12px; }
  .edit-item { flex-wrap: wrap; }
  .due-field { width: calc(100% - 32px); margin-left: 32px; }
  .due-input { width: 100%; box-sizing: border-box; }
}
</style>
