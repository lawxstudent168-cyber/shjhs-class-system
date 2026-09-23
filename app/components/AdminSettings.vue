<template>
  <div>
    <div class="table-header"><h3>⚙️ 系統設定與密碼管理</h3></div>
    
    <!-- 密碼設定區塊 -->
    <div class="settings-section">
      <h4>🔑 其他舊功能與推播密碼模式</h4>
      <p class="help-text">導師後台與手機廣播使用 Vercel 的 NUXT_TEACHER_LOGIN_PASSWORD，下列舊功能密碼設定不會變更導師登入密碼。</p>
      
      <div class="radio-group">
        <label>
          <input type="radio" v-model="pwdConfig.type" value="dynamic" />
          <strong>動態密碼</strong> (今日日期 YYMMDD + 59)
          <span class="preview-tag" v-if="pwdConfig.type === 'dynamic'">👉 今日密碼為：{{ currentDynamicPwd }}</span>
        </label>
        
        <label>
          <input type="radio" v-model="pwdConfig.type" value="custom" />
          <strong>自訂固定密碼</strong>
        </label>
      </div>

      <div v-if="pwdConfig.type === 'custom'" class="custom-pwd-box">
        <label>請設定您的專屬密碼：</label>
        <input type="text" v-model="pwdConfig.custom_pwd" class="edit-input" placeholder="請輸入密碼..." />
      </div>

      <button @click="saveSettings" class="save-btn" :disabled="isSaving">
        {{ isSaving ? '儲存中...' : '💾 儲存密碼設定' }}
      </button>
    </div>

    <!-- 🕒 首頁時鐘樣式總管區塊 -->
    <div class="settings-section" style="margin-top: 25px;">
      <h4>🕒 首頁時鐘樣式總管</h4>
      <p class="help-text">💡 自由搭配 30 種專屬風格、顏色與大小，打造獨一無二的班級看板！</p>

      <div class="clock-settings-grid">
        <div class="form-group">
          <label>🎨 時鐘風格：</label>
          <select v-model="clockConfig.theme" class="edit-input select-theme">
            <optgroup label="經典與現代">
              <option value="classic">1. 經典預設 (Classic)</option>
              <option value="lcd">2. 液晶電子 (Digital LCD)</option>
              <option value="flip">3. 復古翻頁 (Retro Flip)</option>
              <option value="neon">4. 科技發光 (Neon Glow)</option>
              <option value="minimal">5. 極簡文青 (Minimalist)</option>
              <option value="glass">9. 質感毛玻璃 (Glassmorphism)</option>
              <option value="eink">12. 電子紙 (E-Ink)</option>
            </optgroup>
            <optgroup label="立體與材質">
              <option value="gradient">6. 漸層流光 (Gradient)</option>
              <option value="emboss">7. 3D 立體 (3D Emboss)</option>
              <option value="chalk">10. 黑板手寫 (Chalkboard)</option>
              <option value="gold">11. 黃金奢華 (Luxury Gold)</option>
              <option value="metal">16. 金屬雕刻 (Metal Carved)</option>
              <option value="wood">20. 森林木紋 (Wood Craft)</option>
              <option value="jelly">21. 水滴果凍 (Liquid Jelly)</option>
              <option value="ice">28. 冰雪結晶 (Frosted Ice)</option>
            </optgroup>
            <optgroup label="科技與科幻">
              <option value="cyber">8. 賽博龐克 (Cyberpunk)</option>
              <option value="scifi">17. 未來科技 (Sci-Fi HUD)</option>
              <option value="alert">19. 血紅警告 (Red Alert)</option>
              <option value="matrix">27. 黑客指令 (Matrix Terminal)</option>
              <option value="glitch">30. 故障藝術 (Glitch Art)</option>
            </optgroup>
            <optgroup label="復古與懷舊">
              <option value="pixel">13. 像素藝術 (Pixel Art)</option>
              <option value="dotmatrix">14. 點陣看板 (Dot Matrix)</option>
              <option value="typewriter">18. 復古打字機 (Typewriter)</option>
              <option value="arcade">22. 復古街機 (Arcade)</option>
              <option value="news">24. 報紙油墨 (Newspaper)</option>
              <option value="blueprint">25. 藍圖設計 (Blueprint)</option>
              <option value="steampunk">29. 蒸汽龐克 (Steampunk)</option>
            </optgroup>
            <optgroup label="色彩與動態">
              <option value="pastel">15. 粉彩夢幻 (Pastel Dream)</option>
              <option value="aurora">23. 極光漸層 (Aurora)</option>
              <option value="lava">26. 熔岩燈 (Lava Lamp)</option>
            </optgroup>
          </select>
        </div>

        <div class="form-group">
          <label>📏 時間大小 (px)：</label>
          <input type="number" v-model="clockConfig.size" class="edit-input size-input" min="10" max="150" title="控制下方數字時間的大小" />
        </div>

        <div class="form-group">
          <label>📅 日期大小 (px)：</label>
          <input type="number" v-model="clockConfig.dateSize" class="edit-input size-input" min="10" max="80" placeholder="預設 18" title="控制上方日期星期的文字大小" />
        </div>

        <div class="form-group">
          <label>🖌️ 主題顏色：</label>
          <div class="color-picker-box">
            <input type="color" v-model="clockConfig.color" class="color-input" />
            <span class="color-hex">{{ clockConfig.color }}</span>
          </div>
        </div>

        <div class="form-group chk-group">
          <label class="icon-toggle">
            <input type="checkbox" v-model="clockConfig.showIcon" class="large-checkbox" />
            顯示 🕒 時鐘圖示
          </label>
        </div>
      </div>

      <button @click="saveClockSettings" class="save-btn clock-save-btn" :disabled="isSavingClock">
        {{ isSavingClock ? '儲存中...' : '💾 儲存時鐘設定' }}
      </button>
    </div>

    <!-- 🔄 首頁自動更新頻率設定區塊 -->
    <div class="settings-section" style="margin-top: 25px;">
      <h4>🔄 首頁自動更新頻率設定 (智慧變速)</h4>
      <p class="help-text">💡 設定首頁在背景「無感重新整理」的頻率。建議：<b>上課時間拉長以節省伺服器效能，下課時間縮短以保持畫面即時性。</b>(設為 0 代表關閉)</p>
      
      <div class="refresh-grid">
        <div class="form-group row-align">
          <label class="day-label-refresh">上課期間 (秒)：</label>
          <input type="number" v-model="refreshConfig.classTime" class="edit-input" style="width: 120px;" min="0" max="3600" />
        </div>
        <div class="form-group row-align">
          <label class="day-label-refresh">下課期間 (秒)：</label>
          <input type="number" v-model="refreshConfig.breakTime" class="edit-input" style="width: 120px;" min="0" max="3600" />
        </div>
        <div class="form-group row-align">
          <label class="day-label-refresh">週末假日 (秒)：</label>
          <input type="number" v-model="refreshConfig.weekend" class="edit-input" style="width: 120px;" min="0" max="3600" />
        </div>
      </div>
      <button @click="saveRefreshSettings" class="save-btn refresh-btn" :disabled="isSavingRefresh" style="margin-top: 15px;">
        {{ isSavingRefresh ? '儲存中...' : '💾 儲存更新頻率' }}
      </button>
    </div>

    <!-- 🧩 首頁擴充模組顯示與排序 (右側) -->
    <div class="settings-section" style="margin-top: 25px;">
      <h4>🧩 首頁擴充模組顯示與排序 (右側)</h4>
      <p class="help-text">💡 自由控制首頁面板的「擴充模組」是否顯示，並可使用箭頭調整右側面板模組的上下順序。</p>
      
      <div class="dynamic-sort-box">
        <label class="icon-toggle mod-toggle" style="background: transparent; border: none; padding: 0;">
          <input type="checkbox" v-model="dynamicSorting" class="large-checkbox" />
          <span style="font-weight: bold; color: #1d4ed8; font-size: 1.15rem;">🔄 啟用「上下課動態排序」</span>
        </label>
        <p class="help-text-sm">打勾後，系統會自動無視下方順序：<strong>下課時將 YT 影片置頂吸引目光，上課時自動將 YT 影片沉底。</strong></p>
      </div>

      <div class="module-list">
        <div v-for="(mod, index) in indexModules" :key="mod.id" class="module-row" :class="{ 'is-hidden': !mod.isVisible }">
          
          <div class="module-info">
            <label class="icon-toggle mod-toggle">
              <input type="checkbox" v-model="mod.isVisible" class="large-checkbox" />
              <span>{{ mod.name }}</span>
            </label>
            <span class="status-tag" :class="mod.isVisible ? 'tag-on' : 'tag-off'">
              {{ mod.isVisible ? '開啟中' : '已隱藏' }}
            </span>
          </div>

          <div class="module-actions" v-if="mod.id !== 'wikiFeatured'">
            <button @click="moveModuleUp(index)" :disabled="index === 0" class="move-btn" title="上移">⬆️</button>
            <button @click="moveModuleDown(index)" :disabled="index === indexModules.length - 1" class="move-btn" title="下移">⬇️</button>
          </div>
          <!-- 提示 wikiFeatured 是在左側固定位置 -->
          <div v-else style="font-size: 0.85rem; color: #64748b; font-style: italic;">
            固定於左側面板
          </div>
        </div>
      </div>

      <button @click="saveIndexModules" class="save-btn modules-btn" :disabled="isSavingModules" style="margin-top: 20px;">
        {{ isSavingModules ? '儲存中...' : '💾 儲存排序與顯示設定' }}
      </button>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
