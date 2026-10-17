<template>
  <div class="page-container">
    <div class="top-nav">
      <NuxtLink to="/" class="back-btn">⬅ 返回班級首頁</NuxtLink>
    </div>

    <div class="content-wrapper">
      <div class="header-box">
        <h3>📢 教師專屬廣播控制中心</h3>
        <p class="help-text">💡 此為科任老師與導師專用的獨立廣播站，發送的廣播與歷史紀錄皆與後台總管完全獨立。</p>
      </div>

      <!-- 🔒 密碼解鎖畫面 -->
      <div v-if="!isUnlocked" class="lock-screen">
        <div class="lock-box">
          <h4>🔒 系統安全鎖定</h4>
          <p class="hint">請輸入密碼解鎖廣播功能（支援導師與科任老師密碼）</p>
          <input type="password" v-model="pwdInput" class="custom-input pwd-input" placeholder="請輸入密碼..." @keyup.enter="verifyPassword" />
          <button @click="verifyPassword" class="btn-send unlock-btn" :disabled="isVerifying">
            {{ isVerifying ? '驗證中...' : '解鎖進入' }}
          </button>
        </div>
      </div>

      <!-- 🔓 解鎖後的廣播控制面板 -->
      <div v-else class="admin-section">
        <div class="ip-security-banner is-safe">
          <strong>目前操作身分：</strong> {{ currentTeacherRole }}<br>
          您的目前 IP 為 <span class="highlight-ip">{{ currentIP }}</span>
        </div>

        <!-- 罐頭訊息 -->
        <div v-if="presets.length > 0" class="presets-section">
          <div class="presets-header">📦 快速載入罐頭訊息：</div>
          <div class="presets-list">
            <div v-for="(preset, index) in presets" :key="index" class="preset-chip">
              <span class="preset-name" @click="applyPreset(preset)">{{ preset.name }}</span>
              <button class="preset-del" @click="removePreset(index)">✖</button>
            </div>
          </div>
        </div>

        <!-- 手動廣播區塊 -->
        <div class="card manual-card">
          <div class="card-header-row">
            <h4 class="card-title">🚨 即時遙控發送</h4>
            <button @click="saveAsPreset" class="btn-save-preset">💾 存為罐頭</button>
          </div>
          
          <div class="form-grid">
            <div class="form-group full-width">
              <label>📝 廣播文字內容：</label>
              <input type="text" v-model="manualConfig.text" class="custom-input large-input" placeholder="例如：請同學翻開課本第 50 頁！" />
            </div>
            <div class="form-group">
              <label>🔊 播放音效：</label>
              <select v-model="manualConfig.sound" class="custom-input">
                <option v-for="opt in soundOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>🔁 音效次數：</label>
              <select v-model.number="manualConfig.playCount" class="custom-input"><option value="1">1</option><option value="2">2</option><option value="3">3</option></select>
            </div>
            <div class="form-group">
              <label>🗣️ 語音朗讀：</label>
              <select v-model.number="manualConfig.textPlayCount" class="custom-input"><option value="1">1</option><option value="2">2</option><option value="3">3</option></select>
            </div>
            <div class="form-group">
              <label>⏳ 畫面保留：</label>
              <select v-model.number="manualConfig.displayDuration" class="custom-input">
                <option value="10">10 秒</option><option value="30">30 秒</option><option value="60">1 分鐘</option>
                <option value="120">2 分鐘</option><option value="300">5 分鐘</option>
              </select>
            </div>
            <div class="form-group full-width">
              <label>🎯 指定接收單一【設備名稱】：</label>
              <div class="ip-control-group">
                <select v-model="manualConfig.targetIP" class="custom-input flex-2">
                  <option value="">🌐 全發送 (所有教室電腦)</option>
                  <option v-for="target in savedIPs" :key="target" :value="target">🎯 {{ target }}</option>
                </select>
                <input type="text" v-model="newIPInput" class="custom-input flex-1" placeholder="輸入名稱 (如: 701教室)..." />
                <button @click="saveNewIP" class="btn-sub">💾 加入選單</button>
                <button v-if="manualConfig.targetIP" @click="removeSavedIP(manualConfig.targetIP)" class="btn-sub-del">🗑️ 刪除</button>
              </div>
            </div>
          </div>

          <div class="action-row">
            <button @click="testSoundAndTTS" class="btn-test" :disabled="isTesting">
              {{ isTesting ? '🔊 試聽模擬中...' : '🎧 本機模擬試聽' }}
            </button>
            <button @click="sendManualBroadcast" class="btn-send" :disabled="isSending">
              {{ isSending ? '🚀 發送中...' : '🚀 立刻發送到教室！' }}
            </button>
          </div>
        </div>

        <!-- 💡 獨立教師日誌追蹤區塊 -->
        <div class="card logs-card">
          <div class="card-header-row">
            <h4 class="card-title">📝 教師廣播紀錄 (獨立儲存)</h4>
            <div class="log-actions">
              <button @click="exportJSON" class="btn-outline">📄 匯出 JSON</button>
              <button @click="exportCSV" class="btn-outline">📊 匯出 CSV</button>
              <button @click="$refs.fileInput.click()" class="btn-outline-primary">📥 匯入還原</button>
              <input type="file" ref="fileInput" accept=".json, .csv" @change="importLogs" style="display:none" />
            </div>
          </div>

          <div class="table-container">
            <table class="logs-table">
              <thead>
                <tr>
                  <th>發生時間</th>
                  <th>發送身分</th>
                  <th>廣播文字內容</th>
                  <th>音效</th>
                  <th>接收對象</th>
                  <th>發出 IP</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="broadcastLogs.length === 0"><td colspan="6" class="empty-log">目前尚無任何發送紀錄。</td></tr>
                <tr v-for="log in broadcastLogs" :key="log.id">
                  <td class="col-time">{{ log.time }}</td>
                  <td><span class="type-tag">{{ log.role || '未知' }}</span></td>
                  <td class="col-text">{{ log.text }}</td>
                  <td>{{ getSoundLabel(log.sound) }}</td>
                  <td class="col-ip">{{ log.targetIP }}</td>
                  <td class="col-ip">{{ log.ip }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { beginVisitorSession, trackVisitorEvent } from '../utils/visitorTrackingClient.js'
import { ref } from 'vue'
const supabase = useSupabaseClient()

const isUnlocked = ref(false)
const pwdInput = ref('')
const isVerifying = ref(false)
const currentTeacherRole = ref('')
const currentIP = ref('檢查中...')

const isSending = ref(false); const isTesting = ref(false)

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

const manualConfig = ref({ text: '', sound: 'bell_ring', playCount: 1, textPlayCount: 1, displayDuration: 120, targetIP: '', triggerTimestamp: 0 })
const presets = ref([]); const savedIPs = ref([]); const newIPInput = ref('')
const broadcastLogs = ref([]) // 💡 存放教師專屬歷史紀錄

const fileInput = ref(null)
const getSoundLabel = (val) => { const f = soundOptions.find(s => s.value === val); return f ? f.label : val }

// === 🔒 密碼驗證 ===
const verifyPassword = async () => {
  if (!pwdInput.value) return alert('請輸入密碼！')
  isVerifying.value = true

  let verifiedRole = ''
  if (pwdInput.value === '168168168') {
    verifiedRole = '系統導師'
  } else {
    const { data: pwdData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'admin_password').maybeSingle()
    if (pwdData?.setting_value) {
      if (pwdData.setting_value.type === 'dynamic') {
        const cd = new Date(); const yy = String(cd.getFullYear()).slice(2); const mm = String(cd.getMonth()+1).padStart(2,'0'); const dd = String(cd.getDate()).padStart(2,'0')
        if (pwdInput.value === `${yy}${mm}${dd}59`) verifiedRole = '導師'
      } else if (pwdInput.value === pwdData.setting_value.custom_pwd) {
        verifiedRole = '導師'
      }
    }
  }

  if (!verifiedRole) {
    const { data: tData } = await supabase.from('subject_teachers').select('*')
    if (tData) {
      const matchTeacher = tData.find(t => t.password === pwdInput.value)
      if (matchTeacher) verifiedRole = `${matchTeacher.subject_name}老師`
    }
  }

  if (verifiedRole) {
    void beginVisitorSession(verifiedRole, '廣播頁密碼驗證')
    currentTeacherRole.value = verifiedRole
    isUnlocked.value = true
    pwdInput.value = ''
    fetchSettingsAndLogs()
  } else {
    alert('❌ 密碼錯誤！')
  }
  isVerifying.value = false
}

// === 💡 資料庫互動邏輯 (獨立 Key: teacher_broadcast_settings & teacher_broadcast_logs) ===
const fetchSettingsAndLogs = async () => {
  // 1. 抓設定
  const { data: bData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'teacher_broadcast_settings').maybeSingle()
  if (bData && bData.setting_value) {
    if (bData.setting_value.presets) presets.value = bData.setting_value.presets
    if (bData.setting_value.savedIPs) savedIPs.value = bData.setting_value.savedIPs
  }
  
  // 2. 抓專屬紀錄
  const { data: logData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'teacher_broadcast_logs').maybeSingle()
  if (logData && logData.setting_value) { broadcastLogs.value = logData.setting_value }

  try {
    const ipRes = await fetch('https://api.ipify.org?format=json')
    const { ip } = await ipRes.json()
    currentIP.value = ip
  } catch (e) { currentIP.value = '無法取得 IP' }
}

const saveSettingsToDB = async (showAlert = true) => {
  const newSettings = { manual: manualConfig.value, presets: presets.value, savedIPs: savedIPs.value }
  await supabase.from('system_settings').upsert({ setting_key: 'teacher_broadcast_settings', setting_value: newSettings }, { onConflict: 'setting_key' })
  if (showAlert) alert('✅ 廣播設定已儲存！')
}

// === 💡 日誌核心：寫入手動廣播日誌 ===
const appendManualLog = async () => {
  const newLog = {
    id: Date.now(),
    time: new Date().toLocaleString('zh-TW', { hour12: false }),
    role: currentTeacherRole.value,
    text: manualConfig.value.text,
    sound: manualConfig.value.sound,
    targetIP: manualConfig.value.targetIP || '全班發送',
    ip: currentIP.value,
    userAgent: navigator.userAgent
  }
  broadcastLogs.value.unshift(newLog)
  if (broadcastLogs.value.length > 500) broadcastLogs.value = broadcastLogs.value.slice(0, 500)
  await supabase.from('system_settings').upsert({ setting_key: 'teacher_broadcast_logs', setting_value: broadcastLogs.value }, { onConflict: 'setting_key' })
}

// === 💡 匯出與匯入功能 ===
const exportJSON = () => {
  const dataStr = JSON.stringify(broadcastLogs.value, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `teacher_logs_${Date.now()}.json`; a.click();
}

const exportCSV = () => {
  const headers = ['時間', '發送身分', '廣播內容', '音效代碼', '發送目標', '指令發出設備IP'];
  const rows = broadcastLogs.value.map(l => [ l.time, l.role, `"${(l.text || '').replace(/"/g, '""')}"`, l.sound, `"${l.targetIP}"`, l.ip ]);
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" }); 
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `teacher_logs_${Date.now()}.csv`; a.click();
}

const parseCSVRow = (str) => {
  let result = []; let current = ''; let inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"') { if (inQuotes && str[i+1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; } } 
    else if (char === ',' && !inQuotes) { result.push(current); current = ''; } else { current += char; }
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
          importedLogs.push({ id: Date.now() + i, time: row[0], role: row[1], text: row[2], sound: row[3], targetIP: row[4], ip: row[5] });
        }
      }
      if (importedLogs.length > 0) {
        broadcastLogs.value = [...importedLogs, ...broadcastLogs.value].slice(0, 500);
        await supabase.from('system_settings').upsert({ setting_key: 'teacher_broadcast_logs', setting_value: broadcastLogs.value }, { onConflict: 'setting_key' })
        alert('✅ 歷史紀錄匯入成功！');
      }
    } catch (error) { alert('❌ 檔案解析失敗，建議優先匯入 JSON 格式備份檔。'); }
    e.target.value = ''; 
  };
  reader.readAsText(file);
}

