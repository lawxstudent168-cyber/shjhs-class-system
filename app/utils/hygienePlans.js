import { sanitizeHygieneAssignments } from './hygieneAssignments.js'
import { resolveHygieneForDate, validHygieneDate } from './hygieneHistory.js'

export const hygienePlanIds = ['A', 'B', 'C', 'D', 'E']
const copy = value => JSON.parse(JSON.stringify(value))
const validPlan = value => hygienePlanIds.includes(value) ? value : 'A'

const planOnly = value => ({
  nameFontSize: Number(value?.nameFontSize) || 24,
  history: value?.history || { morning: [], lunch: [], squad: [] },
  morning: value?.morning || {},
  lunch: value?.lunch || {},
  squad: value?.squad || {}
})

export function normalizeHygienePlans(value, defaultPlan = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const fallback = planOnly(defaultPlan)
  const legacy = planOnly(source)
  const hasPlans = source.plans && typeof source.plans === 'object' && !Array.isArray(source.plans)
  const plans = {}
  for (const id of hygienePlanIds) {
    const raw = hasPlans ? source.plans[id] : id === 'A' ? legacy : fallback
    plans[id] = sanitizeHygieneAssignments({
      ...copy(fallback),
      ...copy(raw || {}),
      morning: { ...copy(fallback.morning), ...copy(raw?.morning || {}) },
      lunch: { ...copy(fallback.lunch), ...copy(raw?.lunch || {}) },
      squad: { ...copy(fallback.squad), ...copy(raw?.squad || {}) }
    })
  }
  const planStartDates = {}
  for (const id of hygienePlanIds) {
    const date = source.planStartDates?.[id]
    planStartDates[id] = validHygieneDate(date) ? date : ''
  }
  return {
    isVisibleOnIndex: source.isVisibleOnIndex === true,
    homepagePlan: validPlan(source.homepagePlan),
    planStartDates,
    plans
  }
}

export function resolveHomepageHygiene(value, date, defaultPlan = {}) {
  const normalized = normalizeHygienePlans(value, defaultPlan)
  const effectivePlans = hygienePlanIds
    .map((id, index) => ({ id, index, startDate: normalized.planStartDates[id] }))
    .filter(plan => plan.startDate && plan.startDate <= date)
    .sort((left, right) => left.startDate.localeCompare(right.startDate)
      || Number(left.id === normalized.homepagePlan) - Number(right.id === normalized.homepagePlan)
      || left.index - right.index)
  const fallbackPlan = normalized.planStartDates[normalized.homepagePlan]
    ? hygienePlanIds.find(id => !normalized.planStartDates[id]) || 'A'
    : normalized.homepagePlan
  const planId = effectivePlans.at(-1)?.id || fallbackPlan
  const startDate = normalized.planStartDates[planId]
  const resolved = resolveHygieneForDate(normalized.plans[planId], date)
  return {
    ...resolved,
    isVisibleOnIndex: normalized.isVisibleOnIndex,
    activePlan: planId,
    planLabel: `${planId} 方案`,
    startDate
  }
}
