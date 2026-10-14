import test from 'node:test'
import assert from 'node:assert/strict'
import { hygieneAssignmentReport, sanitizeHygieneAssignments } from '../app/utils/hygieneAssignments.js'

test('old student names are removed only from assignment fields', () => {
  const saved = {
    morning: { board_names: '舊學生姓名', board_work: '清理黑板', out_dynamic_areas: [{ area: '走廊', names: '舊學生姓名', work: '掃地' }] },
    lunch: { clean_n1: '舊學生姓名', clean_h1: '整理講桌' },
    squad: { leaders: ['舊學生姓名', '2號'], leader_desc: '提醒小隊員' }
  }
  const clean = sanitizeHygieneAssignments(saved)
  assert.equal(clean.morning.board_names, '')
  assert.equal(clean.morning.out_dynamic_areas[0].names, '')
  assert.equal(clean.lunch.clean_n1, '')
  assert.deepEqual(clean.squad.leaders, ['', '2'])
  assert.equal(clean.morning.board_work, '清理黑板')
  assert.equal(clean.morning.out_dynamic_areas[0].work, '掃地')
  assert.equal(clean.lunch.clean_h1, '整理講桌')
  assert.equal(clean.squad.leader_desc, '提醒小隊員')
  assert.equal(saved.morning.board_names, '舊學生姓名')
})

test('each hygiene tab reports missing and repeated seat numbers independently', () => {
  const data = {
    morning: { board_names: '1、2', sweep_names: '2號' },
    lunch: { clean_n1: '1', move_n1: '2', serve_n1: '3' },
    squad: { leaders: ['1'], duties: ['4'], helpers: ['舊學生姓名'] }
  }
  const seats = [1, 2, 3]
  assert.deepEqual(hygieneAssignmentReport(data, 'morning', seats).missing, ['3'])
  assert.deepEqual(hygieneAssignmentReport(data, 'morning', seats).repeated, [{ seat: '2', count: 2 }])
  assert.deepEqual(hygieneAssignmentReport(data, 'lunch', seats).missing, [])
  assert.deepEqual(hygieneAssignmentReport(data, 'lunch', seats).repeated, [])
  assert.deepEqual(hygieneAssignmentReport(data, 'squad', seats).unknown, ['4'])
  assert.deepEqual(hygieneAssignmentReport(data, 'squad', seats).invalid, ['舊學生姓名'])
})
