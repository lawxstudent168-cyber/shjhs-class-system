import test from 'node:test'
import assert from 'node:assert/strict'
import { schoolDate, fetchAllRows, buildTeacherTodos } from '../app/utils/teacherTodos.js'
const students = [{ id: 1, seat_number: 1, real_name: '甲' }, { id: '2', seat_number: 2, real_name: '乙' }]
const make = (extra = {}) => buildTeacherTodos({ students, messages: [], assignments: [], submissions: [], today: '2026-09-22', ...extra })

test('school date rolls over at Taipei midnight', () => {
  assert.equal(schoolDate(new Date('2026-09-21T15:59:59Z')), '2026-09-21')
  assert.equal(schoolDate(new Date('2026-09-21T16:00:00Z')), '2026-09-22')
})
test('only overdue assignments with missing students are actionable', () => {
  const assignments = [
    { id: 1, deadline: '2026-09-20' }, { id: 2, deadline: '2026-09-22' },
    { id: 3, deadline: '2026-09-23' }, { id: 4, deadline: null },
    { id: 5, deadline: '2026-09-19' }, { id: 6, deadline: '2026-09-18' }
  ]
  const submissions = [
    { assignment_id: '1', student_id: '1' }, { assignment_id: 1, student_id: 1 },
    { assignment_id: 5, student_id: 1 }, { assignment_id: '5', student_id: 2 },
    { assignment_id: 6, student_id: 'deleted-student' }
  ]
  const result = make({ assignments, submissions })
  assert.deepEqual(result.overdue.map(a => [a.id, a.missing.length]), [[6, 2], [1, 1]])
  assert.equal(result.overdue[1].missing[0].id, '2')
  assert.deepEqual(make({ students: [], assignments }).overdue, [])
})
test('leave and other unread counts are disjoint, exclude read messages and teacher replies', () => {
  const leave = '【系統自動推播：線上請假通知】\n請假日期：2026-09-22'
  const base = { student_id: '1', chat_type: '家長', sender_role: '家長(甲)', is_read_by_teacher: false, created_at: '2026-09-21T00:00:00Z' }
  const messages = [
    { ...base, id: 1, content: leave },
    { ...base, id: 2, content: leave, is_read_by_teacher: true },
    { ...base, id: 3, content: '收到', sender_role: '導師' },
    { ...base, id: 4, content: '問題', created_at: '2026-09-20T00:00:00Z' },
    { ...base, id: 5, content: leave, chat_type: '學生' },
    { ...base, id: 6, content: '資料', student_id: 'deleted' }
  ]
  const result = make({ messages })
  assert.deepEqual(result.leaves.map(m => m.id), [1])
  assert.equal(result.leaves[0].studentLabel, '1號 甲')
  assert.deepEqual(result.messages.map(m => m.id), [4, 5, 6])
  assert.equal(result.messages[2].studentLabel, '名單外學生')
  assert.equal(make({ messages: messages.map(m => ({ ...m, is_read_by_teacher: true })) }).leaves.length, 0)
})
test('fetches all pages including beyond default 1000-row cap', async () => {
  const rows = Array.from({ length: 1001 }, (_, id) => ({ id }))
  const result = await fetchAllRows(() => ({ range: async (start, end) => ({ data: rows.slice(start, end + 1), error: null }) }))
  assert.deepEqual(result, rows)
})
test('a failed page or malformed response cannot produce false empty/success results', async () => {
  await assert.rejects(fetchAllRows(() => ({ range: async () => ({ data: null, error: new Error('denied') }) })), /denied/)
  await assert.rejects(fetchAllRows(() => ({ range: async () => ({ data: null, error: null }) })), /格式/)
  await assert.rejects(fetchAllRows(() => ({ range: async start => start === 0 ? { data: Array(500).fill({}), error: null } : { error: new Error('offline') } })), /offline/)
})
