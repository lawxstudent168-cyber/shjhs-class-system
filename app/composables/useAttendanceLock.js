import { ref, computed, toValue, watch } from 'vue'

// Keep permission in this page only; never persist a password or unlocked flag.
export function useAttendanceLock(editAttendance, requestPassword, passwordFree = false) {
  const teacherUnlocked = ref(false)
  const manuallyLocked = ref(false)
  const isPasswordFree = computed(() => Boolean(toValue(passwordFree)))
  const isAttendanceUnlocked = computed(() => teacherUnlocked.value || (isPasswordFree.value && !manuallyLocked.value))
  // A new morning starts a fresh session; yesterday's override must not bypass today's cutoff.
  watch(isPasswordFree, free => {
    if (free) { teacherUnlocked.value = false; manuallyLocked.value = false }
  }, { flush: 'sync' })
  let pendingStudent = null

  const requestAttendanceEdit = async student => {
    if (isAttendanceUnlocked.value) return editAttendance(student)
    pendingStudent = student
    requestPassword()
  }

  const requestAttendanceUnlock = () => {
    pendingStudent = null
    requestPassword()
  }

  const cancelAttendanceUnlock = () => { pendingStudent = null }

  const unlockAttendance = async role => {
    if (role !== 'teacher' && role !== '導師') return false
    teacherUnlocked.value = true
    manuallyLocked.value = false
    const student = pendingStudent
    pendingStudent = null
    if (student) await editAttendance(student)
    return true
  }

  const lockAttendance = () => {
    teacherUnlocked.value = false
    manuallyLocked.value = true
    pendingStudent = null
  }

  return { isAttendanceUnlocked, requestAttendanceEdit, requestAttendanceUnlock, cancelAttendanceUnlock, unlockAttendance, lockAttendance }
}
