// app/composables/useAttendance.js
import { ref, computed, onScopeDispose } from 'vue'
import { nextAttendanceStatus, formatAttendanceStatus } from '../utils/attendanceStatus.js'

export function useAttendance(todayISO) {
  const supabase = useSupabaseClient()
  
  const allStudents = ref([])
  const allStudentsForLogin = ref([])
  const todayAttendances = ref([])

  const partialLeaveStudent = ref(null)
  let resolvePartialLeave
  const finishPartialLeave = (value = null) => {
    partialLeaveStudent.value = null
    resolvePartialLeave?.(value)
    resolvePartialLeave = null
  }
  onScopeDispose(() => finishPartialLeave())

  const expectedCount = computed(() => allStudents.value.length)
  const presentCount = computed(() => todayAttendances.value.filter(a => a.status === '已到').length)
  const leaveCount = computed(() => todayAttendances.value.filter(a => a.status === '請假' || a.status === '全天請假').length)
  const lateLeaveCount = computed(() => todayAttendances.value.filter(a => a.status && a.status.startsWith('晚到請假')).length)
  const earlyLeaveCount = computed(() => todayAttendances.value.filter(a => a.status && a.status.startsWith('早退請假')).length)
  const lateCount = computed(() => todayAttendances.value.filter(a => a.status && a.status.startsWith('遲到')).length)
  const partialPublicLeaveCount = computed(() => todayAttendances.value.filter(a => a.status?.startsWith('部份公假')).length)
  const absentCount = computed(() => expectedCount.value - presentCount.value - leaveCount.value - lateLeaveCount.value - earlyLeaveCount.value - lateCount.value - partialPublicLeaveCount.value)

  // 💡 核心修正 1：加入 skipPasswordCheck (跳過密碼檢查) 通行證
  const toggleAttendanceLogic = async (student, isWeekday, expectedTeacherPwd, skipPasswordCheck = false) => {
    const now = new Date()
    const deadlineHour = 8
    const deadlineMinute = 0
    const isPastDeadline = now.getHours() > deadlineHour || (now.getHours() === deadlineHour && now.getMinutes() >= deadlineMinute)

    // 只有在「沒有提供解鎖通行證」的情況下，才執行原生的密碼阻擋
    if (!skipPasswordCheck) {
      if (!isWeekday) {
        const pwd = prompt("🌴 週末預設不開放點名。\n若需強制修改，請輸入導師密碼：")
        if (pwd !== expectedTeacherPwd && pwd !== '168168168' && pwd !== '1681681681') {
          if (pwd !== null) alert("❌ 密碼錯誤，無法變更點名狀態！"); return
        }
      } else if (isPastDeadline) {
        const timeStr = `${String(deadlineHour).padStart(2, '0')}:${String(deadlineMinute).padStart(2, '0')}`
        const pwd = prompt(`⏰ 目前已超過點名規定時間 (${timeStr})。\n為確保出缺席紀錄正確，若需強制修改請輸入「導師密碼」：`)
        if (pwd !== expectedTeacherPwd && pwd !== '168168168' && pwd !== '1681681681') {
          if (pwd !== null) alert("❌ 密碼錯誤，無法變更點名狀態！"); return
        }
      }
    }

    const currentStatusFull = todayAttendances.value.find(a => a.student_id === student.id)?.status || '未到'
    let nextStatus = nextAttendanceStatus(currentStatusFull)
    if (['遲到', '晚到請假', '早退請假'].includes(nextStatus)) {
      const defaults = { 遲到: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, 晚到請假: '10:00', 早退請假: '14:00' }
      const labels = { 遲到: '遲到到校', 晚到請假: '預計到校', 早退請假: '早退離開' }
      const time = prompt(`請輸入【${labels[nextStatus]}】時間 (HH:mm)：`, defaults[nextStatus])
      if (time === null) return
      try { nextStatus = formatAttendanceStatus(nextStatus, time.trim()) }
      catch (error) { alert(error.message); return }
    } else if (nextStatus === '部份公假') {
      if (partialLeaveStudent.value) return
      const details = await new Promise(resolve => {
        resolvePartialLeave = resolve
        partialLeaveStudent.value = student
      })
      if (!details) return
      try { nextStatus = formatAttendanceStatus(nextStatus, details.time, details.direction) }
      catch (error) { alert(error.message); return }
    }

    try {
      const { data: existing, error: lookupError } = await supabase.from('attendances').select('id').eq('student_id', student.id).eq('record_date', todayISO).maybeSingle()
      if (lookupError) throw lookupError
      const { error } = existing
        ? await supabase.from('attendances').update({ status: nextStatus }).eq('id', existing.id)
        : await supabase.from('attendances').insert({ student_id: student.id, record_date: todayISO, status: nextStatus })
      if (error) throw error
      const record = todayAttendances.value.find(a => a.student_id === student.id)
      if (record) record.status = nextStatus
      else todayAttendances.value.push({ student_id: student.id, record_date: todayISO, status: nextStatus })
    } catch (error) {
      alert('❌ 點名儲存失敗：' + error.message)
    }
  }

  return {
    allStudents, allStudentsForLogin, todayAttendances,
    expectedCount, presentCount, leaveCount, lateLeaveCount, earlyLeaveCount, lateCount, absentCount,
    toggleAttendanceLogic, partialPublicLeaveCount, partialLeaveStudent, finishPartialLeave
  }
}
