<template>
  <div class="page-container" :class="{ 'is-exam-mode': isExamModeView }">
    
    <ExamDashboard 
      v-if="isExamModeView && isIpBrownlisted" 
      :examData="examData" 
      :examStatus="examStatus"
      :currentTime="currentTime"
      :countdownMinutes="countdownMinutes"
      :countdownText="countdownText"
      :currentThemeStyles="currentThemeStyles"
      @exit="isExamModeView = false"
    />

    <div v-if="!isExamModeView" class="normal-home-content">
      
      <div v-if="!isIpBrownlisted" class="identity-banner">
        <span v-if="currentIdentity !== '匿名來訪者'">✅ 目前驗證身分：{{ currentIdentity }}</span>
        <span v-else>⚠️ 尚未驗證身分</span>
        <NuxtLink to="/personal" class="change-id-btn">學生／家長個人首頁</NuxtLink>
        <button @click="showIdentityModal = true" class="change-id-btn">切換/綁定身分</button>
      </div>

      <div v-if="isContentVisible">
        
        <HomeStudentAssignments 
          v-if="!isIpBrownlisted && (activeRoleCategory === 'parent' || activeRoleCategory === 'student')"
          :currentIdentity="currentIdentity"
          :allStudents="allStudentsForLogin"
          :assignments="assignmentsData"
          :submissions="assignmentSubmissionsData"
          :excludedIds="excludedAssignmentIds"
        />

        <NoticeBoards 
          :isClassTime="isClassTime"
          :isIpBrownlisted="isIpBrownlisted"
          :isNoticeBoardVisibleOnIndex="isNoticeBoardVisibleOnIndex"
          :parentNotices="parentNotices"
          :isParentAnnouncementVisibleOnIndex="isParentAnnouncementVisibleOnIndex"
          :parentAnnouncements="parentAnnouncements"
          :isAnnouncementVisibleOnIndex="isAnnouncementVisibleOnIndex"
          :announcements="announcements"
          :privacyFilter="privacyFilter"
          :formatDateTime="formatDateTime"
          :formatNL="formatNL"
        />

        <HomeGoodArticle 
          v-if="!isIpBrownlisted && activeGoodArticle" 
          :article="activeGoodArticle" 
        />

        <div class="main-split">
          <div class="left-panel">
            
            <ControlPanel 
              :isClassTime="isClassTime"
              :marqueeSettings="marqueeSettings"
              :clockConfig="clockConfig"
              :currentTime="currentTime"
              :unreadMsgCount="unreadMsgCount"
              :scheduleDisplay="scheduleDisplay"
              :scheduleButtonConfig="scheduleButtonConfig"
              :isIpBrownlisted="isIpBrownlisted"
              :examData="examData"
              :indexButtonSettings="indexButtonSettings"
              :isScheduleButtonVisible="isScheduleButtonVisible"
              :seatingChart="seatingChart"
              :showSeatingChartLocal="showSeatingChartLocal"
              :hygieneData="hygieneData"
              :showHygieneLocal="showHygieneLocal"
              :isHistoryVisibleOnIndex="isHistoryVisibleOnIndex"
              @enterExam="isExamModeView = true"
              @openLargeSchedule="showLargeSchedule = true"
              @openPwd="openPwdModal"
              @update:showSeatingChartLocal="showSeatingChartLocal = $event"
              @update:showHygieneLocal="showHygieneLocal = $event"
            />

            <AttendanceGrid 
              v-if="isIpBrownlisted"
              :isClassTime="isClassTime"
              :allStudents="allStudents"
              :todayAttendances="todayAttendances"
              :expectedCount="expectedCount"
              :presentCount="presentCount"
              :leaveCount="leaveCount"
              :lateLeaveCount="lateLeaveCount"
              :earlyLeaveCount="earlyLeaveCount"
              :lateCount="lateCount"
              :absentCount="absentCount"
              :privacyFilter="privacyFilter"
              @toggle-attendance="toggleAttendance"
            />

            <div v-if="isIpBrownlisted && !isWeekday" class="weekend-prompt">
              🌴 今天是週末，點名板僅供查閱，點擊需輸入導師密碼解鎖。
            </div>
            
            <HomeEnglishSong 
              v-if="isEnglishSongVisible && todayEnglishSongUrl"
              :videoUrl="todayEnglishSongUrl"
              :isClassTime="isClassTime"
            />
            
            <HomeWikiFeatured v-if="isWikiFeaturedVisible" />
            
          </div>

          <div class="right-panel">
            <ClassNotes 
              :classNoteItems="classNoteItems"
              :editingClassNoteItems="editingClassNoteItems"
              :isEditingClassNotes="isEditingClassNotes"
              :todayDisplay="todayDisplay"
              :privacyFilter="privacyFilter"
              @open-pwd="openPwdModal('classNotes')"
              @cancel-edit="isEditingClassNotes = false"
              @save-items="saveClassNoteItems"
              @add-item="addClassNoteItem"
              @remove-item="removeClassNoteItem"
              @update-item="updateEditingClassNoteItem"
            />

            <ContactBook 
              :contactBookItems="contactBookItems"
              :editingContactItems="editingContactItems"
              :isEditingContact="isEditingContact"
              :todayDisplay="todayDisplay"
              :privacyFilter="privacyFilter"
              @open-pwd="openPwdModal('contact')"
              @cancel-edit="isEditingContact = false"
              @save-items="saveContactItems"
              @add-item="addContactItem"
              @remove-item="removeContactItem"
              @update-item="updateEditingContactItem"
            />
            
            <IndexModulesPanel 
              :indexModulesConfig="indexModulesConfig"
              :indexDynamicSorting="indexDynamicSorting"
              :isClassTime="isClassTime"
              :todayVideoUrl="todayVideoUrl"
              :youtubeIsMuted="youtubeIsMuted"
            />
            
          </div>
        </div>
        
        <SeatingAndHygiene 
          :seatingChart="seatingChart"
          :showSeatingChartLocal="showSeatingChartLocal"
          :indexButtonSettings="indexButtonSettings"
          :hygieneData="hygieneData"
          :showHygieneLocal="showHygieneLocal"
          :privacyFilter="privacyFilter"
          :formatNL="formatNL"
        />
      </div>
      
      <div v-else class="unverified-placeholder">
        <div class="spinner-icon">🛡️</div>
        <h2>系統安全鎖定中</h2>
        <p>為保護班級資訊，請於驗證畫面選擇身分後進入。</p>
      </div>
    </div> 

    <PasswordModal 
      :show="showPwdModal" 
      :title="pwdModalTitle" 
      :desc="pwdModalDesc" 
      :target="pwdTarget" 
      :officerPasswords="officerPasswords" 
      @close="showPwdModal = false" 
      @success="handlePwdSuccess" 
    />
    <IdentityModal 
      :show="showIdentityModal" 
      :students="allStudentsForLogin" 
      :schools="availableSchools" 
      :expectedTeacherPwd="expectedTeacherPwd" 
      :hasCurrentIdentity="currentIdentity !== '匿名來訪者'" 
      :privacyFilter="privacyFilter" 
      @close="showIdentityModal = false" 
      @verified="handleIdentityVerified" 
    />
    <LargeScheduleModal 
      v-if="showLargeSchedule" 
      :scheduleData="scheduleData" 
      :scheduleButtonConfig="scheduleButtonConfig" 
      :isIpBrownlisted="isIpBrownlisted" 
      :privacyFilter="privacyFilter" 
      @close="showLargeSchedule = false" 
    />
    <EmergencyModal 
      v-if="showEmergencyModal" 
      @close="showEmergencyModal = false" 
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

