import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { contactItemContent, contactItemDueDate, normalizeContactBookItems, syncContactDeadlinesToClassNotes } from '../app/utils/contactBook.js'

test('legacy contact strings migrate to items with an optional empty deadline', () => {
  const normalized = normalizeContactBookItems([
    '帶水壺',
    { content: '  交回條  ', dueDate: '2026-11-03' },
    { content: '日期錯誤', dueDate: 'tomorrow' },
    { content: '   ', dueDate: '2026-11-04' }
  ])
  assert.deepEqual(normalized, [
    { content: '帶水壺', dueDate: '' },
    { content: '交回條', dueDate: '2026-11-03' },
    { content: '日期錯誤', dueDate: '' }
  ])
  assert.equal(contactItemContent(normalized[1]), '交回條')
  assert.equal(contactItemDueDate(normalized[1]), '2026-11-03')
})

test('dated contact items replace only their own synchronized class notes', () => {
  const existing = [
    { date: '', content: '長期事項' },
    { date: '2026-11-03', content: '手動事項' },
    { date: '2026-11-02', content: '舊聯絡簿事項', source: 'contact-book', sourceDate: '2026-10-30' },
    { date: '2026-11-05', content: '其他日期聯絡簿', source: 'contact-book', sourceDate: '2026-10-29' }
  ]
  const result = syncContactDeadlinesToClassNotes(existing, [
    { content: '交回條', dueDate: '2026-11-04' },
    { content: '帶水壺', dueDate: '' }
  ], '2026-10-30')
  assert.deepEqual(result, [
    { date: '', content: '長期事項' },
    { date: '2026-11-03', content: '手動事項' },
    { date: '2026-11-04', content: '交回條', source: 'contact-book', sourceDate: '2026-10-30' },
    { date: '2026-11-05', content: '其他日期聯絡簿', source: 'contact-book', sourceDate: '2026-10-29' }
  ])
  assert.deepEqual(syncContactDeadlinesToClassNotes(result, [{ content: '交回條', dueDate: '' }], '2026-10-30'), [
    { date: '', content: '長期事項' },
    { date: '2026-11-03', content: '手動事項' },
    { date: '2026-11-05', content: '其他日期聯絡簿', source: 'contact-book', sourceDate: '2026-10-29' }
  ])
})

test('contact book UI offers optional deadlines and fullscreen mode', () => {
  const board = readFileSync(new URL('../components/home/ContactBook.vue', import.meta.url), 'utf8')
  const admin = readFileSync(new URL('../app/components/AdminContact.vue', import.meta.url), 'utf8')
  const homepage = readFileSync(new URL('../app/pages/index.vue', import.meta.url), 'utf8')
  assert.match(board, /requestFullscreen\(\)/)
  assert.match(board, /繳交期限，可留空/)
  assert.match(board, /update-date/)
  assert.match(admin, /syncContactDeadlinesToClassNotes/)
  assert.match(homepage, /syncContactDeadlinesToClassNotes/)
})
