<template>
  <div class="admin-panel">
    <div class="table-header">
      <h3>⚡ 本週班級注意事項管理</h3>
    </div>

    <div class="editor-section">
      <div class="section-header">
        <h4 class="section-title">📝 按日期安排班級事項</h4>
        <div class="io-actions">
          <button @click="exportJSON" class="io-btn export-btn">📤 匯出備份</button>
          <label class="io-btn import-btn">
            📥 匯入備份
            <input type="file" accept=".json" style="display:none" @change="importJSON" />
          </label>
        </div>
      </div>
      
      <p class="help-text">日期可留空：留空的事項會永久顯示在首頁；有日期的事項只會在今天起 7 天內顯示，並於日期隔天自動消失。</p>

      <div v-if="isLoading" class="loading-state">⏳ 載入資料中，請稍候...</div>
      
      <div v-else class="edit-mode">
        <div v-if="!editItems.some(isCurrentNote)" class="empty-state">
          目前沒有長期、今天或未來的注意事項。
        </div>

        <div v-for="(item, index) in editItems" v-show="showPast || isCurrentNote(item)" :key="'cn-'+index" class="edit-row">
          <span class="row-num">{{ index + 1 }}.</span>
          <label class="date-field"><span>事項日期（留空＝永久）</span><input v-model="item.date" type="date" class="date-picker" /></label>
          <span class="weekday-hint">{{ classNoteDateLabel(item.date) }}</span>
          <input v-model="item.content" type="text" placeholder="輸入班級注意事項..." class="edit-input"/>
          <button @click="removeItem(index)" class="del-row-btn">🗑️ 刪除</button>
        </div>
        <button v-if="editItems.some(isPastNote)" type="button" class="history-toggle" @click="showPast = !showPast">
          {{ showPast ? '收起歷史事項' : '查看及編輯歷史事項' }}
        </button>
        
        <div class="edit-actions">
          <button @click="addItem" class="add-btn">➕ 新增一筆事項</button>
          <div class="right-actions">
            <button v-if="editItems.some(isCurrentNote)" @click="clearUpcoming" class="clear-btn">🧹 清空長期、今天及未來事項</button>
            <button @click="saveItems" class="save-btn" :disabled="isSaving">
              {{ isSaving ? '儲存中...' : '💾 儲存並發布' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { normalizeClassNotes, classNoteDateLabel } from '../utils/classNotes.js'
import { isValidExamDate, taiwanDateISO } from '../utils/examSchedule.js'
const supabase = useSupabaseClient()

const todayISO = taiwanDateISO()

const isLoading = ref(false)
const isSaving = ref(false)
const editItems = ref([])
const allNotesData = ref([])
const showPast = ref(false)
const isCurrentNote = item => !item.date || item.date >= todayISO
const isPastNote = item => Boolean(item.date) && item.date < todayISO

const fetchNotes = async () => {
  isLoading.value = true
  try {
    const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'class_notes_data').maybeSingle()
    
    allNotesData.value = normalizeClassNotes(data?.setting_value)
    editItems.value = allNotesData.value.map(item => ({ ...item }))
  } catch (err) {
    console.error("讀取失敗:", err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => fetchNotes())

const addItem = () => editItems.value.push({ date: '', content: '' })
const removeItem = (idx) => editItems.value.splice(idx, 1)

const clearUpcoming = () => {
  if (confirm('確定要清空長期、今天及未來的所有注意事項嗎？歷史事項會保留。')) {
    editItems.value = editItems.value.filter(isPastNote)
  }
}

const saveItems = async () => {
  if (editItems.value.some(item => item.content.trim() && item.date && !isValidExamDate(item.date))) {
    alert('日期請留空（永久顯示）或選擇有效日期。')
    return
  }
  isSaving.value = true
  try {
    const cleanedItems = normalizeClassNotes(editItems.value)
    const { error } = await supabase.from('system_settings').upsert({
      setting_key: 'class_notes_data',
      setting_value: cleanedItems
    }, { onConflict: 'setting_key' })
    if (error) throw error
    allNotesData.value = cleanedItems
    editItems.value = cleanedItems.map(item => ({ ...item }))
    alert('✅ 班級注意事項已儲存；無日期事項會永久顯示。')
  } catch (err) {
    alert('❌ 儲存失敗：' + err.message)
  } finally {
    isSaving.value = false
  }
}

// 💡 JSON 備份匯出功能
const exportJSON = () => {
  const dataStr = JSON.stringify(allNotesData.value, null, 2)
  const blob = new Blob([dataStr], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `class_notes_backup_${todayISO}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// 💡 JSON 備份匯入功能
const importJSON = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async (e) => {
    try {
      const imported = JSON.parse(e.target.result)
      const validNew = Array.isArray(imported) && imported.every(item =>
        item && (!item.date || isValidExamDate(item.date)) && typeof item.content === 'string')
      const validLegacy = imported && typeof imported === 'object' && !Array.isArray(imported) &&
        Object.entries(imported).every(([date, items]) => (!date || isValidExamDate(date)) &&
          Array.isArray(items) && items.every(item => typeof item === 'string'))
      if (!validNew && !validLegacy) {
        throw new Error('無效的資料格式；請匯入新版陣列或舊版日期鍵值物件。')
      }
      
      if (confirm('是否要【完全覆蓋】現有所有的注意事項歷史紀錄？\n(按「確定」將覆蓋現有資料庫，請謹慎操作)')) {
        const normalized = normalizeClassNotes(imported)
        const { error } = await supabase.from('system_settings').upsert({
          setting_key: 'class_notes_data', 
          setting_value: normalized
        }, { onConflict: 'setting_key' })
        if (error) throw error
        allNotesData.value = normalized
        editItems.value = normalized.map(item => ({ ...item }))
        alert('✅ 匯入成功！系統已同步。')
      }
    } catch(err) { 
      alert('❌ 匯入失敗：' + err.message) 
    }
    event.target.value = '' // 清除選取的檔案，方便重複點擊
  }
  reader.readAsText(file)
}
</script>

<style scoped>
.admin-panel { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; font-family: sans-serif;}
.table-header { border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; } 
.table-header h3 { margin: 0; color: #334155; font-size: 1.4rem;}

/* 日期查詢區塊 */
.query-box { background: #f0f9ff; padding: 20px; border-radius: 8px; border: 1px dashed #7dd3fc; margin-bottom: 25px;}
.query-header { display: flex; align-items: center; gap: 15px; flex-wrap: wrap;}
.query-header label { font-weight: bold; color: #0284c7; font-size: 1.1rem;}
.date-picker { padding: 10px 15px; font-size: 1.1rem; border: 1px solid #7dd3fc; border-radius: 6px; color: #0284c7; font-weight: bold; cursor: pointer;}
.date-picker:focus { outline: none; box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.3); }

/* 編輯區塊表頭與匯出入按鈕 */
.section-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 10px;}
.section-title { margin: 0; color: #0ea5e9; font-size: 1.3rem; font-weight: bold;}
.help-text { color: #64748b; margin-bottom: 20px; font-size: 0.95rem; line-height: 1.5;}

.io-actions { display: flex; gap: 10px; }
.io-btn { padding: 8px 15px; border-radius: 6px; font-weight: bold; font-size: 0.95rem; cursor: pointer; border: none; transition: 0.2s;}
.export-btn { background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc;}
.export-btn:hover { background: #bae6fd; }
.import-btn { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; display: inline-block; }
.import-btn:hover { background: #e2e8f0; }

.loading-state, .empty-state { text-align: center; padding: 30px; color: #94a3b8; font-style: italic; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;}

/* 編輯列表區 */
.edit-mode { background: #f8fafc; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0;}
.edit-row { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
.row-num { font-size: 1.1rem; color: #0ea5e9; width: 30px; font-weight: bold; flex-shrink: 0;}
.date-field { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; color: #475569; font-size: 0.8rem; }
.date-field .date-picker { padding: 9px; font-size: 1rem; }
.weekday-hint { color: #0369a1; white-space: nowrap; font-size: 0.9rem; }
.edit-input { flex: 1; padding: 12px 15px; font-size: 1.05rem; border-radius: 6px; border: 1px solid #cbd5e1; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);}
.edit-input:focus { outline: none; border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.2); }
.history-toggle { background: transparent; border: 0; color: #0369a1; cursor: pointer; text-decoration: underline; padding: 8px 0; }

.del-row-btn { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-weight: bold; white-space: nowrap; transition: 0.2s;}
.del-row-btn:hover { background: #fecaca; }

/* 底部操作按鈕 */
.edit-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 25px; padding-top: 20px; border-top: 1px dashed #cbd5e1;}
.add-btn { background: white; color: #0ea5e9; border: 2px dashed #0ea5e9; padding: 12px 25px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 1.05rem; transition: 0.2s;}
.add-btn:hover { background: #f0f9ff; }

.right-actions { display: flex; gap: 10px; }
.clear-btn { background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 1.05rem; transition: 0.2s;}
.clear-btn:hover { background: #e2e8f0; }

.save-btn { background: #0ea5e9; color: white; border: none; padding: 12px 30px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 1.1rem; transition: 0.2s;}
.save-btn:hover:not(:disabled) { background: #0284c7; }
.save-btn:disabled { background: #7dd3fc; cursor: not-allowed; }

/* =======================================
   💡 手機端 RWD 排版 
   ======================================= */
@media (max-width: 768px) {
  .admin-panel { padding: 15px; }
  .section-header { flex-direction: column; align-items: flex-start; }
  .io-actions { width: 100%; display: flex; gap: 10px; }
  .io-btn { flex: 1; text-align: center; padding: 10px; }
  
  .query-header { flex-direction: column; align-items: stretch; gap: 10px; }
  .date-picker { width: 100%; box-sizing: border-box; }
  
  .edit-mode { padding: 15px; }
  .edit-row { flex-wrap: wrap; gap: 8px; margin-bottom: 20px; background: white; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;}
  .date-field { width: calc(100% - 42px); }
  .date-field .date-picker { width: 100%; box-sizing: border-box; }
  .weekday-hint { margin-left: 42px; }
  .edit-input { min-width: 0; width: calc(100% - 40px); margin-bottom: 5px;}
  .del-row-btn { width: 100%; padding: 12px;}
  
  .edit-actions { flex-direction: column; gap: 15px; align-items: stretch;}
  .add-btn { width: 100%; }
  .right-actions { display: flex; flex-direction: column; gap: 10px; width: 100%; }
  .clear-btn, .save-btn { width: 100%; text-align: center; }
}
</style>