// 其他互動邏輯
const saveNewIP = async () => { if (!newIPInput.value.trim()) return; const newTarget = newIPInput.value.trim(); if (!savedIPs.value.includes(newTarget)) { savedIPs.value.push(newTarget); manualConfig.value.targetIP = newTarget; newIPInput.value = ''; await saveSettingsToDB(false); } }
const removeSavedIP = async (targetToRemove) => { if (confirm(`確定要將「${targetToRemove}」移除嗎？`)) { savedIPs.value = savedIPs.value.filter(t => t !== targetToRemove); manualConfig.value.targetIP = ''; await saveSettingsToDB(false); } }
const saveAsPreset = async () => { if (!manualConfig.value.text) return alert('⚠️ 請先輸入廣播文字再儲存！'); const presetName = prompt('請命名：', manualConfig.value.text.substring(0, 8) + '...'); if (!presetName) return; presets.value.push({ name: presetName, text: manualConfig.value.text, sound: manualConfig.value.sound, playCount: manualConfig.value.playCount, textPlayCount: manualConfig.value.textPlayCount, displayDuration: manualConfig.value.displayDuration, targetIP: manualConfig.value.targetIP }); await saveSettingsToDB(false) }
const applyPreset = (preset) => { manualConfig.value.text = preset.text; manualConfig.value.sound = preset.sound; manualConfig.value.playCount = preset.playCount || 1; manualConfig.value.textPlayCount = preset.textPlayCount || 1; manualConfig.value.displayDuration = preset.displayDuration || 120; manualConfig.value.targetIP = preset.targetIP || '' }
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

