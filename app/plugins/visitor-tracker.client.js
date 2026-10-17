import { configureVisitorTracker, createVisitorTracker } from '../utils/visitorTrackingClient.js'

export default defineNuxtPlugin(nuxtApp => {
  const client = useSupabaseClient()
  const router = useRouter()
  let cachedIP = ''
  let ipRequest
  const getIP = () => {
    if (cachedIP) return Promise.resolve(cachedIP)
    if (!ipRequest) ipRequest = fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(5000) })
      .then(response => response.json()).then(data => { cachedIP = data.ip || ''; return cachedIP })
      .catch(() => '').finally(() => { ipRequest = null })
    return ipRequest
  }
  const local = { getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) }
  const session = { getItem: key => window.sessionStorage.getItem(key), setItem: (key, value) => window.sessionStorage.setItem(key, value) }
  const tracker = createVisitorTracker({ client, local, session,
    getIP, getPath: () => router.currentRoute.value.path, userAgent: navigator.userAgent,
    uuid: () => crypto.randomUUID(), onError: () => console.warn('訪客紀錄寫入失敗，請檢查連線與 visitor_logs 權限。') })
  configureVisitorTracker(tracker)
  const page = path => tracker.record({ kind: 'page', label: '瀏覽頁面', path })
  const context = () => router.currentRoute.value.path === '/admin'
    ? document.querySelector('.header-buttons button.active')?.textContent?.trim() || '導師後台' : ''
  let lastClick = { label: '', path: '', time: 0 }
  const onClick = event => {
    const target = event.target instanceof Element ? event.target.closest('button, a, .btn, .cork-card, .student-card') : null
    if (!target || target.closest('[data-no-tracking]')) return
    // Capture visible action labels only; never read input values, messages, query strings or passwords.
    const label = (target.getAttribute('aria-label') || target.getAttribute('title') || target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)
    if (!label) return
    const path = router.currentRoute.value.path
    if (lastClick.label === label && lastClick.path === path && Date.now() - lastClick.time < 350) return
    lastClick = { label, path, time: Date.now() }
    void tracker.record({ kind: 'click', label: `點擊：${label}`, details: target.closest('.header-buttons') ? '切換後台功能' : context(), outcome: '已點擊（不代表操作成功）' })
  }
  const onChange = event => {
    const target = event.target
    if (!(target instanceof Element) || !target.matches('select,input[type=checkbox],input[type=radio]') || target.closest('[data-no-tracking]')) return
    const label = target.getAttribute('aria-label') || target.getAttribute('title') || '選項'
    void tracker.record({ kind: 'change', label: `變更欄位：${label}`, details: context(), outcome: '已變更（尚未確認儲存）' })
  }
  let removeRouteHook
  nuxtApp.hook('app:mounted', () => {
    void page(router.currentRoute.value.path)
    removeRouteHook = router.afterEach((to, from, failure) => { if (!failure && to.path !== from.path) void page(to.path) })
    window.addEventListener('click', onClick, { capture: true, passive: true })
    window.addEventListener('change', onChange, { capture: true, passive: true })
  })
  if (import.meta.hot) import.meta.hot.dispose(() => {
    removeRouteHook?.()
    window.removeEventListener('click', onClick, true)
    window.removeEventListener('change', onChange, true)
    configureVisitorTracker(null)
  })
})
