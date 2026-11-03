import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { autoArrangeMedia, copyPreviousWeek, delayMediaSchedule, mediaCalendarDays, nextSchoolDay, normalizeMediaSchedule, resolveMediaForDate, setMediaForDate } from '../app/utils/mediaSchedule.js'

const urls = [
  'https://youtu.be/aaaaaaaaaaa',
  'https://youtu.be/bbbbbbbbbbb',
  'https://youtu.be/ccccccccccc'
]

test('legacy weekday schedules remain available until a calendar schedule is created', () => {
  const legacyVideo = { videos: { 1: urls[0], 6: urls[1] } }
  assert.equal(resolveMediaForDate(legacyVideo, '2026-11-02', { nestedLegacy: true }), urls[0])
  assert.equal(resolveMediaForDate(legacyVideo, '2026-11-07', { nestedLegacy: true }), '')
  assert.deepEqual(normalizeMediaSchedule({ 1: urls[1] }).legacy[1], urls[1])
})

test('playlist auto-arrangement clearly numbers videos and skips weekends', () => {
  const arranged = autoArrangeMedia({ library: urls, calendar: { '2026-11-12': { url: urls[0], order: 99 } } }, '2026-11-06')
  assert.deepEqual(arranged.calendar, {
    '2026-11-06': { url: urls[0], order: 1 },
    '2026-11-09': { url: urls[1], order: 2 },
    '2026-11-10': { url: urls[2], order: 3 }
  })
  assert.equal(nextSchoolDay('2026-11-06'), '2026-11-09')
})

test('weekends select only from videos played before that weekend', () => {
  const schedule = autoArrangeMedia({ library: urls }, '2026-11-02')
  const saturday = resolveMediaForDate(schedule, '2026-11-07')
  const sunday = resolveMediaForDate(schedule, '2026-11-08')
  assert.ok(urls.includes(saturday))
  assert.ok(urls.includes(sunday))
  assert.equal(resolveMediaForDate(schedule, '2026-11-01'), '')
})

test('delay moves the remaining list one school day and keeps past entries', () => {
  const schedule = autoArrangeMedia({ library: urls }, '2026-11-02')
  const delayed = delayMediaSchedule(schedule, '2026-11-03')
  assert.deepEqual(delayed.calendar, {
    '2026-11-02': { url: urls[0], order: 1 },
    '2026-11-04': { url: urls[1], order: 2 },
    '2026-11-05': { url: urls[2], order: 3 }
  })
})

test('calendar supports manual choices and copying the previous school week', () => {
  let schedule = setMediaForDate({ library: urls }, '2026-10-26', urls[0])
  schedule = setMediaForDate(schedule, '2026-10-27', urls[1])
  schedule = copyPreviousWeek(schedule, '2026-11-04')
  assert.equal(schedule.calendar['2026-11-02'].url, urls[0])
  assert.equal(schedule.calendar['2026-11-03'].url, urls[1])
  assert.equal(schedule.calendar['2026-11-04'], undefined)
  assert.equal(setMediaForDate(schedule, '2026-11-07', urls[2]).calendar['2026-11-07'], undefined)
  assert.equal(mediaCalendarDays('2026-11').filter(Boolean).length, 30)
})

test('admin and homepage expose calendar, playlist, copy-week and password delay controls', () => {
  const editor = readFileSync(new URL('../app/components/MediaScheduleEditor.vue', import.meta.url), 'utf8')
  const admin = readFileSync(new URL('../app/components/AdminYouTubeSchedule.vue', import.meta.url), 'utf8')
  const delayButton = readFileSync(new URL('../components/home/ScheduleDelayButton.vue', import.meta.url), 'utf8')
  const homepage = readFileSync(new URL('../app/pages/index.vue', import.meta.url), 'utf8')
  assert.match(editor, /複製上週清單/)
  assert.match(editor, /依清單順序自動排列/)
  assert.match(editor, /目前共有/)
  assert.match(admin, /MediaScheduleEditor/g)
  assert.match(delayButton, /導師動態密碼/)
  assert.match(delayButton, /延後到隔天/)
  assert.match(homepage, /matchesTeacherVideoPassword/)
  assert.match(homepage, /delayMediaSchedule/)
})
