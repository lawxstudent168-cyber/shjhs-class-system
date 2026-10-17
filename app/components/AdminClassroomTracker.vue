<template>
  <div class="tracking-container">
    <div class="table-header">
      <h3>🖥️ 教室電腦專屬監控系統</h3>
      <div class="header-actions">
        <!-- 💡 遠端強制登出按鈕 -->
        <button @click="triggerForceLogout" class="force-logout-btn" :disabled="isSendingSignal">
          {{ isSendingSignal ? '發送訊號中...' : '🚨 強制登出教室電腦帳號' }}
        </button>
        <button @click="fetchLogs" class="refresh-btn" :disabled="isLoading">
          {{ isLoading ? '🔄 載入中...' : '🔄 重新整理' }}
        </button>
      </div>
    </div>

    <!-- 綁定教室 IP 設定區塊 -->
    <div class="settings-card">
      <div class="settings-row">
        <label class="setting-label">📍 綁定教室電腦 IP：</label>
        <input type="text" v-model="targetIP" class="ip-input" placeholder="例如：120.116.34.13" />
        <button @click="saveTargetIP" class="save-btn" :disabled="isSaving">
          {{ isSaving ? '儲存中...' : '💾 儲存綁定' }}
        </button>
      </div>
      <p class="help-text">系統將排除其他訪客，只列出這個 IP 的所有操作紀錄。預設已為您填入截圖中的教室 IP。</p>
    </div>

    <!-- 專屬時間軸 -->
    <div class="timeline-panel">
      <div class="timeline-header">
        <h4>📡 來自 {{ targetIP }} 的近期活動軌跡</h4>
        <span class="log-count">共 {{ logs.length }} 筆紀錄</span>
      </div>

      <div v-if="isLoading" class="loading-state">⏳ 載入紀錄中...</div>
      <div v-else-if="logs.length === 0" class="empty-state">目前查無此 IP 的任何操作紀錄</div>
      
      <div v-else class="timeline-content">
        <div v-for="(log, idx) in logs" :key="log.id" class="timeline-item">
          
          <div class="time-col">
            <div class="t-date">{{ formatDateOnly(log.created_at) }}</div>
            <div class="t-time">{{ formatTimeOnly(log.created_at) }}</div>
          </div>
          
          <div class="dot-col">
            <div class="dot"></div>
            <div class="line" v-if="idx !== logs.length - 1"></div>
          </div>
          
          <div class="action-col">
            <div class="action-header">
               <span class="action-tag" :class="getActionClass(log.label || log.role)">
                 {{ getActionCategory(log.label || log.role) }}
               </span>
               <span class="action-text">{{ log.label || log.role || '造訪網站' }}</span>
            </div>
            <div class="device-info">💻 設備：{{ log.device_info }}</div>
          </div>
          
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { normalizeVisitorLog } from '../utils/visitorTracking.js'
import { ref, onMounted } from 'vue'
const supabase = useSupabaseClient()

// 預設代入截圖中的教室 IP
const targetIP = ref('120.116.34.13')
const logs = ref([])
const isLoading = ref(false)
const isSaving = ref(false)
const isSendingSignal = ref(false)

// 載入綁定的 IP
const loadSettings = async () => {
  const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'classroom_computer_ip').maybeSingle()
  if (data && data.setting_value) targetIP.value = data.setting_value
}

// 儲存綁定的 IP
const saveTargetIP = async () => {
  isSaving.value = true
  await supabase.from('system_settings').upsert({ 
    setting_key: 'classroom_computer_ip', 
    setting_value: targetIP.value 
  }, { onConflict: 'setting_key' })
  alert('✅ 教室電腦 IP 綁定成功！')
  isSaving.value = false
  fetchLogs() // 儲存後立即重新抓取資料
}

// 抓取該 IP 的專屬日誌
const fetchLogs = async () => {
  if (!targetIP.value) return
  isLoading.value = true
  const { data } = await supabase.from('visitor_logs')
    .select('*')
    .eq('ip_address', targetIP.value)
    .order('created_at', { ascending: false })
    .limit(300) // 顯示最近 300 筆
  logs.value = (data || []).map(normalizeVisitorLog)
  isLoading.value = false
}

// 💡 遠端強制登出訊號發送函式
const triggerForceLogout = async () => {
  if (!confirm('🚨 確定要強制登出教室電腦的所有身分嗎？\n這將會透過背景訊號清除該電腦上的導師與幹部登入狀態。')) return;

  isSendingSignal.value = true
  try {
    // 寫入當下時間戳記作為「強制登出訊號」
    await supabase.from('system_settings').upsert({
      setting_key: 'force_logout_timestamp',
      setting_value: Date.now()
    }, { onConflict: 'setting_key' });

    alert('✅ 強制登出訊號已發出！\n只要教室電腦的網路正常，將在下一次背景資料更新時（預設60秒內）被強制登出並恢復為匿名狀態。');
    
    // 寫入一筆 Log，紀錄是誰踢的
    await supabase.from('visitor_logs').insert([{
       ip_address: '後台指令', 
       role: '系統管理員', 
       action_details: '🚨 發送指令：遠端強制登出教室電腦所有帳號' 
    }]);

    fetchLogs() // 重新整理日誌
  } catch (error) {
    alert('❌ 訊號發送失敗，請檢查資料庫連線。');
  } finally {
    isSendingSignal.value = false
  }
}

