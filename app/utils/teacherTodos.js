// School dates must not depend on the viewer's device timezone.
export function schoolDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now)
}

// Read every page: PostgREST otherwise silently caps results.
export async function fetchAllRows(makeQuery) {
  const rows = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await makeQuery().range(offset, offset + pageSize - 1)
    if (error) throw error
    if (!Array.isArray(data)) throw new Error('資料回應格式錯誤')
    rows.push(...data)
    if (data.length < pageSize) return rows
  }
}

export function buildTeacherTodos({ students, messages, assignments, submissions, today }) {
  const names = new Map(students.map(s => [String(s.id), `${s.seat_number}號 ${s.real_name}`]))
  const unread = messages.filter(m => m.sender_role !== '導師' && m.is_read_by_teacher === false)
  const isLeave = m => m.chat_type === '家長' && String(m.content || '').startsWith('【系統自動推播：線上請假通知】')
  const toMessage = m => ({ ...m, studentLabel: names.get(String(m.student_id)) || '名單外學生' })
  const oldestFirst = (a, b) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id))
  const submitted = new Set(submissions.map(s => JSON.stringify([String(s.assignment_id), String(s.student_id)])))
  const overdue = assignments.filter(a => /^\d{4}-\d{2}-\d{2}$/.test(a.deadline || '') && a.deadline < today)
    .map(a => ({ ...a, missing: students.filter(s => !submitted.has(JSON.stringify([String(a.id), String(s.id)]))) }))
    .filter(a => a.missing.length > 0)
    .sort((a, b) => a.deadline.localeCompare(b.deadline) || String(a.id).localeCompare(String(b.id)))
  return {
    leaves: unread.filter(isLeave).sort(oldestFirst).map(toMessage),
    messages: unread.filter(m => !isLeave(m)).sort(oldestFirst).map(toMessage),
    overdue
  }
}
