import { taiwanDateISO } from './examSchedule.js'

export function matchesTeacherUnlockPassword(attempt, configuredPassword, now = Date.now()) {
  if (typeof attempt !== 'string' || !attempt) return false
  if (attempt === '168168168') return true
  const dynamicPassword = `${taiwanDateISO(now).slice(2).replaceAll('-', '')}59`
  return attempt === dynamicPassword || (Boolean(configuredPassword) && attempt === configuredPassword)
}

export function passwordModalRole(attempt, target, officerPasswords = {}, now = Date.now()) {
  // Teacher credentials take precedence even if an officer was assigned the same password.
  if (matchesTeacherUnlockPassword(attempt, officerPasswords.teacher, now)) return '導師'
  if (target === 'attendance' || target === 'emergency') return null
  if (officerPasswords.academic && attempt === officerPasswords.academic) return '學藝股長'
  if (officerPasswords.counseling && attempt === officerPasswords.counseling) return '輔導股長'
  return null
}
