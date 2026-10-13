// app/composables/useExamMode.js
import { computed } from 'vue'
import { examFontStyles, examLeftTextStyles, examRemainingSeconds, examStatusAt, taiwanClockHHMMSS } from '../utils/examSchedule.js'
import { examThemes } from '../utils/examThemes.js'

export function useExamMode(examDataRef, nowTickRef) {


  const currentThemeStyles = computed(() => {
    const t = examThemes[examDataRef.value.theme] || examThemes.midnight
    return { '--ex-bg': t.bg, '--ex-border': t.border, '--ex-title': t.title, '--ex-clock': t.clock, '--ex-text': t.text, '--ex-accent': t.accent, '--ex-success': t.success, '--ex-danger': t.danger, '--ex-panel-bg': t.panelBg, ...examFontStyles(examDataRef.value), ...examLeftTextStyles(examDataRef.value, t) }
  })

  const examStatus = computed(() => examStatusAt(examDataRef.value?.periods, taiwanClockHHMMSS(nowTickRef.value).slice(0, 5)))

  const countdownMinutes = computed(() => {
    if (examStatus.value.state !== 'TESTING' || !examStatus.value.current) return 999
    return Math.floor(examRemainingSeconds(examStatus.value.current.endTime, taiwanClockHHMMSS(nowTickRef.value)) / 60)
  })

  const countdownText = computed(() => {
    if (examStatus.value.state !== 'TESTING' || !examStatus.value.current) return ''
    const seconds = examRemainingSeconds(examStatus.value.current.endTime, taiwanClockHHMMSS(nowTickRef.value))
    const diffMins = Math.floor(seconds / 60); const diffSecs = seconds % 60
    return `${String(diffMins).padStart(2, '0')}:${String(diffSecs).padStart(2, '0')}`
  })

  return { currentThemeStyles, examStatus, countdownMinutes, countdownText }
}
