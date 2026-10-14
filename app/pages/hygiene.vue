<template>
  <div class="hygiene-page">
    <!-- ================= 登入介面 ================= -->
    <div v-if="!isLoggedIn" class="login-container">
      <div class="login-card">
        <h2>🧹 班級衛生管理系統</h2>
        <p class="subtitle">此區域僅限導師進入</p>
        <div class="form-group">
          <label>請輸入導師後台密碼：</label>
          <input 
            v-model="passwordInput" 
            type="password" 
            placeholder="支援動態密碼..." 
            class="form-control" 
            @keyup.enter="handleLogin"
          />
        </div>
        <button @click="handleLogin" class="btn-submit" :disabled="isLoggingIn">
          {{ isLoggingIn ? '驗證中...' : '解鎖進入' }}
        </button>
        <div class="back-link">
          <NuxtLink to="/">⬅️ 返回首頁</NuxtLink>
        </div>
      </div>
    </div>

    <!-- ================= 系統主介面 ================= -->
    <div v-else class="workspace">
      <header class="workspace-header screen-only">
        <h2>🧹 衛生管理系統</h2>
        <div class="header-actions">
          <label v-if="isEditing" class="toggle-label">
            <input type="checkbox" v-model="d.isVisibleOnIndex" />
            顯示於首頁
          </label>
          
          <button @click="toggleEditMode" class="btn-edit" :class="{ 'editing': isEditing }">
            {{ isEditing ? '👁️ 切換預覽模式' : '✏️ 開啟編輯模式' }}
          </button>
          <button v-if="isEditing" @click="saveData" class="btn-save" :disabled="isSaving">
            {{ isSaving ? '儲存中...' : '💾 儲存所有變更' }}
          </button>
          <button @click="logout" class="btn-logout">登出</button>
        </div>
      </header>

      <!-- 分頁標籤 -->
      <div class="tabs-container screen-only">
        <button class="tab-btn" :class="{ active: activeTab === 'morning' }" @click="activeTab = 'morning'">🌅 早上掃地管理</button>
        <button class="tab-btn" :class="{ active: activeTab === 'lunch' }" @click="activeTab = 'lunch'">🍱 中午搬餐管理</button>
        <button class="tab-btn" :class="{ active: activeTab === 'squad' }" @click="activeTab = 'squad'">🛡️ 小隊工作管理</button>
      </div>

      <section class="history-panel screen-only" aria-label="衛生管理歷史月曆">
        <div class="history-toolbar">
          <strong>📅 {{ tabNames[activeTab] }}歷史紀錄</strong>
          <div class="history-actions">
            <button type="button" @click="exportHistoryFile('json')">匯出 JSON</button>
            <button type="button" @click="exportHistoryFile('csv')">匯出 CSV</button>
            <button type="button" @click="historyFileInput?.click()">匯入 JSON／CSV</button>
            <input ref="historyFileInput" type="file" accept=".json,.csv,application/json,text/csv" hidden @change="importHistoryFile" />
          </div>
        </div>
        <p>選擇日期後可編輯當天生效的內容；儲存後從該日起沿用，直到下一筆變更。三個分頁的紀錄互不影響。</p>
        <div class="calendar-header">
          <button type="button" @click="shiftCalendarMonth(-1)" aria-label="上個月">‹</button>
          <strong>{{ calendarMonth.replace('-', ' 年 ') }} 月</strong>
          <button type="button" @click="shiftCalendarMonth(1)" aria-label="下個月">›</button>
        </div>
        <div class="history-calendar">
          <span v-for="weekday in ['日', '一', '二', '三', '四', '五', '六']" :key="weekday" class="calendar-weekday">{{ weekday }}</span>
          <button v-for="day in calendarDays" :key="day.date" type="button" :class="{ 'outside-month': !day.inMonth, selected: day.date === selectedDates[activeTab], recorded: day.hasRecord }" @click="selectHistoryDate(day.date)">
            {{ day.day }}<small v-if="day.hasRecord">●</small>
          </button>
        </div>
        <div class="history-selection">
          <label>選取日期 <input type="date" :value="selectedDates[activeTab]" @change="selectHistoryDate($event.target.value)" /></label>
          <span>目前顯示：{{ activeEffectiveDate ? `${activeEffectiveDate} 起的紀錄` : '原始版本' }}</span>
          <button v-if="hasSelectedRecord" type="button" class="delete-history" :disabled="isSaving" @click="deleteSelectedHistory">刪除這天的變更</button>
        </div>
      </section>

      <div class="tips screen-only" v-if="isEditing">
        💡 成員欄位只填座號，多人可用「、」或換行分隔，例如 1、2、3。工作名稱、細節及備註仍可自由修改；需要變色時可使用 HTML。
      </div>

      <div class="assignment-report screen-only" aria-live="polite">
        <strong>本分頁座號分配檢查</strong>
        <template v-if="studentSeatsLoaded">
          <span>已分配 {{ activeReport.assignedCount }}／{{ activeReport.expectedCount }} 人</span>
          <span v-if="activeReport.missing.length" class="report-warning">未分配：{{ activeReport.missing.join('、') }} 號</span>
          <span v-if="activeReport.repeated.length" class="report-warning">重複分配：{{ activeReport.repeated.map(item => `${item.seat} 號（${item.count} 次）`).join('、') }}</span>
          <span v-if="activeReport.unknown.length" class="report-warning">非本班座號：{{ activeReport.unknown.join('、') }}</span>
          <span v-if="activeReport.invalid.length" class="report-warning">含非座號文字：{{ activeReport.invalid.join('、') }}</span>
          <span v-if="!activeReport.missing.length && !activeReport.repeated.length && !activeReport.unknown.length && !activeReport.invalid.length" class="report-ok">每個座號各分配一份工作。</span>
        </template>
        <span v-else class="report-warning">無法取得學生座號，暫時無法核對分配。</span>
        <span v-if="migrationError" class="report-warning">{{ migrationError }}</span>
      </div>

      <!-- 💡 新增的字體大小統一控制器 -->
      <div class="font-settings screen-only" v-if="isEditing">
        <label>🔍 表格內「座號」字體大小：</label>
        <input type="number" v-model="d.nameFontSize" class="font-input" min="12" max="60" /> px
        <span style="font-size: 0.85rem; color: #64748b; margin-left: 10px;">(修改此數字即可統一控制名單大小，不需再手打 HTML)</span>
      </div>

      <!-- ================= 1. 早上掃地管理 ================= -->
      <div v-show="activeTab === 'morning'" class="table-card" id="morning-card">
        
        <div class="print-actions screen-only">
          <button @click="triggerPrint" class="btn-print">📄 產生 PDF / 預覽</button>
          <button @click="generateWord" class="btn-word">📝 匯出 Word</button>
        </div>

        <div class="editable-title">
          <input v-if="isEditing" type="text" v-model="d.morning.title" class="title-input"/>
          <h3 v-else v-html="d.morning.title"></h3>
        </div>
        
        <table class="custom-table morning-table">
          <thead>
            <tr>
              <th colspan="2" width="20%">教室</th>
              <th width="30%">座號</th>
              <th width="50%">工作內容</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="2"><EditText v-model="d.morning.in_hygiene" :edit="isEditing" /></td>
              <!-- 💡 加入 :largeFont 屬性，自動套用放大字體 -->
              <td><EditText v-model="d.morning.in_hygiene_names" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.morning.in_hygiene_work" :edit="isEditing" /></td>
            </tr>
            <tr>
              <td colspan="2"><EditText v-model="d.morning.board" :edit="isEditing" /></td>
              <td><EditText v-model="d.morning.board_names" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.morning.board_work" :edit="isEditing" /></td>
            </tr>
            <tr>
              <td colspan="2"><EditText v-model="d.morning.sweep" :edit="isEditing" /></td>
              <td><EditText v-model="d.morning.sweep_names" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td rowspan="2"><EditText v-model="d.morning.sweep_mop_work" :edit="isEditing" class="h-full" /></td>
            </tr>
            <tr>
              <td colspan="2"><EditText v-model="d.morning.mop" :edit="isEditing" /></td>
              <td><EditText v-model="d.morning.mop_names" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
            </tr>
            <tr>
              <td colspan="2"><EditText v-model="d.morning.window" :edit="isEditing" /></td>
              <td><EditText v-model="d.morning.window_names" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.morning.window_work" :edit="isEditing" /></td>
            </tr>
            <tr>
              <td colspan="2"><EditText v-model="d.morning.hallway" :edit="isEditing" /></td>
              <td><EditText v-model="d.morning.hallway_names" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.morning.hallway_work" :edit="isEditing" /></td>
            </tr>
            <tr>
              <td colspan="2"><EditText v-model="d.morning.trash" :edit="isEditing" /></td>
              <td><EditText v-model="d.morning.trash_names" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.morning.trash_work" :edit="isEditing" /></td>
            </tr>

            <!-- 外掃區 -->
            <tr class="header-row">
              <th>外掃區</th>
              <th>打掃區域</th>
              <th>座號</th>
              <th>工作內容</th>
            </tr>
            
            <tr v-for="(item, idx) in d.morning.out_dynamic_areas" :key="'out-dyn-'+idx">
              <td v-if="idx === 0" :rowspan="d.morning.out_dynamic_areas.length">
                <EditText v-model="d.morning.out_area" :edit="isEditing" class="h-full" />
              </td>
              <td><EditText v-model="item.area" :edit="isEditing" /></td>
              <td><EditText v-model="item.names" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td style="position: relative;">
                <div style="display: flex; gap: 8px; align-items: stretch; height: 100%;">
                  <div style="flex: 1;"><EditText v-model="item.work" :edit="isEditing" class="h-full" /></div>
                  <button v-if="isEditing" @click="removeOutArea(idx)" class="btn-delete-row screen-only" title="刪除此列">🗑️</button>
                </div>
              </td>
            </tr>
            
            <tr v-if="isEditing" class="screen-only">
              <td colspan="4" style="text-align: center; padding: 12px; background-color: #f8fafc;">
                <button @click="addOutArea" class="btn-add-row">➕ 新增一列外掃區域</button>
              </td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer-note">
          <textarea v-if="isEditing" v-model="d.morning.note" rows="3" class="w-full"></textarea>
          <div v-else v-html="d.morning.note"></div>
        </div>
      </div>

      <!-- ================= 2. 中午搬餐管理 ================= -->
      <div v-show="activeTab === 'lunch'" class="table-card" id="lunch-card">
        
        <div class="print-actions screen-only">
          <button @click="triggerPrint" class="btn-print">📄 產生 PDF / 預覽</button>
          <button @click="generateWord" class="btn-word">📝 匯出 Word</button>
        </div>

        <div class="editable-title">
          <input v-if="isEditing" type="text" v-model="d.lunch.title" class="title-input"/>
          <h3 v-else v-html="d.lunch.title"></h3>
        </div>
        <div class="sub-title">
          <input v-if="isEditing" type="text" v-model="d.lunch.sub" class="w-full"/>
          <span v-else v-html="d.lunch.sub"></span>
        </div>

        <table class="custom-table lunch-table">
          <tbody>
            <!-- 清潔組 -->
            <tr>
              <th rowspan="2" width="10%"><EditText v-model="d.lunch.clean_header" :edit="isEditing" class="h-full"/></th>
              <th width="15%"><EditText v-model="d.lunch.clean_h1" :edit="isEditing" /></th>
              <th width="15%"><EditText v-model="d.lunch.clean_h2" :edit="isEditing" /></th>
              <th width="15%"><EditText v-model="d.lunch.clean_h3" :edit="isEditing" /></th>
              <th width="15%"><EditText v-model="d.lunch.clean_h4" :edit="isEditing" /></th>
              <th width="15%"><EditText v-model="d.lunch.clean_h5" :edit="isEditing" /></th>
              <th width="15%"><EditText v-model="d.lunch.clean_h6" :edit="isEditing" /></th>
            </tr>
            <tr>
              <td><EditText v-model="d.lunch.clean_n1" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.lunch.clean_n2" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.lunch.clean_n3" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.lunch.clean_n4" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.lunch.clean_n5" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.lunch.clean_n6" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
            </tr>
            <!-- 搬餐組 -->
            <tr>
              <th rowspan="2"><EditText v-model="d.lunch.move_header" :edit="isEditing" class="h-full"/></th>
              <th><EditText v-model="d.lunch.move_h1" :edit="isEditing" /></th>
              <th><EditText v-model="d.lunch.move_h2" :edit="isEditing" /></th>
              <th><EditText v-model="d.lunch.move_h3" :edit="isEditing" /></th>
              <th><EditText v-model="d.lunch.move_h4" :edit="isEditing" /></th>
              <th><EditText v-model="d.lunch.move_h5" :edit="isEditing" /></th>
              <th><EditText v-model="d.lunch.move_h6" :edit="isEditing" /></th>
            </tr>
            <tr>
              <td><EditText v-model="d.lunch.move_n1" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.lunch.move_n2" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.lunch.move_n3" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.lunch.move_n4" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.lunch.move_n5" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.lunch.move_n6" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
            </tr>
            <!-- 配膳組 -->
            <tr>
              <th rowspan="2"><EditText v-model="d.lunch.serve_header" :edit="isEditing" class="h-full"/></th>
              <th><EditText v-model="d.lunch.serve_h1" :edit="isEditing" /></th>
              <th><EditText v-model="d.lunch.serve_h2" :edit="isEditing" /></th>
              <th><EditText v-model="d.lunch.serve_h3" :edit="isEditing" /></th>
              <th><EditText v-model="d.lunch.serve_h4" :edit="isEditing" /></th>
              <th><EditText v-model="d.lunch.serve_h5" :edit="isEditing" /></th>
              <th><EditText v-model="d.lunch.serve_h6" :edit="isEditing" /></th>
            </tr>
            <tr>
              <td><EditText v-model="d.lunch.serve_n1" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.lunch.serve_n2" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.lunch.serve_n3" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.lunch.serve_n4" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.lunch.serve_n5" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.lunch.serve_n6" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer-note mt-15">
          <textarea v-if="isEditing" v-model="d.lunch.note1" rows="8" class="w-full text-sm"></textarea>
          <div v-else v-html="d.lunch.note1.replace(/\n/g, '<br>')" class="text-sm"></div>
        </div>
        <div class="footer-note mt-10">
          <textarea v-if="isEditing" v-model="d.lunch.note2" rows="6" class="w-full text-sm"></textarea>
          <div v-else v-html="d.lunch.note2.replace(/\n/g, '<br>')" class="text-sm"></div>
        </div>
      </div>

      <!-- ================= 3. 小隊工作管理 ================= -->
      <div v-show="activeTab === 'squad'" class="table-card" id="squad-card">
        
        <div class="print-actions screen-only">
          <button @click="triggerPrint" class="btn-print">📄 產生 PDF / 預覽</button>
          <button @click="generateWord" class="btn-word">📝 匯出 Word</button>
        </div>

        <div class="editable-title">
          <input v-if="isEditing" type="text" v-model="d.squad.title" class="title-input"/>
          <h3 v-else v-html="d.squad.title"></h3>
        </div>
        
        <table class="custom-table squad-table">
          <thead>
            <tr>
              <th width="15%">小隊職務</th><th width="20%">細項</th><th width="20%">座號</th><th width="45%">工作內容</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="n in 6" :key="'ld-'+n">
              <td v-if="n===1" rowspan="6"><EditText v-model="d.squad.role_1" :edit="isEditing" class="h-full" /></td>
              <td><EditText v-model="d.squad.leader_items[n-1]" :edit="isEditing" /></td>
              <td><EditText v-model="d.squad.leaders[n-1]" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td v-if="n===1" rowspan="6"><EditText v-model="d.squad.leader_desc" :edit="isEditing" class="h-full" /></td>
            </tr>
            <tr v-for="n in 6" :key="'dy-'+n">
              <td v-if="n===1" rowspan="6"><EditText v-model="d.squad.role_2" :edit="isEditing" class="h-full" /></td>
              <td><EditText v-model="d.squad.duty_items[n-1]" :edit="isEditing" /></td>
              <td><EditText v-model="d.squad.duties[n-1]" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.squad.duty_desc[n-1]" :edit="isEditing" /></td>
            </tr>
            <tr v-for="n in 5" :key="'hp-'+n">
              <td v-if="n===1" rowspan="5"><EditText v-model="d.squad.role_3" :edit="isEditing" class="h-full" /></td>
              <td><EditText v-model="d.squad.helper_items[n-1]" :edit="isEditing" /></td>
              <td><EditText v-model="d.squad.helpers[n-1]" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.squad.helper_desc[n-1]" :edit="isEditing" /></td>
            </tr>
            <tr v-for="n in 4" :key="'er-'+n">
              <td v-if="n===1" rowspan="4"><EditText v-model="d.squad.role_4" :edit="isEditing" class="h-full" /></td>
              <td><EditText v-model="d.squad.errand_items[n-1]" :edit="isEditing" /></td>
              <td><EditText v-model="d.squad.errands[n-1]" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td><EditText v-model="d.squad.errand_desc[n-1]" :edit="isEditing" /></td>
            </tr>
            <tr v-for="n in 2" :key="'mn-'+n">
              <td v-if="n===1" rowspan="2"><EditText v-model="d.squad.role_5" :edit="isEditing" class="h-full" /></td>
              <td><EditText v-model="d.squad.minion_items[n-1]" :edit="isEditing" /></td>
              <td><EditText v-model="d.squad.minions[n-1]" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td v-if="n===1" rowspan="2"><EditText v-model="d.squad.minion_desc" :edit="isEditing" class="h-full" /></td>
            </tr>
            <tr v-for="n in 3" :key="'ot-'+n">
              <td v-if="n===1" rowspan="3"><EditText v-model="d.squad.role_6" :edit="isEditing" class="h-full" /></td>
              <td><EditText v-model="d.squad.other_items[n-1]" :edit="isEditing" /></td>
              <td><EditText v-model="d.squad.others[n-1]" :edit="isEditing" :largeFont="d.nameFontSize" /></td>
              <td v-if="n===1" rowspan="3"><EditText v-model="d.squad.other_desc" :edit="isEditing" class="h-full" /></td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, defineComponent, h } from 'vue'