import ExamDashboard from '~~/components/home/ExamDashboard.vue'
import AttendanceGrid from '~~/components/home/AttendanceGrid.vue'
import ContactBook from '~~/components/home/ContactBook.vue'
import ClassNotes from '~~/components/home/ClassNotes.vue'
import SeatingAndHygiene from '~~/components/home/SeatingAndHygiene.vue'
import NoticeBoards from '~~/components/home/NoticeBoards.vue'
import ControlPanel from '~~/components/home/ControlPanel.vue'
import LargeScheduleModal from '~~/components/home/LargeScheduleModal.vue'
import PasswordModal from '~~/components/home/PasswordModal.vue'
import IdentityModal from '~~/components/home/IdentityModal.vue'
import IndexModulesPanel from '~~/components/home/IndexModulesPanel.vue'
import HomeWikiFeatured from '~~/components/home/HomeWikiFeatured.vue'
import HomeEnglishSong from '~~/components/home/HomeEnglishSong.vue'
import HomeGoodArticle from '~~/components/home/HomeGoodArticle.vue'
import HomeStudentAssignments from '~~/components/home/HomeStudentAssignments.vue' 

// 💡 匯入剛剛拆分出來的強大 Composables
import { useFormatters } from '~/composables/useFormatters'
import { useIdentityGuard } from '~/composables/useIdentityGuard'
import { usePasswordAccess } from '~/composables/usePasswordAccess'
import { useHomeData } from '~/composables/useHomeData'

