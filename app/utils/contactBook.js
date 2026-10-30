import { normalizeClassNotes } from './classNotes.js'
import { isValidExamDate } from './examSchedule.js'

export function contactItemContent(item) {
  return typeof item === 'string' ? item : typeof item?.content === 'string' ? item.content : ''
}

export function contactItemDueDate(item) {
  return typeof item === 'object' && item && isValidExamDate(item.dueDate) ? item.dueDate : ''
}

export function normalizeContactBookItems(value) {
  if (!Array.isArray(value)) return []
  return value
    .map(item => ({
      content: contactItemContent(item).trim(),
      dueDate: contactItemDueDate(item)
    }))
    .filter(item => item.content)
}

export function editableContactBookItems(value) {
  return normalizeContactBookItems(value).map(item => ({ ...item }))
}

export function syncContactDeadlinesToClassNotes(existingNotes, contactItems, recordDate) {
  const retained = normalizeClassNotes(existingNotes).filter(item =>
    !(item.source === 'contact-book' && item.sourceDate === recordDate))
  const synced = normalizeContactBookItems(contactItems)
    .filter(item => item.dueDate)
    .map(item => ({
      date: item.dueDate,
      content: item.content,
      source: 'contact-book',
      sourceDate: recordDate
    }))
  return normalizeClassNotes([...retained, ...synced])
}