import { hygieneAssignmentReport, sanitizeHygieneAssignments } from '../utils/hygieneAssignments.js'
import { deleteHygieneRecord, exportHygieneHistory, hygieneTabs, importHygieneHistory, normalizeHygieneHistory, resolveHygieneSection, setHygieneRecord, validHygieneDate } from '../utils/hygieneHistory.js'
import { taiwanDateISO } from '../utils/examSchedule.js'
const supabase = useSupabaseClient()

// 💡 升級版 EditText：接收 largeFont 屬性，若有值則自動套用放大與粗體
const EditText = defineComponent({
  props: ['modelValue', 'edit', 'class', 'largeFont'],
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => {
      const styleObj = props.largeFont ? { fontSize: `${props.largeFont}px`, fontWeight: 'bold' } : {}
      
      return props.edit 
        ? h('textarea', { 
            value: props.modelValue, 
            class: ['editable-textarea', props.class],
            style: styleObj,
            onInput: (e) => emit('update:modelValue', e.target.value) 
          })
        : h('div', { 
            class: ['readonly-text', props.class], 
            style: styleObj,
            innerHTML: String(props.modelValue || '').replace(/\n/g, '<br>') 
          })
    }
  }
})

const logRoleVisit = async (roleName) => {
  try {
    const ipRes = await fetch('https://api.ipify.org?format=json')
    const { ip } = await ipRes.json()
    await supabase.from('visitor_logs').insert([{ 
      ip_address: ip, 
      device_info: navigator.userAgent, 
      role: roleName 
    }])
  } catch (e) { 
    console.error("日誌寫入失敗", e) 
  }
}