const supabase = useSupabaseClient()

const dDate = new Date()
const todayISO = `${dDate.getFullYear()}-${String(dDate.getMonth() + 1).padStart(2, '0')}-${String(dDate.getDate()).padStart(2, '0')}`
const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const todayDisplay = `${dDate.getFullYear()}年${dDate.getMonth() + 1}月${dDate.getDate()}日${days[dDate.getDay()]}`
const isWeekday = dDate.getDay() !== 0 && dDate.getDay() !== 6

const currentTime = ref('')
const nowTick = ref(Date.now())
let timer = null
const updateTime = () => { nowTick.value = Date.now(); currentTime.value = new Date().toLocaleTimeString('zh-TW', { hour12: false }) }

// 狀態控制
const showEmergencyModal = ref(false)
const showSeatingChartLocal = ref(false)
const showHygieneLocal = ref(false)
const showLargeSchedule = ref(false)
const isExamModeView = ref(false)
const isEditingContact = ref(false)
const editingContactItems = ref([])
const isEditingClassNotes = ref(false)
const editingClassNoteItems = ref([])
let dataRefreshTimer = null

// 1. 🛡️ 身分防護總管
const { 
  isIpWhitelisted, isIpBrownlisted, currentIpStr, currentIdentity, showIdentityModal, activeRoleCategory, isContentVisible, 
  checkIpRules, checkIdentity, logVisit, logRoleVisit 
} = useIdentityGuard(supabase)

// 2. 📝 出缺席總管 (底層邏輯)
const { 
  allStudents, allStudentsForLogin, todayAttendances,
  expectedCount, presentCount, leaveCount, lateLeaveCount, earlyLeaveCount, lateCount, absentCount,
  toggleAttendanceLogic
} = useAttendance(todayISO)

// 3. 🧠 資料抓取大腦
const {
  contactBookItems, officerPasswords, isHistoryVisibleOnIndex, globalButtonSettings, roleButtonSettings, clockConfig,
  announcements, parentAnnouncements, isAnnouncementVisibleOnIndex, isParentAnnouncementVisibleOnIndex, isNoticeBoardVisibleOnIndex,
  scheduleData, scheduleButtonConfig, examData, autoRefreshConfig, indexModulesConfig, indexDynamicSorting, isWikiFeaturedVisible,
  youtubeSchedule, youtubeIsMuted, englishSongSchedule, parentNotices, classNoteItems, seatingChart, hygieneData,
  marqueeSettings, unreadMsgCount, assignmentsData, assignmentSubmissionsData, excludedAssignmentIds, goodArticles,
  expectedTeacherPwd, loadTeacherPwd, fetchData
} = useHomeData(supabase, todayISO, isIpBrownlisted, activeRoleCategory, currentIdentity, allStudents, allStudentsForLogin, todayAttendances)

// 4. ✨ 格式化與過濾器 (有了前面的 ref，現在可以呼叫了)
const { privacyFilter, formatNL, formatDateTime } = useFormatters(isIpWhitelisted, allStudentsForLogin)

// 5. 🔑 密碼視窗總管
const { showPwdModal, pwdTarget, pwdModalTitle, pwdModalDesc, currentEditorRole, openPwdModal } = usePasswordAccess(isWeekday)

// 6. 🕒 考試模式與倒數器
const { currentThemeStyles, examStatus, countdownMinutes, countdownText } = useExamMode(examData, nowTick)

// ==============
// 以下是畫面專屬的 computed 與行為邏輯
// ==============
const activeGoodArticle = computed(() => goodArticles.value.find(a => a.is_published === true) || null)
const todayEnglishSongUrl = computed(() => englishSongSchedule.value[new Date(nowTick.value).getDay()] || '')
const isEnglishSongVisible = computed(() => englishSongSchedule.value.isVisible !== false)
const todayVideoUrl = computed(() => youtubeSchedule.value[new Date(nowTick.value).getDay()] || '')

const indexButtonSettings = computed(() => {
  const roleSettings = roleButtonSettings.value[activeRoleCategory.value] || roleButtonSettings.value.anonymous
  const effectiveSettings = {}
  for (const key in roleSettings) { effectiveSettings[key] = (globalButtonSettings.value && globalButtonSettings.value[key] === false) ? false : roleSettings[key] }
  return effectiveSettings
})

