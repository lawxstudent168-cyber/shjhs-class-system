<template>
  <section class="tracking-center" data-no-tracking>
    <header class="tracking-header">
      <div><h3>家長與實名足跡追蹤中心</h3><p>整合登入身分、操作足跡、訪客設備與全網站紀錄。</p></div>
      <div class="buttons"><button :disabled="loading" @click="loadLogs(true)">重新整理</button><button :disabled="!filtered.length" @click="exportCsv">匯出目前篩選 CSV</button></div>
    </header>
    <div class="filters">
      <label>開始日期<input v-model="fromDate" type="date" /></label>
      <label>結束日期<input v-model="toDate" type="date" /></label>
      <button :disabled="loading" @click="loadLogs(true)">查詢日期</button>
      <label class="search">搜尋<input v-model="search" placeholder="姓名、座號、角色、IP、操作、頁面或登入階段" /></label>
      <label>操作類別<select v-model="kind"><option value="">全部類別</option><option v-for="(label, value) in visitorEventKinds" :key="value" :value="value">{{ label }}</option></select></label>
    </div>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    <div class="summary">
      <span>目前載入 <strong>{{ logs.length }}</strong> / {{ total }} 筆</span>
      <span>實名身分 <strong>{{ identities.length }}</strong> 組</span>
      <span>已記錄登入／驗證 <strong>{{ loginCount }}</strong> 次</span>
      <span>篩選結果 <strong>{{ filtered.length }}</strong> 筆</span>
    </div>
    <nav class="view-tabs" aria-label="足跡檢視方式">
      <button v-for="tab in tabs" :key="tab.id" :class="{ active: mode === tab.id }" @click="mode = tab.id; selectedKey = ''">{{ tab.label }}</button>
    </nav>
    <p class="note">統計與文字篩選以目前載入資料為準，可按下方「載入更多」。時間皆為台灣時間。具名身分依登入時提供的名稱歸戶；「導師」等共用角色不能辨識是哪一位個人。點擊紀錄只表示按下按鈕，實際完成的操作另標示結果。</p>
    <p class="note">舊紀錄保留原始內容；沒有身分或登入階段的紀錄不會根據 IP 自動歸戶。瀏覽器記憶身分與本次重新驗證會分開標示。</p>
    <div v-if="loading && !logs.length" class="empty" role="status">載入中…</div>
    <div v-else-if="mode === 'all'" class="all-records">
      <p v-if="!filtered.length" class="empty">沒有符合條件的紀錄。</p>
      <div v-else class="table-wrap"><table>
        <thead><tr><th>時間</th><th>登入身分／來源</th><th>操作及結果</th><th>頁面／登入階段</th><th>IP／設備</th><th>管理</th></tr></thead>
        <tbody><tr v-for="log in filtered" :key="log.id">
          <td>{{ formatTime(log.created_at) }}</td>
          <td><strong>{{ log.identity }}</strong><small>{{ log.source }}</small></td>
          <td><span class="badge">{{ visitorEventKinds[log.kind] || log.kind }}</span> {{ log.label }}<small>{{ log.outcome }} {{ log.details }}</small></td>
          <td>{{ log.path || '未記錄頁面' }}<small>{{ log.sessionId || '舊紀錄無登入階段' }}</small></td>
          <td>{{ log.ip_address || '未知 IP' }}<small>{{ log.device_info || '未知設備' }}</small></td>
          <td><button :disabled="blocking || !validIP(log.ip_address)" @click="toggleBlock(log.ip_address)">{{ blockedIPs.includes(log.ip_address) ? '解除封鎖' : '封鎖 IP' }}</button></td>
        </tr></tbody>
      </table></div>
    </div>
    <div v-else class="tracking-layout">
      <aside aria-label="身分或工作階段清單">
        <p v-if="!groups.length" class="empty">沒有符合條件的紀錄。</p>
        <button v-for="group in groups" :key="group.key" class="group-card" :class="{ selected: selected?.key === group.key }" @click="selectedKey = group.key">
          <strong>{{ groupTitle(group) }}</strong>
          <small>{{ formatTime(group.latestTime) }}</small>
          <span>{{ group.logs.length }} 筆動作 · {{ group.loginCount }} 次登入／驗證 · {{ group.devices.size }} 組瀏覽器設備</span>
        </button>
      </aside>
      <div class="timeline">
        <template v-if="selected">
          <h4>{{ groupTitle(selected) }}</h4>
          <p v-if="mode === 'session'" class="note">{{ selected.logs[0].sessionId ? '登入階段識別：' + selected.logs[0].sessionId : '這是缺少登入階段識別的舊紀錄，不能推定一次登入。' }}</p>
          <article v-for="log in selected.logs" :key="log.id" class="event">
            <time>{{ formatTime(log.created_at) }}</time>
            <div><span class="badge">{{ visitorEventKinds[log.kind] || log.kind }}</span> <strong>{{ log.label }}</strong></div>
            <p>身分：<strong>{{ log.identity }}</strong> · {{ log.source }}</p>
            <p v-if="log.outcome || log.details">{{ log.outcome }} <span>{{ log.details }}</span></p>
            <small>頁面：{{ log.path || '未記錄' }} · IP：{{ log.ip_address || '未知' }}</small>
            <small>登入階段：{{ log.sessionId || '舊紀錄未提供' }}</small>
            <small>設備：{{ log.device_info || '未知' }}</small>
          </article>
        </template>
        <p v-else class="empty">請選擇要查看的身分、登入階段或設備。</p>
      </div>
    </div>
    <footer><button v-if="logs.length < total" :disabled="loading" @click="loadLogs(false)">{{ loading ? '載入中…' : '載入更多' }}</button><span v-else>目前查詢日期範圍已全部載入</span></footer>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { filterVisitorLogs, groupVisitorLogs, normalizeVisitorLog, visitorEventKinds, visitorLogsCsv } from '../utils/visitorTracking.js'
