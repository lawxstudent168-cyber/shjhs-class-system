import { ref } from 'vue'

// Keep permission in this page only; never persist a password or unlocked flag.
export function useAttendanceLock(editAttendance, requestPassword) {
  const isAttendanceUnlocked = ref(false)
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
    isAttendanceUnlocked.value = true
    const student = pendingStudent
    pendingStudent = null
    if (student) await editAttendance(student)
    return true
  }

  const lockAttendance = () => {
    isAttendanceUnlocked.value = false
    pendingStudent = null
  }

  return { isAttendanceUnlocked, requestAttendanceEdit, requestAttendanceUnlock, cancelAttendanceUnlock, unlockAttendance, lockAttendance }
}
