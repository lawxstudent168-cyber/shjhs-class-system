export const scheduleSemesters = [
  { id: '7-1', label: '七年級上學期' }, { id: '7-2', label: '七年級下學期' },
  { id: '8-1', label: '八年級上學期' }, { id: '8-2', label: '八年級下學期' },
  { id: '9-1', label: '九年級上學期' }, { id: '9-2', label: '九年級下學期' }
]
const validTerm = term => scheduleSemesters.some(item => item.id === term)
export const scheduleSemesterLabel = term => scheduleSemesters.find(item => item.id === term)?.label || term
const clone = value => JSON.parse(JSON.stringify(value))
const emptyDays = () => Array.from({ length: 5 }, () => ({ subject: '', teacher: '' }))

export function normalizeClassSchedule(value, fallback = { periods: [] }) {
  const source = Array.isArray(value?.periods) ? value : fallback
  // Keep schedule content only, not the surrounding semester collection.
  const { terms, activeTerm, schemaVersion, semesterLabel, ...schedule } = clone(source)
  schedule.periods = (schedule.periods || []).map(period => ({ ...period,
    days: Array.from({ length: 5 }, (_, index) => {
      const day = period.days?.[index]
      return typeof day === 'string' ? { subject: day, teacher: '' } : { subject: '', teacher: '', ...day }
    })
  }))
  if (!schedule.periods.some(period => period.name === '早掃時間')) {
    const index = schedule.periods.findIndex(period => period.name === '早修')
    if (index !== -1) schedule.periods.splice(index + 1, 0, { name: '早掃時間', startTime: '08:00', endTime: '08:15', days: emptyDays() })
  }
  if (!schedule.periods.some(period => ['午餐和午掃', '午餐和午掃時間'].includes(period.name))) {
    const index = schedule.periods.findIndex(period => period.name === '第四節')
    if (index !== -1) schedule.periods.splice(index + 1, 0, { name: '午餐和午掃', startTime: '11:50', endTime: '12:25', days: emptyDays() })
  }
  return schedule
}

export function normalizeSemesterSchedules(value, fallback = { periods: [] }) {
  const activeTerm = validTerm(value?.activeTerm) ? value.activeTerm : '7-1'
  const terms = {}
  for (const { id } of scheduleSemesters) {
    if (Array.isArray(value?.terms?.[id]?.periods)) terms[id] = normalizeClassSchedule(value.terms[id], fallback)
  }
  if (!terms[activeTerm]) terms[activeTerm] = normalizeClassSchedule(value, fallback)
  return { activeTerm, terms }
}

export function copySemesterSchedules(bank, sourceTerm, targets, overwrite = false) {
  if (!validTerm(sourceTerm) || !bank.terms?.[sourceTerm]) throw new Error('請先建立來源學期課表。')
  const uniqueTargets = [...new Set(targets)]
  if (!uniqueTargets.length) throw new Error('請選擇至少一個目標學期。')
  for (const term of uniqueTargets) {
    if (!validTerm(term) || term === sourceTerm) throw new Error('目標學期必須是其他有效學期。')
    if (bank.terms[term] && !overwrite) throw new Error(`${scheduleSemesterLabel(term)}已有課表，請先確認覆蓋。`)
  }
  const result = clone(bank)
  for (const term of uniqueTargets) result.terms[term] = normalizeClassSchedule(bank.terms[sourceTerm])
  return result
}

export function serializeSemesterSchedules(bank) {
  if (!validTerm(bank.activeTerm) || !Array.isArray(bank.terms?.[bank.activeTerm]?.periods)) throw new Error('請先建立首頁使用學期的課表。')
  const saved = normalizeSemesterSchedules(bank)
  // The top-level periods keep existing homepage and full-screen consumers compatible.
  return { ...clone(saved.terms[saved.activeTerm]), schemaVersion: 2, ...saved, semesterLabel: scheduleSemesterLabel(saved.activeTerm) }
}