import { trackVisitorEvent } from '../utils/visitorTrackingClient.js'
const props = defineProps({ initialMode: { type: String, default: 'identity' } })
const supabase = useSupabaseClient()
const logs = ref([]), total = ref(0), loading = ref(false), errorMessage = ref('')
const fromDate = ref(''), toDate = ref(''), search = ref(''), kind = ref(''), mode = ref(props.initialMode), selectedKey = ref('')
const blockedIPs = ref([]), blocking = ref(false)
const tabs = [{ id: 'identity', label: '家長與實名身分' }, { id: 'session', label: '每次登入／工作階段' }, { id: 'device', label: '訪客設備足跡' }, { id: 'all', label: '全網站紀錄' }]
const filtered = computed(() => filterVisitorLogs(logs.value, { search: search.value, kind: kind.value }))
const identities = computed(() => groupVisitorLogs(logs.value, 'identity'))
const loginCount = computed(() => logs.value.filter(log => log.kind === 'login').length)
const groups = computed(() => groupVisitorLogs(filtered.value, mode.value))
const selected = computed(() => groups.value.find(group => group.key === selectedKey.value) || groups.value[0])
const formatTime = value => value ? new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) : '未記錄時間'
const groupTitle = group => mode.value === 'identity' ? group.key
  : mode.value === 'session' ? `${group.logs[0].identity} · ${group.logs.some(log => log.kind === 'login') ? '登入／驗證階段' : '延續階段／舊紀錄'}`
  : `${group.logs[0].deviceId ? '瀏覽器設備 ' + group.logs[0].deviceId.slice(0, 8) : '舊紀錄設備推估'} · ${[...group.identities].join('、')}`

