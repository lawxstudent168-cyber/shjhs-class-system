<template>
  <div class="settings-container">
    <div class="table-header">
      <h3>🎯 依身分控制首頁按鈕顯示</h3>
      <button @click="saveSettings" class="save-btn" :disabled="isSaving">
        {{ isSaving ? '儲存中...' : '💾 儲存按鈕設定' }}
      </button>
    </div>
    
    <p class="help-text">
      您可以為不同的驗證身分，個別設定他們在班級首頁能看到哪些功能按鈕。<br>
      💡 此設定受限於「首頁功能按鈕顯示控制」的總開關。若總開關關閉，即使此處勾選，依然不會顯示。為避免無法管理，<strong>導師預設擁有所有按鈕權限</strong>。
    </p>

    <div class="table-wrapper">
      <table class="role-table">
        <thead>
          <tr>
            <th>功能按鈕</th>
            <th class="col-anonymous">👤 匿名訪客</th>
            <th class="col-classroom">🖥️ 教室電腦<br><span class="col-sub">校內/未登入</span></th>
            <th class="col-student">🎒 學生</th>
            <th class="col-parent">👨‍👩‍👦 家長</th>
            <th class="col-teacher">👨‍🏫 任課老師</th>
            <th class="col-admin">👑 導師</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="btn in buttonList" :key="btn.key">
            <td class="btn-name">{{ btn.label }}</td>
            <td><input type="checkbox" v-model="settings.anonymous[btn.key]" class="role-cb"></td>
            <td><input type="checkbox" v-model="settings.classroom[btn.key]" class="role-cb"></td>
            <td><input type="checkbox" v-model="settings.student[btn.key]" class="role-cb"></td>
            <td><input type="checkbox" v-model="settings.parent[btn.key]" class="role-cb"></td>
            <td><input type="checkbox" v-model="settings.subject_teacher[btn.key]" class="role-cb"></td>
            <!-- 導師強制鎖定為 true -->
            <td><input type="checkbox" v-model="settings.teacher[btn.key]" class="role-cb" disabled title="導師必須擁有所有權限"></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { homeButtonList, defaultRoleButtonSettings, normalizeRoleButtonSettings } from '../utils/homeButtonSettings.js'
const supabase = useSupabaseClient()

const isSaving = ref(false)

const buttonList = homeButtonList
const settings = ref(normalizeRoleButtonSettings())

const fetchSettings = async () => {
  const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'role_button_settings').maybeSingle()
  if (data && data.setting_value) {
    settings.value = normalizeRoleButtonSettings(data.setting_value)
  }
}

onMounted(() => fetchSettings())

const saveSettings = async () => {
  isSaving.value = true
  // 強制確保導師擁有全部權限
  settings.value.teacher = { ...defaultRoleButtonSettings.teacher }
  
  const { error } = await supabase.from('system_settings').upsert({
    setting_key: 'role_button_settings',
    setting_value: settings.value
  }, { onConflict: 'setting_key' })
  
  if (!error) alert('✅ 依身分按鈕權限已成功更新！')
  else alert('❌ 儲存失敗')
  isSaving.value = false
}
</script>

<style scoped>
.settings-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); font-family: sans-serif; }
.table-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 15px; }
.table-header h3 { margin: 0; color: #1e293b; font-size: 1.4rem; }
.save-btn { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 1.05rem; }
.save-btn:hover:not(:disabled) { background: #2563eb; }
.help-text { color: #64748b; font-size: 0.95rem; margin-bottom: 20px; line-height: 1.6; }

.table-wrapper { overflow-x: auto; border: 1px solid #cbd5e1; border-radius: 8px; }
.role-table { width: 100%; border-collapse: collapse; text-align: center; }
.role-table th, .role-table td { padding: 12px; border: 1px solid #e2e8f0; }
.role-table th { background: #f8fafc; color: #334155; font-size: 1.05rem; position: sticky; top: 0; }
.role-table tbody tr:hover { background: #f1f5f9; }

.btn-name { font-weight: bold; color: #0f172a; text-align: left; padding-left: 20px !important; }
.col-sub { font-size: 0.8rem; font-weight: normal; color: #64748b; }
.role-cb { transform: scale(1.4); cursor: pointer; accent-color: #10b981; }

.col-anonymous { background: #f1f5f9 !important; }
.col-classroom { background: #fef08a !important; color: #854d0e !important; }
.col-student { background: #e0f2fe !important; }
.col-parent { background: #dcfce7 !important; }
.col-teacher { background: #fee2e2 !important; }
.col-admin { background: #fef3c7 !important; }
</style>