const isLoggedIn = ref(false)
const isLoggingIn = ref(false)
const passwordInput = ref('')
const isEditing = ref(false)
const isSaving = ref(false)
const activeTab = ref('morning')
const tabNames = { morning: '早上掃地', lunch: '中午搬餐', squad: '小隊工作' }
const todayTaiwan = taiwanDateISO()
const selectedDates = ref({ morning: todayTaiwan, lunch: todayTaiwan, squad: todayTaiwan })
const calendarMonth = ref(todayTaiwan.slice(0, 7))
const historyFileInput = ref(null)
const storedData = ref(null)
const studentSeatNumbers = ref([])
const studentSeatsLoaded = ref(false)
const migrationError = ref('')
const activeReport = computed(() => hygieneAssignmentReport(d.value, activeTab.value, studentSeatNumbers.value))
const activeEffectiveDate = computed(() => resolveHygieneSection(storedData.value || defaultData, activeTab.value, selectedDates.value[activeTab.value]).effectiveDate)
const hasSelectedRecord = computed(() => normalizeHygieneHistory(storedData.value?.history)[activeTab.value].some(item => item.date === selectedDates.value[activeTab.value]))
const calendarDays = computed(() => {
  const [year, month] = calendarMonth.value.split('-').map(Number)
  const first = new Date(Date.UTC(year, month - 1, 1))
  const start = first.getUTCDay()
  const records = new Set(normalizeHygieneHistory(storedData.value?.history)[activeTab.value].map(item => item.date))
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, index - start + 1)).toISOString().slice(0, 10)
    return { date, day: Number(date.slice(-2)), inMonth: date.slice(0, 7) === calendarMonth.value, hasRecord: records.has(date) }
  })
})

