const controls = 'button,a,[role=button],[role=tab],summary,input[type=button],input[type=submit],.btn,.cork-card,.student-card,[data-track-action]'
const clean = text => String(text || '').replace(/\s+/g, ' ').trim().slice(0, 100)
export function visitorFeatureContext(element) {
  const feature = element?.closest?.('[data-track-feature]')
  return feature ? [feature.getAttribute('data-track-feature'), feature.getAttribute('data-track-context')].filter(Boolean).join('；') : ''
}
export function describeVisitorClick(element) {
  if (!element?.closest || element.closest('[data-no-tracking]')) return null
  // Form contents are never used as action labels.
  if (element.closest('textarea,select,input:not([type=button]):not([type=submit])')) return null
  const target = element.closest(controls)
  const feature = element.closest('[data-track-feature]')
  if (!target && !feature) return null
  if (target?.disabled || target?.getAttribute('aria-disabled') === 'true') return null
  const details = visitorFeatureContext(element)
  if (!target) return { kind: 'interaction', label: `點選功能：${clean(feature.getAttribute('data-track-feature'))}`, details, outcome: '主動點選（不代表已閱讀）' }
  const label = clean(target.getAttribute('data-track-action') || target.getAttribute('aria-label') || target.getAttribute('title') || (target.tagName === 'INPUT' ? '執行按鈕' : target.textContent) || '開啟連結')
  return { kind: 'click', label: `點擊：${label}`, details, outcome: '已點擊（不代表操作成功）' }
}
export function describeVisitorField(element, focus = false) {
  if (!element?.closest || element.closest('[data-no-tracking]')) return null
  if (focus ? !element.matches('textarea,input:not([type=password]):not([type=hidden]):not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio])') : !element.matches('select,input[type=checkbox],input[type=radio]')) return null
  if (/password/i.test(element.getAttribute('autocomplete') || '')) return null
  const label = clean(element.getAttribute('aria-label') || element.getAttribute('title') || (focus ? '文字欄位' : '選項'))
  return { kind: focus ? 'interaction' : 'change', label: `${focus ? '使用欄位' : '變更欄位'}：${label}`, details: visitorFeatureContext(element), outcome: focus ? '欄位取得焦點（不記錄輸入內容）' : '已變更（尚未確認儲存）' }
}
