import { sanitizeHygieneAssignments } from './hygieneAssignments.js'

export const hygieneTabs = ['morning', 'lunch', 'squad']
export const validHygieneDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
const copy = value => JSON.parse(JSON.stringify(value))

export function normalizeHygieneHistory(value) {
  const result = { morning: [], lunch: [], squad: [] }
  for (const tab of hygieneTabs) {
    const byDate = new Map()
    for (const entry of Array.isArray(value?.[tab]) ? value[tab] : []) {
      if (validHygieneDate(entry?.date) && entry.data && typeof entry.data === 'object' && !Array.isArray(entry.data)) {
        byDate.set(entry.date, { date: entry.date, data: copy(entry.data) })
      }
    }
    result[tab] = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  }
  return result
}

export function resolveHygieneSection(data, tab, date) {
  if (!hygieneTabs.includes(tab)) throw new Error('未知的衛生分頁')
  const records = normalizeHygieneHistory(data?.history)[tab]
  let section = data?.[tab] || {}
  let effectiveDate = ''
  for (const record of records) {
    if (record.date > date) break
    section = record.data
    effectiveDate = record.date
  }
  return { section: copy(section), effectiveDate }
}

export function resolveHygieneForDate(data, date) {
  const sanitized = sanitizeHygieneAssignments(data || {})
  const resolved = { ...sanitized }
  for (const tab of hygieneTabs) resolved[tab] = resolveHygieneSection(sanitized, tab, date).section
  return resolved
}

export function setHygieneRecord(history, tab, date, section) {
  if (!hygieneTabs.includes(tab) || !validHygieneDate(date) || !section || typeof section !== 'object' || Array.isArray(section)) throw new Error('日期或紀錄格式錯誤')
  const result = normalizeHygieneHistory(history)
  result[tab] = [...result[tab].filter(item => item.date !== date), { date, data: copy(section) }].sort((a, b) => a.date.localeCompare(b.date))
  return result
}

export function deleteHygieneRecord(history, tab, date) {
  if (!hygieneTabs.includes(tab)) throw new Error('未知的衛生分頁')
  const result = normalizeHygieneHistory(history)
  result[tab] = result[tab].filter(item => item.date !== date)
  return result
}

const csvCell = value => `"${String(value).replaceAll('"', '""')}"`
export function exportHygieneHistory(data, tab, type) {
  if (!hygieneTabs.includes(tab)) throw new Error('未知的衛生分頁')
  const payload = { format: 'hygiene-history-v1', tab, base: copy(data[tab] || {}), records: normalizeHygieneHistory(data.history)[tab] }
  if (type === 'json') return JSON.stringify(payload, null, 2)
  if (type !== 'csv') throw new Error('不支援的檔案格式')
  return '\ufefftab,date,data\r\n' + [['BASE', payload.base], ...payload.records.map(item => [item.date, item.data])].map(([date, section]) => `${csvCell(tab)},${csvCell(date)},${csvCell(JSON.stringify(section))}`).join('\r\n') + '\r\n'
}

function parseCsvRows(text) {
  const rows = []
  let row = [], field = '', quoted = false
  const input = text.replace(/^\ufeff/, '')
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i++ }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); if (row.some(Boolean)) rows.push(row); row = []; field = '' }
    else field += char
  }
  if (quoted) throw new Error('CSV 引號未結束')
  if (row.length || field) { row.push(field); rows.push(row) }
  return rows
}

export function importHygieneHistory(text, tab, type) {
  if (!hygieneTabs.includes(tab)) throw new Error('未知的衛生分頁')
  let payload
  if (type === 'json') payload = JSON.parse(text)
  else if (type === 'csv') {
    const rows = parseCsvRows(text)
    if (rows.shift()?.join(',') !== 'tab,date,data') throw new Error('CSV 欄位應為 tab,date,data')
    const parsed = rows.map(row => {
      if (row.length !== 3 || row[0] !== tab) throw new Error('CSV 欄位數或分頁不符')
      return { date: row[1], data: JSON.parse(row[2]) }
    })
    const base = parsed.shift()
    if (base?.date !== 'BASE') throw new Error('CSV 缺少原始版本')
    payload = { format: 'hygiene-history-v1', tab, base: base.data, records: parsed }
  } else throw new Error('請選擇 JSON 或 CSV 檔')
  if (payload?.format !== 'hygiene-history-v1' || payload.tab !== tab || !payload.base || typeof payload.base !== 'object' || Array.isArray(payload.base) || !Array.isArray(payload.records) || payload.records.length > 5000) throw new Error('檔案格式或分頁不符')
  if (payload.records.some(item => !validHygieneDate(item?.date) || !item.data || typeof item.data !== 'object' || Array.isArray(item.data))) throw new Error('紀錄日期或內容格式錯誤')
  const sanitized = sanitizeHygieneAssignments({ [tab]: payload.base, history: { [tab]: payload.records } })
  return { base: sanitized[tab], records: normalizeHygieneHistory(sanitized.history)[tab] }
}