// 💡 發送廣播時，同時更新設定並寫入獨立日誌
const sendManualBroadcast = async () => {
  if (!manualConfig.value.text.trim()) return alert('⚠️ 廣播文字不可為空！')
  isSending.value = true
  manualConfig.value.triggerTimestamp = Date.now()
  await saveSettingsToDB(false) 
  await appendManualLog() 
  alert('✅ 廣播訊號已發送！')
  isSending.value = false
}
</script>

<style scoped>
.page-container { min-height: 100vh; background-color: #f1f5f9; padding: 20px; font-family: sans-serif; display: flex; flex-direction: column; align-items: center;}
.top-nav { width: 100%; max-width: 900px; margin-bottom: 20px; }
.back-btn { background: white; color: #475569; border: 1px solid #cbd5e1; padding: 8px 15px; border-radius: 6px; font-weight: bold; text-decoration: none; display: inline-block; transition: 0.2s; }
.back-btn:hover { background: #e2e8f0; }

.content-wrapper { width: 100%; max-width: 900px; }
.header-box { margin-bottom: 20px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;}
.header-box h3 { margin: 0 0 10px 0; color: #1e293b; font-size: 1.4rem; }
.help-text { font-size: 0.95rem; color: #64748b; margin: 0; }

.lock-screen { display: flex; justify-content: center; padding: 40px 20px; }
.lock-box { background: white; padding: 30px; border-radius: 8px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.05); width: 100%; max-width: 350px; border: 1px solid #e2e8f0;}
.lock-box h4 { margin: 0 0 10px 0; color: #334155; }
.lock-box .hint { font-size: 0.85rem; color: #64748b; margin-bottom: 20px; }
.pwd-input { text-align: center; font-size: 1.2rem; font-weight: bold; margin-bottom: 15px; width: 100%; box-sizing: border-box;}
.unlock-btn { width: 100%; padding: 12px; }

.admin-section { font-family: sans-serif; }
.ip-security-banner { padding: 10px 15px; border-radius: 8px; margin-bottom: 20px; font-size: 0.95rem; line-height: 1.5; background-color: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
.highlight-ip { font-family: monospace; font-weight: bold; background: rgba(255,255,255,0.5); padding: 2px 6px; border-radius: 4px; }

.presets-section { background: #eff6ff; padding: 15px; border-radius: 8px; border: 1px dashed #93c5fd; margin-bottom: 25px; }
.presets-header { font-weight: bold; color: #1d4ed8; margin-bottom: 10px; }
.presets-list { display: flex; flex-wrap: wrap; gap: 10px; }
.preset-chip { display: flex; align-items: center; background: white; border: 1px solid #bfdbfe; border-radius: 20px; overflow: hidden; }
.preset-name { padding: 6px 12px; cursor: pointer; color: #2563eb; font-weight: bold; font-size: 0.9rem; }
.preset-name:hover { background: #dbeafe; }
.preset-del { background: #fee2e2; color: #ef4444; border: none; padding: 6px 10px; cursor: pointer; }
.preset-del:hover { background: #fecaca; }

.card { background: white; padding: 20px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 20px; }
.card-header-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px; margin-bottom: 15px; flex-wrap: wrap; gap:10px;}
.card-title { margin: 0; font-size: 1.1rem; color: #0f172a; }
.btn-save-preset { background: #f8fafc; color: #0284c7; border: 1px solid #bae6fd; padding: 6px 10px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.85rem; }

.manual-card { border-left: 4px solid #ef4444; }
.logs-card { border-left: 4px solid #8b5cf6; }

.form-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 15px; }
.form-group { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 150px; }
.full-width { flex: 100%; }
.form-group label { font-weight: bold; color: #475569; font-size: 0.9rem; }

.custom-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.95rem; outline: none; }
.custom-input:focus { border-color: #3b82f6; }
.large-input { font-size: 1.05rem; padding: 10px; font-weight: bold; color: #b45309; background: #fffbeb; border-color: #fcd34d; }

.ip-control-group { display: flex; gap: 8px; flex-wrap: wrap; align-items: center;}
.flex-2 { flex: 2; min-width: 120px; }
.flex-1 { flex: 1; min-width: 100px; }
.btn-sub { background: #10b981; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; }
.btn-sub-del { background: #fee2e2; color: #ef4444; border: 1px solid #fca5a5; padding: 7px 10px; border-radius: 6px; font-weight: bold; cursor: pointer; }

.action-row { display: flex; gap: 10px; justify-content: flex-end; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 15px; flex-wrap: wrap;}
.btn-test { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 10px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; }
.btn-send { background: #ef4444; color: white; border: none; padding: 10px 25px; border-radius: 6px; font-size: 1.1rem; font-weight: bold; cursor: pointer; box-shadow: 0 4px 6px rgba(239,68,68,0.3); }

/* 日誌專屬樣式 */
.log-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.btn-outline { background: white; color: #475569; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; transition: 0.2s; font-weight: bold; }
.btn-outline:hover { background: #f1f5f9; }
.btn-outline-primary { background: white; color: #8b5cf6; border: 1px solid #c4b5fd; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; transition: 0.2s; font-weight: bold; }
.btn-outline-primary:hover { background: #f5f3ff; }

.table-container { width: 100%; overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
.logs-table { width: 100%; border-collapse: collapse; min-width: 600px; font-size: 0.95rem; }
.logs-table th, .logs-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
.logs-table th { background: #f8fafc; font-weight: bold; color: #475569; position: sticky; top: 0; }
.logs-table tr:hover { background: #f1f5f9; }
.empty-log { text-align: center; color: #94a3b8; font-style: italic; padding: 30px !important; }

.type-tag { padding: 3px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: bold; background: #f3e8ff; color: #7e22ce; }

.col-time { white-space: nowrap; color: #64748b; font-size: 0.85rem; }
.col-text { font-weight: bold; color: #334155; }
.col-ip { font-family: monospace; color: #0369a1; font-size: 0.9rem; }
</style>
