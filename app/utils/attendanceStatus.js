export const attendanceStatusOrder = ['未到', '已到', '遲到', '全天請假', '晚到請假', '早退請假', '部份公假']

export function parseAttendanceStatus(status = '未到') {
  status = status || '未到'
  if (status === '請假') return { base: '全天請假', time: '', direction: '入班' }
  const base = attendanceStatusOrder.find(value => status.startsWith(value)) || '未到'
  const time = status.match(/\d{2}:\d{2}/)?.[0] || ''
  const direction = status.includes('離班') ? '離班' : '入班'
  return { base, time, direction }
}

export function nextAttendanceStatus(status) {
  const { base } = parseAttendanceStatus(status)
  return attendanceStatusOrder[(attendanceStatusOrder.indexOf(base) + 1) % attendanceStatusOrder.length]
}

export function formatAttendanceStatus(base, time = '', direction = '入班') {
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('請輸入有效時間（HH:mm）')
  if (base === '部份公假') {
    if (!time || !['入班', '離班'].includes(direction)) throw new Error('部份公假請選擇入班／離班並填寫時間')
    return `部份公假(${direction} ${time})`
  }
  if (base === '遲到' && time) return `遲到_${time}`
  if (['晚到請假', '早退請假'].includes(base) && time) return `${base}(${time})`
  return base
}