const defaultData = {
  isVisibleOnIndex: false, 
  nameFontSize: 24, // 💡 新增的預設字體大小
  history: { morning: [], lunch: [], squad: [] },
  morning: {
    title: '704 班 教室和外掃區 早上掃地工作分配表 2021/10/18 開始',
    note: '請先做好垃圾分類。每天早上和週五下午都要倒資源回收垃圾。\n每天早上和週五下午打掃時間視情況倒一般垃圾，超過八分滿時得立刻倒。週五下午和例假日前一天下午一定得倒光。',
    in_hygiene: '內衛生', in_hygiene_names: '', in_hygiene_work: '',
    board: '講台掃拖、講桌\n黑板清潔\n整理置物櫃等\n教室內雜項物\n品並且擦拭', board_names: '', board_work: '整理黑板、粉筆槽、打板擦、擦講桌和整理抽屜\n講台掃地和拖地\n擦沒有使用的桌椅、書櫃和後面的置物櫃',
    sweep: '教室地板掃地', sweep_names: '',
    sweep_mop_work: '<span style="color:red; font-weight:bold;">負責掃地的人請 8:00 後開始後立刻開始打掃。</span>拖地的人在掃完後立刻拖地，並開電扇讓地板吹乾。',
    mop: '教室地板拖地', mop_names: '',
    window: '擦窗戶\n清理洗手台和\n小陽台', window_names: '', window_work: '擦靠走廊的窗戶\n掃小陽台，清理洗手台上垃圾污垢',
    hallway: '教室走廊\n掃拖地', hallway_names: '', hallway_work: '<span style="color:red; font-weight:bold;">負責掃地的人請 7:20 後開始後立刻開始打掃，先掃走人工垃圾，8:00 後再掃細節部分。</span>8:20 上課鐘響前五分鐘開始掃地，鐘響後開始拖地，並隨時保持乾淨',
    trash: '倒垃圾、資源回\n收、整理使用後\n的掃地用具', trash_names: '', trash_work: '整理並分類垃圾，將垃圾壓下去，換垃圾袋，將垃圾桶排好',
    out_area: '北側人行道\n\n下雨時，學校會\n宣佈是否打掃',
    out_dynamic_areas: [
      { area: '外衛生', names: '', work: '' },
      { area: '撿拾人工垃圾(拿必須用具)', names: '', work: '' }
    ]
  },
  lunch: {
    title: '704 午餐搬運、中午打掃輪值表 實施日期：2021/10/18 開始',
    sub: '數字為午餐排隊順序，請按照順序排隊，請勿插隊 (請帶口罩，注意衛生，避免傳染)。',
    clean_header: '清潔組 (中\n午打掃)', clean_h1: '講台、講\n桌、黑板、\n餐桌\n2-2', clean_h2: '教室掃地\n2-1', clean_h3: '座位拖地\n2-3', clean_h4: '走廊掃拖\n(掃地打鐘\n前 3 分鐘開\n始，拖地打\n鐘後開始)\n2-5', clean_h5: '洗公用餐\n具，整理洗\n手台\n2-4', clean_h6: '幫老師拿東\n西回辦公室\n2-4',
    clean_n1: '', clean_n2: '', clean_n3: '', clean_n4: '', clean_n5: '', clean_n6: '',
    move_header: '搬餐組', move_h1: '飯盒\n3-1', move_h2: '大菜盒 A\n3-3', move_h3: '大菜盒 B\n3-3', move_h4: '小菜盒\n3-4', move_h5: '湯桶\n3-2', move_h6: '水 or 飲料\nor 候補 3-5',
    move_n1: '', move_n2: '', move_n3: '', move_n4: '', move_n5: '', move_n6: '',
    serve_header: '配膳組 (先打菜，\n全部同學分配\n完，再用餐)', serve_h1: '飯盒\n1-1', serve_h2: '大菜盒 A\n1-2', serve_h3: '大菜盒 B\n1-3', serve_h4: '小菜盒\n1-4', serve_h5: '湯桶\n1-5', serve_h6: '清潔消毒餐\n桌且移動桌\n子並歸位\n1-6',
    serve_n1: '', serve_n2: '', serve_n3: '', serve_n4: '', serve_n5: '', serve_n6: '',
    note1: '1. 1200-1215 為用餐時間，用餐時請勿聊天，活動範圍為教室、陽台和走廊，要上廁所或外出請詢問導師。\n2. 最晚 1215 用餐結束（老師會看用餐狀況調整），每個人請將廚餘丟至「一般垃圾桶」，並用衛生紙將餐盘整理收好，整理抽屜和書櫃，最後自己搬上椅子，沒有工作者請退到掃地區域以外等候，<span style="color:blue">拖地完、地板吹乾後</span>，方可進入。整理組搬椅子的同學請在 1225 前按照導師指示搬下，勿亂跑。\n3. <span style="background:black; color:white; font-weight:bold;">副衛生股長</span>監督「飯菜的搬送」；<span style="background:black; color:white; font-weight:bold;">正衛生股長</span>監督「中午掃地情況」，一遇有缺人則請詢問導師。\n4. <span style="font-weight:bold; text-decoration:underline;">正副衛生股長</span>負責午休鐘響之後<span style="text-decoration:underline;">檢查室內外地板垃圾</span>。(每天輪流)\n5. <span style="font-weight:bold; text-decoration:underline;">禁止私下更換搬運之飯菜，違者下個階段續搬</span>。除非第四節上課老師延後下課，全班之飯菜需於<span style="font-weight:bold; text-decoration:underline;">每天 1200 前</span>搬至教室。\n6. 導師未到教室前不得私自打菜。<span style="font-weight:bold;">若導師在 1205 尚未到教室，由班長宣佈開始打菜。</span>\n7. <span style="text-decoration:underline;">每週不定期</span>有水果或點心，同學記得去廚房搬運<span style="font-weight:bold; text-decoration:underline;">全部搬運回來</span>。(或由老師指派)\n若餐盒配置不太相同時，整組 8 工作必須負責全部搬回來，先到者先選擇搬運東西。',
    note2: '----------------------------清潔組（中午打掃）工作守則----------------------------\n1. 清潔組負責「講台桌黑板、餐桌」者，請用抹布擦餐桌，處理廚餘（第一優先），然後擦粉筆槽，請勿在午休時間教室內板擦，然後擦黑板，將粉筆排好，<span style="color:blue">然後掃和拖</span>講台，講桌也要擦，上面的東西請擺好。請將垃圾桶周圍垃圾清理乾淨，將必要垃圾分類。\n2. 清潔組負責「教室掃地」和「座位拖地」者，請於大部分的同學吃完飯後，開始打掃。先掃，後拖。「座位拖地」代表只拖桌子和椅子下方地板。\n3. 清潔組負責「走廊掃拖」者，請「最慢」在 12:20 開始掃地。<span style="font-weight:bold;">唯有拖地的人，必須在 12:25 打鐘後，才開始拖，一共兩次。<span style="text-decoration:underline;">正副衛生股長請在教室內最後進行善後補強工作。</span></span>\n4. 清潔組負責「整理垃圾、用具、洗手臺」者，請將洗手臺廚餘清理乾淨，抹布擺好。然後將垃圾桶旁垃圾整理，垃圾壓好。'
  },
  squad: {
    title: '704 各項小隊成員工作 20210901',
    role_1: '小隊長',
    role_2: '值日生\n<span class="text-xs">(每天第 7 節下課到辦公室簽到)</span>',
    role_3: '小幫手\n<span class="text-xs">(每天第 1 節下課到辦公室簽到)</span>',
    role_4: '公差\n<span class="text-xs">(每天第 2 節下課到辦公室簽到...)</span>',
    role_5: '小小兵\n<span class="text-xs">(每天第 3 節下課到辦公室簽到)</span>',
    role_6: '其他',
    leader_items: ['小隊長 1', '小隊長 2', '小隊長 3', '小隊長 4', '小隊長 5', '小隊長 6'],
    leader_desc: '監督小隊員，提醒各項事物，登記其他小隊違規行為。每天第 3,7 節下課到辦公室登記違規行為。',
    leaders: ['', '', '', '', '', ''],
    duty_items: ['值日生 1', '值日生 2', '值日生 3', '值日生 4', '值日生 5', '值日生 6'],
    duty_desc: ['負責第 1,2 節上下課擦黑板', '負責第 3,4 節上下課擦黑板', '負責第 5,6 節上下課擦黑板', '負責第 7,8 節上下課擦黑板', '負責每節課老師要求的講桌或設備移動事項', '負責每節課老師要求的講桌或設備移動事項'],
    duties: ['', '', '', '', '', ''],
    helper_items: ['小幫手 1', '小幫手 2', '小幫手 3', '小幫手 4', '小幫手 5'],
    helper_desc: ['每節上課前，撿乾淨<span style="color:blue">第 1,2 小隊</span>每排附近的垃圾', '每節上課前，撿乾淨<span style="color:blue">第 3,4 小隊</span>每排附近的垃圾', '每節上課前，撿乾淨<span style="color:blue">第 5,6 小隊</span>每排附近的垃圾', '每節上課前，撿乾淨講台和講桌附近的垃圾', '每節上課前，撿乾淨教室後面空地附近的垃圾'],
    helpers: ['', '', '', '', ''],
    errand_items: ['公差 1', '公差 2', '公差 3', '公差 4'],
    errand_desc: ['8:20 前，搬聯絡簿到辦公室', '12:00 前，搬聯絡簿到教室的講桌旁', '<span style="color:red">13:05</span> 一打鐘，便搬聯絡簿到辦公室', '第七節下課，搬聯絡簿到教室'],
    errands: ['', '', '', ''],
    minion_items: ['小小兵 1', '小小兵 2'],
    minion_desc: '每天第 3,7 節下課到辦公室向導師報告十件上課時同學們的行為。', minions: ['', ''],
    other_items: ['特別小助理 1', '特別小助理 2', '特別小助理 3'],
    other_desc: '每天第 1,6 節下課到辦公室詢問老師要做的事', others: ['', '', '']
  }
}

