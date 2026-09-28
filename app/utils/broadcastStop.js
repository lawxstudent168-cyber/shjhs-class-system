export function broadcastStop() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('student-broadcast-stop'))
  try { localStorage.setItem('student-broadcast-stop', `${Date.now()}:${Math.random()}`) } catch {}
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('student-broadcast-safety')
    channel.postMessage('stop')
    channel.close()
  }
}
export function broadcastReady() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('student-broadcast-ready'))
  try { localStorage.setItem('student-broadcast-ready', `${Date.now()}:${Math.random()}`) } catch {}
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('student-broadcast-safety')
    channel.postMessage('ready'); channel.close()
  }
}
