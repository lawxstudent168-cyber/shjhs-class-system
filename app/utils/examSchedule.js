export const examFontSettings = {
  clock: { label: '右側目前時間', min: 48, max: 160, default: 120 },
  subject: { label: '右側目前科目', min: 32, max: 112, default: 88 },
  countdown: { label: '右側倒數時間', min: 48, max: 144, default: 104 },
  notes: { label: '考前提醒文字', min: 16, max: 48, default: 24 }
}

export const examLeftTextSettings = {
  header: { label: '欄位名稱', min: 14, max: 48, default: 22 },
  period: { label: '節次', min: 16, max: 64, default: 29 },
  subject: { label: '考試科目', min: 16, max: 64, default: 29 },
  time: { label: '開始與結束時間', min: 16, max: 64, default: 29 }
}

const validColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : null

const emptyDay = () => ({ title: '', periods: [], notes: [] })

export function normalizeExamSchedule(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const days = [0, 1].map(index => {
    // Existing single-day records become day one without changing the saved row first.
    const day = Array.isArray(source.days) ? source.days[index] : index === 0 ? source : null
    if (!day || typeof day !== 'object') return emptyDay()
    return {
      title: typeof day.title === 'string' ? day.title : '',
      periods: Array.isArray(day.periods) ? day.periods.map(period => ({ ...period })) : [],
      notes: Array.isArray(day.notes) ? [...day.notes] : []
    }
  })
  const fontSizes = Object.fromEntries(Object.entries(examFontSettings).map(([key, setting]) => {
    const size = Number(source.fontSizes?.[key])
    return [key, Number.isFinite(size) && size >= setting.min && size <= setting.max ? size : setting.default]
  }))
  const leftTextSizes = Object.fromEntries(Object.entries(examLeftTextSettings).map(([key, setting]) => {
    const size = Number(source.leftTextSizes?.[key])
    return [key, Number.isFinite(size) && size >= setting.min && size <= setting.max ? size : setting.default]
  }))
  const leftTextColors = Object.fromEntries(Object.keys(examLeftTextSettings).map(key =>
    [key, validColor(source.leftTextColors?.[key])]
  ))
  return {
    isExamModeEnabled: source.isExamModeEnabled !== false,
    theme: typeof source.theme === 'string' ? source.theme : 'midnight',
    displayDay: source.displayDay === 2 ? 2 : 1,
    days,
    fontSizes,
    leftTextSizes,
    leftTextColors
  }
}

export function displayedExamSchedule(value) {
  const schedule = normalizeExamSchedule(value)
  const day = schedule.days[schedule.displayDay - 1]
  return { ...schedule, title: day.title, periods: day.periods, notes: day.notes }
}

export function examFontStyles(value) {
  const { fontSizes } = normalizeExamSchedule(value)
  return {
    '--ex-clock-size': `${fontSizes.clock}px`,
    '--ex-subject-size': `${fontSizes.subject}px`,
    '--ex-countdown-size': `${fontSizes.countdown}px`,
    '--ex-notes-size': `${fontSizes.notes}px`,
    '--ex-next-subject-size': `${Math.round(fontSizes.subject * 0.65)}px`,
    '--ex-next-time-size': `${Math.round(fontSizes.clock * 0.25)}px`
  }
}

export function examLeftTextStyles(value, theme) {
  const { leftTextSizes, leftTextColors } = normalizeExamSchedule(value)
  const styles = {}
  for (const key of Object.keys(examLeftTextSettings)) {
    const color = leftTextColors[key]
    styles[`--ex-left-${key}-size`] = `${leftTextSizes[key]}px`
    styles[`--ex-left-${key}-color`] = color || (key === 'header' ? theme.title : theme.text)
    if (key !== 'header') styles[`--ex-left-${key}-active-color`] = color || theme.accent
  }
  return styles
}