const supabase = useSupabaseClient()

const pwdConfig = ref({ type: 'dynamic', custom_pwd: '' })
const isSaving = ref(false)

const clockConfig = ref({ theme: 'classic', color: '#1e293b', size: 35, dateSize: 18, showIcon: true })
const isSavingClock = ref(false)

const refreshConfig = ref({ classTime: 120, breakTime: 30, weekend: 60 })
const isSavingRefresh = ref(false)

// 💡 核心修正：將 wikiFeatured (典範條目) 加入模組清單
const defaultModules = [
  { id: 'wikiFeatured', name: '📖 維基百科 典範條目', isVisible: true },
  { id: 'wikiImage', name: '🌍 維基百科每日圖片', isVisible: true },
  { id: 'wikiOtd', name: '🏛️ 歷史上的今天', isVisible: true },
  { id: 'youtube', name: '📺 YouTube 推薦影片', isVisible: true },
  { id: 'foxNews', name: '🦊 Fox News 頭條', isVisible: true },
  { id: 'cnnNews', name: '🟥 CNN News 頭條', isVisible: true },
  { id: 'abcNews', name: '⬛ ABC News 頭條', isVisible: true }
]
const indexModules = ref(JSON.parse(JSON.stringify(defaultModules)))
const dynamicSorting = ref(false)
const isSavingModules = ref(false)

