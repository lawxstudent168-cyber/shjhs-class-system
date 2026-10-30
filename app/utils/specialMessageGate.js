export function advanceSpecialMessageGate(state, now = Date.now(), required = 7, windowMs = 8000) {
  const previous = state && Number.isFinite(state.lastTap) && now - state.lastTap <= windowMs ? state.count : 0
  const count = previous + 1
  return count >= required
    ? { count: 0, lastTap: 0, unlocked: true }
    : { count, lastTap: now, unlocked: false }
}
