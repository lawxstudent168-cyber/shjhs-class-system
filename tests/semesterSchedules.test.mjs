import test from 'node:test'
import assert from 'node:assert/strict'
import { scheduleSemesters, normalizeClassSchedule, normalizeSemesterSchedules, copySemesterSchedules, serializeSemesterSchedules } from '../app/utils/semesterSchedules.js'

const schedule = () => ({ custom: { color: 'green' }, periods: [{ name: '第一節', startTime: '08:20', endTime: '09:05', days: Array.from({ length: 5 }, (_, i) => ({ subject: `科目${i}`, teacher: `教師${i}` })) }] })

test('existing schedule becomes seventh-grade first semester without altering its content or source', () => {
  const legacy = schedule(), original = structuredClone(legacy)
  const bank = normalizeSemesterSchedules(legacy)
  assert.equal(bank.activeTerm, '7-1')
  assert.deepEqual(Object.keys(bank.terms), ['7-1'])
  assert.deepEqual(bank.terms['7-1'], legacy)
  bank.terms['7-1'].periods[0].days[0].subject = '修改'
  assert.deepEqual(legacy, original)
})

test('copy into five semesters creates independent subjects, teachers, times and custom settings', () => {
  const bank = normalizeSemesterSchedules(schedule())
  const targets = scheduleSemesters.map(term => term.id).filter(id => id !== '7-1')
  const copied = copySemesterSchedules(bank, '7-1', targets)
  assert.equal(copied.activeTerm, '7-1')
  assert.equal(Object.keys(copied.terms).length, 6)
  for (const term of targets) assert.deepEqual(copied.terms[term], bank.terms['7-1'])
  copied.terms['7-2'].periods[0].days[0].subject = '自然'
  copied.terms['7-2'].periods[0].days[0].teacher = '新教師'
  copied.terms['7-2'].periods[0].startTime = '08:30'
  copied.terms['7-2'].custom.color = 'red'
  assert.equal(copied.terms['8-1'].periods[0].days[0].subject, '科目0')
  assert.equal(copied.terms['7-1'].periods[0].days[0].teacher, '教師0')
  assert.equal(copied.terms['8-2'].periods[0].startTime, '08:20')
  assert.equal(copied.terms['9-1'].custom.color, 'green')
  assert.equal(Object.keys(bank.terms).length, 1)
})

test('saving future edits keeps homepage published semester until explicitly switched and survives reload', () => {
  const bank = copySemesterSchedules(normalizeSemesterSchedules(schedule()), '7-1', ['7-2'])
  bank.terms['7-2'].periods[0].days[0].subject = '七下新科目'
  let payload = serializeSemesterSchedules(bank)
  assert.equal(payload.periods[0].days[0].subject, '科目0')
  assert.equal(payload.semesterLabel, '七年級上學期')
  const reloaded = normalizeSemesterSchedules(JSON.parse(JSON.stringify(payload)))
  assert.equal(reloaded.terms['7-2'].periods[0].days[0].subject, '七下新科目')
  reloaded.activeTerm = '7-2'
  payload = serializeSemesterSchedules(reloaded)
  assert.equal(payload.periods[0].days[0].subject, '七下新科目')
  assert.equal(payload.semesterLabel, '七年級下學期')
  assert.equal(payload.terms['7-1'].periods[0].days[0].subject, '科目0')
  assert.equal(payload.terms['7-2'].terms, undefined)
})

test('existing target needs explicit overwrite; invalid or mixed targets never mutate the original', () => {
  const bank = copySemesterSchedules(normalizeSemesterSchedules(schedule()), '7-1', ['7-2'])
  bank.terms['7-2'].periods[0].days[0].subject = '保留'
  const original = structuredClone(bank)
  assert.throws(() => copySemesterSchedules(bank, '7-1', ['8-1', '7-2']))
  assert.deepEqual(bank, original)
  for (const targets of [[], ['7-1'], ['unknown']]) assert.throws(() => copySemesterSchedules(bank, '7-1', targets))
  assert.throws(() => serializeSemesterSchedules({ ...bank, activeTerm: '9-2' }))
  const overwritten = copySemesterSchedules(bank, '7-1', ['7-2'], true)
  assert.equal(overwritten.terms['7-2'].periods[0].days[0].subject, '科目0')
  assert.equal(bank.terms['7-2'].periods[0].days[0].subject, '保留')
})

test('legacy sweep rows and string day cells remain supported without modifying stored input', () => {
  const source = { periods: [{ name: '早修', days: ['國文'] }, { name: '第四節', days: [] }] }
  const result = normalizeClassSchedule(source)
  assert.deepEqual(result.periods.map(period => period.name), ['早修', '早掃時間', '第四節', '午餐和午掃'])
  assert.deepEqual(result.periods[0].days[0], { subject: '國文', teacher: '' })
  assert.equal(result.periods[0].days.length, 5)
  assert.equal(source.periods.length, 2)
})