const currentDynamicPwd = computed(() => {
  const d = new Date()
  const yy = String(d.getFullYear()).slice(2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}59`
})

const fetchConfig = async () => {
  const { data: pwdData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'admin_password').maybeSingle()
  if (pwdData?.setting_value) pwdConfig.value = pwdData.setting_value

  const { data: clkData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'index_clock_config').maybeSingle()
  if (clkData && clkData.setting_value) {
    clockConfig.value = { ...clockConfig.value, ...clkData.setting_value }
    if (!clockConfig.value.dateSize) clockConfig.value.dateSize = 18 
  } else {
    const { data: oldSize } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'index_clock_size').maybeSingle()
    if (oldSize) clockConfig.value.size = Number(oldSize.setting_value) || 35
  }

  const { data: refreshData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'index_auto_refresh_config').maybeSingle()
  if (refreshData && refreshData.setting_value) {
    refreshConfig.value = { ...refreshConfig.value, ...refreshData.setting_value }
  } else {
    const { data: oldRefresh } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'index_auto_refresh_seconds').maybeSingle()
    if (oldRefresh && oldRefresh.setting_value !== undefined) {
      const oldVal = Number(oldRefresh.setting_value) || 60
      refreshConfig.value = { classTime: oldVal, breakTime: oldVal, weekend: oldVal }
    }
  }

  const { data: modData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'index_modules_config').maybeSingle()
  if (modData && modData.setting_value) {
    let loadedMods = []
    if (Array.isArray(modData.setting_value)) {
      loadedMods = modData.setting_value
    } else {
      if (modData.setting_value.modules) loadedMods = modData.setting_value.modules
      if (modData.setting_value.dynamicSorting !== undefined) dynamicSorting.value = modData.setting_value.dynamicSorting
    }
    
    // 確保所有 defaultModules 都有在清單內
    const existingIds = loadedMods.map(m => m.id)
    defaultModules.forEach(defMod => {
      if (!existingIds.includes(defMod.id)) {
        loadedMods.push(defMod)
      }
    })
    indexModules.value = loadedMods
  }
}

onMounted(() => fetchConfig())

const moveModuleUp = (index) => {
  if (index > 0) {
    const temp = indexModules.value[index]
    indexModules.value[index] = indexModules.value[index - 1]
    indexModules.value[index - 1] = temp
  }
}

const moveModuleDown = (index) => {
  if (index < indexModules.value.length - 1) {
    const temp = indexModules.value[index]
    indexModules.value[index] = indexModules.value[index + 1]
    indexModules.value[index + 1] = temp
  }
}

const saveSettings = async () => {
  if (pwdConfig.value.type === 'custom' && !pwdConfig.value.custom_pwd.trim()) return alert('❌ 請輸入您的自訂密碼！')
  isSaving.value = true
  const { error } = await supabase.from('system_settings').upsert({ setting_key: 'admin_password', setting_value: pwdConfig.value }, { onConflict: 'setting_key' })
  if (!error) alert('✅ 密碼設定已成功更新！')
  else alert('❌ 儲存失敗')
  isSaving.value = false
}

const saveClockSettings = async () => {
  isSavingClock.value = true
  const { error } = await supabase.from('system_settings').upsert({ setting_key: 'index_clock_config', setting_value: clockConfig.value }, { onConflict: 'setting_key' })
  if (!error) alert('✅ 首頁時鐘樣式已成功更新！')
  else alert('❌ 儲存失敗')
  isSavingClock.value = false
}

const saveRefreshSettings = async () => {
  isSavingRefresh.value = true
  const { error } = await supabase.from('system_settings').upsert({ setting_key: 'index_auto_refresh_config', setting_value: refreshConfig.value }, { onConflict: 'setting_key' })
  if (!error) alert('✅ 自動更新頻率 (智慧變速) 設定成功！')
  else alert('❌ 儲存失敗')
  isSavingRefresh.value = false
}

const saveIndexModules = async () => {
  isSavingModules.value = true
  const payload = { modules: indexModules.value, dynamicSorting: dynamicSorting.value }
  const { error } = await supabase.from('system_settings').upsert({ setting_key: 'index_modules_config', setting_value: payload }, { onConflict: 'setting_key' })
  if (!error) alert('✅ 模組排序設定成功！重整首頁後生效。')
  else alert('❌ 儲存失敗')
  isSavingModules.value = false
}
</script>

<style scoped>
.table-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; }
.table-header h3 { margin: 0; color: #334155; }
.settings-section { background: white; padding: 25px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.settings-section h4 { margin-top: 0; color: #1e293b; }
.help-text { font-size: 0.95rem; color: #64748b; margin-bottom: 20px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 15px; }

.radio-group { display: flex; flex-direction: column; gap: 15px; margin: 20px 0; font-size: 1.1rem; }
.radio-group label { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.preview-tag { background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 6px; font-size: 0.95rem; font-weight: bold; margin-left: 10px; }
.custom-pwd-box { margin-left: 28px; padding: 15px; background: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;}

.clock-settings-grid { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 20px; padding: 15px; background: #f8fafc; border-left: 4px solid #10b981; border-radius: 4px;}
.form-group { display: flex; flex-direction: column; gap: 8px; }
.form-group label { font-weight: bold; color: #475569; }
.edit-input { padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 1rem; outline: none; transition: border-color 0.2s;}
.edit-input:focus { border-color: #10b981; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2); }
.select-theme { width: 250px; }
.size-input { width: 120px; }

.color-picker-box { display: flex; align-items: center; gap: 10px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 12px; }
.color-input { -webkit-appearance: none; -moz-appearance: none; appearance: none; width: 30px; height: 30px; background: transparent; border: none; cursor: pointer; padding: 0; }
.color-input::-webkit-color-swatch-wrapper { padding: 0; }
.color-input::-webkit-color-swatch { border: 2px solid #e2e8f0; border-radius: 4px; }
.color-hex { font-family: monospace; font-size: 1.05rem; color: #334155; font-weight: bold; text-transform: uppercase;}

.chk-group { justify-content: center; }
.icon-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; background: white; border: 1px solid #cbd5e1; padding: 9px 15px; border-radius: 6px; user-select: none; transition: 0.2s;}
.icon-toggle:hover { background: #f1f5f9; }
.large-checkbox { transform: scale(1.3); accent-color: #10b981; cursor: pointer; }

.save-btn { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; font-size: 1.1rem; cursor: pointer; transition: 0.2s;}
.save-btn:hover:not(:disabled) { filter: brightness(0.9); }
.save-btn:disabled { background: #94a3b8; cursor: not-allowed; }

.clock-save-btn { background-color: #10b981; }

.refresh-grid { display: flex; flex-direction: column; gap: 15px; max-width: 400px; padding: 15px; background: #faf5ff; border-left: 4px solid #8b5cf6; border-radius: 4px; margin-bottom: 20px;}
.refresh-btn { margin-top: 0; background-color: #8b5cf6; }
.modules-btn { background-color: #f59e0b; }

.row-align { flex-direction: row; align-items: center; }
.day-label-refresh { width: 120px; text-align: right; }

optgroup { font-weight: bold; color: #1e3a8a; background: #f1f5f9; }
option { font-weight: normal; color: #1e293b; background: white; }

.dynamic-sort-box { background: #eff6ff; border: 1px dashed #93c5fd; padding: 15px 20px; border-radius: 8px; margin-bottom: 15px; }
.help-text-sm { margin: 8px 0 0 32px; font-size: 0.95rem; color: #2563eb; }

.module-list { display: flex; flex-direction: column; gap: 10px; max-width: 600px; }
.module-row { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px 20px; border-radius: 8px; transition: 0.3s; }
.module-row:hover { border-color: #94a3b8; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.module-row.is-hidden { background: #f1f5f9; opacity: 0.6; }

.module-info { display: flex; align-items: center; gap: 15px; }
.mod-toggle span { font-weight: bold; font-size: 1.1rem; color: #1e293b; }
.status-tag { font-size: 0.85rem; font-weight: bold; padding: 3px 8px; border-radius: 4px; }
.tag-on { background: #dcfce7; color: #166534; }
.tag-off { background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; }

.module-actions { display: flex; gap: 5px; }
.move-btn { background: white; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 10px; cursor: pointer; transition: 0.2s; font-size: 1.1rem; }
.move-btn:hover:not(:disabled) { background: #e2e8f0; border-color: #94a3b8; }
.move-btn:disabled { opacity: 0.3; cursor: not-allowed; }
</style>
