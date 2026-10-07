import test from 'node:test'
import assert from 'node:assert/strict'
import { encodePersonalSession, decodePersonalSession, extendPersonalSession, authorizePersonalStudent } from '../server/utils/personalHomeSession.js'
import { buildPersonalOverview, loadPersonalOverview, normalizeBirthday, verifyPersonalCredentials, LEAVE_PREFIX } from '../server/utils/personalHomeData.js'

const secret = 'test-only-secret-with-at-least-32-characters'
const now = Date.parse('2026-09-22T04:00:00Z')
const student = { id: 'a', real_name: '測試甲', seat_number: 1, birthday: '2013-05-14', id_last_5: '12345', parent_email: 'parent@example.test' }

// Query double applies filters rather than returning the same rows for every student.
function database(tables) {
  const calls = []
  return { calls, from(table) {
    const filters = []
    const call = { table, filters, columns: '' }; calls.push(call)
    let limit
    const query = {
      select(columns) { call.columns = columns; return this },
      eq(key, value) { filters.push([key, 'eq', value]); return this },
      in(key, value) { filters.push([key, 'in', value]); return this },
      gte(key, value) { filters.push([key, 'gte', value]); return this },
      lte(key, value) { filters.push([key, 'lte', value]); return this },
      like(key, value) { filters.push([key, 'like', value]); return this },
      order() { return this },
      limit(value) { limit = value; return this },
      range(start, end) { return Promise.resolve({ data: rows().slice(start, end + 1), error: null }) },
      then(resolve, reject) { return Promise.resolve({ data: rows().slice(0, limit), error: null }).then(resolve, reject) }
    }
    function rows() {
      return (tables[table] || []).filter(row => filters.every(([key, op, value]) => {
        if (op === 'eq') return String(row[key]) === String(value)
        if (op === 'in') return value.map(String).includes(String(row[key]))
        if (op === 'gte') return row[key] >= value
        if (op === 'lte') return row[key] <= value
        return String(row[key]).startsWith(value.slice(0, -1))
      }))
    }
    return query
  } }
}

test('signed sessions reject tampering, expiry and unverified child selection', () => {
  const session = extendPersonalSession(null, { studentId: 'a', role: 'student' }, secret, now)
  const token = encodePersonalSession(session, secret)
  assert.deepEqual(decodePersonalSession(token, secret, now), session)
  assert.equal(decodePersonalSession(token, secret, session.expires), null)
  const [, signature] = token.split('.')
  const forged = Buffer.from(JSON.stringify({ ...session, studentIds: ['b'] })).toString('base64url')
  assert.equal(decodePersonalSession(`${forged}.${signature}`, secret, now), null)
  assert.equal(decodePersonalSession(token, 'other-secret', now), null)
  assert.equal(authorizePersonalStudent(session, 'b'), null)
  assert.equal(authorizePersonalStudent(session, ['a']), null)
  assert.equal(authorizePersonalStudent(session, undefined), 'a')
})

test('parent switching preserves only children verified under the same full email', () => {
  const first = extendPersonalSession(null, { role: 'parent', studentId: 'a', email: 'Parent@example.test' }, secret, now)
  const second = extendPersonalSession(first, { role: 'parent', studentId: 'b', email: 'parent@example.test' }, secret, now)
  assert.deepEqual(second.studentIds, ['b', 'a'])
  assert.deepEqual(extendPersonalSession(second, { role: 'parent', studentId: 'c', email: 'different@example.test' }, secret, now).studentIds, ['c'])
  assert.deepEqual(extendPersonalSession(second, { role: 'student', studentId: 'a' }, secret, now).studentIds, ['a'])
  assert.ok(!JSON.stringify(second).includes('@'))
})

test('verification requires matching credentials and full bound parent email', async () => {
  const db = database({ students: [student], parents: [{ student_id: 'a', email: 'Second@example.test' }] })
  const body = { role: 'student', seatNumber: '1', birthday: '20130514', idLast5: '12345' }
  assert.equal((await verifyPersonalCredentials(db, body)).studentId, 'a')
  assert.equal(await verifyPersonalCredentials(db, { ...body, idLast5: '99999' }), null)
  assert.equal(await verifyPersonalCredentials(db, { ...body, birthday: '20130515' }), null)
  assert.equal(await verifyPersonalCredentials(db, { ...body, role: 'parent', email: 'stranger@example.test' }), null)
  assert.equal((await verifyPersonalCredentials(db, { ...body, role: 'parent', email: ' SECOND@example.test ' })).role, 'parent')
  assert.equal(await verifyPersonalCredentials(db, { ...body, role: 'teacher' }), null)
  assert.equal(normalizeBirthday('20130514'), '20130514')
  assert.equal(normalizeBirthday('2013/05/14'), '20130514')
  assert.equal(normalizeBirthday('2013/5/4'), '20130504')
  assert.equal(normalizeBirthday('invalid'), '')
  assert.equal(await verifyPersonalCredentials(database({ students: [student, { ...student, id: 'b' }] }), body), null)
})

