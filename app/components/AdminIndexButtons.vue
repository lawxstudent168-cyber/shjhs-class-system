<template>
  <div class="admin-buttons-card">
    <div class="card-header">
      <h3>🎛️ 首頁功能按鈕顯示控制</h3>
      <p class="help-text">取消勾選即可在首頁隱藏該按鈕。對於尚未開發完成或暫不需要的功能，可先在此關閉顯示。</p>
    </div>
    
    <div class="toggle-grid">
      <label class="toggle-item" :class="{ 'is-disabled': !settings.parentBind }">
        <input type="checkbox" v-model="settings.parentBind"> 👨‍👩‍👧 家長綁定
      </label>
      <label class="toggle-item" :class="{ 'is-disabled': !settings.parentMsg }">
        <input type="checkbox" v-model="settings.parentMsg"> 💬 家長私訊
      </label>
      <label class="toggle-item" :class="{ 'is-disabled': !settings.studentMsg }">
        <input type="checkbox" v-model="settings.studentMsg"> 💬 學生私訊
      </label>
      <label class="toggle-item" :class="{ 'is-disabled': !settings.assignments }">
        <input type="checkbox" v-model="settings.assignments"> 📚 作業管理
      </label>
      <label class="toggle-item" :class="{ 'is-disabled': !settings.discipline }">
        <input type="checkbox" v-model="settings.discipline"> ⚖️ 秩序管理
      </label>
      <label class="toggle-item" :class="{ 'is-disabled': !settings.hygiene }">
        <input type="checkbox" v-model="settings.hygiene"> 🧹 衛生管理
      </label>
      <label class="toggle-item" :class="{ 'is-disabled': !settings.seats }">
        <input type="checkbox" v-model="settings.seats"> 🪑 座位管理
      </label>
      <label class="toggle-item" :class="{ 'is-disabled': !settings.smallSeatMap }">
        <input type="checkbox" v-model="settings.smallSeatMap"> 👀 顯示小座位表
      </label>
      <label class="toggle-item" :class="{ 'is-disabled': !settings.schedule }">
        <input type="checkbox" v-model="settings.schedule"> 🗓️ 課表管理
      </label>
      
      <!-- 💡 新增：大考管理開關 -->
      <label class="toggle-item" :class="{ 'is-disabled': !settings.exams }">
        <input type="checkbox" v-model="settings.exams"> 🎓 大考管理
      </label>

      <label class="toggle-item" :class="{ 'is-disabled': !settings.emergency }">
        <input type="checkbox" v-model="settings.emergency"> 🚨 緊急通知
      </label>
      <label class="toggle-item" :class="{ 'is-disabled': !settings.admin }">
        <input type="checkbox" v-model="settings.admin"> ⚙️ 後台入口
      </label>
    </div>

    <div class="action-footer">
      <button @click="saveSettings" class="btn-save" :disabled="isSaving">
        {{ isSaving ? '⏳ 儲存中...' : '💾 儲存並套用至首頁' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
const supabase = useSupabaseClient()

const isSaving = ref(false)
const settings = ref({
  parentBind: true, parentMsg: true, studentMsg: true, assignments: true, 
  discipline: true, hygiene: true, seats: true, smallSeatMap: true, schedule: true, exams: true, emergency: true, admin: true
})

onMounted(async () => {
  const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'index_button_settings').maybeSingle()
  if (data?.setting_value) {
    settings.value = { ...settings.value, ...data.setting_value }
  }
})

const saveSettings = async () => {
  isSaving.value = true
  try {
    const { error } = await supabase.from('system_settings').upsert({
      setting_key: 'index_button_settings',
      setting_value: settings.value
    }, { onConflict: 'setting_key' })
    if (error) throw error
    alert('✅ 首頁按鈕設定已成功更新！')
  } catch (err) {
    alert(`❌ 儲存失敗：${err.message}`)
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped>
.admin-buttons-card { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; max-width: 800px; margin: 0 auto; }
.card-header { border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; margin-bottom: 20px; }
.card-header h3 { margin: 0; color: #1e293b; font-size: 1.3rem; }
.help-text { color: #64748b; font-size: 0.95rem; margin-top: 8px; margin-bottom: 0;}

.toggle-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px; }
.toggle-item { display: flex; align-items: center; gap: 10px; padding: 12px 15px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; cursor: pointer; font-weight: bold; color: #334155; transition: 0.2s; user-select: none;}
.toggle-item:hover { border-color: #3b82f6; background: #eff6ff; }
.toggle-item input[type="checkbox"] { transform: scale(1.2); cursor: pointer; }
.is-disabled { opacity: 0.5; background: #f1f5f9; border-color: #e2e8f0; text-decoration: line-through; }

.action-footer { display: flex; justify-content: flex-end; border-top: 2px dashed #e2e8f0; padding-top: 20px; }
.btn-save { background: #10b981; color: white; border: none; padding: 12px 25px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 1.1rem; transition: 0.2s; }
.btn-save:disabled { background: #94a3b8; cursor: not-allowed; }
.btn-save:hover:not(:disabled) { background: #059669; }
</style>