const d = ref(JSON.parse(JSON.stringify(defaultData))) 
storedData.value = JSON.parse(JSON.stringify(defaultData))

onMounted(async () => {
  if (sessionStorage.getItem('hygiene_admin_logged_in') === 'true') {
    isLoggedIn.value = true
    await fetchLayout()
  }
})

const handleLogin = async () => {
  if (!passwordInput.value) return
  isLoggingIn.value = true
  try {
    const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'admin_password').maybeSingle()
    let expectedPwd = '168168168' 
    if (data?.setting_value) {
      const config = data.setting_value
      if (config.type === 'dynamic') {
        const dt = new Date(); const yy = String(dt.getFullYear()).slice(2); const mm = String(dt.getMonth() + 1).padStart(2, '0'); const dd = String(dt.getDate()).padStart(2, '0')
        expectedPwd = `${yy}${mm}${dd}59`
      } else if (config.type === 'custom' && config.custom_pwd) { expectedPwd = config.custom_pwd }
    }
    
    if (passwordInput.value === expectedPwd || passwordInput.value === '168168168') {
      isLoggedIn.value = true; 
      sessionStorage.setItem('hygiene_admin_logged_in', 'true'); 
      await logRoleVisit('導師');
      await fetchLayout()
    } else alert('❌ 密碼錯誤！')
  } catch (e) {
    if (passwordInput.value === '168168168') { 
      isLoggedIn.value = true; 
      sessionStorage.setItem('hygiene_admin_logged_in', 'true'); 
      await logRoleVisit('導師(降級登入)');
      await fetchLayout() 
    }
  } finally { isLoggingIn.value = false; passwordInput.value = '' }
}