const overviewInput = {
  student, role: 'parent', today: '2026-09-22', tomorrow: '2026-09-23',
  assignments: [
    { id: 1, title: '逾期', deadline: '2026-09-21' }, { id: 2, title: '今日', deadline: '2026-09-22' },
    { id: 3, title: '不限時', deadline: null }, { id: 4, title: '排除', deadline: '2026-09-20' },
    { id: 5, title: '已交', deadline: '2026-09-19' }
  ],
  submissions: [{ student_id: 'b', assignment_id: 1 }, { student_id: 'a', assignment_id: '5' }],
  messages: [
    { id: 1, student_id: 'a', chat_type: '家長', sender_role: '導師', content: '給家長' },
    { id: 2, student_id: 'a', chat_type: '學生', sender_role: '導師', content: '給學生' },
    { id: 3, student_id: 'b', chat_type: '家長', sender_role: '導師', content: '別人的' }
  ],
  leaves: [{ id: 1, student_id: 'a', chat_type: '家長', content: LEAVE_PREFIX, is_read_by_teacher: true }],
  attendance: [{ student_id: 'a', record_date: '2026-09-22', status: '已到' }, { student_id: 'b', status: '未到' }],
  settings: {
    excluded_assignment_ids_from_report: ['4'],
    announcements_data: [{ id: 1, title: '公告', content: '<b>準備文具</b>', links: [{ url: 'javascript:alert(1)' }, { url: 'https://example.test', name: '網站' }] }],
    parent_announcements_data: [{ id: 2, title: '家長限定' }],
    parent_notices_data: [{ id: 3, isHidden: true }, { id: 4, startDate: '2026-09-23' }, { id: 5, endDate: '2026-09-21' }, { id: 6, content: '今天提醒' }],
    class_notes_data: { '2026-09-23': ['攜帶水壺'] }
  },
  contacts: [{ record_date: '2026-09-22', contact_items: ['帶課本'] }]
}

test('overview honors deadline boundaries, excluded assignments and student ownership', () => {
  const result = buildPersonalOverview(overviewInput)
  assert.deepEqual(result.counts, { overdue: 1, pending: 2, submitted: 1 })
  assert.deepEqual(result.messages.map(m => m.id), [1])
  assert.equal(result.leaves[0].seen, true)
  assert.equal(result.attendance.length, 1)
  assert.deepEqual(result.reminders[1].notes, ['攜帶水壺'])
  assert.equal(result.announcements.length, 3)
  assert.equal(result.announcements[0].content, '準備文具')
  assert.deepEqual(result.announcements[0].links, [{ title: '網站', url: 'https://example.test/' }])
  assert.ok(!('birthday' in result.student))
  assert.ok(!('id_last_5' in result.student))
})

test('students do not receive parent messages, leave details or parent-only notices', () => {
  const result = buildPersonalOverview({ ...overviewInput, role: 'student' })
  assert.deepEqual(result.messages.map(m => m.id), [2])
  assert.deepEqual(result.leaves, [])
  assert.deepEqual(result.announcements.map(n => n.id), [1])
  const hidden = buildPersonalOverview({ ...overviewInput, settings: { ...overviewInput.settings, announcement_board_visible: false, parent_announcement_board_visible: false, parent_notices_board_visible: false } })
  assert.deepEqual(hidden.announcements, [])
})

test('loader scopes each personal query at the database, and never reads password settings', async () => {
  const db = database({ students: [student], private_messages: overviewInput.messages, attendances: overviewInput.attendance })
  const result = await loadPersonalOverview(db, 'a', 'student', new Date(now))
  assert.equal(result.student.id, 'a')
  const privateQueries = db.calls.filter(c => ['assignment_submissions', 'private_messages', 'attendances'].includes(c.table))
  assert.ok(privateQueries.every(c => c.filters.some(([key, op, value]) => key === 'student_id' && op === 'eq' && value === 'a')))
  const messageQuery = privateQueries.find(c => c.table === 'private_messages')
  assert.ok(messageQuery.filters.some(([key, , value]) => key === 'chat_type' && value === '學生'))
  assert.equal(db.calls.filter(c => c.table === 'private_messages').length, 1)
  const settings = db.calls.find(c => c.table === 'system_settings').filters[0][2]
  assert.ok(!settings.includes('admin_password'))
  assert.ok(!settings.includes('parent_notices_data'))
})

test('database failures propagate instead of reporting empty personal data', async () => {
  const db = database({ students: [student] })
  const from = db.from
  db.from = table => {
    const query = from(table)
    if (table === 'assignment_submissions') query.range = async () => ({ data: null, error: new Error('permission denied') })
    return query
  }
  await assert.rejects(loadPersonalOverview(db, 'a', 'parent', new Date(now)), /permission denied/)
})
