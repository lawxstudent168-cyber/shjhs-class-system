<template>
  <div class="admin-board-container">
    <div class="table-header print-hide"><h3>📢 家長須知管理中心</h3></div>

    <div class="visibility-control-box print-hide">
      <label class="toggle-label">
        <input type="checkbox" v-model="isVisibleOnIndex" @change="toggleVisibility" />
        ✅ 允許在首頁顯示「家長須知事項」區塊 (前台已設定為僅限學校 IP 外可見)
      </label>
      <span v-if="isSavingVis" class="saving-text">⏳ 狀態儲存中...</span>
    </div>

    <div class="board-editor-container print-hide">
      <div class="view-tabs">
        <button :class="['tab-btn', { active: activeTab === 'manage' }]" @click="activeTab = 'manage'">📝 發布與管理</button>
        <button :class="['tab-btn', { active: activeTab === 'email' }]" @click="activeTab = 'email'">📧 信件推播設定</button>
        <button :class="['tab-btn', { active: activeTab === 'print' }]" @click="activeTab = 'print'">🖨️ 紙本列印設定</button>
        <button :class="['tab-btn', { active: activeTab === 'history' }]" @click="activeTab = 'history'">📅 歷史紀錄查詢</button>
      </div>

      <!-- ==================== 發布與管理 ==================== -->
      <div v-show="activeTab === 'manage'">
        <div class="editor-panel">
          <h4 class="section-title">
            {{ editingNoticeId ? '✏️ 編輯須知事項' : '📝 新增須知事項' }} (支援保留網頁格式)
          </h4>
          <p class="help-text">您可以直接複製網頁內容並貼上，系統會保留排版。若設定日期，首頁將於區間內自動顯示。</p>
          
          <div class="edit-item rich-text-item" style="margin-bottom: 10px;">
            <span class="bullet">📌</span>
            <div 
              class="edit-input notice-input rich-text-editor" 
              contenteditable="true"
              @blur="updateNewNoticeRichText"
              @input="updateNewNoticeRichText"
              ref="newNoticeEditorRef"
              placeholder="在此貼上或輸入須知內容..."
            ></div>
          </div>
          
          <div class="links-container">
            <label class="links-title">🔗 附加網址連結 (選填)：</label>
            <div v-for="(link, idx) in newNotice.links" :key="idx" class="link-row">
              <input type="text" v-model="link.title" placeholder="連結標題 (如: 報名表單)" class="custom-input flex-1" />
              <input type="url" v-model="link.url" placeholder="https://..." class="custom-input flex-2" />
              <button @click="removeLink(idx)" class="del-row-btn" title="移除此連結">✖</button>
            </div>
            <button @click="addLink" class="btn-outline-primary" style="margin-top: 10px;">➕ 新增一筆網址連結</button>
          </div>
          
          <div class="date-row">
            <div class="date-group">
              <label>起始日期：</label>
              <input type="date" v-model="newNotice.startDate" class="form-control date-input" />
            </div>
            <div class="date-group">
              <label>結束日期 (選填)：</label>
              <input type="date" v-model="newNotice.endDate" class="form-control date-input" />
              <span class="hint">留空代表永久顯示，直到手動刪除</span>
            </div>
            
            <div class="date-group" style="justify-content: flex-end; padding-bottom: 10px;">
              <label class="toggle-label" style="font-size: 1rem; color: #475569;">
                <input type="checkbox" v-model="newNotice.isHidden" />
                👀 暫存/隱藏 (不在首頁與信件顯示)
              </label>
            </div>

            <div class="form-actions">
              <button v-if="editingNoticeId" @click="cancelEditNotice" class="cancel-btn auto-width-btn">取消編輯</button>
              <button @click="addNotice" class="add-btn auto-width-btn" :disabled="!newNotice.content || isSaving">
                {{ isSaving ? '處理中...' : (editingNoticeId ? '💾 儲存修改' : '➕ 儲存並發布須知') }}
              </button>
            </div>
          </div>
        </div>

        <div class="notices-list-section" style="margin-top: 30px;">
          <div class="list-header-flex">
            <h4 class="section-title" style="border:none; margin:0; padding:0;">📋 目前已建立的須知清單</h4>
            <div class="io-actions">
              <button @click="exportJSON" class="io-btn export-btn">📤 匯出 JSON</button>
              <label class="io-btn import-btn">
                📥 匯入 JSON
                <input type="file" accept=".json" style="display:none" @change="importJSON" />
              </label>
            </div>
          </div>
          
          <div v-if="isLoading" class="empty-state">⏳ 載入中...</div>
          <div v-else-if="notices.length === 0" class="empty-state">目前尚無任何須知事項。</div>
          
          <div v-for="notice in notices" :key="notice.id" class="notice-item" :class="{ 'is-editing-highlight': editingNoticeId === notice.id, 'is-hidden-item': notice.isHidden }">
            <div class="notice-content">
              <div class="notice-text" v-html="notice.content"></div>
              
              <div v-if="notice.links && notice.links.length > 0" class="notice-links-display">
                <a v-for="(link, idx) in notice.links" :key="idx" :href="link.url" target="_blank" class="notice-link-item">
                  🔗 {{ link.title || '參考連結' }}
                </a>
              </div>

              <div class="notice-dates">
                🗓️ 刊登期間：
                <span class="highlight">{{ notice.startDate || '未設定' }}</span> 至 <span class="highlight">{{ notice.endDate || '永久' }}</span>
                <span v-if="notice.isHidden" class="hidden-tag"> (已隱藏/暫存)</span>
                <span v-else-if="!isActiveToday(notice.startDate, notice.endDate)" class="expired-tag"> (今日未生效)</span>
                <span v-else class="active-tag"> (今日生效中)</span>
              </div>
            </div>
            <div class="item-actions">
              <button @click="toggleNoticeHidden(notice)" class="btn-outline-primary" style="padding: 10px 15px; font-size:0.95rem;">
                {{ notice.isHidden ? '👁️ 設為顯示' : '🙈 設為隱藏' }}
              </button>
              <button @click="editNotice(notice)" class="btn-edit" :disabled="isSaving">✏️ 編輯</button>
              <button @click="deleteNotice(notice.id)" class="del-row-btn" :disabled="isSaving">🗑️ 刪除</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== 📧 信件推播設定 ==================== -->
      <div v-show="activeTab === 'email'" class="email-editor-section">
        
        <div class="editor-header">
          <h4>📧 編輯信件範本</h4>
          <button @click="saveNoticeEmailTemplate" class="save-template-btn small-btn" :disabled="isSavingNoticeTemplate">
            {{ isSavingNoticeTemplate ? '儲存中...' : '💾 存為範本' }}
          </button>
        </div>
        <p class="help-text">
          為降低被判定為垃圾郵件的機率，系統會強制以「純文字」格式發送。信件中的網址會被多數信箱自動轉換為可點擊的超連結。<br>
          <span style="color:#b91c1c;">建議：若信件仍進入垃圾桶，請在家長群組提醒將導師信箱加入通訊錄。</span>
        </p>
        
        <div class="form-group">
          <label>信件主旨：</label>
          <input type="text" v-model="noticeEmailSubjectTemplate" class="edit-input" />
        </div>
        <div class="form-group">
          <label>信件內容：(變數: <span v-pre>{{須知清單}}</span>)</label>
          <textarea v-model="noticeEmailContentTemplate" rows="6" class="edit-input textarea-input"></textarea>
        </div>
        
        <div class="email-preview-section">
          <h5>👀 純文字信件預覽 (家長實際看到的模樣)</h5>
          <div class="preview-box plain-text-preview">
            <div class="preview-subject"><strong>主旨：</strong> {{ noticePreviewSubject }}</div>
            <div class="preview-body">{{ noticePreviewContent }}</div>
          </div>
        </div>

        <hr class="cork-divider" style="margin: 30px 0;">

        <div class="recipient-selector-section">
          <div class="editor-header" style="border:none;">
            <h4>👥 選擇推播對象</h4>
            <div class="select-all-actions">
              <button @click="selectAllRecipients(true)" class="btn-outline">✅ 全選</button>
              <button @click="selectAllRecipients(false)" class="btn-outline">❌ 全不選</button>
            </div>
          </div>
          
          <div v-if="isLoadingEmails" class="loading-state" style="padding: 20px;">⏳ 正在載入聯絡人名單...</div>
          <div v-else-if="availableRecipients.length === 0" class="empty-state" style="padding: 20px;">資料庫中找不到任何帶有 Email 的家長或學生資料。</div>
          
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

        <div class="send-action-bar">
          <div class="send-summary">
            即將發送給 <strong>{{ selectedRecipientsCount }}</strong> 個信箱
          </div>
          <button @click="sendNoticeEmail" class="email-btn late-btn" :disabled="isSendingEmail || selectedRecipientsCount === 0">
            {{ isSendingEmail ? '正在安全推播中...' : '📧 解鎖並執行推播' }}
          </button>
        </div>

      </div>

      <!-- ==================== 🖨️ 紙本列印設定 (加入 QR Code 功能) ==================== -->
      <div v-show="activeTab === 'print'" class="email-editor-section">
        <div class="editor-header">
          <h4>🖨️ 編輯紙本列印範本</h4>
          <button @click="savePrintTemplate" class="save-template-btn small-btn" :disabled="isSavingPrintTemplate">
            {{ isSavingPrintTemplate ? '儲存中...' : '💾 存為列印範本' }}
          </button>
        </div>
        <p class="help-text">以一張 A4 紙輸出左右兩份相同須知單，沿中央裁切。紙本內容中的網址會自動改成下方的 QR code，網址本身不會印出。</p>
        
        <div class="form-group">
          <label>紙本須知單內容：(變數: <span v-pre>{{須知清單}}</span>、<span v-pre>{{今日日期}}</span>)</label>
          <textarea v-model="printContentTemplate" rows="8" class="edit-input textarea-input"></textarea>
        </div>

        <div class="form-group">
          <label style="color:#0284c7;">🔗 從今日須知與紙本範本自動找到的網址：</label>
          <p v-if="!autoPrintQrSources.length" class="hint">目前沒有網址；有網址時會自動產生 QR code。</p>
          <div v-for="source in autoPrintQrSources" :key="source.url" class="auto-qr-row">
            <input v-model="printAutoQrNames[source.url]" type="text" class="custom-input" :placeholder="source.suggestedName || '輸入印在 QR code 下方的名稱'" />
            <span class="auto-qr-url">{{ source.url }}</span>
          </div>
          <span class="hint">只需填寫或修改名稱；須知的附加連結也會自動轉換。</span>
        </div>

        <div class="form-group">
          <label style="color:#0284c7;">➕ 自行附加其他 QR code（選填，最多 8 個）：</label>
          <div v-for="(qr, index) in printQrCodes" :key="index" class="link-row">
            <input v-model="qr.name" type="text" class="custom-input flex-1" placeholder="QR code 名稱（印在下方）" />
            <input v-model="qr.url" type="url" class="custom-input flex-2" placeholder="https://..." />
            <button type="button" class="del-row-btn" @click="printQrCodes.splice(index, 1)">✖</button>
          </div>
          <button type="button" class="btn-outline-primary" :disabled="printQrCodes.length >= 8" @click="printQrCodes.push({ name: '', url: '' })">➕ 新增 QR code</button>
          <span class="hint">按「存為列印範本」可暫存文字、網址名稱及自行附加的 QR code；不會改動網頁或信件內容。</span>
        </div>
        
        <div class="email-preview-section">
          <h5>👀 紙本內容預覽（PDF 將左右各印一份）</h5>
          <div class="preview-box plain-text-preview print-preview-slip">
            <div class="print-preview-text">{{ printPreviewText }}</div>
            <div v-if="printQrPreview.length" class="print-qr-list">
              <div v-for="qr in printQrPreview" :key="qr.url" class="print-qr-item">
                <img :src="qr.image" :alt="qr.name" />
                <span>{{ qr.name }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="send-action-bar">
          <button @click="triggerPrint" class="email-btn print-btn" :disabled="isPreparingPrint">
            {{ isPreparingPrint ? '正在產生 QR code...' : '📄 開啟單頁列印 / 匯出 PDF' }}
          </button>
        </div>
      </div>

      <!-- ==================== 歷史紀錄查詢 ==================== -->
      <div v-show="activeTab === 'history'" class="history-calendar-container">
        <h4 class="section-title">📅 歷史須知紀錄查詢與編輯</h4>
        <div class="query-box">
          <div class="query-header">
            <label>選擇查詢日期：</label>
            <input type="date" v-model="historyDate" @change="fetchHistory" class="form-control date-picker" />
          </div>
        </div>

        <div class="history-results">
          <div v-if="isHistoryLoading" class="loading-state">⏳ 紀錄搜尋中...</div>
          <div v-else>
            
            <div class="detail-header-flex">
              <h5 class="history-date-title">🗓️ {{ historyDate }} 曾刊登的須知：</h5>
              <button v-if="!isEditingHistory" @click="startEditHistory" class="btn-edit">✏️ 編輯歷史</button>
            </div>
            
            <div v-if="!isEditingHistory">
              <div v-if="historicalNotices.length === 0" class="empty-state">這一天沒有任何生效的家長須知。</div>
              <div v-else class="history-list">
                <div v-for="(hist, index) in historicalNotices" :key="'h-'+index" class="history-item">
                  <span class="bullet">📌</span>
                  <div class="history-text" v-html="hist"></div>
                </div>
              </div>
            </div>

            <div v-else class="history-edit-mode">
              <p class="help-text">修改此處內容將會儲存為該日期的「歷史快照」，不會影響到現正刊登中的發布設定。</p>
              <div class="notice-edit-list">
                <div v-for="(n, i) in editHistoryNotices" :key="'ehn-'+i" class="edit-item rich-text-item" style="margin-bottom:10px;">
                  <span class="bullet">📌</span>
                  <div 
                    class="edit-input notice-input rich-text-editor" 
                    contenteditable="true"
                    @blur="updateEditHistoryRichText($event, i)"
                    @input="updateEditHistoryRichText($event, i)"
                    v-html="n"
                  ></div>
                  <button @click="removeHistoryNotice(i)" class="del-row-btn">🗑️</button>
                </div>
                <button @click="addHistoryNotice" class="add-btn" style="width: 100%;">➕ 新增歷史紀錄</button>
              </div>
              <div class="edit-actions-row">
                <button @click="cancelEditHistory" class="cancel-btn">取消</button>
                <button @click="saveHistory" class="save-btn" :disabled="isSavingHistory">
                  {{ isSavingHistory ? '儲存中...' : '💾 儲存歷史快照' }}
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
import { ref, computed, onMounted, watch } from 'vue'
import { removePrintUrls, escapePrintHtml, normalizePrintQrCodes, isPrintQrUrl, collectPrintQrSources } from '../utils/noticePrint.js'
const supabase = useSupabaseClient()

const activeTab = ref('manage')
const isLoading = ref(true)
const isSaving = ref(false)

const isVisibleOnIndex = ref(true)
const isSavingVis = ref(false)

const d = new Date()
const todayISO = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const todayDisplay = d.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

const notices = ref([])
const editingNoticeId = ref(null)
const newNoticeEditorRef = ref(null)

const newNotice = ref({ content: '', startDate: todayISO, endDate: '', isHidden: false, links: [] })

const isSendingEmail = ref(false)
const isSavingNoticeTemplate = ref(false)
const noticeEmailSubjectTemplate = ref('📢 班級須知推播 ({{今日日期}})')
const noticeEmailContentTemplate = ref(`各位家長您好，今日班級重要須知推播如下：\n\n{{須知清單}}\n\n(若此信件進入垃圾郵件，請將導師信箱加入通訊錄或標示為非垃圾郵件)\n\n班級導師 敬上`)

const isSavingPrintTemplate = ref(false)
const printContentTemplate = ref(`【家長聯絡事項單】\n發布日期：{{今日日期}}\n\n親愛的家長您好，今日班級重要須知如下：\n\n{{須知清單}}\n\n煩請您詳閱並於下方簽名，讓孩子明日繳回，感謝您的配合！\n\n家長簽名：_________________________`)
const printQrCodes = ref([])
const printAutoQrNames = ref({})
const printQrPreview = ref([])
const isPreparingPrint = ref(false)

const availableRecipients = ref([])
const isLoadingEmails = ref(true)

const historyDate = ref(todayISO)
const isHistoryLoading = ref(false)
const historicalNotices = ref([])
const isEditingHistory = ref(false)
const isSavingHistory = ref(false)
const editHistoryNotices = ref([])

const updateNewNoticeRichText = (event) => { newNotice.value.content = event.target.innerHTML }
const updateEditHistoryRichText = (event, index) => { editHistoryNotices.value[index] = event.target.innerHTML }

const addLink = () => {
  if (!newNotice.value.links) newNotice.value.links = []
  newNotice.value.links.push({ title: '', url: '' })
}
const removeLink = (idx) => {
  newNotice.value.links.splice(idx, 1)
}

const fetchData = async () => {
  isLoading.value = true
  
  const { data: boardData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'parent_notices_data').maybeSingle()
  if (boardData?.setting_value) { 
    notices.value = (boardData.setting_value || []).sort((a, b) => Number(a.id) - Number(b.id))
  }
  
  const { data: tmplData } = await supabase.from('email_templates').select('*').eq('template_id', 'notice_board').maybeSingle()
  if (tmplData) { 
    noticeEmailSubjectTemplate.value = tmplData.subject
    noticeEmailContentTemplate.value = tmplData.content.replace(/<br\s*\/?>/ig, '\n').replace(/<[^>]+>/g, '') 
  }

  const { data: printTmplData } = await supabase.from('email_templates').select('*').eq('template_id', 'notice_print_template').maybeSingle()
  if (printTmplData) {
    printContentTemplate.value = printTmplData.content.replace(/<br\s*\/?>/ig, '\n').replace(/<[^>]+>/g, '') 
  }

  const { data: sysData } = await supabase.from('system_settings').select('*').in('setting_key', ['parent_notices_board_visible', 'print_qr_url', 'print_qr_codes', 'print_auto_qr_names'])
  if (sysData && sysData.length > 0) {
    const settings = Object.fromEntries(sysData.map(s => [s.setting_key, s.setting_value]))
    printQrCodes.value = normalizePrintQrCodes(settings.print_qr_codes, settings.print_qr_url)
    printAutoQrNames.value = settings.print_auto_qr_names && typeof settings.print_auto_qr_names === 'object' && !Array.isArray(settings.print_auto_qr_names)
      ? settings.print_auto_qr_names : {}
    sysData.forEach(s => {
      if (s.setting_key === 'parent_notices_board_visible') isVisibleOnIndex.value = s.setting_value
    })
  }

  isLoading.value = false
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
          rawList.push({ email: p.email, name: `${sNum}${sName} 的家長`, role: p.relationship || '家長', selected: true }) 
        }
      })
    }

    const { data: students } = await supabase.from('students').select('seat_number, real_name, email, parent_email, parent_mail, guardian_email')
    if (students) {
      students.forEach(s => {
        const sEmail = s.parent_email || s.parent_mail || s.email || s.guardian_email
        if (sEmail && String(sEmail).includes('@')) {
          rawList.push({ email: sEmail, name: `${s.seat_number}號 ${s.real_name}`, role: '學生(或備用信箱)', selected: false }) 
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
    
  } catch (err) {
    console.error("載入聯絡人失敗", err)
  } finally {
    isLoadingEmails.value = false
  }
}

onMounted(async () => {
  await fetchData()
  await fetchHistory()
  await fetchRecipients() 
})

const selectAllRecipients = (val) => { availableRecipients.value.forEach(p => p.selected = val) }
const selectedRecipientsCount = computed(() => availableRecipients.value.filter(p => p.selected).length)

const toggleVisibility = async () => {
  isSavingVis.value = true
  try {
    await supabase.from('system_settings').upsert({
      setting_key: 'parent_notices_board_visible',
      setting_value: isVisibleOnIndex.value
    }, { onConflict: 'setting_key' })
  } catch (err) {
    alert('狀態更新失敗：' + err.message)
    isVisibleOnIndex.value = !isVisibleOnIndex.value 
  } finally {
    isSavingVis.value = false
  }
}

const isActiveToday = (startDate, endDate) => {
  const startOk = !startDate || startDate <= todayISO
  const endOk = !endDate || endDate >= todayISO
  return startOk && endOk
}

const stripHtmlToPlainText = (html) => {
  if (!html) return ''
  let res = html.replace(/<br\s*\/?>/ig, '\n')
  res = res.replace(/<\/p>/ig, '\n\n')
  res = res.replace(/<\/div>/ig, '\n')
  res = res.replace(/<li[^>]*>/ig, '- ')
  res = res.replace(/<\/li>/ig, '\n')
  res = res.replace(/<[^>]+>/g, '') 
  const txt = document.createElement("textarea")
  txt.innerHTML = res
  return txt.value.replace(/\n\s*\n/g, '\n\n').trim() 
}

const activeNoticesPlainText = computed(() => {
  const active = notices.value.filter(n => !n.isHidden && isActiveToday(n.startDate, n.endDate))
  if (active.length === 0) return '(今日尚無生效的須知事項)'
  
  return active.map((n, i) => {
    let plainText = `${i + 1}. ${stripHtmlToPlainText(n.content)}`;
    if (n.links && n.links.length > 0) {
      const formattedLinks = n.links
        .filter(l => l.url.trim() !== '')
        .map(l => `   🔗 ${l.title || '參考連結'}: ${l.url}`)
        .join('\n');
      plainText += `\n${formattedLinks}`;
    }
    return plainText;
  }).join('\n\n')
})

const noticePreviewSubject = computed(() => noticeEmailSubjectTemplate.value.replace(/{{今日日期}}/g, todayDisplay))
const noticePreviewContent = computed(() => noticeEmailContentTemplate.value.replace(/{{須知清單}}/g, activeNoticesPlainText.value))

const activeNoticesPrintText = computed(() => {
  const active = notices.value.filter(n => !n.isHidden && isActiveToday(n.startDate, n.endDate))
  if (!active.length) return '(今日尚無生效的須知事項)'
  return active.map((notice, index) => `${index + 1}. ${removePrintUrls(stripHtmlToPlainText(notice.content))}`)
    .filter(Boolean).join('\n\n')
})

const printPreviewText = computed(() => removePrintUrls(printContentTemplate.value
    .replace(/{{今日日期}}/g, todayDisplay)
    .replace(/{{須知清單}}/g, activeNoticesPrintText.value)))

const autoPrintQrSources = computed(() => collectPrintQrSources(
  notices.value.filter(n => !n.isHidden && isActiveToday(n.startDate, n.endDate)),
  printContentTemplate.value
))
const allPrintQrEntries = computed(() => {
  const manualNames = new Map(printQrCodes.value.map(qr => [String(qr.url || '').trim(), String(qr.name || '').trim()]))
  const entries = autoPrintQrSources.value.map(source => ({
    url: source.url,
    name: String(printAutoQrNames.value[source.url] || source.suggestedName || manualNames.get(source.url) || new URL(source.url).hostname).trim()
  }))
  const seen = new Set(entries.map(entry => entry.url))
  for (const qr of printQrCodes.value) {
    const url = String(qr.url || '').trim()
    if (!qr.name?.trim() || !isPrintQrUrl(url) || seen.has(url)) continue
    entries.push({ name: qr.name.trim(), url })
    seen.add(url)
  }
  return entries
})

let qrPreviewRevision = 0
const generateQrPreview = async () => {
  const revision = ++qrPreviewRevision
  const valid = allPrintQrEntries.value
  if (!valid.length) { printQrPreview.value = []; return }
  const { default: QRCode } = await import('qrcode')
  const generated = await Promise.all(valid.map(async qr => ({
    name: qr.name.trim(), url: qr.url.trim(),
    image: await QRCode.toDataURL(qr.url.trim(), { width: 180, margin: 1 })
  })))
  if (revision === qrPreviewRevision) printQrPreview.value = generated
}
watch(allPrintQrEntries, () => { generateQrPreview().catch(error => console.error('無法產生 QR code', error)) }, { deep: true })

const editNotice = (notice) => {
  editingNoticeId.value = notice.id
  newNotice.value = { ...notice }
  if (newNotice.value.isHidden === undefined) newNotice.value.isHidden = false 
  newNotice.value.links = notice.links ? JSON.parse(JSON.stringify(notice.links)) : []
  if (newNoticeEditorRef.value) newNoticeEditorRef.value.innerHTML = notice.content
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const cancelEditNotice = () => {
  editingNoticeId.value = null
  newNotice.value = { content: '', startDate: todayISO, endDate: '', isHidden: false, links: [] }
  if (newNoticeEditorRef.value) newNoticeEditorRef.value.innerHTML = ''
}

const toggleNoticeHidden = async (notice) => {
  isSaving.value = true
  try {
    const updatedNotices = notices.value.map(n => {
      if (n.id === notice.id) return { ...n, isHidden: !n.isHidden }
      return n
    })
    const { error } = await supabase.from('system_settings').upsert({ setting_key: 'parent_notices_data', setting_value: updatedNotices }, { onConflict: 'setting_key' })
    if (error) throw error
    notices.value = updatedNotices
  } catch (err) {
    alert('❌ 狀態切換失敗：' + err.message)
  } finally {
    isSaving.value = false
  }
}

const addNotice = async () => {
  if (!newNotice.value.content) return
  isSaving.value = true
  
  const validLinks = (newNotice.value.links || []).filter(l => l.url.trim() !== '')

  let updatedNotices = [...notices.value]
  
  if (editingNoticeId.value) {
    const idx = updatedNotices.findIndex(n => n.id === editingNoticeId.value)
    if (idx !== -1) updatedNotices[idx] = { 
      ...newNotice.value, 
      id: editingNoticeId.value, 
      links: validLinks 
    }
  } else {
    updatedNotices.push({ 
      id: Date.now().toString(), 
      content: newNotice.value.content, 
      startDate: newNotice.value.startDate, 
      endDate: newNotice.value.endDate, 
      isHidden: newNotice.value.isHidden || false,
      links: validLinks
    })
  }
  
  updatedNotices.sort((a, b) => Number(a.id) - Number(b.id))
  
  try {
    const { error } = await supabase.from('system_settings').upsert({ setting_key: 'parent_notices_data', setting_value: updatedNotices }, { onConflict: 'setting_key' })
    if (error) throw error
    
    notices.value = updatedNotices
    cancelEditNotice()
    alert('✅ 須知已成功儲存發布！')
    await fetchHistory()
  } catch (err) { alert('❌ 儲存失敗：' + err.message) } finally { isSaving.value = false }
}

const deleteNotice = async (id) => {
  if (!confirm('確定要刪除這則須知嗎？')) return
  isSaving.value = true
  const updatedNotices = notices.value.filter(n => n.id !== id)
  try {
    await supabase.from('system_settings').upsert({ setting_key: 'parent_notices_data', setting_value: updatedNotices }, { onConflict: 'setting_key' })
    notices.value = updatedNotices
    if (editingNoticeId.value === id) cancelEditNotice()
    await fetchHistory()
  } catch (err) { alert('❌ 刪除失敗：' + err.message) } finally { isSaving.value = false }
}

const sendNoticeEmail = async () => {
  const targetEmails = availableRecipients.value.filter(p => p.selected).map(p => p.email)
  
  if (targetEmails.length === 0) {
    return alert('❌ 請至少選擇一個收件人！')
  }

  isSendingEmail.value = true
  try {
    const { data: pwdData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'admin_password').maybeSingle()
    let expectedPwd = '168168168'
    if (pwdData?.setting_value) {
      if (pwdData.setting_value.type === 'dynamic') {
        const yy = String(d.getFullYear()).slice(2); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0')
        expectedPwd = `${yy}${mm}${dd}59`
      } else { expectedPwd = pwdData.setting_value.custom_pwd }
    }
    const inputPwd = prompt(`🔒 準備發送給 ${targetEmails.length} 個信箱。\n請輸入導師密碼確認：`)
    if (inputPwd !== expectedPwd && inputPwd !== '168168168') {
      isSendingEmail.value = false; return alert('❌ 密碼錯誤，發送取消！')
    }

    await fetch('/api/send-email', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ 
        bcc: targetEmails, 
        subject: noticePreviewSubject.value, 
        content: noticePreviewContent.value 
      }) 
    })
    
    await supabase.from('communication_logs').insert({ 
      student_id: null, 
      notification_type: '須知推播', 
      sent_by: '導師', 
      recipient_emails: `選定的 ${targetEmails.length} 個信箱`, 
      message_content: noticePreviewContent.value 
    })
    
    alert(`✅ 已成功推播至 ${targetEmails.length} 個家長/學生信箱！`)
  } catch(e) { 
    alert("❌ 推播失敗: " + e.message) 
  } finally { 
    isSendingEmail.value = false 
  }
}

