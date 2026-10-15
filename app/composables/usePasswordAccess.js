import { ref } from 'vue'

export function usePasswordAccess(isWeekday) {
  const showPwdModal = ref(false)
  const pwdTarget = ref('')
  const pwdModalTitle = ref('')
  const pwdModalDesc = ref('')
  const currentEditorRole = ref('')

  const openPwdModal = (target) => {
    pwdTarget.value = target
    if (target === 'emergency') { 
      pwdModalTitle.value = '🚨 緊急通知系統解鎖'
      pwdModalDesc.value = '請輸入「導師」密碼：' 
    } else if (target === 'contact') { 
      pwdModalTitle.value = '✏️ 編輯聯絡簿解鎖'
      pwdModalDesc.value = '請輸入「學藝股長」、「輔導股長」或「導師」密碼：' 
    } else if (target === 'classNotes') { 
      pwdModalTitle.value = '⚡ 編輯注意事項解鎖'
      pwdModalDesc.value = '請輸入「學藝股長」、「輔導股長」或「導師」密碼：' 
    } else if (target === 'attendance') {
      pwdModalTitle.value = '🔓 點名板解鎖'
      pwdModalDesc.value = '請輸入「導師」密碼。解鎖後可連續點名，確認完成後請按「鎖上」：'
    }
    showPwdModal.value = true
  }

  return {
    showPwdModal, pwdTarget, pwdModalTitle, pwdModalDesc, currentEditorRole,
    openPwdModal
  }
}
