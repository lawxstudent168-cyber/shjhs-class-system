<template>
  <div class="admin-section">
    <AdminStudentBroadcast />
    <div class="header-box">
      <h3>📡 教室廣播遙控與定時系統</h3>
      <p class="help-text">💡 本系統可將文字與音效遠端傳送至班級首頁。為解決學校共用 IP 問題，請在首頁點擊設定「廣播設備名稱」（如：701教室），並在此指定名稱即可單獨發送。</p>
      
      <div class="ip-security-banner" :class="isCurrentDeviceClassroom ? 'is-safe' : 'is-warning'">
        <strong>🛡️ 廣播安全隔離檢測：</strong> 
        您的目前 IP 為 <span class="highlight-ip">{{ currentIP }}</span>。<br>
        狀態：{{ isCurrentDeviceClassroom ? '✅ 位於褐色名單內！若未指定單一名稱，將廣播至全校首頁。' : '⚠️ 這台不是教室電腦。為保護隱私，您的首頁已啟動靜音隔離，家長在家絕對聽不到廣播。' }}
      </div>
    </div>

    <!-- 1. 罐頭訊息 -->
    <div v-if="presets.length > 0" class="presets-section">
      <div class="presets-header">📦 快速載入罐頭訊息：</div>
      <div class="presets-list">
        <div v-for="(preset, index) in presets" :key="index" class="preset-chip">
          <span class="preset-name" @click="applyPreset(preset)" title="點擊載入此設定">{{ preset.name }}</span>
          <button class="preset-del" @click="removePreset(index)" title="刪除此罐頭">✖</button>
        </div>
      </div>
    </div>

    <!-- 2. 手動廣播 -->
    <div class="card manual-card">
      <div class="card-header-row">
        <h4 class="card-title">🚨 即時遙控發送 (手動廣播)</h4>
        <button @click="saveAsPreset" class="btn-save-preset">💾 將目前設定存為罐頭</button>
      </div>
      
      <div class="form-grid">
        <div class="form-group full-width">
          <label>📝 廣播文字內容 (將於音效後自動語音朗讀)：</label>
          <input type="text" v-model="manualConfig.text" class="custom-input large-input" placeholder="例如：請各組組長現在到導師辦公室集合！" />
        </div>
        <div class="form-group">
          <label>🔊 播放音效 (高相容 MP3)：</label>
          <select v-model="manualConfig.sound" class="custom-input">
            <option v-for="opt in soundOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>🔁 音效次數：</label>
          <select v-model.number="manualConfig.playCount" class="custom-input">
            <option value="1">1 次</option><option value="2">2 次</option><option value="3">3 次</option>
          </select>
        </div>
        <div class="form-group">
          <label>🗣️ 語音朗讀次數：</label>
          <select v-model.number="manualConfig.textPlayCount" class="custom-input">
            <option value="1">1 次</option><option value="2">2 次 (建議)</option><option value="3">3 次</option>
          </select>
        </div>
        <div class="form-group">
          <label>⏳ 畫面保留時間：</label>
          <select v-model.number="manualConfig.displayDuration" class="custom-input">
            <option value="10">10 秒</option><option value="30">30 秒</option><option value="60">1 分鐘</option>
            <option value="120">2 分鐘</option><option value="300">5 分鐘</option><option value="600">10 分鐘</option>
          </select>
        </div>
        <div class="form-group full-width">
          <label>🎯 指定接收單一【設備名稱】 (解決學校共用IP)：</label>
          <div class="ip-control-group">
            <select v-model="manualConfig.targetIP" class="custom-input flex-2">
              <option value="">🌐 全發送 (所有褐色名單內的電腦)</option>
              <option v-for="target in savedIPs" :key="target" :value="target">🎯 {{ target }}</option>
            </select>
            <input type="text" v-model="newIPInput" class="custom-input flex-1" placeholder="輸入名稱 (如: 701教室)..." />
            <button @click="saveNewIP" class="btn-sub">💾 加入選單</button>
            <button v-if="manualConfig.targetIP" @click="removeSavedIP(manualConfig.targetIP)" class="btn-sub-del">🗑️ 刪除選取</button>
          </div>
        </div>
      </div>

      <div class="action-row">
        <button @click="testSoundAndTTS" class="btn-test" :disabled="isTesting">
          {{ isTesting ? '🔊 試聽模擬中...' : '🎧 本機模擬試聽 (音效+語音)' }}
        </button>
        <button @click="sendManualBroadcast" class="btn-send" :disabled="isSending">
          {{ isSending ? '🚀 訊號發送中...' : '🚀 立刻發送到教室螢幕！' }}
        </button>
      </div>
    </div>

    <!-- 3. 定時排程 -->
    <div class="card schedule-card">
      <div class="schedule-header">
        <h4 class="card-title">⏰ 定時廣播排程 (每日循環)</h4>
        <button @click="addSchedule" class="btn-add">➕ 新增一筆排程</button>
      </div>
      <div v-if="schedules.length === 0" class="empty-state">目前沒有任何定時排程。</div>
      <div v-else class="schedule-list">
        <div v-for="(sch, index) in schedules" :key="index" class="schedule-item" :class="{'is-disabled': !sch.isActive}">
          <div class="sch-row top-row">
            <input type="checkbox" v-model="sch.isActive" class="toggle-chk" title="啟用/停用" />
            <input type="time" v-model="sch.time" class="time-input" required />
            <input type="text" v-model="sch.text" class="custom-input text-input" placeholder="排程廣播文字..." />
            <button @click="removeSchedule(index)" class="btn-del" title="刪除此排程">🗑️</button>
          </div>
          <div class="sch-row bottom-row">
            <div class="mini-group">
              <label>音效:</label>
              <select v-model="sch.sound" class="custom-input mini-select">
                <option v-for="opt in soundOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
            <div class="mini-group">
              <label>音/語次:</label>
              <select v-model.number="sch.playCount" class="custom-input mini-select-small"><option value="1">1</option><option value="2">2</option><option value="3">3</option></select>
              <select v-model.number="sch.textPlayCount" class="custom-input mini-select-small"><option value="1">1</option><option value="2">2</option><option value="3">3</option></select>
            </div>
            <div class="mini-group">
              <label>保留:</label>
              <select v-model.number="sch.displayDuration" class="custom-input mini-select-small">
                <option value="10">10秒</option><option value="30">30秒</option><option value="60">1分</option><option value="120">2分</option><option value="300">5分</option>
              </select>
            </div>
            <div class="mini-group ip-group">
              <label>對象:</label>
              <select v-model="sch.targetIP" class="custom-input ip-select">
                <option value="">🌐 全發送</option>
                <option v-for="target in savedIPs" :key="target" :value="target">{{ target }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      <div class="save-row">
        <button @click="saveSettingsToDB" class="btn-save-all" :disabled="isSavingSch">
          {{ isSavingSch ? '儲存中...' : '💾 儲存所有排程與罐頭設定' }}
        </button>
      </div>
    </div>

    <!-- 💡 4. 新增：歷史紀錄與匯出匯入 (Audit Logs) -->
    <div class="card logs-card">
      <div class="card-header-row">
        <h4 class="card-title">📝 廣播歷史與日誌追蹤</h4>
        <div class="log-actions">
          <button @click="exportJSON" class="btn-outline">📄 匯出 JSON</button>
          <button @click="exportCSV" class="btn-outline">📊 匯出 CSV (Excel)</button>
          <button @click="$refs.fileInput.click()" class="btn-outline-primary">📥 匯入還原紀錄</button>
          <input type="file" ref="fileInput" accept=".json, .csv" @change="importLogs" style="display:none" />
        </div>
      </div>

      <div class="table-container">
        <table class="logs-table">
          <thead>
            <tr>
              <th>發生時間</th>
              <th>觸發類型</th>
              <th>廣播文字內容</th>
              <th>音效</th>
              <th>指定接收對象</th>
              <th>指令發出 IP</th>
              <th>操作設備 (瀏覽器)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="broadcastLogs.length === 0"><td colspan="7" class="empty-log">目前尚無任何廣播紀錄。</td></tr>
            <tr v-for="log in broadcastLogs" :key="log.id">
              <td class="col-time">{{ log.time }}</td>
              <td><span class="type-tag" :class="log.type === '手動發送' ? 't-manual' : 't-auto'">{{ log.type }}</span></td>
              <td class="col-text">{{ log.text }}</td>
              <td>{{ getSoundLabel(log.sound) }}</td>
              <td class="col-ip">{{ log.targetIP }}</td>
              <td class="col-ip">{{ log.ip }}</td>
              <td class="col-ua" :title="log.userAgent">{{ formatUA(log.userAgent) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
const supabase = useSupabaseClient()

const soundOptions = [
  { value: 'none', label: '🔇 無音效 (純文字)' }, { value: 'bell_ring', label: '🛎️ 服務鈴 (叮叮)' },
  { value: 'door_bell', label: '🚪 門鈴 (叮咚)' }, { value: 'computer_error', label: '⚠️ 電腦警告音' },
  { value: 'water_droplet', label: '💧 水滴聲' }, { value: 'glass', label: '🥂 敲擊玻璃杯' },
  { value: 'tap', label: '👆 輕觸聲' }, { value: 'branch_break', label: '🪵 樹枝斷裂聲' },
  { value: 'button_tiny', label: '🖱️ 短促按鍵音' }, { value: 'button_click', label: '🖱️ 滑鼠點擊' },
  { value: 'button_push', label: '🔘 按下按鈕' }, { value: 'camera_flashing', label: '📸 相機快門' },
  { value: 'cd_tray', label: '💿 光碟機退片' }, { value: 'door_bump', label: '🚪 撞門聲' },
  { value: 'keyboard_desk', label: '⌨️ 鍵盤敲擊' }, { value: 'metal_plate', label: '🛡️ 金屬敲擊' },
  { value: 'pop_cork', label: '🍾 開香檳' }, { value: 'snap', label: '🫰 彈指聲' },
  { value: 'staple_gun', label: '🖇️ 釘書機' }, { value: 'chord_1', label: '🎹 電子和弦 1' },
  { value: 'chord_2', label: '🎹 電子和弦 2' }, { value: 'chord_3', label: '🎹 電子和弦 3' },
  { value: 'heater_1', label: '🥁 爵士鼓聲 1' }, { value: 'heater_2', label: '🥁 爵士鼓聲 2' },
  { value: 'heater_3', label: '🥁 爵士鼓聲 3' }, { value: 'kick_n_hat', label: '🥁 踢鼓與鈸' },
  { value: 'punchy_kick', label: '🥁 重踢鼓' }, { value: 'side_stick', label: '🥁 鼓邊敲擊' },
  { value: 'brk_snr', label: '🥁 小鼓打擊' }, { value: 'dry_ohh', label: '🥁 銅鈸開啟' },
  { value: 'dsc_oh', label: '🥁 銅鈸迴響' }
]

const sounds = {
  bell_ring: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/bell_ring.mp3', door_bell: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/door_bell.mp3',
  computer_error: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/computer_error.mp3', water_droplet: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/water_droplet.mp3',
  glass: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/glass.mp3', tap: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/tap.mp3',
  branch_break: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/branch_break.mp3', button_tiny: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/button_tiny.mp3',
  button_click: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/button_click.mp3', button_push: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/button_push.mp3',
  camera_flashing: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/camera_flashing.mp3', cd_tray: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/cd_tray.mp3',
  door_bump: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/door_bump.mp3', keyboard_desk: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/keyboard_desk.mp3',
  metal_plate: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/metal_plate.mp3', pop_cork: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/pop_cork.mp3',
  snap: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/snap.mp3', staple_gun: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/staple_gun.mp3',
  chord_1: 'https://s3.amazonaws.com/freecodecamp/drums/Chord_1.mp3', chord_2: 'https://s3.amazonaws.com/freecodecamp/drums/Chord_2.mp3',
  chord_3: 'https://s3.amazonaws.com/freecodecamp/drums/Chord_3.mp3', heater_1: 'https://s3.amazonaws.com/freecodecamp/drums/Heater-1.mp3',
  heater_2: 'https://s3.amazonaws.com/freecodecamp/drums/Heater-2.mp3', heater_3: 'https://s3.amazonaws.com/freecodecamp/drums/Heater-3.mp3',
  kick_n_hat: 'https://s3.amazonaws.com/freecodecamp/drums/Kick_n_Hat.mp3', punchy_kick: 'https://s3.amazonaws.com/freecodecamp/drums/punchy_kick_1.mp3',
  side_stick: 'https://s3.amazonaws.com/freecodecamp/drums/side_stick_1.mp3', brk_snr: 'https://s3.amazonaws.com/freecodecamp/drums/Brk_Snr.mp3',
  dry_ohh: 'https://s3.amazonaws.com/freecodecamp/drums/Dry_Ohh.mp3', dsc_oh: 'https://s3.amazonaws.com/freecodecamp/drums/Dsc_Oh.mp3'
}

const isSending = ref(false); const isSavingSch = ref(false); const isTesting = ref(false)
const currentIP = ref('檢查中...'); const isCurrentDeviceClassroom = ref(false)

const manualConfig = ref({ text: '', sound: 'bell_ring', playCount: 1, textPlayCount: 1, displayDuration: 120, targetIP: '', triggerTimestamp: 0 })
const schedules = ref([]); const presets = ref([]); const savedIPs = ref([]); const newIPInput = ref('')
const broadcastLogs = ref([]) // 💡 存放歷史紀錄

const fileInput = ref(null)

const getSoundLabel = (val) => { const f = soundOptions.find(s => s.value === val); return f ? f.label : val }
const formatUA = (ua) => { if (!ua) return '未知'; if (ua.includes('Chrome')) return 'Chrome / Edge'; if (ua.includes('Safari')) return 'Safari'; return '其他瀏覽器' }

const fetchSettingsAndCheckIP = async () => {
  const { data: bData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'broadcast_settings').maybeSingle()
  if (bData && bData.setting_value) {
    if (bData.setting_value.schedules) schedules.value = bData.setting_value.schedules
    if (bData.setting_value.presets) presets.value = bData.setting_value.presets
    if (bData.setting_value.savedIPs) savedIPs.value = bData.setting_value.savedIPs
  }

  // 💡 載入日誌資料
  const { data: logData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'broadcast_logs').maybeSingle()
  if (logData && logData.setting_value) { broadcastLogs.value = logData.setting_value }

  try {
    const ipRes = await fetch('https://api.ipify.org?format=json')
    const { ip } = await ipRes.json()
    currentIP.value = ip
    const { data: rules } = await supabase.from('ip_rules').select('ip_range').eq('rule_type', '褐名單')
    if (rules && rules.length > 0) isCurrentDeviceClassroom.value = rules.some(r => ip.startsWith(r.ip_range))
  } catch (e) { currentIP.value = '無法取得 IP' }
}

onMounted(() => fetchSettingsAndCheckIP())

// === 💡 日誌核心：寫入手動廣播日誌 ===
const appendManualLog = async () => {
  const newLog = {
    id: Date.now(),
    time: new Date().toLocaleString('zh-TW', { hour12: false }),
    type: '手動發送',
    text: manualConfig.value.text,
    sound: manualConfig.value.sound,
    targetIP: manualConfig.value.targetIP || '全發送',
    ip: currentIP.value,
    userAgent: navigator.userAgent
  }
  broadcastLogs.value.unshift(newLog)
  if (broadcastLogs.value.length > 500) broadcastLogs.value = broadcastLogs.value.slice(0, 500)
  await supabase.from('system_settings').upsert({ setting_key: 'broadcast_logs', setting_value: broadcastLogs.value }, { onConflict: 'setting_key' })
}

// === 💡 匯出與匯入功能 ===
const exportJSON = () => {
  const dataStr = JSON.stringify(broadcastLogs.value, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `broadcast_logs_${Date.now()}.json`; a.click();
}

const exportCSV = () => {
  const headers = ['時間', '類型', '廣播內容', '音效代碼', '發送目標', '指令發出設備IP', '瀏覽器資訊'];
  const rows = broadcastLogs.value.map(l => [ l.time, l.type, `"${(l.text || '').replace(/"/g, '""')}"`, l.sound, `"${l.targetIP}"`, l.ip, `"${(l.userAgent || '').replace(/"/g, '""')}"` ]);
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" }); // 加 BOM 讓 Excel 支援中文
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `broadcast_logs_${Date.now()}.csv`; a.click();
}

// 簡易自製 CSV Parser (用於支援匯入)
const parseCSVRow = (str) => {
  let result = []; let current = ''; let inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"') {
      if (inQuotes && str[i+1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) { result.push(current); current = ''; } else { current += char; }
  }
  result.push(current); return result;
}

const importLogs = (e) => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const content = event.target.result; let importedLogs = [];
      if (file.name.endsWith('.json')) { importedLogs = JSON.parse(content); } 
      else if (file.name.endsWith('.csv')) {
        const lines = content.split('\n').filter(l => l.trim());
        for (let i = 1; i < lines.length; i++) {
          const row = parseCSVRow(lines[i]);
          importedLogs.push({ id: Date.now() + i, time: row[0], type: row[1], text: row[2], sound: row[3], targetIP: row[4], ip: row[5], userAgent: row[6] });
        }
      }
      if (importedLogs.length > 0) {
        broadcastLogs.value = [...importedLogs, ...broadcastLogs.value].slice(0, 500); // 合併並限制筆數
        await supabase.from('system_settings').upsert({ setting_key: 'broadcast_logs', setting_value: broadcastLogs.value }, { onConflict: 'setting_key' })
        alert('✅ 歷史紀錄匯入成功！');
      }
    } catch (error) { alert('❌ 檔案解析失敗，建議優先匯入 JSON 格式備份檔。'); }
    e.target.value = ''; 
  };
  reader.readAsText(file);
}

// === 其餘手動廣播與設定邏輯 (不變) ===
const saveNewIP = async () => {
  if (!newIPInput.value.trim()) return; const newTarget = newIPInput.value.trim();
  if (!savedIPs.value.includes(newTarget)) { savedIPs.value.push(newTarget); manualConfig.value.targetIP = newTarget; newIPInput.value = ''; await saveSettingsToDB(false); }
}

const removeSavedIP = async (targetToRemove) => {
  if (confirm(`確定要將「${targetToRemove}」移除嗎？`)) { savedIPs.value = savedIPs.value.filter(t => t !== targetToRemove); manualConfig.value.targetIP = ''; await saveSettingsToDB(false); }
}

const saveAsPreset = async () => {
  if (!manualConfig.value.text) return alert('⚠️ 請先輸入廣播文字再儲存！')
  const defaultName = manualConfig.value.text.substring(0, 8) + '...'
  const presetName = prompt('請為此罐頭訊息命名：', defaultName)
  if (!presetName) return
  presets.value.push({ name: presetName, text: manualConfig.value.text, sound: manualConfig.value.sound, playCount: manualConfig.value.playCount, textPlayCount: manualConfig.value.textPlayCount, displayDuration: manualConfig.value.displayDuration, targetIP: manualConfig.value.targetIP })
  await saveSettingsToDB(false) 
}

const applyPreset = (preset) => {
  manualConfig.value.text = preset.text; manualConfig.value.sound = preset.sound; manualConfig.value.playCount = preset.playCount || 1; manualConfig.value.textPlayCount = preset.textPlayCount || 1; manualConfig.value.displayDuration = preset.displayDuration || 120; manualConfig.value.targetIP = preset.targetIP || ''
}
const removePreset = async (index) => { if (confirm('確定刪除此罐頭訊息嗎？')) { presets.value.splice(index, 1); await saveSettingsToDB(false) } }

const testSoundAndTTS = async () => {
  if (isTesting.value) return; isTesting.value = true
  if (manualConfig.value.sound !== 'none' && sounds[manualConfig.value.sound]) {
    for (let i = 0; i < manualConfig.value.playCount; i++) {
      await new Promise((resolve) => { const audio = new Audio(sounds[manualConfig.value.sound]); audio.onended = resolve; audio.onerror = resolve; audio.play().catch(resolve) })
      await new Promise(r => setTimeout(r, 500))
    }
  }
  if (manualConfig.value.text.trim()) {
    const ttsCount = manualConfig.value.textPlayCount || 1
    for (let i = 0; i < ttsCount; i++) {
      await new Promise((resolve) => { window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(manualConfig.value.text); utterance.lang = 'zh-TW'; utterance.onend = resolve; utterance.onerror = resolve; window.speechSynthesis.speak(utterance) })
      if (i < ttsCount - 1) await new Promise(r => setTimeout(r, 800))
    }
  }
  isTesting.value = false
}

const saveSettingsToDB = async (showAlert = true) => {
  isSavingSch.value = true
  const newSettings = { manual: manualConfig.value, schedules: schedules.value, presets: presets.value, savedIPs: savedIPs.value }
  const { error } = await supabase.from('system_settings').upsert({ setting_key: 'broadcast_settings', setting_value: newSettings }, { onConflict: 'setting_key' })
  if (showAlert) { if (!error) alert('✅ 設定已成功儲存！'); else alert('❌ 儲存失敗') }
  isSavingSch.value = false
}

const sendManualBroadcast = async () => {
  if (!manualConfig.value.text.trim()) return alert('⚠️ 廣播文字不可為空！')
  isSending.value = true
  manualConfig.value.triggerTimestamp = Date.now()
  await saveSettingsToDB(false) 
  await appendManualLog() // 💡 發送後寫入日誌
  alert('✅ 廣播訊號已發送！')
  isSending.value = false
}

const addSchedule = () => { schedules.value.push({ isActive: true, time: '08:00', text: '早自修時間開始', sound: 'bell_ring', playCount: 1, textPlayCount: 1, displayDuration: 120, targetIP: '' }) }
const removeSchedule = (index) => { if (confirm('確定要刪除這筆排程嗎？')) schedules.value.splice(index, 1) }

</script>

<style scoped>
.admin-section { font-family: sans-serif; }
.header-box { margin-bottom: 20px; }
.header-box h3 { margin: 0; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; font-size: 1.4rem; }
.help-text { font-size: 0.95rem; color: #64748b; margin-top: 10px; }

.ip-security-banner { padding: 12px 15px; border-radius: 8px; margin-top: 15px; font-size: 0.95rem; line-height: 1.5; border: 1px solid transparent;}
.is-safe { background-color: #dcfce7; color: #166534; border-color: #bbf7d0; }
.is-warning { background-color: #fef9c3; color: #854d0e; border-color: #fde047; }
.highlight-ip { font-family: monospace; font-weight: bold; background: rgba(255,255,255,0.5); padding: 2px 6px; border-radius: 4px; }

.presets-section { background: #eff6ff; padding: 15px; border-radius: 8px; border: 1px dashed #93c5fd; margin-bottom: 25px; }
.presets-header { font-weight: bold; color: #1d4ed8; margin-bottom: 10px; }
.presets-list { display: flex; flex-wrap: wrap; gap: 10px; }
.preset-chip { display: flex; align-items: center; background: white; border: 1px solid #bfdbfe; border-radius: 20px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.preset-name { padding: 6px 12px; cursor: pointer; color: #2563eb; font-weight: bold; font-size: 0.9rem; transition: 0.2s; }
.preset-name:hover { background: #dbeafe; }
.preset-del { background: #fee2e2; color: #ef4444; border: none; padding: 6px 10px; cursor: pointer; font-size: 0.8rem; border-left: 1px solid #bfdbfe; transition: 0.2s; }
.preset-del:hover { background: #fecaca; color: #b91c1c; }

.card { background: white; padding: 25px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 25px; }
.card-header-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px; margin-bottom: 20px; flex-wrap: wrap; gap:10px;}
.card-title { margin: 0; font-size: 1.2rem; color: #0f172a; }
.btn-save-preset { background: #f8fafc; color: #0284c7; border: 1px solid #bae6fd; padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 0.9rem; }
.btn-save-preset:hover { background: #e0f2fe; }

.manual-card { border-left: 5px solid #ef4444; }
.schedule-card { border-left: 5px solid #3b82f6; }
.logs-card { border-left: 5px solid #10b981; }

.form-grid { display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 20px; }
.form-group { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 150px; }
.full-width { flex: 100%; }
.form-group label { font-weight: bold; color: #475569; font-size: 0.95rem; }

.custom-input { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 1rem; outline: none; transition: 0.2s;}
.custom-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }
.large-input { font-size: 1.1rem; padding: 12px; font-weight: bold; color: #b45309; background: #fffbeb; border-color: #fcd34d; }

.ip-control-group { display: flex; gap: 10px; flex-wrap: wrap; align-items: center;}
.flex-2 { flex: 2; min-width: 150px; }
.flex-1 { flex: 1; min-width: 120px; }
.btn-sub { background: #10b981; color: white; border: none; padding: 10px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.btn-sub:hover { background: #059669; }
.btn-sub-del { background: #fee2e2; color: #ef4444; border: 1px solid #fca5a5; padding: 9px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.btn-sub-del:hover { background: #fecaca; }

.action-row { display: flex; gap: 15px; justify-content: flex-end; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 20px; flex-wrap: wrap;}
.btn-test { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.btn-test:hover:not(:disabled) { background: #e2e8f0; }

.btn-send { background: #ef4444; color: white; border: none; padding: 12px 30px; border-radius: 6px; font-size: 1.15rem; font-weight: bold; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 6px rgba(239,68,68,0.3); }
.btn-send:hover:not(:disabled) { background: #dc2626; transform: translateY(-2px); box-shadow: 0 6px 12px rgba(239,68,68,0.4); }
.btn-send:disabled, .btn-test:disabled { filter: grayscale(50%); opacity: 0.7; cursor: not-allowed; transform: none; box-shadow: none; }

.schedule-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px; }
.btn-add { background: #10b981; color: white; border: none; padding: 8px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; }
.btn-add:hover { background: #059669; }

.empty-state { text-align: center; padding: 30px; color: #94a3b8; font-style: italic; background: #f8fafc; border-radius: 8px; }

.schedule-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
.schedule-item { display: flex; flex-direction: column; gap: 10px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; transition: 0.3s; }
.schedule-item.is-disabled { opacity: 0.6; filter: grayscale(100%); background: #f1f5f9; }

.sch-row { display: flex; align-items: center; gap: 15px; width: 100%; flex-wrap: wrap; }
.toggle-chk { transform: scale(1.5); accent-color: #3b82f6; cursor: pointer; }
.time-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 1.1rem; font-family: monospace; font-weight: bold; }
.text-input { flex: 1; min-width: 200px; }
.btn-del { background: #fee2e2; color: #ef4444; border: 1px solid #fca5a5; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 1.1rem; margin-left: auto;}

.mini-group { display: flex; align-items: center; gap: 5px; font-size: 0.9rem; color: #475569; font-weight: bold; }
.mini-select { width: 130px; }
.mini-select-small { width: 60px; padding-left: 5px; padding-right: 5px;}
.ip-group { flex: 1; justify-content: flex-end; }
.ip-select { width: 140px; }

.save-row { display: flex; justify-content: flex-end; padding-top: 15px; border-top: 1px solid #e2e8f0; }
.btn-save-all { background: #3b82f6; color: white; border: none; padding: 12px 30px; border-radius: 6px; font-size: 1.1rem; font-weight: bold; cursor: pointer; transition: 0.2s; }
.btn-save-all:hover:not(:disabled) { background: #2563eb; }

/* 日誌專屬樣式 */
.log-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.btn-outline { background: white; color: #475569; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; transition: 0.2s; font-weight: bold; }
.btn-outline:hover { background: #f1f5f9; }
.btn-outline-primary { background: white; color: #3b82f6; border: 1px solid #93c5fd; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; transition: 0.2s; font-weight: bold; }
.btn-outline-primary:hover { background: #eff6ff; }

.table-container { width: 100%; overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
.logs-table { width: 100%; border-collapse: collapse; min-width: 800px; font-size: 0.95rem; }
.logs-table th, .logs-table td { padding: 12px 15px; border-bottom: 1px solid #e2e8f0; text-align: left; }
.logs-table th { background: #f8fafc; font-weight: bold; color: #475569; position: sticky; top: 0; }
.logs-table tr:hover { background: #f1f5f9; }
.empty-log { text-align: center; color: #94a3b8; font-style: italic; padding: 30px !important; }

.type-tag { padding: 3px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: bold; }
.t-manual { background: #fee2e2; color: #b91c1c; }
.t-auto { background: #e0e7ff; color: #4338ca; }

.col-time { white-space: nowrap; color: #64748b; font-size: 0.9rem; }
.col-text { font-weight: bold; color: #334155; }
.col-ip { font-family: monospace; color: #0369a1; }
.col-ua { color: #94a3b8; font-size: 0.85rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

@media (max-width: 768px) {
  .sch-row { flex-direction: column; align-items: flex-start; }
  .btn-del { margin-left: 0; align-self: flex-end; }
  .ip-group { justify-content: flex-start; width: 100%; }
  .ip-select { width: 100%; }
}
</style>