const logout = () => { sessionStorage.removeItem('hygiene_admin_logged_in'); isLoggedIn.value = false; navigateTo('/') }

const fetchLayout = async () => {
  const { data: students, error: studentError } = await supabase.from('students').select('seat_number')
  studentSeatsLoaded.value = !studentError && Array.isArray(students)
  studentSeatNumbers.value = studentSeatsLoaded.value ? students.map(student => student.seat_number).filter(value => value !== null && value !== undefined) : []

  const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'hygiene_management_data').maybeSingle()
  if (data?.setting_value) {
    const dbData = data.setting_value
    const baseData = JSON.parse(JSON.stringify(defaultData))
    
    d.value = { 
      ...baseData, 
      ...dbData,
      nameFontSize: dbData.nameFontSize || 24, // 💡 載入儲存的字體大小
      morning: { ...baseData.morning, ...(dbData.morning || {}) },
      lunch: { ...baseData.lunch, ...(dbData.lunch || {}) },
      squad: { ...baseData.squad, ...(dbData.squad || {}) }
    }

    if (!d.value.morning.out_dynamic_areas || d.value.morning.out_dynamic_areas.length === 0) {
      const m = d.value.morning;
      const migrated = [];
      if (m.out_hygiene || m.out_hygiene_names || m.out_hygiene_work) {
        migrated.push({ area: m.out_hygiene || '', names: m.out_hygiene_names || '', work: m.out_hygiene_work || '' });
      }
      if (m.out_sweep1 || m.out_sweep1_names || m.out_sweep2_names || m.out_sweep3_names || m.out_sweep_work) {
        const names = [m.out_sweep1_names, m.out_sweep2_names, m.out_sweep3_names].filter(Boolean).join('\n');
        migrated.push({ area: m.out_sweep1 || '', names: names, work: m.out_sweep_work || '' });
      }
      if (migrated.length === 0) {
        migrated.push({ area: '', names: '', work: '' });
      }
      d.value.morning.out_dynamic_areas = migrated;
    }

    const sanitized = sanitizeHygieneAssignments(d.value)
    if (JSON.stringify(sanitized) !== JSON.stringify(d.value)) {
      const { error } = await supabase.from('system_settings').upsert({ setting_key: 'hygiene_management_data', setting_value: sanitized }, { onConflict: 'setting_key' })
      migrationError.value = error ? '舊姓名已從畫面隱藏，但資料庫清理失敗；請稍後按「儲存所有變更」重試。' : ''
    }
    storedData.value = { ...sanitized, history: normalizeHygieneHistory(sanitized.history) }
  }
  for (const tab of hygieneTabs) d.value[tab] = resolveHygieneSection(storedData.value, tab, selectedDates.value[tab]).section
}

const hasUnsavedSection = tab => JSON.stringify(d.value[tab]) !== JSON.stringify(resolveHygieneSection(storedData.value, tab, selectedDates.value[tab]).section)
const selectHistoryDate = date => {
  if (!validHygieneDate(date)) return
  const tab = activeTab.value
  if (isEditing.value && hasUnsavedSection(tab) && !confirm('目前分頁有尚未儲存的內容。要放棄變更並切換日期嗎？')) return
  selectedDates.value = { ...selectedDates.value, [tab]: date }
  calendarMonth.value = date.slice(0, 7)
  d.value[tab] = resolveHygieneSection(storedData.value, tab, date).section
}
const shiftCalendarMonth = offset => {
  const [year, month] = calendarMonth.value.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1 + offset, 1))
  calendarMonth.value = next.toISOString().slice(0, 7)
}
const persistHistoryData = async next => {
  const sanitized = sanitizeHygieneAssignments(next)
  const { error } = await supabase.from('system_settings').upsert({ setting_key: 'hygiene_management_data', setting_value: sanitized }, { onConflict: 'setting_key' })
  if (error) throw error
  storedData.value = sanitized
  d.value.isVisibleOnIndex = sanitized.isVisibleOnIndex
  d.value.nameFontSize = sanitized.nameFontSize
  migrationError.value = ''
}
const deleteSelectedHistory = async () => {
  const tab = activeTab.value
  const date = selectedDates.value[tab]
  if (!hasSelectedRecord.value || !confirm(`確定刪除 ${date} 的${tabNames[tab]}變更？該日將沿用更早的版本。`)) return
  isSaving.value = true
  try {
    const next = JSON.parse(JSON.stringify(storedData.value))
    next.history = deleteHygieneRecord(next.history, tab, date)
    await persistHistoryData(next)
    d.value[tab] = resolveHygieneSection(storedData.value, tab, date).section
  } catch { alert('刪除失敗，請重試。') } finally { isSaving.value = false }
}
const downloadHistoryFile = (content, filename, mime) => {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const link = document.createElement('a')
  link.href = url; link.download = filename; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const exportHistoryFile = type => {
  try {
    const tab = activeTab.value
    downloadHistoryFile(exportHygieneHistory(storedData.value, tab, type), `hygiene_${tab}_history.${type}`, type === 'json' ? 'application/json' : 'text/csv;charset=utf-8')
  } catch (error) { alert(`匯出失敗：${error.message}`) }
}
const importHistoryFile = async event => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const tab = activeTab.value
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error('檔案不可超過 2 MB')
    const type = file.name.toLowerCase().endsWith('.json') ? 'json' : file.name.toLowerCase().endsWith('.csv') ? 'csv' : ''
    const imported = importHygieneHistory(await file.text(), tab, type)
    const required = Object.keys(defaultData[tab])
    if (![imported.base, ...imported.records.map(item => item.data)].every(section => required.every(key => key in section))) throw new Error('檔案缺少工作欄位')
    if (!confirm(`匯入會覆蓋「${tabNames[tab]}」的原始版本和全部歷史紀錄，確定繼續嗎？`)) return
    isSaving.value = true
    const next = JSON.parse(JSON.stringify(storedData.value))
    next[tab] = imported.base
    next.history = normalizeHygieneHistory(next.history)
    next.history[tab] = imported.records
    await persistHistoryData(next)
    d.value[tab] = resolveHygieneSection(storedData.value, tab, selectedDates.value[tab]).section
    alert('匯入完成。')
  } catch (error) { alert(`匯入失敗：${error.message}`) } finally { isSaving.value = false }
}

