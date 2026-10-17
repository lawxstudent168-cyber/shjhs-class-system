import { beginVisitorSession, resumeVisitorSession } from '../utils/visitorTrackingClient.js'
import { ref, computed } from 'vue'

export function useIdentityGuard(supabase) {
  const isIpWhitelisted = ref(false)
  const isIpBrownlisted = ref(false)
  const currentIpStr = ref('')
  const currentIdentity = ref('匿名來訪者')
  const showIdentityModal = ref(false)

  const activeRoleCategory = computed(() => {
    const id = currentIdentity.value;
    if (!id) return 'anonymous';
    if (id.includes('導師')) return 'teacher';
    if (id.includes('任課老師')) return 'subject_teacher';
    if (id.includes('家長')) return 'parent';
    if (id.includes('學生')) return 'student';
    if (isIpBrownlisted.value) return 'classroom';
    return 'anonymous';
  })

  const isContentVisible = computed(() => isIpBrownlisted.value || currentIdentity.value !== '匿名來訪者')

  const checkIpRules = async () => {
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json')
      const { ip } = await ipRes.json()
      currentIpStr.value = ip 
      const { data: rules } = await supabase.from('ip_rules').select('ip_range, rule_type')
      if (rules && rules.length > 0) {
        isIpWhitelisted.value = rules.filter(r => r.rule_type === '白名單').some(r => ip.startsWith(r.ip_range))
        isIpBrownlisted.value = rules.filter(r => r.rule_type === '褐名單').some(r => ip.startsWith(r.ip_range))
      }
    } catch (e) {}
  }

  const checkIdentity = () => {
    currentIdentity.value = localStorage.getItem('visitor_known_identity') || '匿名來訪者'
    void resumeVisitorSession(currentIdentity.value, '首頁裝置記憶身分（本次未重新驗證）')
    if (!isIpBrownlisted.value && currentIdentity.value === '匿名來訪者') {
      showIdentityModal.value = true
    }
  }

  // Page views are recorded by the globally registered plugin, once per navigation.
  const logVisit = async () => {}
  const logRoleVisit = (roleName, target = '') => {
    const labels = { attendance: '點名板', contact: '聯絡簿', classNotes: '注意事項', emergency: '緊急通知' }
    return beginVisitorSession(roleName, `密碼驗證${target ? '／' + (labels[target] || target) : ''}`)
  }

  return {
    isIpWhitelisted, isIpBrownlisted, currentIpStr, currentIdentity, showIdentityModal, 
    activeRoleCategory, isContentVisible,
    checkIpRules, checkIdentity, logVisit, logRoleVisit
  }
}
