import { onMounted, onScopeDispose, watch } from 'vue'
import { getVisitorContext, subscribeVisitorContext, trackVisitorEvent } from '../utils/visitorTrackingClient.js'

// An element being visible is evidence of display, never proof that a person read it.
export function useFeatureExposure(element, options) {
  let observer, timer, unsubscribe, stopWatch
  let visible = false
  let disposed = false
  const recorded = new Set()
  const pending = new Set()
  const cancel = () => { clearTimeout(timer); timer = null }
  const check = () => {
    cancel()
    const settings = options()
    const context = getVisitorContext()
    if (disposed || !settings.ready || !visible || document.visibilityState === 'hidden' || !context) return
    const key = JSON.stringify([context.sessionId, context.identity, settings.feature, settings.context])
    if (recorded.has(key) || pending.has(key)) return
    timer = setTimeout(async () => {
      if (disposed || document.visibilityState === 'hidden') return
      pending.add(key)
      const success = await trackVisitorEvent({ kind: 'view', label: `${settings.feature}進入可視範圍`, details: settings.context, outcome: '已顯示至少 1 秒（不代表已閱讀）' })
      pending.delete(key)
      if (success) recorded.add(key)
    }, 1000)
  }
  onMounted(() => {
    unsubscribe = subscribeVisitorContext(check)
    stopWatch = watch(options, check, { deep: true, flush: 'post' })
    document.addEventListener('visibilitychange', check)
    if (typeof IntersectionObserver === 'undefined' || !element.value) return
    observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.1)
      check()
    }, { threshold: [0, 0.1] })
    observer.observe(element.value)
  })
  onScopeDispose(() => {
    disposed = true; cancel(); observer?.disconnect(); unsubscribe?.(); stopWatch?.()
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', check)
  })
}
