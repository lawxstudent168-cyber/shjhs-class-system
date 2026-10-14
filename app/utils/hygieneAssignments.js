const morningFields = ['in_hygiene_names', 'board_names', 'sweep_names', 'mop_names', 'window_names', 'hallway_names', 'trash_names', 'out_hygiene_names', 'out_sweep1_names', 'out_sweep2_names', 'out_sweep3_names']
const lunchFields = ['clean', 'move', 'serve'].flatMap(group => Array.from({ length: 6 }, (_, index) => `${group}_n${index + 1}`))
const squadFields = ['leaders', 'duties', 'helpers', 'errands', 'minions', 'others']

const seatKey = value => {
  const match = String(value ?? '').trim().match(/^(\d+)(?:號)?$/)
  const number = match ? Number(match[1]) : 0
  return Number.isSafeInteger(number) && number > 0 ? String(number) : null
}

export function parseSeatAssignments(value) {
  const tokens = String(value ?? '').trim().split(/[\s,，、;；/／]+/).filter(Boolean)
  const seats = []
  const invalid = []
  for (const token of tokens) {
    const key = seatKey(token)
    if (key) seats.push(key)
    else invalid.push(token)
  }
  return { seats, invalid }
}

export function assignmentValues(data, tab) {
  const section = data?.[tab] || {}
  if (tab === 'morning') return [
    ...morningFields.map(field => section[field]),
    ...(Array.isArray(section.out_dynamic_areas) ? section.out_dynamic_areas.map(item => item?.names) : [])
  ]
  if (tab === 'lunch') return lunchFields.map(field => section[field])
  if (tab === 'squad') return squadFields.flatMap(field => Array.isArray(section[field]) ? section[field] : [])
  return []
}

// Drop old name-only assignments from saved JSON while leaving every task/detail field untouched.
export function sanitizeHygieneAssignments(data) {
  if (!data || typeof data !== 'object') return data
  const clean = value => parseSeatAssignments(value).seats.join('、')
  const cleanSection = (section, tab) => {
    const result = { ...(section || {}) }
    if (tab === 'morning') {
      for (const field of morningFields) if (field in result) result[field] = clean(result[field])
      if (Array.isArray(result.out_dynamic_areas)) result.out_dynamic_areas = result.out_dynamic_areas.map(item => ({ ...item, names: clean(item?.names) }))
    }
    if (tab === 'lunch') for (const field of lunchFields) if (field in result) result[field] = clean(result[field])
    if (tab === 'squad') for (const field of squadFields) if (Array.isArray(result[field])) result[field] = result[field].map(clean)
    return result
  }
  const history = { ...(data.history || {}) }
  for (const tab of ['morning', 'lunch', 'squad']) {
    if (Array.isArray(history[tab])) history[tab] = history[tab].map(item => ({ ...item, data: cleanSection(item?.data, tab) }))
  }
  return { ...data, morning: cleanSection(data.morning, 'morning'), lunch: cleanSection(data.lunch, 'lunch'), squad: cleanSection(data.squad, 'squad'), history }
}

export function hygieneAssignmentReport(data, tab, studentSeatNumbers) {
  const valid = [...new Set((studentSeatNumbers || []).map(seatKey).filter(Boolean))].sort((a, b) => Number(a) - Number(b))
  const validSet = new Set(valid)
  const counts = new Map()
  const invalid = new Set()
  const unknown = new Set()
  for (const value of assignmentValues(data, tab)) {
    const parsed = parseSeatAssignments(value)
    parsed.invalid.forEach(token => invalid.add(token))
    for (const seat of parsed.seats) {
      if (!validSet.has(seat)) unknown.add(seat)
      else counts.set(seat, (counts.get(seat) || 0) + 1)
    }
  }
  return {
    expectedCount: valid.length,
    assignedCount: valid.filter(seat => counts.has(seat)).length,
    missing: valid.filter(seat => !counts.has(seat)),
    repeated: valid.filter(seat => (counts.get(seat) || 0) >= 2).map(seat => ({ seat, count: counts.get(seat) })),
    unknown: [...unknown].sort((a, b) => Number(a) - Number(b)),
    invalid: [...invalid]
  }
}
