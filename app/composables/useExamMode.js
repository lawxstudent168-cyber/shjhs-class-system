// app/composables/useExamMode.js
import { computed } from 'vue'
import { examFontStyles, examLeftTextStyles } from '../utils/examSchedule.js'

export function useExamMode(examDataRef, nowTickRef) {
  const examThemes = {
    midnight: { name: '午夜藍', bg: '#0f172a', border: '#334155', title: '#f8fafc', clock: '#fbbf24', text: '#cbd5e1', accent: '#3b82f6', success: '#10b981', danger: '#ef4444', panelBg: '#1e293b' },
    blackboard: { name: '經典黑板', bg: '#1a3627', border: '#5b3a1a', title: '#ffffff', clock: '#fbbf24', text: '#e2e8f0', accent: '#fca5a5', success: '#a7f3d0', danger: '#f87171', panelBg: '#234a36' },
    slate: { name: '沉穩灰', bg: '#334155', border: '#64748b', title: '#f8fafc', clock: '#38bdf8', text: '#f1f5f9', accent: '#818cf8', success: '#34d399', danger: '#f87171', panelBg: '#475569' },
    matcha: { name: '抹茶綠', bg: '#2f3e36', border: '#5b6a5a', title: '#ecfdf5', clock: '#a7f3d0', text: '#d1fae5', accent: '#6ee7b7', success: '#10b981', danger: '#fca5a5', panelBg: '#3b4d45' },
    burgundy: { name: '勃根地紅', bg: '#450a0a', border: '#7f1d1d', title: '#fee2e2', clock: '#fca5a5', text: '#fecaca', accent: '#f87171', success: '#a7f3d0', danger: '#fbbf24', panelBg: '#591111' },
    ocean: { name: '深海湛藍', bg: '#083344', border: '#164e63', title: '#cffafe', clock: '#67e8f9', text: '#a5f3fc', accent: '#22d3ee', success: '#34d399', danger: '#fca5a5', panelBg: '#114358' },
    mocha: { name: '摩卡棕', bg: '#3e2723', border: '#784315', title: '#fef3c7', clock: '#fde047', text: '#fde68a', accent: '#fbbf24', success: '#6ee7b7', danger: '#fca5a5', panelBg: '#5c3a21' },
    purple: { name: '星空紫', bg: '#2e1065', border: '#4c1d95', title: '#ede9fe', clock: '#c4b5fd', text: '#ddd6fe', accent: '#a78bfa', success: '#6ee7b7', danger: '#fca5a5', panelBg: '#3b187d' },
    retro: { name: '復古紙質', bg: '#e7e5e4', border: '#94a3b8', title: '#1c1917', clock: '#b45309', text: '#44403c', accent: '#78350f', success: '#15803d', danger: '#b91c1c', panelBg: '#f5f5f4' },
    minimal: { name: '極簡白', bg: '#ffffff', border: '#cbd5e1', title: '#0f172a', clock: '#0284c7', text: '#334155', accent: '#3b82f6', success: '#16a34a', danger: '#dc2626', panelBg: '#f8fafc' }
  }

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
