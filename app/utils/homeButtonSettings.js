export const homeButtonList = [
  { key: 'parentBind', label: '👨‍👩‍👦 綁定' },
  { key: 'parentMsg', label: '💬 家長私訊' },
  { key: 'studentMsg', label: '💬 學生私訊' },
  { key: 'parentLeave', label: '📝 家長代學生請假' },
  { key: 'schedule', label: '📅 顯示班級大課表' },
  { key: 'assignments', label: '📚 作業管理' },
  { key: 'discipline', label: '⚖️ 秩序管理' },
  { key: 'hygiene', label: '🧹 衛生管理' },
  { key: 'seats', label: '🪑 座位管理' },
  { key: 'manageSchedule', label: '⚙️ 課表管理' },
  { key: 'broadcast', label: '📢 教師廣播站' },
  { key: 'exams', label: '📝 大考管理' },
  { key: 'emergency', label: '🚨 緊急通知' },
  { key: 'admin', label: '⚙️ 後台' },
  { key: 'showSeats', label: '👀 顯示教室座位表' },
  { key: 'smallSeatMap', label: '🪑 顯示小座位表' },
  { key: 'showHygiene', label: '🧹 顯示衛生工作' },
  { key: 'contactHistory', label: '📅 查詢近期聯絡簿' }
]

const shared = { parentBind: false, parentMsg: false, studentMsg: false, parentLeave: false, schedule: true,
  assignments: true, discipline: true, hygiene: true, seats: true, manageSchedule: false, broadcast: false,
  exams: false, emergency: true, admin: false, showSeats: false, smallSeatMap: false,
  showHygiene: false, contactHistory: false }

export const defaultRoleButtonSettings = {
  anonymous: { ...shared, parentBind: true, parentMsg: true, studentMsg: true, parentLeave: true },
  classroom: { ...shared, showSeats: true, smallSeatMap: true, showHygiene: true, contactHistory: true },
  student: { ...shared, studentMsg: true, contactHistory: true },
  parent: { ...shared, parentMsg: true, parentLeave: true, contactHistory: true },
  subject_teacher: { ...shared, showSeats: true, smallSeatMap: true, showHygiene: true, contactHistory: true, broadcast: true },
  teacher: Object.fromEntries(homeButtonList.map(button => [button.key, true]))
}

export function normalizeRoleButtonSettings(saved) {
  const source = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
  return Object.fromEntries(Object.entries(defaultRoleButtonSettings).map(([role, defaults]) => [
    role, { ...defaults, ...(source[role] && typeof source[role] === 'object' ? source[role] : {}) }
  ]))
}

export function effectiveHomeButtonSettings(roleSettings, globalSettings, role) {
  const normalized = normalizeRoleButtonSettings(roleSettings)
  const selected = normalized[role] || normalized.anonymous
  const global = globalSettings && typeof globalSettings === 'object' ? globalSettings : {}
  const effective = { ...selected }
  for (const key of Object.keys(effective)) {
    // The old global "schedule" switch controls course management; the large timetable has its own switch.
    const globalKey = key === 'manageSchedule' ? 'schedule'
      : key === 'showSeats' ? 'seats'
        : key === 'showHygiene' ? 'hygiene'
          : key === 'schedule' ? null : key
    if (globalKey && global[globalKey] === false) effective[key] = false
  }
  return effective
}
