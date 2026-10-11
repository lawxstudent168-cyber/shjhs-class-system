// app/composables/useExamMode.js
import { computed } from 'vue'
import { examFontStyles, examLeftTextStyles } from '../utils/examSchedule.js'
import { examThemes } from '../utils/examThemes.js'

export function useExamMode(examDataRef, nowTickRef) {


  const currentThemeStyles = computed(() => {
    const t = examThemes[examDataRef.value.theme] || examThemes.midnight
    return { '--ex-bg': t.bg, '--ex-border': t.border, '--ex-title': t.title, '--ex-clock': t.clock, '--ex-text': t.text, '--ex-accent': t.accent, '--ex-success': t.success, '--ex-danger': t.danger, '--ex-panel-bg': t.panelBg, ...examFontStyles(examDataRef.value), ...examLeftTextStyles(examDataRef.value, t) }
  })

  const examStatus = computed(() => {
    if (!examDataRef.value || !examDataRef.value.periods || examDataRef.value.periods.length === 0) return { state: 'WAITING', periods: [] }
    const now = new Date(nowTickRef.value); const nowMins = now.getHours() * 60 + now.getMinutes()
    let current = null; let next = null; let state = 'WAITING'; const periods = JSON.parse(JSON.stringify(examDataRef.value.periods))
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i]; if (!p.startTime || !p.endTime) continue
      const [sh, sm] = p.startTime.split(':').map(Number); const [eh, em] = p.endTime.split(':').map(Number)
      const startMins = sh * 60 + sm; const endMins = eh * 60 + em; p.isActive = false
      if (nowMins >= startMins && nowMins <= endMins) { state = 'TESTING'; current = p; p.isActive = true; if (i + 1 < periods.length) next = periods[i + 1]; break }
      if (nowMins < startMins) { if (state !== 'TESTING') { state = i === 0 ? 'WAITING' : 'BREAK'; next = p }; break }
    }
    const lastP = periods[periods.length - 1]
    if (lastP && lastP.endTime) {
      const [lsh, lsm] = lastP.endTime.split(':').map(Number)
      if (!current && !next && nowMins >= (lsh * 60 + lsm)) { state = 'FINISHED' }
    }
    return { state, current, next, periods }
  })

  const countdownMinutes = computed(() => {
    if (examStatus.value.state !== 'TESTING' || !examStatus.value.current) return 999;
    const currentTick = nowTickRef.value; const now = new Date(currentTick)
    const [eh, em] = examStatus.value.current.endTime.split(':').map(Number)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), eh, em, 0)
    return Math.floor((end.getTime() - currentTick) / 60000)
  })

  const countdownText = computed(() => {
    if (examStatus.value.state !== 'TESTING' || !examStatus.value.current) return '';
    const currentTick = nowTickRef.value; const now = new Date(currentTick)
    const [eh, em] = examStatus.value.current.endTime.split(':').map(Number)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), eh, em, 0)
    const diffMs = end.getTime() - currentTick; if (diffMs <= 0) return '00:00'
    const diffMins = Math.floor(diffMs / 60000); const diffSecs = Math.floor((diffMs % 60000) / 1000)
    return `${String(diffMins).padStart(2, '0')}:${String(diffSecs).padStart(2, '0')}`
  })

  return { currentThemeStyles, examStatus, countdownMinutes, countdownText }
}
