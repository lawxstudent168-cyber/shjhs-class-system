import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { classNoteDateLabel, normalizeClassNotes, weeklyClassNotes } from '../app/utils/classNotes.js'

test('existing date-keyed notes migrate without losing their dates or history', () => {
  const legacy = {
    '2026-10-11': ['舊事項'],
    '2026-10-13': ['帶水壺', '交回條']
  }
  assert.deepEqual(normalizeClassNotes(legacy), [
    { date: '2026-10-11', content: '舊事項' },
    { date: '2026-10-13', content: '帶水壺' },
    { date: '2026-10-13', content: '交回條' }
  ])
})

test('the homepage shows today through six days ahead and drops each note the next day', () => {
  const notes = [
    { date: '2026-10-11', content: '昨天' },
    { date: '2026-10-12', content: '今天' },
    { date: '2026-10-18', content: '第七天' },
    { date: '2026-10-19', content: '第八天' }
  ]
  const mondayMidnightTaipei = Date.UTC(2026, 9, 11, 16)
  assert.deepEqual(weeklyClassNotes(notes, mondayMidnightTaipei).map(item => item.content), ['今天', '第七天'])
  assert.deepEqual(weeklyClassNotes(notes, mondayMidnightTaipei + 86400000).map(item => item.content), ['第七天', '第八天'])
  assert.equal(classNoteDateLabel('2026-10-12'), '10/12（週一）')
})

test('seven-day window crosses month and year boundaries', () => {
  const notes = [{ date: '2027-01-06', content: '六天後' }, { date: '2027-01-07', content: '七天後' }]
  assert.deepEqual(weeklyClassNotes(notes, Date.UTC(2026, 11, 30, 16)).map(item => item.content), ['六天後'])
})

test('notes without a date stay permanently on the homepage and sort first', () => {
  const notes = [
    { date: '2026-11-02', content: '下週事項' },
    { date: '', content: '每天都要帶水壺' },
    { content: '缺少日期欄位也視為長期事項' },
    { date: 'not-a-date', content: '無效日期' }
  ]
  assert.deepEqual(normalizeClassNotes(notes), [
    { date: '', content: '每天都要帶水壺' },
    { date: '', content: '缺少日期欄位也視為長期事項' },
    { date: '2026-11-02', content: '下週事項' }
  ])
  assert.deepEqual(weeklyClassNotes(notes, '2027-05-01').map(item => item.content), [
    '每天都要帶水壺',
    '缺少日期欄位也視為長期事項'
  ])
  assert.equal(classNoteDateLabel(''), '長期')
})

test('class notes UI supports blank dates and a native fullscreen control', () => {
  const board = readFileSync(new URL('../components/home/ClassNotes.vue', import.meta.url), 'utf8')
  const admin = readFileSync(new URL('../app/components/AdminClassNotes.vue', import.meta.url), 'utf8')
  assert.match(board, /requestFullscreen\(\)/)
  assert.match(board, /document\.exitFullscreen\(\)/)
  assert.match(board, /日期留空時永久顯示/)
  assert.match(admin, /事項日期（留空＝永久）/)
  assert.match(admin, /\{ date: '', content: '' \}/)
})
