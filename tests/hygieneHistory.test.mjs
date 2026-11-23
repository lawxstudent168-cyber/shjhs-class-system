import test from 'node:test'
import assert from 'node:assert/strict'
import { deleteHygieneRecord, exportHygieneHistory, importHygieneHistory, resolveHygieneForDate, resolveHygieneSection, setHygieneRecord } from '../app/utils/hygieneHistory.js'
import { clearHygieneSeatAssignments } from '../app/utils/hygieneAssignments.js'
import { hygienePlanIds, normalizeHygienePlans, resolveHomepageHygiene } from '../app/utils/hygienePlans.js'
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

test('legacy hygiene data becomes plan A while B through E remain independent', () => {
  const fallback = { nameFontSize: 24, morning: { title: '空白方案' }, lunch: {}, squad: {}, history: {} }
  const normalized = normalizeHygienePlans({ isVisibleOnIndex: true, morning: { title: '既有方案', board_names: '1' }, lunch: {}, squad: {} }, fallback)
  assert.equal(normalized.plans.A.morning.title, '既有方案')
  assert.equal(normalized.plans.B.morning.title, '空白方案')
  assert.equal(normalized.plans.C.morning.title, '空白方案')
  assert.equal(normalized.plans.D.morning.title, '空白方案')
  assert.equal(normalized.plans.E.morning.title, '空白方案')
  normalized.plans.B.morning.title = 'B 方案'
  assert.equal(normalized.plans.A.morning.title, '既有方案')
})

test('homepage automatically keeps the previous plan and changes on each implementation date', () => {
  const data = {
    isVisibleOnIndex: true,
    homepagePlan: 'B',
    planStartDates: { A: '', B: '2026-11-20', C: '2026-12-01' },
    plans: {
      A: { morning: { title: 'A' }, lunch: {}, squad: {} },
      B: { morning: { title: 'B' }, lunch: {}, squad: {} },
      C: { morning: { title: 'C' }, lunch: {}, squad: {} }
    }
  }
  const previous = resolveHomepageHygiene(data, '2026-11-19')
  assert.equal(previous.isVisibleOnIndex, true)
  assert.equal(previous.activePlan, 'A')
  assert.equal(previous.morning.title, 'A')
  const active = resolveHomepageHygiene(data, '2026-11-20')
  assert.equal(active.isVisibleOnIndex, true)
  assert.equal(active.activePlan, 'B')
  assert.equal(active.morning.title, 'B')
  assert.equal(resolveHomepageHygiene(data, '2026-12-01').activePlan, 'C')
})

test('clearing a plan removes every base and historical seat assignment but keeps its work text', () => {
  const plan = {
    morning: { title: '早掃', board_names: '1、2', board_work: '擦黑板', out_dynamic_areas: [{ area: '走廊', names: '3', work: '掃地' }] },
    lunch: { clean_n1: '4', note1: '午餐說明' },
    squad: { leaders: ['5', '6'], leader_desc: '帶隊' },
    history: setHygieneRecord({}, 'morning', '2026-11-20', { board_names: '7', board_work: '歷史工作' })
  }
  const cleared = clearHygieneSeatAssignments(plan)
  assert.equal(cleared.morning.board_names, '')
  assert.equal(cleared.morning.out_dynamic_areas[0].names, '')
  assert.equal(cleared.lunch.clean_n1, '')
  assert.deepEqual(cleared.squad.leaders, ['', ''])
  assert.equal(cleared.history.morning[0].data.board_names, '')
  assert.equal(cleared.history.morning[0].data.board_work, '歷史工作')
  assert.equal(cleared.morning.board_work, '擦黑板')
})

test('hygiene management exposes A through E plans, scheduling, copying and clearing', () => {
  const page = readFileSync(new URL('../app/pages/hygiene.vue', import.meta.url), 'utf8')
  assert.deepEqual(hygienePlanIds, ['A', 'B', 'C', 'D', 'E'])
  assert.match(page, /目前編輯/)
  assert.match(page, /首頁基準方案/)
  assert.match(page, /開始實施日期/)
  assert.match(page, /switchPlan/)
  assert.match(page, /完整複製/)
  assert.match(page, /清空.*方案全部座號/)
})