const saveNoticeEmailTemplate = async () => {
  isSavingNoticeTemplate.value = true
  const safeHtmlContent = noticeEmailContentTemplate.value.replace(/\n/g, '<br>')
  await supabase.from('email_templates').upsert({ template_id: 'notice_board', subject: noticeEmailSubjectTemplate.value, content: safeHtmlContent })
  alert('✅ 推播信件範本已儲存！')
  isSavingNoticeTemplate.value = false
}

const savePrintTemplate = async () => {
  const entries = printQrCodes.value.filter(qr => qr.name.trim() || qr.url.trim())
  if (entries.length > 8 || entries.some(qr => !qr.name.trim() || !isPrintQrUrl(qr.url))) {
    alert('請為每個 QR code 填寫名稱與有效的 http/https 網址（最多 8 個）。')
    return
  }
  isSavingPrintTemplate.value = true
  try {
    const { error: templateError } = await supabase.from('email_templates').upsert({
      template_id: 'notice_print_template', subject: '紙本列印範本',
      content: printContentTemplate.value.replace(/\n/g, '<br>')
    })
    if (templateError) throw templateError
    const names = Object.fromEntries(Object.entries(printAutoQrNames.value)
      .filter(([, name]) => typeof name === 'string' && name.trim())
      .map(([url, name]) => [url, name.trim()]))
    const { error: qrError } = await supabase.from('system_settings').upsert([
      { setting_key: 'print_qr_codes', setting_value: entries.map(qr => ({ name: qr.name.trim(), url: qr.url.trim() })) },
      { setting_key: 'print_auto_qr_names', setting_value: names }
    ], { onConflict: 'setting_key' })
    if (qrError) throw qrError
    alert('✅ 紙本列印範本與 QR code 名稱已儲存！')
  } catch (error) {
    alert('❌ 紙本設定儲存失敗：' + error.message)
  } finally { isSavingPrintTemplate.value = false }
}

