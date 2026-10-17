import { describeVisitorClick, describeVisitorField, visitorFeatureContext } from '../utils/visitorInteractions.js'
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
  let lastClick = { key: '', time: 0 }
  const onClick = event => {
    const action = describeVisitorClick(event.target)
    if (!action) return
    const key = JSON.stringify([router.currentRoute.value.path, action.label, action.details])
    if (lastClick.key === key && Date.now() - lastClick.time < 350) return
    lastClick = { key, time: Date.now() }
    void tracker.record({ ...action, details: [action.details, context()].filter(Boolean).join('；') })
  }
  const field = (event, focus) => {
    const action = describeVisitorField(event.target, focus)
    if (action) void tracker.record({ ...action, details: [action.details, context()].filter(Boolean).join('；') })
  }
  const onChange = event => field(event, false)
  const onFocus = event => field(event, true)
  const onSubmit = event => {
    if (!event.target?.closest || event.target.closest('[data-no-tracking]')) return
    void tracker.record({ kind: 'interaction', label: '提交表單', details: [visitorFeatureContext(event.target), context()].filter(Boolean).join('；'), outcome: '已提交（尚未確認結果）' })
  }
  let removeRouteHook
  nuxtApp.hook('app:mounted', () => {
    void page(router.currentRoute.value.path)
    removeRouteHook = router.afterEach((to, from, failure) => { if (!failure && to.path !== from.path) void page(to.path) })
    window.addEventListener('click', onClick, { capture: true, passive: true })
    window.addEventListener('change', onChange, { capture: true, passive: true })
    window.addEventListener('focusin', onFocus, { capture: true, passive: true })
    window.addEventListener('submit', onSubmit, { capture: true, passive: true })
  })
  if (import.meta.hot) import.meta.hot.dispose(() => {
    removeRouteHook?.()
    window.removeEventListener('click', onClick, true)
    window.removeEventListener('change', onChange, true)
    window.removeEventListener('focusin', onFocus, true)
    window.removeEventListener('submit', onSubmit, true)
    configureVisitorTracker(null)
  })
})