const addOutArea = () => {
  if (!d.value.morning.out_dynamic_areas) d.value.morning.out_dynamic_areas = [];
  d.value.morning.out_dynamic_areas.push({ area: '', names: '', work: '' });
}

const removeOutArea = (idx) => {
  d.value.morning.out_dynamic_areas.splice(idx, 1);
  if (d.value.morning.out_dynamic_areas.length === 0) {
    d.value.morning.out_dynamic_areas.push({ area: '', names: '', work: '' });
  }
}

const toggleEditMode = () => { isEditing.value = !isEditing.value }

const saveData = async () => {
  const invalidTab = ['morning', 'lunch', 'squad'].find(tab => {
    const report = hygieneAssignmentReport(d.value, tab, studentSeatNumbers.value)
    return report.invalid.length || (studentSeatsLoaded.value && report.unknown.length)
  })
  if (invalidTab) {
    activeTab.value = invalidTab
    alert('請先修正此分頁的非座號文字或非本班座號，再儲存。')
    return
  }
  isSaving.value = true
  try {
    const next = JSON.parse(JSON.stringify(storedData.value))
    next.isVisibleOnIndex = d.value.isVisibleOnIndex
    next.nameFontSize = d.value.nameFontSize
    for (const tab of hygieneTabs) {
      if (hasUnsavedSection(tab)) next.history = setHygieneRecord(next.history, tab, selectedDates.value[tab], d.value[tab])
    }
    await persistHistoryData(next)
    for (const tab of hygieneTabs) d.value[tab] = resolveHygieneSection(storedData.value, tab, selectedDates.value[tab]).section
    alert('✅ 衛生管理設定已成功儲存！')
    isEditing.value = false
  } catch (error) { alert('❌ 儲存失敗') } finally { isSaving.value = false }
}

const triggerPrint = () => {
  if (isEditing.value) {
    alert('💡 請先點擊右上角「👁️ 切換預覽模式」退出編輯，再產生 PDF 會有最完美的排版喔！')
    return
  }
  setTimeout(() => {
    window.print()
  }, 300)
}

