import test from 'node:test'
import assert from 'node:assert/strict'
import { deleteHygieneRecord, exportHygieneHistory, importHygieneHistory, resolveHygieneForDate, resolveHygieneSection, setHygieneRecord } from '../app/utils/hygieneHistory.js'
import { normalizeHygienePlans, resolveHomepageHygiene } from '../app/utils/hygienePlans.js'
import { readFileSync } from 'node:fs'

test('each tab keeps its original content until its first dated change, then uses the latest change', () => {
  const original = { morning: { title: '早掃原版', board_names: '1' }, lunch: { title: '午餐原版' }, squad: { title: '小隊原版' } }
  let history = setHygieneRecord({}, 'morning', '2026-10-16', { title: '早掃新版', board_names: '2' })
  history = setHygieneRecord(history, 'morning', '2026-10-20', { title: '早掃第三版', board_names: '3' })
  history = setHygieneRecord(history, 'lunch', '2026-10-18', { title: '午餐新版' })
  const data = { ...original, history }
  assert.equal(resolveHygieneForDate(data, '2026-10-15').morning.title, '早掃原版')
  assert.equal(resolveHygieneForDate(data, '2026-10-16').morning.title, '早掃新版')
  assert.equal(resolveHygieneForDate(data, '2026-10-19').morning.title, '早掃新版')
  assert.equal(resolveHygieneForDate(data, '2026-10-20').morning.title, '早掃第三版')
  assert.equal(resolveHygieneForDate(data, '2026-10-17').lunch.title, '午餐原版')
  assert.equal(resolveHygieneForDate(data, '2026-10-19').lunch.title, '午餐新版')
  assert.equal(resolveHygieneForDate(data, '2026-10-20').squad.title, '小隊原版')
  history = deleteHygieneRecord(history, 'morning', '2026-10-20')
  assert.equal(resolveHygieneSection({ ...original, history }, 'morning', '2026-10-21').section.title, '早掃新版')
})

test('editing a date replaces only that record', () => {
  let history = setHygieneRecord({}, 'squad', '2026-10-16', { title: '初版' })
  history = setHygieneRecord(history, 'squad', '2026-10-16', { title: '修正版' })
  assert.equal(history.squad.length, 1)
  assert.equal(history.squad[0].data.title, '修正版')
})

test('JSON and CSV round-trip one complete tab and reject another tab', () => {
  const data = { morning: { title: '早掃', board_names: '1、2', board_work: '掃地，拖地\n擦桌子' }, history: setHygieneRecord({}, 'morning', '2026-10-16', { title: '更新', board_names: '3', board_work: '擦「講桌」' }) }
  for (const type of ['json', 'csv']) {
    const encoded = exportHygieneHistory(data, 'morning', type)
    const imported = importHygieneHistory(encoded, 'morning', type)
    assert.deepEqual(imported.base, data.morning)
    assert.deepEqual(imported.records, data.history.morning)
    assert.throws(() => importHygieneHistory(encoded, 'lunch', type))
  }
})

test('historical student names are cleaned while historical work details remain', () => {
  const data = { morning: { board_names: '舊姓名', board_work: '保留說明' }, history: setHygieneRecord({}, 'morning', '2026-10-16', { board_names: '舊姓名', board_work: '保留歷史說明' }) }
  const resolved = resolveHygieneForDate(data, '2026-10-17')
  assert.equal(resolved.morning.board_names, '')
  assert.equal(resolved.morning.board_work, '保留歷史說明')
})

test('legacy hygiene data becomes plan A while B and C remain independent', () => {
  const fallback = { nameFontSize: 24, morning: { title: '空白方案' }, lunch: {}, squad: {}, history: {} }
  const normalized = normalizeHygienePlans({ isVisibleOnIndex: true, morning: { title: '既有方案', board_names: '1' }, lunch: {}, squad: {} }, fallback)
  assert.equal(normalized.plans.A.morning.title, '既有方案')
  assert.equal(normalized.plans.B.morning.title, '空白方案')
  assert.equal(normalized.plans.C.morning.title, '空白方案')
  normalized.plans.B.morning.title = 'B 方案'
  assert.equal(normalized.plans.A.morning.title, '既有方案')
})

test('the selected homepage plan appears only from its implementation date', () => {
  const data = {
    isVisibleOnIndex: true,
    homepagePlan: 'B',
    planStartDates: { A: '', B: '2026-11-20', C: '' },
    plans: {
      A: { morning: { title: 'A' }, lunch: {}, squad: {} },
      B: { morning: { title: 'B' }, lunch: {}, squad: {} },
      C: { morning: { title: 'C' }, lunch: {}, squad: {} }
    }
  }
  assert.equal(resolveHomepageHygiene(data, '2026-11-19').isVisibleOnIndex, false)
  const active = resolveHomepageHygiene(data, '2026-11-20')
  assert.equal(active.isVisibleOnIndex, true)
  assert.equal(active.activePlan, 'B')
  assert.equal(active.morning.title, 'B')
})

test('hygiene management exposes A B C plans, homepage selection and start dates', () => {
  const page = readFileSync(new URL('../app/pages/hygiene.vue', import.meta.url), 'utf8')
  assert.match(page, /目前編輯/)
  assert.match(page, /首頁顯示方案/)
  assert.match(page, /開始實施日期/)
  assert.match(page, /switchPlan/)
})
