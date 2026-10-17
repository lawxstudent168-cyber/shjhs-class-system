import test from 'node:test'
import assert from 'node:assert/strict'
import { visitorEventPrefix, normalizeVisitorLog, groupVisitorLogs, filterVisitorLogs, visitorLogsCsv } from '../app/utils/visitorTracking.js'
import { createVisitorTracker } from '../app/utils/visitorTrackingClient.js'

const storage = initial => {
  const map = new Map(Object.entries(initial || {}))
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) }
}
const row = (id, identity, sessionId, deviceId = 'browser-1', kind = 'click') => normalizeVisitorLog({
  id, created_at: `2026-10-17T00:00:${String(id).padStart(2, '0')}Z`, ip_address: '1.2.3.4', device_info: 'browser', role: identity,
  action_details: visitorEventPrefix + JSON.stringify({ kind, identity, session_id: sessionId, device_id: deviceId, label: '操作', path: '/admin', identity_source: '密碼驗證' })
})

test('same IP cannot merge different people or different logins; anonymous historical logs remain unattributed', () => {
  const logs = [row(1, '王同學 家長', 'login-1', 'd1', 'login'), row(2, '王同學 家長', 'login-2', 'd2', 'login'), row(3, '導師', 'login-3')]
  logs.push(normalizeVisitorLog({ id: 4, role: null, ip_address: '1.2.3.4', action_details: '點擊：按鈕' }))
  assert.equal(groupVisitorLogs(logs, 'identity').length, 2)
  const parent = groupVisitorLogs(logs, 'identity').find(group => group.key === '王同學 家長')
  assert.equal(parent.devices.size, 2)
  assert.equal(parent.loginCount, 2)
  assert.equal(groupVisitorLogs(logs, 'session').length, 4)
  assert.equal(logs[3].identity, '未記錄身分')
  assert.equal(logs[3].sessionId, '')
  assert.equal(logs[3].label, '點擊：按鈕')
})

test('browser identifiers survive an IP change, and every event retains the actual actor', () => {
  const first = row(1, '學生', 's1')
  const second = { ...row(2, '導師', 's2'), ip_address: '2.3.4.5' }
  const groups = groupVisitorLogs([first, second], 'device')
  assert.equal(groups.length, 1)
  assert.deepEqual([...groups[0].identities].sort(), ['學生', '導師'])
  assert.equal(groups[0].logs[0].identity, '導師')
})

test('search and category filters work on legacy and structured records; CSV escapes formulas and quotes', () => {
  const logs = [row(1, '王同學 家長', 's1', 'd1', 'login'), row(2, '導師', 's2')]
  assert.equal(filterVisitorLogs(logs, { search: '王同學', kind: 'login' }).length, 1)
  assert.equal(filterVisitorLogs(logs, { search: '1.2.3.4' }).length, 2)
  assert.equal(filterVisitorLogs(logs, { kind: 'page' }).length, 0)
  assert.match(visitorLogsCsv([{ ...logs[0], label: '=1+1', details: '含"引號' }]), /"'=1\+1"/)
  assert.match(visitorLogsCsv([{ ...logs[0], details: '含"引號' }]), /含""引號/)
  const broken = normalizeVisitorLog({ id: 8, action_details: visitorEventPrefix + '{invalid' })
  assert.equal(broken.kind, 'legacy')
})

test('async writes snapshot identity and session before IP lookup, including rapid role switches', async () => {
  const writes = []
  let release
  const ip = new Promise(resolve => { release = resolve })
  let sequence = 0
  const tracker = createVisitorTracker({ client: { from: () => ({ insert: async rows => { writes.push(...rows); return { error: null } } }) },
    local: storage(), session: storage(), getIP: () => ip, getPath: () => '/admin', userAgent: 'UA', uuid: () => `id-${++sequence}` })
  const first = tracker.login('王同學 家長', '家長驗證')
  const second = tracker.record({ kind: 'click', label: '查看', password: 'never-copy-this', token: 'secret' })
  const third = tracker.login('導師', '導師驗證')
  release('1.2.3.4')
  await Promise.all([first, second, third])
  const logs = writes.map(normalizeVisitorLog)
  assert.deepEqual(logs.map(log => log.identity), ['王同學 家長', '王同學 家長', '導師'])
  assert.equal(logs[0].sessionId, logs[1].sessionId)
  assert.notEqual(logs[1].sessionId, logs[2].sessionId)
  assert.equal(JSON.stringify(writes).includes('never-copy-this'), false)
  assert.equal(JSON.stringify(writes).includes('secret'), false)
})

test('logout, reload, remembered identity and resumed role are separate from fresh password logins', async () => {
  const writes = []
  let sequence = 0, path = '/'
  const local = storage({ visitor_known_identity: '王同學 家長' }), session = storage()
  const options = { client: { from: () => ({ insert: async rows => { writes.push(...rows); return {} } }) }, local, session,
    getIP: async () => '', getPath: () => path, userAgent: 'UA', uuid: () => `id-${++sequence}` }
  let tracker = createVisitorTracker(options)
  await tracker.record({ kind: 'page', label: '首頁' })
  assert.match(normalizeVisitorLog(writes[0]).source, /裝置記憶/)
  await tracker.login('導師')
  tracker = createVisitorTracker(options)
  await tracker.record({ kind: 'page', label: '重新整理' })
  assert.equal(normalizeVisitorLog(writes[1]).sessionId, normalizeVisitorLog(writes[2]).sessionId)
  await tracker.logout()
  await tracker.record({ kind: 'page', label: '登出後瀏覽' })
  assert.equal(normalizeVisitorLog(writes[3]).identity, '導師')
  assert.equal(normalizeVisitorLog(writes[4]).identity, '王同學 家長')
  assert.notEqual(normalizeVisitorLog(writes[3]).sessionId, normalizeVisitorLog(writes[4]).sessionId)
  path = '/admin'
  await tracker.resume('導師')
  assert.match(normalizeVisitorLog(writes[5]).source, /未重新驗證/)
  assert.equal(writes.map(normalizeVisitorLog).filter(log => log.kind === 'login').length, 1)
})

test('storage restrictions and failed writes do not block the original user action', async () => {
  const blockedStorage = { getItem: () => { throw Error('blocked') }, setItem: () => { throw Error('blocked') } }
  let errors = 0
  const tracker = createVisitorTracker({ client: { from: () => ({ insert: async () => ({ error: { message: 'permission denied' } }) }) },
    local: blockedStorage, session: blockedStorage, getIP: async () => '', getPath: () => '/', userAgent: 'UA', uuid: () => Math.random().toString(), onError: () => errors++ })
  assert.equal(await tracker.login('導師'), false)
  assert.equal(errors, 1)
})