const availableSchools = computed(() => {
  if (!allStudentsForLogin.value || allStudentsForLogin.value.length === 0) return []
  const schools = allStudentsForLogin.value.map(s => s.graduated_school || s.elementary_school || s.elem_school || s.school || s.school_name).filter(Boolean)
  return [...new Set(schools)].sort()
})

const scheduleDisplay = computed(() => {
  if (!scheduleData.value || !scheduleData.value.periods) return null
  const now = new Date(nowTick.value)
  const currentDayIndex = now.getDay() - 1 
  if (currentDayIndex < 0 || currentDayIndex > 4) return { current: { status: '放假中', label: '週末', subject: '週末休息', teacher: '' }, next: null }
  
  const nowMins = now.getHours() * 60 + now.getMinutes()
  let currentClass = { status: '下課中', label: '目前', subject: '休息時間', teacher: '' }
  let nextClass = null
  const maskTeacherName = (name) => { if (!name) return ''; if (name.length >= 3) return name.charAt(0) + 'Ｏ' + name.charAt(name.length - 1); if (name.length === 2) return name.charAt(0) + 'Ｏ'; return 'ＯＯＯ' }
  
  for (let i = 0; i < scheduleData.value.periods.length; i++) {
    const p = scheduleData.value.periods[i]; if (!p.startTime || !p.endTime) continue
    const [sh, sm] = p.startTime.split(':').map(Number); const [eh, em] = p.endTime.split(':').map(Number)
    const dayData = p.days[currentDayIndex]; if (!dayData || !dayData.subject) continue
    const safeTeacher = isIpBrownlisted.value ? (dayData.teacher || '') : maskTeacherName(dayData.teacher)
    
    if (nowMins >= (sh * 60 + sm) && nowMins <= (eh * 60 + em)) {
      currentClass = { status: '上課中', label: p.name, subject: dayData.subject, teacher: safeTeacher }
      for (let j = i + 1; j < scheduleData.value.periods.length; j++) {
        const nextDayData = scheduleData.value.periods[j].days[currentDayIndex]
        if (nextDayData && nextDayData.subject) { nextClass = { subject: nextDayData.subject, teacher: isIpBrownlisted.value ? (nextDayData.teacher || '') : maskTeacherName(nextDayData.teacher) }; break }
      }
      break
    }
    if (nowMins < (sh * 60 + sm) && !nextClass) nextClass = { subject: dayData.subject, teacher: safeTeacher } 
  }
  return { current: currentClass, next: nextClass }
})

const isClassTime = computed(() => scheduleDisplay.value?.current?.status === '上課中')

const pendingAttendanceStudent = ref(null)
const toggleAttendance = (student) => {
  const now = new Date()
  if (!isWeekday || now.getHours() >= 8) { pendingAttendanceStudent.value = student; openPwdModal('attendance') } 
  else { toggleAttendanceLogic(student, isWeekday, expectedTeacherPwd.value) }
}

const handlePwdSuccess = async ({ target, role }) => {
  showPwdModal.value = false; currentEditorRole.value = role
  if (target === 'emergency') showEmergencyModal.value = true
  else if (target === 'contact') { isEditingContact.value = true; editingContactItems.value = [...contactBookItems.value] } 
  else if (target === 'classNotes') { isEditingClassNotes.value = true; editingClassNoteItems.value = [...classNoteItems.value] } 
  else if (target === 'attendance') {
    if (role !== 'teacher' && role !== '導師') return alert('❌ 權限不足：點名板狀態變更僅限導師解鎖！')
    if (pendingAttendanceStudent.value) { await toggleAttendanceLogic(pendingAttendanceStudent.value, true, expectedTeacherPwd.value, true); pendingAttendanceStudent.value = null }
  }
  await logRoleVisit(role)
}

const handleIdentityVerified = async (finalIdentity) => {
  localStorage.setItem('visitor_known_identity', finalIdentity)
  currentIdentity.value = finalIdentity
  showIdentityModal.value = false
  await fetchData() 
  await supabase.from('visitor_logs').insert([{ ip_address: currentIpStr.value || '未知IP', device_info: navigator.userAgent, role: finalIdentity, action_details: `🔑 綁定設備身分：${finalIdentity}` }])
}

const logAudit = async (actionType, details) => { try { await supabase.from('assignment_audit_logs').insert({ subject_name: '首頁黑板', action_type: actionType, operator_role: currentEditorRole.value || '導師', details: details }) } catch (e) {} }