onMounted(async () => {
  await loadSettings()
  await fetchLogs()
})

// === 格式化與標籤處理輔助函式 ===
const formatDateOnly = (iso) => iso ? new Date(iso).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }) : ''
const formatTimeOnly = (iso) => iso ? new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : ''

const getActionCategory = (action) => {
  if (!action) return '📌 動作'
  if (action.includes('點擊') || action.includes('按鈕')) return '🖱️ 點擊'
  if (action.includes('瀏覽') || action.includes('進入')) return '👁️ 瀏覽'
  if (action.includes('登入') || action.includes('解鎖')) return '🔑 驗證'
  if (action.includes('強制登出')) return '🚨 系統'
  return '📌 動作'
}

const getActionClass = (action) => {
  if (!action) return 'tag-default'
  if (action.includes('點擊') || action.includes('按鈕')) return 'tag-click'
  if (action.includes('瀏覽') || action.includes('進入')) return 'tag-view'
  if (action.includes('登入') || action.includes('解鎖')) return 'tag-auth'
  if (action.includes('強制登出')) return 'tag-danger'
  return 'tag-default'
}
</script>

<style scoped>
.tracking-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); font-family: sans-serif; }
.table-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;}
.table-header h3 { margin: 0; color: #1e293b; font-size: 1.4rem; }

.header-actions { display: flex; gap: 10px; }
.refresh-btn { background: #f1f5f9; border: 1px solid #cbd5e1; color: #475569; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; }
.refresh-btn:hover:not(:disabled) { background: #e2e8f0; }

.force-logout-btn { background-color: #ef4444; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2); }
.force-logout-btn:hover:not(:disabled) { background-color: #dc2626; box-shadow: 0 4px 6px rgba(220, 38, 38, 0.3); transform: translateY(-1px); }
.force-logout-btn:disabled { background-color: #fca5a5; cursor: not-allowed; transform: none; }

.settings-card { background: #f0fdfa; border: 1px dashed #0f766e; padding: 15px 20px; border-radius: 8px; margin-bottom: 20px; }
.settings-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.setting-label { font-weight: bold; color: #0f766e; font-size: 1.05rem; }
.ip-input { padding: 8px 12px; border: 1px solid #99f6e4; border-radius: 6px; font-size: 1.05rem; width: 200px; outline: none; }
.ip-input:focus { box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.2); border-color: #0d9488; }
.save-btn { background: #0d9488; color: white; border: none; padding: 9px 18px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.save-btn:hover:not(:disabled) { background: #0f766e; }
.help-text { color: #115e59; font-size: 0.9rem; margin: 10px 0 0 0; opacity: 0.8; }

.timeline-panel { border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; }
.timeline-header { padding: 15px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center; }
.timeline-header h4 { margin: 0; color: #1e293b; font-size: 1.2rem; }
.log-count { background: #e2e8f0; color: #475569; padding: 4px 12px; border-radius: 20px; font-size: 0.9rem; font-weight: bold; }

.timeline-content { padding: 30px 40px; max-height: 600px; overflow-y: auto; }
.timeline-item { display: flex; gap: 20px; }
.time-col { width: 100px; text-align: right; flex-shrink: 0; padding-top: 2px; }
.t-date { font-size: 0.9rem; color: #64748b; }
.t-time { font-size: 1.15rem; font-weight: bold; color: #1e293b; font-family: monospace; }

.dot-col { display: flex; flex-direction: column; align-items: center; width: 24px; flex-shrink: 0; }
.dot { width: 14px; height: 14px; border-radius: 50%; background: #3b82f6; border: 3px solid #bfdbfe; margin-top: 5px; z-index: 2; }
.line { flex: 1; width: 2px; background: #e2e8f0; min-height: 45px; margin-top: 5px; margin-bottom: 5px; }

.action-col { flex: 1; padding-bottom: 30px; }
.action-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.action-tag { padding: 4px 10px; border-radius: 20px; font-size: 0.9rem; font-weight: bold; }
.action-text { font-size: 1.15rem; color: #334155; line-height: 1.5; font-weight: bold; }
.device-info { font-size: 0.9rem; color: #94a3b8; background: #f8fafc; display: inline-block; padding: 4px 10px; border-radius: 6px; border: 1px solid #f1f5f9; }

.tag-view { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
.tag-click { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
.tag-auth { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
.tag-danger { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
.tag-default { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }

.loading-state, .empty-state { text-align: center; padding: 60px 20px; color: #64748b; font-style: italic; font-size: 1.1rem; }
</style>