let activeDates = { from: '', to: '' }
const loadLogs = async reset => {
  if (loading.value) return
  if (reset && fromDate.value && toDate.value && fromDate.value > toDate.value) { errorMessage.value = '開始日期不能晚於結束日期。'; return }
  loading.value = true; errorMessage.value = ''
  const dates = reset ? { from: fromDate.value, to: toDate.value } : activeDates
  try {
    let query = supabase.from('visitor_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).order('id', { ascending: false })
    if (dates.from) query = query.gte('created_at', `${dates.from}T00:00:00+08:00`)
    if (dates.to) query = query.lte('created_at', `${dates.to}T23:59:59.999999+08:00`)
    const offset = reset ? 0 : logs.value.length
    const { data, error, count } = await query.range(offset, offset + 499)
    if (error) throw error
    const normalized = (data || []).map(normalizeVisitorLog)
    if (reset) { logs.value = normalized; activeDates = dates }
    else { const seen = new Set(logs.value.map(log => log.id)); logs.value.push(...normalized.filter(log => !seen.has(log.id))) }
    total.value = count ?? logs.value.length
    const blocked = await supabase.from('ip_rules').select('ip_range').eq('rule_type', '黑名單')
    if (blocked.error) throw blocked.error
    blockedIPs.value = (blocked.data || []).map(row => row.ip_range)
  } catch { errorMessage.value = '讀取失敗，請檢查網路或資料表讀取權限後重試；目前資料可能尚未完整載入。' }
  finally { loading.value = false }
}
const validIP = ip => typeof ip === 'string' && (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || /^[a-f\d:]+$/i.test(ip) && ip.includes(':'))
const toggleBlock = async ip => {
  const block = !blockedIPs.value.includes(ip)
  if (!validIP(ip) || !confirm(`確定${block ? '封鎖' : '解除封鎖'} IP ${ip}？此 IP 可能由多位使用者共用。`)) return
  blocking.value = true
  try {
    const result = block
      ? await supabase.from('ip_rules').insert({ ip_range: ip, rule_type: '黑名單', description: '從統一足跡追蹤中心設定' })
      : await supabase.from('ip_rules').delete().eq('ip_range', ip).eq('rule_type', '黑名單')
    if (result.error) throw result.error
    blockedIPs.value = block ? [...blockedIPs.value, ip] : blockedIPs.value.filter(value => value !== ip)
    void trackVisitorEvent({ kind: 'operation', label: block ? '封鎖 IP' : '解除封鎖 IP', details: ip, outcome: '成功' })
  } catch { errorMessage.value = '封鎖設定儲存失敗，請重試。' }
  finally { blocking.value = false }
}
const exportCsv = () => {
  const url = URL.createObjectURL(new Blob([visitorLogsCsv(filtered.value)], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a'); link.href = url; link.download = 'visitor-tracking.csv'; link.click(); URL.revokeObjectURL(url)
}
onMounted(() => loadLogs(true))
</script>

<style scoped>
.tracking-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
h3 { margin: 0; color: #1e293b; } p { margin: 8px 0; } .tracking-header p, .note { color: #64748b; font-size: .9rem; line-height: 1.6; }
button, input, select { font: inherit; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 7px; background: white; color: #334155; }
button { cursor: pointer; } button:disabled { opacity: .5; cursor: default; } .buttons, .filters, .summary, .view-tabs { display: flex; gap: 10px; flex-wrap: wrap; margin: 16px 0; align-items: end; }
.filters label { display: flex; flex-direction: column; gap: 5px; font-size: .9rem; } .search { flex: 1; min-width: 200px; } .summary span { background: #f1f5f9; padding: 10px; border-radius: 8px; }
.view-tabs .active, .group-card.selected { background: #eff6ff; border-color: #3b82f6; color: #1d4ed8; }.error { background: #fef2f2; color: #b91c1c; padding: 12px; }
.tracking-layout { display: grid; grid-template-columns: minmax(240px, 32%) minmax(0, 1fr); gap: 18px; } aside, .timeline { max-height: 720px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
.group-card { width: 100%; text-align: left; display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }.group-card span { font-size: .85rem; }.event { padding: 14px 0; border-bottom: 1px solid #e2e8f0; }.event time { display: block; color: #64748b; margin-bottom: 8px; } small { display: block; color: #64748b; margin-top: 6px; overflow-wrap: anywhere; }.badge { background: #e0f2fe; color: #0369a1; padding: 3px 7px; border-radius: 5px; font-size: .85rem; }
.empty { padding: 30px 10px; text-align: center; color: #64748b; }.table-wrap { overflow-x: auto; } table { width: 100%; border-collapse: collapse; min-width: 920px; } th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; vertical-align: top; }td { max-width: 260px; overflow-wrap: anywhere; } footer { display: flex; justify-content: center; padding: 20px; }
@media(max-width: 760px) { .tracking-layout { grid-template-columns: 1fr; } aside { max-height: 300px; } .filters label { flex: 1; } }
</style>