const generateWord = () => {
  if (isEditing.value) {
    alert('💡 請先點擊右上角「👁️ 切換預覽模式」退出編輯，再產生 Word 會有最完美的排版喔！')
    return
  }
  
  let targetCardId = ''
  let title = '衛生管理表'
  
  if (activeTab.value === 'morning') {
    targetCardId = 'morning-card'
    title = '早上掃地分配表'
  } else if (activeTab.value === 'lunch') {
    targetCardId = 'lunch-card'
    title = '中午搬餐輪值表'
  } else if (activeTab.value === 'squad') {
    targetCardId = 'squad-card'
    title = '小隊工作管理表'
  }

  const activeCard = document.getElementById(targetCardId)
  if (!activeCard) return
  
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = activeCard.innerHTML
  
  const screenOnlyElements = tempDiv.querySelectorAll('.screen-only')
  screenOnlyElements.forEach(el => el.remove())

  const contentHtml = tempDiv.innerHTML

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:w="urn:schemas-microsoft-com:office:word" 
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page WordSection1 {
            size: 841.9pt 595.3pt; 
            mso-page-orientation: landscape;
            margin: 25.0pt 25.0pt 25.0pt 25.0pt; 
        }
        div.WordSection1 { page: WordSection1; }
        body { font-family: "微軟正黑體", "Microsoft JhengHei", sans-serif; }
        h3 { text-align: center; font-size: 16pt; margin-bottom: 8pt; }
        .sub-title { text-align: center; margin-bottom: 8pt; font-size: 10pt; color: #555; }
        table { width: 100%; border-collapse: collapse; text-align: center; margin-bottom: 8pt; }
        th, td { border: 1px solid #000; padding: 4px; vertical-align: middle; font-size: 9.5pt; }
        th { background-color: #f1f5f9; font-weight: bold; }
        .footer-note { margin-top: 8pt; font-size: 9.5pt; line-height: 1.3; }
        .text-sm { font-size: 9pt; }
        .text-xs { font-size: 8pt; color: #666; }
      </style>
    </head>
    <body>
      <div class="WordSection1">
        ${contentHtml}
      </div>
    </body>
    </html>
  `

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${title}.doc`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
</script>

<style>
.editable-textarea { width: 100%; height: 100%; min-height: 40px; border: 1px dashed #94a3b8; background: #fff; padding: 4px; font-family: inherit; font-size: inherit; resize: vertical; box-sizing: border-box; text-align: center; }
.editable-textarea:focus { border-color: #3b82f6; outline: none; background: #eff6ff; }
.readonly-text { padding: 4px; line-height: 1.4; word-break: break-word; }
.h-full { height: 100%; min-height: 80px; }
.w-full { width: 100%; box-sizing: border-box;}
</style>

<style scoped>
.hygiene-page { min-height: 100vh; background: #f8fafc; font-family: sans-serif; }
.login-container { display: flex; justify-content: center; align-items: center; min-height: 80vh; padding: 20px; }
.login-card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; }
.subtitle { color: #64748b; margin-bottom: 20px; }
.form-group { margin-bottom: 20px; text-align: left; }
.form-control { width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; }
.btn-submit { width: 100%; padding: 12px; background: #0891b2; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
.back-link { margin-top: 15px; }

.workspace { padding: 20px; max-width: 1200px; margin: 0 auto; }
.workspace-header { display: flex; justify-content: space-between; align-items: center; background: white; padding: 15px 25px; border-radius: 8px 8px 0 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); flex-wrap: wrap; gap: 15px; border-bottom: 1px solid #e2e8f0;}
.workspace-header h2 { margin: 0; color: #0891b2; }

.toggle-label { font-weight: bold; color: #0891b2; display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 5px 10px; border: 1px dashed #cbd5e1; border-radius: 6px; background: #f0fdfa;}
.toggle-label input { cursor: pointer; }

.header-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; align-items: center;}
.btn-edit { background: #e2e8f0; color: #334155; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; }
.btn-edit.editing { background: #f59e0b; color: white; }
.btn-save { background: #10b981; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; }
.btn-logout { background: #ef4444; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; }

.tabs-container { display: flex; background: white; padding: 10px 25px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); gap: 10px; margin-bottom: 20px; overflow-x: auto; white-space: nowrap;}
.tab-btn { padding: 8px 16px; border: none; background: transparent; color: #64748b; font-weight: bold; font-size: 1.05rem; cursor: pointer; border-bottom: 3px solid transparent; transition: 0.2s;}
.tab-btn:hover { color: #0891b2; }
.tab-btn.active { color: #0891b2; border-bottom-color: #0891b2; }

.tips { background: #fffbeb; color: #b45309; padding: 10px 15px; border-radius: 6px; border: 1px dashed #fcd34d; margin-bottom: 20px; font-size: 0.95rem; }
.history-panel { background: white; border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
.history-panel p { margin: 8px 0 14px; color: #475569; font-size: 0.9rem; }
.history-toolbar, .history-actions, .history-selection, .calendar-header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.history-toolbar { justify-content: space-between; }
.history-actions button, .history-selection button, .calendar-header button { padding: 6px 10px; border: 1px solid #0891b2; border-radius: 6px; background: #ecfeff; color: #0e7490; font-weight: 700; cursor: pointer; }
.calendar-header { justify-content: center; margin-bottom: 8px; }
.calendar-header button { min-width: 36px; font-size: 1.2rem; }
.history-calendar { max-width: 560px; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; margin: 0 auto 12px; }
.history-calendar button, .calendar-weekday { min-height: 35px; text-align: center; }
.history-calendar button { position: relative; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #334155; cursor: pointer; }
.history-calendar button.outside-month { color: #94a3b8; }
.history-calendar button.recorded { border-color: #0e7490; background: #ecfeff; }
.history-calendar button.selected { background: #0891b2; color: white; }
.history-calendar button small { position: absolute; right: 3px; bottom: 1px; font-size: 0.55rem; }
.calendar-weekday { padding-top: 8px; font-weight: 700; color: #64748b; }
.history-selection { justify-content: center; }
.history-selection label { display: flex; align-items: center; gap: 6px; }
.history-selection input { padding: 5px; border: 1px solid #cbd5e1; border-radius: 5px; }
.history-selection .delete-history { color: #b91c1c; border-color: #fca5a5; background: #fef2f2; }
.assignment-report { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 12px 15px; margin-bottom: 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; color: #334155; }
.assignment-report strong { color: #0e7490; }
.report-warning { color: #b91c1c; font-weight: 700; }
.report-ok { color: #166534; font-weight: 700; }

/* 💡 字體大小控制器樣式 */
.font-settings { background: #f0f9ff; border: 1px dashed #bae6fd; padding: 10px 15px; border-radius: 6px; margin-bottom: 15px; display: inline-flex; align-items: center; gap: 10px; color: #0284c7; font-weight: bold; }
.font-input { width: 70px; padding: 5px; border: 1px solid #7dd3fc; border-radius: 4px; text-align: center; font-weight: bold; color: #0369a1; }

.btn-add-row { background: #e0f2fe; color: #0284c7; border: 1px dashed #7dd3fc; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; }
.btn-add-row:hover { background: #bae6fd; }
.btn-delete-row { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; border-radius: 6px; padding: 6px 10px; cursor: pointer; transition: 0.2s; font-size: 0.9rem;}
.btn-delete-row:hover { background: #fecaca; }

.print-actions { display: flex; justify-content: flex-end; gap: 12px; margin-bottom: 15px; }
.btn-print { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.btn-print:hover { background: #2563eb; }
.btn-word { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.btn-word:hover { background: #1d4ed8; }

.table-card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow-x: auto; }
.editable-title { text-align: center; margin-bottom: 20px; }
.editable-title h3 { margin: 0; font-size: 1.5rem; letter-spacing: 1px; color: #1e293b;}
.title-input { width: 100%; font-size: 1.5rem; text-align: center; font-weight: bold; border: 1px dashed #cbd5e1; padding: 5px; }
.sub-title { text-align: center; margin-bottom: 15px; color: #475569; font-size: 0.95rem;}

.custom-table { width: 100%; border-collapse: collapse; min-width: 800px; text-align: center; font-size: 0.95rem; }
.custom-table th, .custom-table td { border: 1px solid #000; padding: 8px; vertical-align: middle; }
.custom-table th { background-color: #f1f5f9; font-weight: bold; }
.header-row th { background-color: #e2e8f0; }

.morning-table td:nth-child(1), .morning-table td:nth-child(2) { font-weight: bold; }
.lunch-table th { background: transparent; font-weight: bold;}
.lunch-table td { background: transparent; }

.footer-note { margin-top: 15px; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; color: #334155; line-height: 1.6;}
.mt-10 { margin-top: 10px; }
.mt-15 { margin-top: 15px; }
.text-sm { font-size: 0.9rem; }
.text-xs { font-size: 0.75rem; color: #64748b; font-weight: normal;}

@media (max-width: 768px) {
  .workspace-header { flex-direction: column; text-align: center;}
  .header-actions { flex-direction: column; width: 100%;}
  .header-actions button, .toggle-label { width: 100%; justify-content: center;}
}

@media screen {
  .print-only { display: none !important; }
}

@media print {
  @page { size: A4 landscape; margin: 15mm; } 
  
  .screen-only, .login-container, .workspace-header, .tabs-container, .tips { display: none !important; }
  
  .hygiene-page, .workspace, .table-card { 
    background: white !important; 
    padding: 0 !important; 
    margin: 0 !important; 
    box-shadow: none !important; 
    border: none !important; 
    max-width: 100% !important;
  }
  
  .custom-table { width: 100% !important; page-break-inside: auto; min-width: auto !important;}
  tr { page-break-inside: avoid; page-break-after: auto; }
  th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .header-row th { background-color: #e2e8f0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  
  .footer-note { background: transparent !important; border: none !important; padding: 10px 0 0 0 !important; }
}
</style>
