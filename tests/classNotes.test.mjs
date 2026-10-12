import test from 'node:test'
import assert from 'node:assert/strict'
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