const triggerPrint = async () => {
  const entries = printQrCodes.value.filter(qr => qr.name.trim() || qr.url.trim())
  if (entries.length > 8 || entries.some(qr => !qr.name.trim() || !isPrintQrUrl(qr.url))) {
    alert('請先填妥每個 QR code 的名稱與有效網址，或移除未完成的項目。')
    return
  }
  const printWindow = window.open('', '_blank')
  if (!printWindow) { alert('瀏覽器封鎖了列印視窗，請允許此網站開啟新視窗。'); return }
  isPreparingPrint.value = true
  try {
    await generateQrPreview()
    const qrCount = printQrPreview.value.length
    const qrColumns = qrCount > 12 ? 4 : qrCount > 6 ? 3 : 2
    const qrSize = qrCount > 12 ? 14 : qrCount > 6 ? 17 : 20
    const qrMarkup = printQrPreview.value.map(qr => `<div class="qr-item"><img src="${qr.image}" alt=""><span>${escapePrintHtml(qr.name)}</span></div>`).join('')
    const slip = `<section class="slip"><div class="slip-text">${escapePrintHtml(printPreviewText.value)}</div><div class="qr-list">${qrMarkup}</div></section>`
    printWindow.document.open()
    printWindow.document.write(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>家長須知紙本</title><style>
      @page { size: A4 portrait; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 209.5mm; height: 296.5mm; font-family: "Microsoft JhengHei", "Noto Sans TC", sans-serif; color: #111; }
      .sheet { display: flex; width: 209.5mm; height: 296.5mm; overflow: hidden; }
      .slip { width: 104.75mm; height: 296.5mm; padding: 10mm 7mm; display: flex; flex-direction: column; overflow: hidden; }
      .slip:first-child { border-right: 1px dashed #888; }
      .slip-text { flex: 1; min-height: 0; white-space: pre-wrap; overflow-wrap: anywhere; overflow: hidden; font-size: 11pt; line-height: 1.45; }
      .qr-list { display: grid; grid-template-columns: repeat(${qrColumns}, minmax(0, 1fr)); gap: 3mm; flex: none; margin-top: 4mm; }
      .qr-list:empty { display: none; }
      .qr-item { min-width: 0; text-align: center; break-inside: avoid; }
      .qr-item img { display: block; width: ${qrSize}mm; height: ${qrSize}mm; margin: 0 auto; }
      .qr-item span { display: block; font-size: 8pt; overflow-wrap: anywhere; line-height: 1.2; }
    </style></head><body><main class="sheet">${slip}${slip}</main></body></html>`)
    printWindow.document.close()
    await Promise.all([...printWindow.document.images].map(image => image.decode().catch(() => {})))
    let fits = true
    for (const text of printWindow.document.querySelectorAll('.slip-text')) {
      let size = 11
      while (text.scrollHeight > text.clientHeight + 2 && size > 7) {
        size -= 0.5
        text.style.fontSize = `${size}pt`
      }
      if (text.scrollHeight > text.clientHeight + 2 || text.closest('.slip').scrollHeight > text.closest('.slip').clientHeight + 2) fits = false
    }
    if (!fits) { printWindow.alert('內容太長，無法在單頁完整顯示。請縮短紙本範本或須知內容後重試。'); return }
    printWindow.focus()
    printWindow.print()
  } catch (error) {
    printWindow.close()
    alert('無法產生紙本預覽：' + error.message)
  } finally { isPreparingPrint.value = false }
}

const fetchHistory = async () => {
  if (!historyDate.value) return
  isHistoryLoading.value = true
  historicalNotices.value = []
  try {
    const targetDate = historyDate.value
    let foundNotices = []
    
    const { data: contactData } = await supabase.from('contact_books').select('*').eq('record_date', targetDate).maybeSingle()
    if (contactData && contactData.notices && Array.isArray(contactData.notices)) {
      foundNotices = [...contactData.notices]
    }

    notices.value.forEach(n => {
      const startOk = !n.startDate || n.startDate <= targetDate
      const endOk = !n.endDate || n.endDate >= targetDate
      if (!n.isHidden && startOk && endOk && !foundNotices.includes(n.content)) {
        let histContent = n.content;
        if (n.links && n.links.length > 0) {
          const linksHtml = n.links.map(l => `<a href="${l.url}" target="_blank" style="color:#2563eb;font-weight:bold;">🔗 ${l.title || '參考連結'}</a>`).join('<br>');
          histContent += `<br><br>${linksHtml}`;
        }
        foundNotices.push(histContent)
      }
    })
    historicalNotices.value = foundNotices
  } finally { isHistoryLoading.value = false; isEditingHistory.value = false }
}

const startEditHistory = () => { editHistoryNotices.value = [...historicalNotices.value]; isEditingHistory.value = true }
const cancelEditHistory = () => { isEditingHistory.value = false }
const addHistoryNotice = () => editHistoryNotices.value.push('')
const removeHistoryNotice = (i) => editHistoryNotices.value.splice(i, 1)

const saveHistory = async () => {
  isSavingHistory.value = true
  try {
    await supabase.from('contact_books').upsert({ record_date: historyDate.value, notices: editHistoryNotices.value }, { onConflict: 'record_date' })
    alert('✅ 歷史紀錄已成功儲存！')
    historicalNotices.value = [...editHistoryNotices.value]
    isEditingHistory.value = false
  } catch (error) { alert('❌ 儲存失敗：' + error.message) } finally { isSavingHistory.value = false }
}

const exportJSON = () => {
  const dataStr = JSON.stringify(notices.value, null, 2)
  const blob = new Blob([dataStr], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `parent_notices_backup_${todayISO}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const importJSON = (event) => {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async (e) => {
    try {
      const imported = JSON.parse(e.target.result)
      if (!Array.isArray(imported)) throw new Error("無效的資料格式，必須是陣列")
      
      let merged = []
      if (confirm('是否要【完全覆蓋】現有清單？\n(按「確定」將覆蓋，按「取消」則附加在原有清單之後)')) {
        merged = imported
      } else {
        merged = [...notices.value, ...imported]
      }
      
      merged.sort((a, b) => Number(a.id) - Number(b.id))

      await supabase.from('system_settings').upsert({ setting_key: 'parent_notices_data', setting_value: merged }, { onConflict: 'setting_key' })
      notices.value = merged
      alert('✅ 匯入成功！')
      await fetchHistory()
    } catch(err) { alert('❌ 匯入失敗：' + err.message) }
    event.target.value = '' 
  }
  reader.readAsText(file)
}
</script>

<style scoped>
.admin-board-container { font-family: sans-serif; padding-bottom: 30px;}
.table-header { border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; } 
.table-header h3 { margin: 0; color: #334155; font-size: 1.4rem;}

.visibility-control-box { background: white; padding: 15px 25px; border-radius: 8px; border: 1px solid #cbd5e1; margin-bottom: 20px; display: flex; align-items: center; gap: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);}
.toggle-label { font-weight: bold; font-size: 1.1rem; color: #1e293b; cursor: pointer; display: flex; align-items: center; gap: 10px;}
.toggle-label input { transform: scale(1.3); cursor: pointer;}
.saving-text { color: #f59e0b; font-weight: bold; font-size: 0.95rem; }

.view-tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; flex-wrap: wrap;}
.tab-btn { background: transparent; border: none; padding: 10px 20px; font-size: 1.1rem; font-weight: bold; color: #64748b; cursor: pointer; border-radius: 8px 8px 0 0; transition: 0.2s;}
.tab-btn:hover { background: #f1f5f9; color: #3b82f6;}
.tab-btn.active { background: #eff6ff; color: #2563eb; border-bottom: 3px solid #3b82f6; }

.board-editor-container { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; }
.editor-panel { background: white; padding: 25px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }

.section-title { margin: 0 0 10px 0; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; font-size: 1.2rem; }
.help-text { font-size: 0.95rem; color: #64748b; margin-bottom: 15px; line-height: 1.5;}

.rich-text-item { display: flex; align-items: flex-start; gap: 10px; }
.rich-text-editor { flex: 1; min-height: 80px; height: auto; overflow-y: auto; padding: 12px; border: 1px solid #94a3b8; border-radius: 6px; background: #fdfdfd; line-height: 1.5; font-size: 1.05rem;}
.rich-text-editor:empty:before { content: attr(placeholder); color: #94a3b8; pointer-events: none; display: block; }
.rich-text-editor:focus { background: white; border-color: #3b82f6; outline: none; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1); }
.bullet { display: inline-block; margin-top: 10px; font-size: 1.2rem;}

.links-container { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px dashed #cbd5e1; }
.links-title { display: block; font-weight: bold; color: #475569; margin-bottom: 10px; font-size: 1rem; }
.link-row { display: flex; gap: 10px; margin-bottom: 10px; align-items: center; flex-wrap: wrap; }
.flex-1 { flex: 1; min-width: 150px; }
.flex-2 { flex: 2; min-width: 250px; }
.notice-links-display { display: flex; flex-direction: column; gap: 6px; margin-bottom: 15px; padding-left: 10px; border-left: 3px solid #bfdbfe; }
.notice-link-item { display: inline-flex; align-items: center; color: #2563eb; text-decoration: none; font-weight: bold; font-size: 1rem; padding: 4px 8px; background: #eff6ff; border-radius: 6px; width: fit-content; transition: 0.2s;}
.notice-link-item:hover { background: #dbeafe; text-decoration: underline; }

.date-row { display: flex; gap: 20px; align-items: flex-end; flex-wrap: wrap; margin-top: 20px; background: #f1f5f9; padding: 15px; border-radius: 8px; border: 1px dashed #cbd5e1;}
.date-group { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 200px; }
.date-group label { font-weight: bold; color: #475569; font-size: 1rem; }
.date-input { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; font-size: 1rem; margin-bottom: 0; cursor: pointer;}
.hint { font-size: 0.85rem; color: #94a3b8; margin-top: 2px;}

.form-actions { display: flex; gap: 10px; align-items: center;}
.add-btn { background: #10b981; color: white; border: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; font-size: 1.1rem; cursor: pointer; transition: 0.2s;}
.add-btn:hover:not(:disabled) { background: #059669; }
.add-btn:disabled { background: #9ca3af; cursor: not-allowed; }
.auto-width-btn { height: fit-content; white-space: nowrap;}
.cancel-btn { background: #64748b; color: white; border: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; cursor: pointer;}

.list-header-flex { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;}
.io-actions { display: flex; gap: 10px; }
.io-btn { padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 0.9rem; cursor: pointer; border: none; transition: 0.2s;}
.export-btn { background: #e0e7ff; color: #3730a3; border: 1px solid #a5b4fc;}
.export-btn:hover { background: #c7d2fe; }
.import-btn { background: #dcfce7; color: #166534; border: 1px solid #86efac; display: inline-block; }
.import-btn:hover { background: #bbf7d0; }

.notices-list-section { background: white; padding: 25px; border-radius: 8px; border: 1px solid #e2e8f0; }
.empty-state, .loading-state { text-align: center; padding: 30px; color: #94a3b8; font-style: italic; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;}

.notice-item { display: flex; justify-content: space-between; align-items: stretch; padding: 20px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 15px; transition: 0.2s; gap: 20px; flex-wrap: wrap;}
.notice-item:hover { border-color: #cbd5e1; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
.is-editing-highlight { border: 2px solid #3b82f6; background: #eff6ff; }
.is-hidden-item { opacity: 0.65; background-color: #f8fafc; border-style: dashed; }
.notice-content { flex: 1; min-width: 250px;}
.notice-text { color: #1e293b; font-size: 1.1rem; line-height: 1.6; margin-bottom: 15px; overflow-wrap: break-word;}
.notice-dates { font-size: 0.95rem; color: #64748b; background: #f1f5f9; padding: 8px 15px; border-radius: 6px; display: inline-block; font-weight: bold;}
.highlight { color: #3b82f6; }
.active-tag { color: #10b981; font-weight: bold;}
.expired-tag { color: #ef4444; font-weight: bold;}
.hidden-tag { color: #8b5cf6; font-weight: bold; }

.item-actions { display: flex; gap: 10px; flex-shrink: 0; align-items: flex-start;}
.btn-outline-primary { background: white; color: #3b82f6; border: 1px solid #93c5fd; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; padding: 8px 12px;}
.btn-outline-primary:hover { background: #eff6ff; }
.btn-edit { background: #eff6ff; color: #3b82f6; border: 1px solid #bfdbfe; padding: 10px 18px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 1rem;}
.btn-edit:hover { background: #dbeafe; }
.del-row-btn { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; font-size: 1rem;}
.del-row-btn:hover { background: #fecaca; }

.email-editor-section { background: white; padding: 25px; border-radius: 8px; border: 1px solid #e2e8f0; }
.editor-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;}
.editor-header h4 { margin: 0; font-size: 1.2rem; color: #1e293b; }
.save-template-btn.small-btn { padding: 8px 15px; font-size: 0.95rem; background: #10b981; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
.form-group { margin-bottom: 15px; } .form-group label { display: block; margin-bottom: 8px; font-weight: bold; color: #475569; font-size: 1rem; }
.edit-input { padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; width: 100%; font-size: 1.05rem;}
.textarea-input { resize: vertical; font-family: inherit; line-height: 1.5; }

.email-preview-section { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 15px; margin-top: 20px; }
.email-preview-section h5 { margin: 0 0 10px 0; color: #334155; font-size: 1.05rem;}
.plain-text-preview { background: #fefce8; padding: 20px; border-radius: 6px; border: 1px solid #fde047; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);}
.preview-subject { font-size: 1.05rem; color: #92400e; border-bottom: 1px dashed #fcd34d; padding-bottom: 10px; margin-bottom: 15px; font-weight: bold;}
.preview-body { font-size: 1.05rem; color: #451a03; line-height: 1.6; white-space: pre-wrap; font-family: monospace;}

.recipient-selector-section { margin-top: 20px; }
.select-all-actions { display: flex; gap: 10px; }
.btn-outline { background: white; border: 1px solid #cbd5e1; color: #475569; padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 0.9rem;}
.btn-outline:hover { background: #f1f5f9; }
.recipients-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; margin-top: 15px; max-height: 400px; overflow-y: auto; padding-right: 10px;}
.recipient-label { display: flex; align-items: center; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 15px; border-radius: 8px; cursor: pointer; transition: 0.2s; }
.recipient-label:hover { border-color: #94a3b8; }
.recipient-label.is-selected { background: #eff6ff; border-color: #3b82f6; }
.large-checkbox { transform: scale(1.3); cursor: pointer; }
.recipient-info { display: flex; flex-direction: column; gap: 2px; }
.r-name { font-weight: bold; color: #1e293b; font-size: 1.05rem;}
.r-role { font-size: 0.85rem; color: #64748b; }
.r-email { font-family: monospace; font-size: 0.9rem; color: #0284c7; }

.send-action-bar { margin-top: 30px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.send-summary { font-size: 1.1rem; color: #334155; }
.send-summary strong { color: #dc2626; font-size: 1.3rem; }
.email-btn { background: #f59e0b; color: white; border: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; cursor: pointer; width: 100%; max-width: 400px; font-size: 1.2rem; transition: 0.2s; text-align: center;}
.email-btn:hover:not(:disabled) { background: #d97706; }
.email-btn:disabled { background: #cbd5e1; cursor: not-allowed; }

.print-btn { background: #3b82f6; max-width: 500px; }
.print-btn:hover:not(:disabled) { background: #2563eb; }

.history-calendar-container { background: white; padding: 25px; border-radius: 8px; border: 1px solid #e2e8f0; }
.query-box { margin-bottom: 20px; background: #f1f5f9; padding: 20px; border-radius: 8px; border: 1px dashed #cbd5e1;}
.query-header { display: flex; align-items: center; gap: 15px; flex-wrap: wrap;}
.query-header label { font-weight: bold; color: #475569; font-size: 1.05rem;}
.date-picker { width: 220px; padding: 10px 15px; font-weight: bold; font-size: 1.1rem; color: #0f766e; margin-bottom: 0; cursor: pointer; border: 1px solid #cbd5e1; border-radius: 6px;}

.history-results { background: white; padding: 25px; border-radius: 8px; border: 1px solid #cbd5e1;}
.detail-header-flex { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px dashed #f1f5f9; padding-bottom: 10px; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;}
.history-date-title { color: #d97706; margin: 0; font-size: 1.2rem;}
.history-list { display: flex; flex-direction: column; gap: 15px; }
.history-item { display: flex; align-items: flex-start; gap: 12px; font-size: 1.1rem; line-height: 1.6; color: #1e293b; background: #fffbeb; padding: 15px 20px; border-radius: 8px; border-left: 5px solid #f59e0b;}

.edit-actions-row { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px dashed #cbd5e1;}
.save-btn { background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; }

.print-preview-slip { max-width: 450px; min-height: 420px; display: flex; flex-direction: column; background: white; color: #111; }
.auto-qr-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 10px; }
.auto-qr-row .custom-input { flex: 1; min-width: 180px; }
.auto-qr-url { flex: 2; min-width: 210px; overflow-wrap: anywhere; color: #475569; font-size: 0.85rem; }
.print-preview-text { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.45; flex: 1; }
.print-qr-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
.print-qr-item { min-width: 0; text-align: center; overflow-wrap: anywhere; font-size: 0.8rem; }
.print-qr-item img { display: block; width: 76px; height: 76px; margin: 0 auto 4px; }

@media (max-width: 768px) {
  .admin-board-container { padding-bottom: 20px; }
  .table-header h3 { font-size: 1.25rem; }
  .visibility-control-box { padding: 15px; flex-direction: column; align-items: flex-start; gap: 10px; }
  .view-tabs { flex-direction: column; gap: 8px; border-bottom: none; }
  .tab-btn { width: 100%; border-radius: 8px; padding: 12px; font-size: 1.05rem; border: 1px solid #cbd5e1; background: white; }
  .tab-btn.active { border: 2px solid #3b82f6; background: #eff6ff; }
  .board-editor-container { padding: 10px; border: none; background: transparent; }
  .editor-panel, .notices-list-section, .email-editor-section, .history-calendar-container { padding: 15px; }
  .date-row { flex-direction: column; align-items: stretch; gap: 12px; padding: 12px; }
  .date-group { min-width: 100%; }
  
  .link-row { flex-direction: column; align-items: stretch; }
  .del-row-btn { width: 100%; text-align: center; }

  .form-actions { display: flex; flex-direction: column; width: 100%; margin-top: 10px; gap: 10px;}
  .auto-width-btn { width: 100%; text-align: center; margin-top: 0; padding: 12px;}
  .cancel-btn { padding: 12px; }
  .list-header-flex { flex-direction: column; align-items: stretch; gap: 12px; }
  .io-actions { display: flex; width: 100%; gap: 10px; }
  .io-btn { flex: 1; text-align: center; padding: 10px; }
  .notice-item { flex-direction: column; padding: 15px; gap: 15px; }
  .notice-content { min-width: 100%; }
  .notice-dates { display: block; font-size: 0.9rem; line-height: 1.8; padding: 12px; border-radius: 8px;}
  .item-actions { width: 100%; flex-direction: column; gap: 10px; }
  .item-actions button { width: 100%; padding: 12px; font-size: 1rem; }
  .editor-header { flex-direction: column; align-items: stretch; gap: 12px;}
  .save-template-btn.small-btn { width: 100%; padding: 12px; font-size: 1.05rem; }
  .email-btn { max-width: 100%; padding: 15px; font-size: 1.1rem; }
  .plain-text-preview { padding: 15px; }
  .preview-subject, .preview-body { font-size: 1rem; }
  .query-header { flex-direction: column; align-items: stretch; gap: 10px; }
  .date-picker { width: 100%; }
  .detail-header-flex { flex-direction: column; align-items: stretch; gap: 12px; }
  .btn-edit { width: 100%; text-align: center; padding: 12px;}
  .history-item { padding: 15px; font-size: 1.05rem; }
  .edit-actions-row { flex-direction: column; align-items: stretch; gap: 10px; }
  .save-btn { width: 100%; padding: 15px; font-size: 1.1rem; }
}
</style>