const saveContactItems = async () => {
  try {
    await supabase.from('contact_books').upsert({ record_date: todayISO, contact_items: editingContactItems.value }, { onConflict: 'record_date' })
    await logAudit('修改聯絡簿', `更新為：${editingContactItems.value.length > 0 ? editingContactItems.value.join('、') : '清空無事項'}`)
    alert("✅ 聯絡簿已成功更新發布！")
    contactBookItems.value = [...editingContactItems.value]; isEditingContact.value = false
  } catch (error) { alert("❌ 儲存失敗") }
}

const saveClassNoteItems = async () => {
  try {
    const { data: currentSettings } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'class_notes_data').maybeSingle()
    let updatedData = currentSettings?.setting_value || {}
    updatedData[todayISO] = editingClassNoteItems.value
    await supabase.from('system_settings').upsert({ setting_key: 'class_notes_data', setting_value: updatedData }, { onConflict: 'setting_key' })
    await logAudit('修改注意事項', `更新為：${editingClassNoteItems.value.length > 0 ? editingClassNoteItems.value.join('、') : '清空無事項'}`)
    alert("✅ 注意事項已成功更新發布！")
    classNoteItems.value = [...editingClassNoteItems.value]; isEditingClassNotes.value = false
  } catch (error) { alert("❌ 儲存失敗") }
}

const addContactItem = () => { editingContactItems.value.push('') }
const removeContactItem = (idx) => { editingContactItems.value.splice(idx, 1) }
const updateEditingContactItem = (index, value) => { editingContactItems.value[index] = value }
const addClassNoteItem = () => { editingClassNoteItems.value.push('') }
const removeClassNoteItem = (idx) => { editingClassNoteItems.value.splice(idx, 1) }
const updateEditingClassNoteItem = (index, value) => { editingClassNoteItems.value[index] = value }

const currentRefreshInterval = computed(() => {
  if (!isWeekday) return autoRefreshConfig.value.weekend
  return isClassTime.value ? autoRefreshConfig.value.classTime : autoRefreshConfig.value.breakTime
})

const startAutoRefresh = () => {
  if (dataRefreshTimer) clearInterval(dataRefreshTimer)
  if (currentRefreshInterval.value > 0) { dataRefreshTimer = setInterval(fetchData, currentRefreshInterval.value * 1000) }
}

watch(isClassTime, (newVal, oldVal) => { if (newVal !== oldVal) { fetchData(); startAutoRefresh() } })
watch(currentRefreshInterval, (newVal, oldVal) => { if (newVal !== oldVal) { startAutoRefresh() } })

const isScheduleButtonVisible = computed(() => {
  if (!scheduleButtonConfig.value.isVisible) return false
  if (scheduleButtonConfig.value.visibility === 'both') return true
  if (scheduleButtonConfig.value.visibility === 'inside' && isIpBrownlisted.value) return true
  return scheduleButtonConfig.value.visibility === 'outside' && !isIpBrownlisted.value
})

onMounted(() => { 
  updateTime(); timer = setInterval(updateTime, 1000)
  checkIpRules().then(() => { 
    loadTeacherPwd(); checkIdentity() 
    fetchData().then(() => { logVisit(); startAutoRefresh() }) 
  }) 
})

onUnmounted(() => { if (timer) clearInterval(timer); if (dataRefreshTimer) clearInterval(dataRefreshTimer) })
</script>

<style scoped>
.page-container { 
  min-height: 100vh; 
  background-color: #f3f4f6; 
  padding: 20px; 
  font-family: sans-serif; 
  display: flex; 
  flex-direction: column; 
  gap: 20px; 
  transition: 0.3s; 
  max-width: 100vw; 
  overflow-x: hidden; 
  box-sizing: border-box; 
}

.is-exam-mode { 
  padding: 0; 
  background: var(--ex-bg); 
  overflow: hidden; 
}

.normal-home-content { 
  width: 100%; 
  max-width: 100%; 
  box-sizing: border-box; 
}

.main-split { 
  display: flex; 
  gap: 20px; 
  align-items: flex-start; 
  width: 100%; 
  box-sizing: border-box; 
}

.left-panel { 
  flex: 1; 
  display: flex; 
  flex-direction: column; 
  gap: 20px; 
  min-width: 0; 
  width: 100%; 
  box-sizing: border-box;
}

.right-panel { 
  flex: 1; 
  min-width: 0; 
  width: 100%; 
  box-sizing: border-box;
}

.unverified-placeholder { 
  flex: 1; 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center; 
  background: white; 
  padding: 80px 20px; 
  border-radius: 12px; 
  border: 1px dashed #cbd5e1; 
  margin-top: 20px; 
}

