import { createError } from 'h3'
import { fetchAllRows, schoolDate } from '../../app/utils/teacherTodos.js'

export const LEAVE_PREFIX = '【系統自動推播：線上請假通知】'
export function normalizeBirthday(value) {
  const text = String(value || '')
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:T.*)?$/) || text.match(/^(\d{4})(\d{2})(\d{2})$/)
  return match ? `${match[1]}${match[2].padStart(2, '0')}${match[3].padStart(2, '0')}` : ''
}

export function validPersonalCredentials(body) {
  return body && ['student', 'parent'].includes(body.role)
    && /^\d{1,3}$/.test(String(body.seatNumber || ''))
    && /^\d{8}$/.test(body.birthday || '')
    && /^\d{5}$/.test(body.idLast5 || '')
    && (body.role === 'student' || (typeof body.email === 'string' && body.email.length < 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())))
}

export async function verifyPersonalCredentials(db, body) {
  if (!validPersonalCredentials(body)) return null
  // Optional legacy student fields vary across installations; never return this row.
  const { data, error } = await db.from('students').select('*').eq('seat_number', Number(body.seatNumber)).limit(2)
  if (error) throw error
  if (data?.length !== 1) return null
  const student = data[0]
  const storedId = String(student.id_number || student.id_last_5 || '').slice(-5)
  if (normalizeBirthday(student.birthday) !== body.birthday || storedId !== body.idLast5) return null
  const email = body.role === 'parent' ? body.email.trim().toLowerCase() : ''
  if (body.role === 'parent') {
    const { data: parents, error: parentError } = await db.from('parents').select('email').eq('student_id', student.id)
    if (parentError) throw parentError
    const emails = [student.parent_email, ...(parents || []).map(p => p.email)]
    if (!emails.some(value => typeof value === 'string' && value.trim().toLowerCase() === email)) return null
  }
  return { studentId: String(student.id), role: body.role, email }
}

const asArray = value => Array.isArray(value) ? value : []
const plainText = value => String(value || '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
const safeLinks = links => asArray(links).flatMap(link => {
  try {
    const url = new URL(link.url)
    return ['https:', 'http:'].includes(url.protocol) ? [{ title: link.title || link.name || url.hostname, url: url.href }] : []
  } catch { return [] }
})

export function buildPersonalOverview({ student, role, assignments, submissions, messages, leaves, attendance, settings, contacts, today, tomorrow }) {
  const excluded = new Set(asArray(settings.excluded_assignment_ids_from_report).map(String))
  const mySubmitted = new Set(submissions.filter(s => String(s.student_id) === String(student.id)).map(s => String(s.assignment_id)))
  const work = assignments.filter(a => !excluded.has(String(a.id))).map(a => ({
    id: a.id, title: a.title, subject: a.subject_name, deadline: a.deadline,
    status: mySubmitted.has(String(a.id)) ? 'submitted' : a.deadline && a.deadline < today ? 'overdue' : 'pending'
  })).sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'))
  const channel = role === 'parent' ? '家長' : '學生'
  const myMessages = messages.filter(m => String(m.student_id) === String(student.id) && m.chat_type === channel && m.sender_role === '導師')
  const notice = a => ({ id: a.id, title: a.title || '班級提醒', content: plainText(a.content), date: a.date, links: safeLinks(a.links) })
  const announcements = settings.announcement_board_visible === false ? [] : asArray(settings.announcements_data).map(notice)
  if (role === 'parent') {
    if (settings.parent_announcement_board_visible !== false) announcements.push(...asArray(settings.parent_announcements_data).map(notice))
    if (settings.parent_notices_board_visible !== false) announcements.push(...asArray(settings.parent_notices_data)
      .filter(n => !n.isHidden && (!n.startDate || n.startDate <= today) && (!n.endDate || n.endDate >= today)).map(notice))
  }
  return {
    today, tomorrow,
    student: { id: String(student.id), name: student.real_name, seatNumber: student.seat_number }, role,
    assignments: work,
    counts: { overdue: work.filter(a => a.status === 'overdue').length, pending: work.filter(a => a.status === 'pending').length, submitted: work.filter(a => a.status === 'submitted').length },
    reminders: [today, tomorrow].map(date => ({ date,
      contactItems: asArray(contacts.find(c => c.record_date === date)?.contact_items).map(plainText),
      notes: asArray(settings.class_notes_data?.[date]).map(plainText)
    })),
    announcements: announcements.sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    messages: myMessages.map(m => ({ id: m.id, content: m.content, date: m.created_at })),
    leaves: role === 'parent' ? leaves.filter(m => String(m.student_id) === String(student.id) && m.chat_type === '家長' && String(m.content).startsWith(LEAVE_PREFIX))
      .map(m => ({ id: m.id, content: m.content, date: m.created_at, seen: m.is_read_by_teacher === true })) : [],
    attendance: attendance.filter(a => String(a.student_id) === String(student.id)).map(a => ({ date: a.record_date, status: a.status }))
  }
}

export async function loadPersonalOverview(db, studentId, role, now = new Date()) {
  const today = schoolDate(now)
  const tomorrow = schoolDate(new Date(now.getTime() + 86400000))
  const since = schoolDate(new Date(now.getTime() - 29 * 86400000))
  const read = make => fetchAllRows(make)
  const keys = ['excluded_assignment_ids_from_report', 'class_notes_data', 'announcements_data', 'announcement_board_visible']
  if (role === 'parent') keys.push('parent_announcements_data', 'parent_announcement_board_visible', 'parent_notices_data', 'parent_notices_board_visible')
  const [students, assignments, submissions, messages, leaves, attendance, settingsRows, contacts] = await Promise.all([
    read(() => db.from('students').select('id,real_name,seat_number').eq('id', studentId).order('id')),
    read(() => db.from('assignments').select('id,title,subject_name,deadline').order('id')),
    read(() => db.from('assignment_submissions').select('id,student_id,assignment_id').eq('student_id', studentId).order('id')),
    read(() => db.from('private_messages').select('id,student_id,chat_type,sender_role,content,created_at').eq('student_id', studentId).eq('chat_type', role === 'parent' ? '家長' : '學生').eq('sender_role', '導師').gte('created_at', `${since}T00:00:00+08:00`).order('created_at', { ascending: false }).order('id')),
    role === 'parent' ? read(() => db.from('private_messages').select('id,student_id,chat_type,content,created_at,is_read_by_teacher').eq('student_id', studentId).eq('chat_type', '家長').like('content', `${LEAVE_PREFIX}%`).gte('created_at', `${since}T00:00:00+08:00`).order('created_at', { ascending: false }).order('id')) : [],
    read(() => db.from('attendances').select('id,student_id,record_date,status').eq('student_id', studentId).gte('record_date', since).lte('record_date', today).order('record_date', { ascending: false }).order('id')),
    read(() => db.from('system_settings').select('setting_key,setting_value').in('setting_key', keys).order('setting_key')),
    read(() => db.from('contact_books').select('record_date,contact_items').in('record_date', [today, tomorrow]).order('record_date'))
  ])
  if (students.length !== 1) throw createError({ statusCode: 401, statusMessage: 'Student is no longer available' })
  return buildPersonalOverview({ student: students[0], role, assignments, submissions, messages, leaves, attendance,
    settings: Object.fromEntries(settingsRows.map(s => [s.setting_key, s.setting_value])), contacts, today, tomorrow })
}
