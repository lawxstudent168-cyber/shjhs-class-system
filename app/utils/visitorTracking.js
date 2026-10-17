export const visitorEventPrefix = '@visitor/v1:'
export const visitorEventKinds = { login: '登入／驗證', logout: '登出／鎖定', page: '瀏覽頁面', view: '內容顯示', interaction: '功能操作', click: '點擊', change: '變更欄位', operation: '操作結果', legacy: '舊紀錄' }

export function normalizeVisitorLog(row) {
  let event = null
  if (typeof row.action_details === 'string' && row.action_details.startsWith(visitorEventPrefix)) {
    try {
      const parsed = JSON.parse(row.action_details.slice(visitorEventPrefix.length))
      if (parsed && typeof parsed === 'object' && typeof parsed.kind === 'string') event = parsed
    } catch { /* Keep malformed payloads visible as legacy records. */ }
  }
  return {
    ...row, event, identity: event?.identity || row.role || '未記錄身分',
    label: event?.label || row.action_details || '造訪網站（舊紀錄未提供操作內容）',
    kind: event?.kind || 'legacy', path: event?.path || '',
    sessionId: event?.session_id || '', deviceId: event?.device_id || '',
    source: event?.identity_source || '舊紀錄，驗證方式未記錄',
    outcome: event?.outcome || '', details: event?.details || ''
  }
}

export const isNamedVisitor = identity => typeof identity === 'string' && Boolean(identity.trim()) &&
  !['匿名來訪者', '未記錄身分', '未知身分'].includes(identity) && !/^家長[／/]學生/.test(identity) && !identity.includes('未具名')

export function groupVisitorLogs(logs, mode) {
  const groups = new Map()
  for (const log of logs) {
    if (mode === 'identity' && !isNamedVisitor(log.identity)) continue
    const key = mode === 'identity' ? log.identity
      : mode === 'session' ? (log.sessionId ? `${log.sessionId}|${log.identity}` : `legacy:${log.id}`)
      : log.deviceId || `legacy-device:${log.ip_address || ''}|${log.device_info || ''}`
    if (!groups.has(key)) groups.set(key, { key, logs: [], identities: new Set(), devices: new Set(), loginCount: 0, latestTime: log.created_at })
    const group = groups.get(key)
    group.logs.push(log)
    group.identities.add(log.identity)
    group.devices.add(log.deviceId || `${log.ip_address || ''}|${log.device_info || ''}`)
    if (log.kind === 'login') group.loginCount++
    if (new Date(log.created_at) > new Date(group.latestTime)) group.latestTime = log.created_at
  }
  for (const group of groups.values()) group.logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  return [...groups.values()].sort((a, b) => new Date(b.latestTime) - new Date(a.latestTime))
}

export function filterVisitorLogs(logs, { search = '', kind = '', namedOnly = false } = {}) {
  const term = search.trim().toLowerCase()
  return logs.filter(log => (!kind || log.kind === kind) && (!namedOnly || isNamedVisitor(log.identity)) &&
    (!term || [log.identity, log.label, log.details, log.source, log.path, log.ip_address, log.device_info, log.sessionId].join(' ').toLowerCase().includes(term)))
}

export function visitorLogsCsv(logs) {
  const cell = value => {
    let text = String(value ?? '')
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text
    return `"${text.replaceAll('"', '""')}"`
  }
  return '\uFEFF' + [['時間', '身分', '驗證來源', '類別', '操作', '結果', '內容', '頁面', '登入階段', 'IP', '設備'],
    ...logs.map(log => [log.created_at, log.identity, log.source, visitorEventKinds[log.kind] || log.kind, log.label, log.outcome, log.details, log.path, log.sessionId, log.ip_address, log.device_info])]
    .map(row => row.map(cell).join(',')).join('\r\n')
}


export function contactHistoryViewer(isTeacher, currentIdentity, rememberedIdentity) {
  if (isTeacher) return { identity: '導師', source: '聯絡簿查詢／導師密碼驗證' }
  const namedViewer = identity => typeof identity === 'string' && /家長|學生/.test(identity) &&
    !/導師|老師/.test(identity) && !/^(家長|學生|家長[／/]學生)([（(].*[）)])?$/.test(identity)
  const identity = [currentIdentity, rememberedIdentity].find(namedViewer)
  return {
    identity: identity || '家長／學生（未具名）',
    source: identity ? '聯絡簿共用查詢密碼／既有具名身分關聯（非重新實名驗證）' : '聯絡簿共用查詢密碼（無個人身分資料）'
  }
}
