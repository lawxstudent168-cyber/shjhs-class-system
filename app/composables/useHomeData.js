import { ref, computed, unref } from 'vue'
import { displayedExamSchedule, normalizeExamSchedule, taiwanDateISO } from '../utils/examSchedule.js'
import { normalizeClassNotes, weeklyClassNotes } from '../utils/classNotes.js'
import { resolveSeatingLayout } from '../utils/seatingSchedule.js'
import { normalizeRoleButtonSettings } from '../utils/homeButtonSettings.js'
import { sanitizeHygieneAssignments } from '../utils/hygieneAssignments.js'
import { resolveHygieneForDate } from '../utils/hygieneHistory.js'

export function useHomeData(supabase, todayISO, isIpBrownlistedRef, activeRoleCategoryRef, currentIdentityRef, allStudentsRef, allStudentsForLoginRef, todayAttendancesRef, nowTickRef) {
  const contactBookItems = ref([])
  const officerPasswords = ref({ academic: '', counseling: '', discipline: '', teacher: '168168168' })
  const isHistoryVisibleOnIndex = ref(false)
  const globalButtonSettings = ref({})
  const roleButtonSettings = ref(normalizeRoleButtonSettings())
  
  const clockConfig = ref({ theme: 'classic', color: '#1e293b', size: 35, showIcon: true })
  const announcements = ref([])
  const parentAnnouncements = ref([])
  const isAnnouncementVisibleOnIndex = ref(true)
  const isParentAnnouncementVisibleOnIndex = ref(true)
  const isNoticeBoardVisibleOnIndex = ref(true)
  const scheduleData = ref(null)
  const scheduleButtonConfig = ref({ isVisible: false, visibility: 'both', teacherOnlyInBrownlist: true })
  const savedExamData = ref(normalizeExamSchedule())
  const examDayISO = computed(() => taiwanDateISO(unref(nowTickRef)))
  const examData = computed(() => displayedExamSchedule(savedExamData.value, examDayISO.value))
  const autoRefreshConfig = ref({ classTime: 60, breakTime: 60, weekend: 60 }) 
  
  const indexModulesConfig = ref([
    { id: 'wikiImage', name: '🌍 維基百科每日圖片', isVisible: true },
    { id: 'wikiOtd', name: '🏛️ 歷史上的今天', isVisible: true },
    { id: 'youtube', name: '📺 YouTube 推薦影片', isVisible: true },
    { id: 'foxNews', name: '🦊 Fox News 頭條', isVisible: true },
    { id: 'cnnNews', name: '🟥 CNN News 頭條', isVisible: true },
    { id: 'abcNews', name: '⬛ ABC News 頭條', isVisible: true }
  ])
  const indexDynamicSorting = ref(false)

  // 💡 自動偵測是否顯示維基百科典範條目
  const isWikiFeaturedVisible = computed(() => {
    const mod = indexModulesConfig.value.find(m => m.id === 'wikiFeatured')
    return mod ? mod.isVisible : true 
  })

  const youtubeSchedule = ref({})
  const youtubeIsMuted = ref(true)
  const youtubeBlockedDates = ref([])
  const englishSongSchedule = ref({ 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', isVisible: true })
  const parentNotices = ref([])
  const allClassNoteItems = ref([])
  const classNotesTodayISO = computed(() => taiwanDateISO(unref(nowTickRef)))
  const classNoteItems = computed(() => weeklyClassNotes(allClassNoteItems.value, classNotesTodayISO.value))
  const savedSeatingData = ref(null)
  const seatingChart = computed(() => resolveSeatingLayout(savedSeatingData.value, examDayISO.value))
  const defaultHygieneData = { isVisibleOnIndex: false, morning: {}, lunch: {}, squad: {} }
  const savedHygieneData = ref(JSON.parse(JSON.stringify(defaultHygieneData)))
  const hygieneData = computed(() => resolveHygieneForDate(savedHygieneData.value, examDayISO.value))
  const marqueeSettings = ref({})
  const unreadMsgCount = ref(0)
  const assignmentsData = ref([])
  const assignmentSubmissionsData = ref([])
  const excludedAssignmentIds = ref([])
  const goodArticles = ref([])
  const expectedTeacherPwd = ref('168168168')

  const loadTeacherPwd = async () => {
    const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'admin_password').maybeSingle()
    if (data?.setting_value) {
      if (data.setting_value.type === 'dynamic') {
        const d = new Date()
        const yy = String(d.getFullYear()).slice(2)
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        expectedTeacherPwd.value = `${yy}${mm}${dd}59`
      } else {
        expectedTeacherPwd.value = data.setting_value.custom_pwd || '168168168'
      }
    }
  }

  const fetchData = async () => {
    const isIpBrownlisted = unref(isIpBrownlistedRef)
    const activeRoleCategory = unref(activeRoleCategoryRef)
    const currentIdentity = unref(currentIdentityRef)

    const { data: boardData } = await supabase.from('contact_books').select('contact_items').eq('record_date', todayISO).maybeSingle()
    contactBookItems.value = boardData?.contact_items || []

    const keysToFetch = [
      'board_officer_passwords', 'seating_chart_data', 'hygiene_management_data', 
      'contact_history_visible', 'index_button_settings', 'announcements_data', 
      'class_schedule_data', 'exam_schedule_data', 'parent_notices_data', 
      'class_notes_data', 'announcement_board_visible', 'parent_notices_board_visible',
      'parent_announcements_data', 'parent_announcement_board_visible', 'schedule_button_settings',
      'index_clock_size', 'index_clock_config', 'index_auto_refresh_seconds', 'role_button_settings',
      'force_logout_timestamp', 'marquee_settings', 'youtube_schedule_data',
      'index_modules_config', 'english_song_schedule_data',
      'index_auto_refresh_config', 'good_articles_data', 'excluded_assignment_ids_from_report' 
    ]

    const { data: sysData } = await supabase.from('system_settings').select('*').in('setting_key', keysToFetch)
    
    if (sysData && sysData.length > 0) {
      sysData.forEach(s => {
        try {
          const v = s.setting_value
          if (v === null || v === undefined) return
          
          switch (s.setting_key) {
            case 'excluded_assignment_ids_from_report': excludedAssignmentIds.value = v || []; break
            case 'good_articles_data': goodArticles.value = Array.isArray(v) ? v : []; break
            case 'board_officer_passwords': officerPasswords.value = { ...officerPasswords.value, ...v }; break
            case 'contact_history_visible': isHistoryVisibleOnIndex.value = v; break
            case 'index_button_settings': globalButtonSettings.value = v; break
            case 'role_button_settings': roleButtonSettings.value = normalizeRoleButtonSettings(v); break
            case 'index_clock_config': clockConfig.value = { ...clockConfig.value, ...v }; break
            case 'index_clock_size': if (!sysData.find(x => x.setting_key === 'index_clock_config')) { clockConfig.value.size = Number(v) || 35 }; break
            case 'announcements_data': if (Array.isArray(v)) announcements.value = v.sort((a, b) => new Date(b.date) - new Date(a.date)); break
            case 'parent_announcements_data': if (Array.isArray(v)) parentAnnouncements.value = v.sort((a, b) => new Date(b.date) - new Date(a.date)); break
            case 'announcement_board_visible': isAnnouncementVisibleOnIndex.value = v; break
            case 'parent_announcement_board_visible': isParentAnnouncementVisibleOnIndex.value = v; break
            case 'parent_notices_board_visible': isNoticeBoardVisibleOnIndex.value = v; break
            case 'class_schedule_data': scheduleData.value = v; break
            case 'schedule_button_settings': scheduleButtonConfig.value = { teacherOnlyInBrownlist: true, ...v }; break
            case 'exam_schedule_data': savedExamData.value = normalizeExamSchedule(v); break
            case 'index_auto_refresh_config': if (typeof v === 'object') autoRefreshConfig.value = { ...autoRefreshConfig.value, ...v }; break
            case 'index_auto_refresh_seconds': if (!sysData.find(x => x.setting_key === 'index_auto_refresh_config')) { const oldVal = Number(v) || 60; autoRefreshConfig.value = { classTime: oldVal, breakTime: oldVal, weekend: oldVal } }; break
            case 'index_modules_config': 
              let loadedMods = []
              if (Array.isArray(v)) { loadedMods = v } else if (typeof v === 'object') { if (v.modules) loadedMods = v.modules; if (v.dynamicSorting !== undefined) indexDynamicSorting.value = v.dynamicSorting }
              const existingIds = loadedMods.map(m => m.id)
              const defaultModsList = [
                { id: 'wikiFeatured', name: '📖 維基百科 典範條目', isVisible: true },
                { id: 'wikiImage', name: '🌍 維基百科每日圖片', isVisible: true },
                { id: 'wikiOtd', name: '🏛️ 歷史上的今天', isVisible: true },
                { id: 'youtube', name: '📺 YouTube 推薦影片', isVisible: true },
                { id: 'foxNews', name: '🦊 Fox News 頭條', isVisible: true },
                { id: 'cnnNews', name: '🟥 CNN News 頭條', isVisible: true },
                { id: 'abcNews', name: '⬛ ABC News 頭條', isVisible: true }
              ]
              defaultModsList.forEach(defMod => { if (!existingIds.includes(defMod.id)) loadedMods.push(defMod) })
              indexModulesConfig.value = loadedMods
              break
            case 'youtube_schedule_data': 
              if (typeof v === 'object') {
                if (v.videos) {
                  youtubeSchedule.value = v.videos
                  youtubeIsMuted.value = v.isMuted !== false
                  youtubeBlockedDates.value = Array.isArray(v.blockedDates) ? v.blockedDates : []
                } else {
                  youtubeSchedule.value = v
                  youtubeIsMuted.value = true
                  youtubeBlockedDates.value = []
                }
              } break
            case 'english_song_schedule_data': if (typeof v === 'object') englishSongSchedule.value = { ...englishSongSchedule.value, ...v }; break
            case 'parent_notices_data': if (Array.isArray(v)) { parentNotices.value = v.filter(n => !n.isHidden && (!n.startDate || n.startDate <= todayISO) && (!n.endDate || n.endDate >= todayISO)) }; break
            case 'class_notes_data': allClassNoteItems.value = normalizeClassNotes(v); break
            case 'seating_chart_data': if (typeof v === 'object') savedSeatingData.value = v; break
            case 'hygiene_management_data': if (typeof v === 'object') savedHygieneData.value = sanitizeHygieneAssignments({ ...defaultHygieneData, ...v }); break
            case 'marquee_settings': marqueeSettings.value = v; break
            case 'force_logout_timestamp': {
              const dbLogoutTime = Number(v) || 0; const localLogoutTime = Number(localStorage.getItem('local_logout_timestamp')) || 0
              if (dbLogoutTime > localLogoutTime) {
                localStorage.setItem('local_logout_timestamp', dbLogoutTime)
                if (isIpBrownlisted && currentIdentity !== '匿名來訪者') {
                  localStorage.removeItem('visitor_known_identity')
                  sessionStorage.removeItem('schedule_admin_logged_in')
                  sessionStorage.removeItem('exams_admin_logged_in')
                  currentIdentityRef.value = '匿名來訪者'
                  alert('⚠️ 系統安全機制：管理員已遠端強制登出此設備的帳號。\n為保護班級資訊，請重新驗證身分。')
                  window.location.reload() 
                }
              }
              break
            }
          }
        } catch (err) {}
      })
      
    }

    const { data: sData } = await supabase.from('students').select('*').order('seat_number')
    if (sData) { 
      allStudentsForLoginRef.value = sData
      allStudentsRef.value = sData.filter(s => !s.hide_attendance) 
    }
    
    const { data: attData } = await supabase.from('attendances').select('*').eq('record_date', todayISO)
    if (attData) { todayAttendancesRef.value = attData }

    try {
      const { data: msgData } = await supabase.from('private_messages').select('*').neq('sender_role', '導師')
      if (msgData) {
        const uParents = msgData.filter(m => m.chat_type === '家長' && m.is_read_by_teacher === false).length
        const uStudents = msgData.filter(m => m.chat_type === '學生' && m.is_read_by_teacher === false).length
        unreadMsgCount.value = isIpBrownlisted ? (uParents + uStudents) : uParents
      }
    } catch (e) {}

    if (!isIpBrownlisted && (activeRoleCategory === 'parent' || activeRoleCategory === 'student')) {
      const { data: assignData } = await supabase.from('assignments').select('*').order('deadline', { ascending: true })
      if (assignData) { assignmentsData.value = assignData }

      const { data: subData } = await supabase.from('assignment_submissions').select('*')
      if (subData) { assignmentSubmissionsData.value = subData }
    }
  }

  return {
    contactBookItems, officerPasswords, isHistoryVisibleOnIndex, globalButtonSettings, roleButtonSettings, clockConfig,
    announcements, parentAnnouncements, isAnnouncementVisibleOnIndex, isParentAnnouncementVisibleOnIndex, isNoticeBoardVisibleOnIndex,
    scheduleData, scheduleButtonConfig, examData, autoRefreshConfig, indexModulesConfig, indexDynamicSorting, isWikiFeaturedVisible,
    youtubeSchedule, youtubeIsMuted, youtubeBlockedDates, englishSongSchedule, parentNotices, classNoteItems, allClassNoteItems, seatingChart, hygieneData,
    marqueeSettings, unreadMsgCount, assignmentsData, assignmentSubmissionsData, excludedAssignmentIds, goodArticles,
    expectedTeacherPwd, loadTeacherPwd, fetchData
  }
}
