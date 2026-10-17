import { visitorEventPrefix } from './visitorTracking.js'

let activeTracker = null
export const configureVisitorTracker = tracker => { activeTracker = tracker }
export const trackVisitorEvent = event => activeTracker?.record(event) || Promise.resolve(false)
export const beginVisitorSession = (identity, source = '密碼驗證') => activeTracker?.login(identity, source) || Promise.resolve(false)
export const resumeVisitorSession = identity => activeTracker?.resume(identity) || Promise.resolve(false)
export const endVisitorSession = label => activeTracker?.logout(label) || Promise.resolve(false)

export function createVisitorTracker({ client, local, session, getIP, getPath, userAgent, uuid, now = Date.now, onError = () => {} }) {
  const read = (storage, key) => { try { return storage.getItem(key) } catch { return null } }
  const write = (storage, key, value) => { try { storage.setItem(key, value) } catch { /* Private browsing can disable storage. */ } }
  const remembered = () => read(local, 'visitor_known_identity') || '匿名來訪者'
  const deviceId = read(local, 'visitor_tracking_device') || uuid()
  write(local, 'visitor_tracking_device', deviceId)
  let state
  try { state = JSON.parse(read(session, 'visitor_tracking_session')) } catch { /* Start a session below. */ }
  if (!state?.id || typeof state.identity !== 'string') state = { id: uuid(), identity: remembered(), source: remembered() === '匿名來訪者' ? '匿名' : '裝置記憶身分（本次未重新驗證）', path: getPath(), last: now() }
  const persist = () => write(session, 'visitor_tracking_session', JSON.stringify(state))
  const record = async ({ kind, label, details = '', outcome = '', path = getPath() }) => {
    // Start a separate continuation after inactivity; never count it as a fresh login.
    if (now() - state.last > 30 * 60 * 1000) {
      state = { id: uuid(), identity: state.identity, source: '閒置後延續身分（本次未重新驗證）', path, last: now() }
    }
    state.last = now()
    persist()
    const snapshot = { kind, label: String(label).slice(0, 160), details: String(details).slice(0, 500), outcome,
      path: String(path).split(/[?#]/)[0], session_id: state.id, device_id: deviceId,
      identity: state.identity, identity_source: state.source }
    try {
      const ip = await getIP()
      const { error } = await client.from('visitor_logs').insert([{ ip_address: ip || '未知IP', device_info: userAgent, role: snapshot.identity, action_details: visitorEventPrefix + JSON.stringify(snapshot) }])
      if (error) throw error
      return true
    } catch (error) { onError(error); return false }
  }
  const login = (identity, source = '密碼驗證') => {
    state = { id: uuid(), identity: String(identity || '未知身分'), source, path: getPath(), last: now() }
    return record({ kind: 'login', label: '登入／身分驗證成功', outcome: '成功' })
  }
  const resume = identity => {
    if (state.identity === identity && state.path === getPath()) return Promise.resolve(true)
    state = { id: uuid(), identity: String(identity), source: '登入狀態延續（本次未重新驗證）', path: getPath(), last: now() }
    return record({ kind: 'operation', label: '延續既有登入狀態' })
  }
  const logout = async (label = '登出') => {
    const pending = record({ kind: 'logout', label, outcome: '成功' })
    state = { id: uuid(), identity: remembered(), source: remembered() === '匿名來訪者' ? '匿名' : '裝置記憶身分（本次未重新驗證）', path: getPath(), last: now() }
    persist()
    return pending
  }
  persist()
  return { record, login, logout, resume }
}