.spinner-icon { 
  font-size: 4rem; 
  animation: pulse 2s infinite; 
  margin-bottom: 20px; 
}

.unverified-placeholder h2 { 
  color: #334155; 
  margin-bottom: 10px; 
}

.unverified-placeholder p { 
  color: #64748b; 
  font-size: 1.1rem; 
}

@keyframes pulse { 
  0% { transform: scale(1); opacity: 1; } 
  50% { transform: scale(1.1); opacity: 0.7; } 
  100% { transform: scale(1); opacity: 1; } 
}

.weekend-prompt { 
  text-align: center; 
  padding: 15px; 
  background: #fef3c7; 
  border: 2px dashed #fde68a; 
  border-radius: 8px; 
  color: #d97706; 
  font-size: 1rem; 
  font-weight: bold; 
  margin-top: 10px;
}

.identity-banner { 
  background: #e0f2fe; 
  color: #0369a1; 
  padding: 12px 20px; 
  text-align: center; 
  font-weight: bold; 
  border-radius: 8px; 
  display: flex; 
  justify-content: center; 
  align-items: center; 
  gap: 15px; 
  border: 1px solid #bae6fd; 
  margin-bottom: 15px;
}

.change-id-btn { 
  background: #0ea5e9; 
  color: white; 
  border: none; 
  padding: 6px 14px; 
  border-radius: 6px; 
  cursor: pointer; 
  font-size: 0.95rem; 
  font-weight: bold; 
  transition: 0.2s; 
}

.change-id-btn:hover { 
  background: #0284c7; 
}

@media (max-width: 1024px) { 
  .main-split { flex-direction: column; } 
}

@media (max-width: 768px) { 
  .page-container { padding: 10px; } 
}

:deep(.text-sm) { font-size: 0.9rem !important; line-height: 1.5; }
:deep(.text-xs) { font-size: 0.75rem !important; color: #64748b; font-weight: normal; line-height: 1.4; }
:deep(.mt-10) { margin-top: 10px; }
:deep(.mt-15) { margin-top: 15px; }

:deep(.custom-table) { 
  width: 100%; border-collapse: collapse; min-width: 800px; text-align: center; font-size: 0.95rem; 
}
:deep(.custom-table th), :deep(.custom-table td) { 
  border: 1px solid #000; padding: 8px; vertical-align: middle; 
}
:deep(.custom-table th) { background-color: #f1f5f9; font-weight: bold; }
:deep(.header-row th) { background-color: #e2e8f0; }
:deep(.morning-table td:nth-child(1)), :deep(.morning-table td:nth-child(2)) { font-weight: bold; }
:deep(.lunch-table th) { background: transparent; font-weight: bold; }
:deep(.lunch-table td) { background: transparent; }
:deep(.seat-num), :deep(.seat-number) { font-size: 1.2rem; font-weight: bold; }
:deep(.morning-table tbody tr td:nth-child(2)) { font-size: var(--name-size, 25px) !important; font-weight: bold !important; }
:deep(.morning-table tbody tr td[rowspan] + td) { font-size: inherit !important; font-weight: normal !important; }
:deep(.morning-table tbody tr td[rowspan] + td + td) { font-size: var(--name-size, 25px) !important; font-weight: bold !important; }
:deep(.lunch-table tbody tr:nth-child(even) td) { font-size: var(--name-size, 25px) !important; font-weight: bold !important; }
:deep(.squad-table tbody tr td:nth-child(2)) { font-size: var(--name-size, 25px) !important; font-weight: bold !important; }
:deep(.squad-table tbody tr td[rowspan] + td) { font-size: inherit !important; font-weight: normal !important; }
:deep(.squad-table tbody tr td[rowspan] + td + td) { font-size: var(--name-size, 25px) !important; font-weight: bold !important; }

@media (max-width: 850px) {
  :deep(.custom-table) { display: block; overflow-x: auto; white-space: nowrap; min-width: 100%; border: none; }
  :deep(.custom-table th), :deep(.custom-table td) { white-space: nowrap; }
  :deep(.morning-table tbody tr td:nth-child(2)), 
  :deep(.morning-table tbody tr td[rowspan] + td + td), 
  :deep(.lunch-table tbody tr:nth-child(even) td), 
  :deep(.squad-table tbody tr td:nth-child(2)), 
  :deep(.squad-table tbody tr td[rowspan] + td + td) { font-size: 1.2rem !important; }
}
</style>
