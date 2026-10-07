// Browser-independent receiver state machine. Injected audio is silent in tests.
export function createBroadcastReceiver({ request, update, createAudio, visible, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let epoch = 0, timer, audio, active = false, sound = false, watermark = null, seen = new Set()
  let state = { student: null, messages: [], sound: false, error: '' }
  const publish = values => { state = { ...state, ...values }; update(state) }
  function mute() { sound = false; audio?.close(); audio = null; publish({ sound: false }) }
  function pause() { epoch++; active = false; clearTimer(timer); mute(); watermark = null; publish({ messages: [] }) }
  function reset() { pause(); seen = new Set(); publish({ student: null, error: '' }) }
  async function poll(current) {
    if (!active || current !== epoch || !visible()) return
    const startedAt = Date.now()
    try {
      const result = await request({ action: 'inbox' })
      if (!active || current !== epoch || !visible()) return
      const serverNow = Date.parse(result.serverTime) + (Date.now() - startedAt)
      const messages = (result.messages || []).filter(message => !message.expires_at || Date.parse(message.expires_at) > serverNow)
      const fresh = watermark !== null && messages.some(message => !seen.has(message.id) && Date.parse(message.created_at) >= watermark)
      for (const message of messages) seen.add(message.id)
      if (seen.size > 2000) seen = new Set(messages.map(message => message.id))
      watermark = Date.parse(result.serverTime)
      publish({ student: result.student, messages, error: '' })
      if (fresh && sound) audio?.beep()
    } catch (error) {
      if (current !== epoch) return
      mute(); watermark = null
      const status = error?.statusCode || error?.response?.status
      publish({ messages: [], ...(status === 401 || status === 403 ? { student: null } : {}), error: status === 401 || status === 403 ? '' : '連線中斷，恢復後會自動補收。' })
      if (status === 401 || status === 403) { active = false; return }
    }
    if (active && current === epoch) timer = setTimer(() => poll(current), 5000)
  }
  function resume() {
    if (active || !visible()) return
    active = true; watermark = null
    void poll(++epoch)
  }
  async function enableSound() {
    if (!active || !state.student || !visible()) return
    const current = epoch
    mute()
    let candidate
    try {
      candidate = createAudio()
      audio = candidate
      await candidate.resume()
      if (current !== epoch || !active || !visible()) { candidate.close(); return }
      if (!candidate.running()) throw new Error('Audio blocked')
      sound = true; publish({ sound: true, error: '' })
    } catch {
      candidate?.close()
      if (current === epoch) { audio = null; publish({ sound: false, error: '瀏覽器未啟用音訊，文字仍會接收。' }) }
    }
  }
  async function acknowledge(id) {
    const current = epoch
    try {
      await request({ action: 'ack', ids: [id] })
      if (current === epoch) publish({ messages: state.messages.filter(message => message.id !== id) })
    } catch { if (current === epoch) publish({ error: '尚未標為已讀，請稍後重試。' }) }
  }
  return { resume, pause, reset, enableSound, mute, acknowledge }
}
