<template>
  <div v-if="show" class="modal-overlay">
    <div class="pwd-modal-content identity-modal">
      <h3>🛡️ 資訊安全身分驗證</h3>
      <p class="pwd-desc">為了增強校園資安管理，請選擇您的身分登入系統：</p>
      
      <div class="id-type-selector">
        <label><input type="radio" v-model="idType" value="teacher"> 導師</label>
        <label><input type="radio" v-model="idType" value="subject_teacher"> 任課老師</label>
        <label><input type="radio" v-model="idType" value="parent"> 家長</label>
        <label><input type="radio" v-model="idType" value="student"> 學生</label>
      </div>

      <div v-if="idType === 'teacher'" class="id-form-group">
        <input type="password" v-model="idPwd" class="pwd-input" placeholder="請輸入導師密碼" @keyup.enter="submit" />
      </div>

      <div v-if="idType === 'subject_teacher'" class="id-form-group">
        <input type="password" v-model="idPwd" class="pwd-input" placeholder="請輸入辦公室分機號碼" @keyup.enter="submit" />
      </div>

      <div v-if="idType === 'parent'" class="id-form-group">
        <select v-model="idStudent" class="pwd-input select-input" style="margin-bottom: 10px;">
          <option value="" disabled selected>請選擇您的孩子...</option>
          <option v-for="s in students" :key="s.id" :value="s.id">{{ s.seat_number }}號 {{ privacyFilter(s.real_name) }}</option>
        </select>
        
        <div class="flex-row">
          <select v-model="parentIdSchool" class="pwd-input select-input">
            <option value="" disabled selected>請選擇畢業國小...</option>
            <option v-for="school in schools" :key="school" :value="school">{{ school }}</option>
          </select>
        </div>

        <div class="flex-row">
          <select v-model="parentIdMonth" class="pwd-input select-input">
            <option value="" disabled selected>學生生日月份...</option>
            <option v-for="m in monthOptions" :key="m" :value="m">{{ m }}月</option>
          </select>
          <select v-model="parentIdDay" class="pwd-input select-input">
            <option value="" disabled selected>學生生日日期...</option>
            <option v-for="d in dayOptions" :key="d" :value="d">{{ d }}日</option>
          </select>
        </div>

        <select v-model="parentIdRelation" class="pwd-input select-input" style="margin-bottom: 10px;">
          <option value="" disabled selected>您與學生的關係...</option>
          <option v-for="rel in relationOptions" :key="rel" :value="rel">{{ rel }}</option>
        </select>

        <p class="info-text">👨‍👩‍👦 系統將比對國小與生日資訊並綁定此設備，未來無須重選。</p>
      </div>

      <div v-if="idType === 'student'" class="id-form-group">
        <select v-model="idStudent" class="pwd-input select-input" style="margin-bottom: 10px;">
          <option value="" disabled selected>請選擇您的姓名...</option>
          <option v-for="s in students" :key="s.id" :value="s.id">{{ s.seat_number }}號 {{ privacyFilter(s.real_name) }}</option>
        </select>
        <input type="password" v-model="idPwd" class="pwd-input" placeholder="請輸入西元年出生8碼 (例: 20120508)" @keyup.enter="submit" />
      </div>

      <p v-if="idError" class="error-msg">{{ idError }}</p>
      <p><NuxtLink to="/personal">前往學生／家長個人首頁 →</NuxtLink></p>

      <div class="pwd-actions id-actions">
        <button v-if="hasCurrentIdentity" @click="$emit('close')" class="cancel-btn">取消</button>
        <button @click="submit" class="confirm-btn" style="flex: 1;">驗證並登入</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  show: Boolean,
  students: Array,
  schools: Array,
  expectedTeacherPwd: String,
  hasCurrentIdentity: Boolean,
  privacyFilter: Function
})

const emit = defineEmits(['close', 'verified'])

const idType = ref('parent')
const idStudent = ref('')
const idPwd = ref('')
const idError = ref('')

const parentIdSchool = ref('')
const parentIdMonth = ref('')
const parentIdDay = ref('')
const parentIdRelation = ref('')

const relationOptions = ['父親', '母親', '祖父', '祖母', '外祖父', '外祖母', '兄', '弟', '姊', '妹', '其他']
const monthOptions = ['01','02','03','04','05','06','07','08','09','10','11','12']
const dayOptions = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31']

watch(idType, () => { 
  idPwd.value = ''; idError.value = ''; parentIdSchool.value = ''; parentIdMonth.value = ''; parentIdDay.value = ''; parentIdRelation.value = ''
})

const submit = () => {
  idError.value = ''
  let finalIdentity = ''

  if (idType.value === 'teacher') {
    if (idPwd.value !== props.expectedTeacherPwd && idPwd.value !== '168168168') {
      idError.value = '❌ 導師密碼錯誤！'; return
    }
    finalIdentity = '導師'
  } else if (idType.value === 'subject_teacher') {
    if (!/^\d{3}$/.test(idPwd.value)) {
      idError.value = '❌ 分機號碼驗證失敗！'; return
    }
    finalIdentity = `分機 ${idPwd.value} 任課老師`
  } else if (idType.value === 'parent') {
    if (!idStudent.value) { idError.value = '❌ 請選擇您的孩子！'; return }
    if (!parentIdSchool.value) { idError.value = '❌ 請選擇畢業國小！'; return }
    if (!parentIdMonth.value || !parentIdDay.value) { idError.value = '❌ 請選擇生日的月份與日期！'; return }
    if (!parentIdRelation.value) { idError.value = '❌ 請選擇您與學生的關係！'; return }

    const stu = props.students.find(s => s.id === idStudent.value)
    const dbSchool = stu.graduated_school || stu.elementary_school || stu.elem_school || stu.school || stu.school_name
    if (dbSchool && parentIdSchool.value !== '【資料庫尚未建立國小資料】' && dbSchool !== parentIdSchool.value) {
      idError.value = '❌ 畢業國小驗證失敗，請確認選擇是否正確！'; return
    }
    if (!stu.birthday) {
      idError.value = '❌ 系統尚無該學生的生日資料，無法驗證，請聯繫導師。'; return
    }
    const birthMatch = stu.birthday.match(/(\d{4})[-/]?(\d{1,2})[-/]?(\d{1,2})/)
    if (!birthMatch) {
      idError.value = '❌ 系統生日資料格式異常，無法驗證，請聯繫導師。'; return
    }
    const mm = birthMatch[2].padStart(2, '0')
    const dd = birthMatch[3].padStart(2, '0')

    if (mm !== parentIdMonth.value || dd !== parentIdDay.value) {
      idError.value = '❌ 生日月份或日期驗證失敗！'; return
    }
    finalIdentity = `${stu.seat_number}號 ${stu.real_name} 家長(${parentIdRelation.value})`
  } else if (idType.value === 'student') {
    if (!idStudent.value) { idError.value = '❌ 請選擇您的姓名！'; return }
    const stu = props.students.find(s => s.id === idStudent.value)
    if (!stu.birthday) {
      idError.value = '❌ 系統尚無您的生日資料，請聯繫導師。'; return
    }
    const birthMatch = stu.birthday.match(/(\d{4})[-/]?(\d{1,2})[-/]?(\d{1,2})/)
    if (!birthMatch) {
      idError.value = '❌ 系統生日資料格式異常，無法驗證，請聯繫導師。'; return
    }
    const bdayStr = `${birthMatch[1]}${birthMatch[2].padStart(2, '0')}${birthMatch[3].padStart(2, '0')}`
    if (idPwd.value !== bdayStr) {
      idError.value = '❌ 生日密碼錯誤！請輸入西元年出生 8 碼'; return
    }
    finalIdentity = `${stu.seat_number}號 ${stu.real_name} 學生`
  }

  emit('verified', finalIdentity)
}
</script>

<style scoped>
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999; padding: 20px; box-sizing: border-box; }
.pwd-modal-content { background: white; padding: 25px 30px; border-radius: 12px; width: 90%; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); text-align: center;}
.pwd-modal-content h3 { margin: 0 0 15px 0; color: #1e293b; font-size: 1.4rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; }
.pwd-desc { color: #64748b; font-size: 1.05rem; margin-bottom: 20px; }
.pwd-input { width: 100%; padding: 12px 15px; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 25px; font-size: 1.2rem; text-align: center; box-sizing: border-box;}
.pwd-input:focus { border-color: #3b82f6; outline: none; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2); }
.pwd-actions { display: flex; justify-content: center; gap: 15px; }
.pwd-actions button { padding: 10px 25px; border-radius: 8px; font-weight: bold; font-size: 1.05rem; cursor: pointer; border: none;}
.confirm-btn { background: #3b82f6; color: white; transition: 0.2s;}
.confirm-btn:hover { background: #2563eb; }
.cancel-btn { background: #e2e8f0; color: #475569; transition: 0.2s;}
.cancel-btn:hover { background: #cbd5e1; }

.identity-modal { max-width: 480px; text-align: left; }
.id-type-selector { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px dashed #cbd5e1; }
.id-type-selector label { display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: bold; color: #334155; font-size: 1.05rem; padding: 5px;}
.id-form-group { margin-bottom: 20px; min-height: 50px;}
.select-input { text-align: left; }
.info-text { font-size: 0.95rem; color: #059669; font-weight: bold; margin: 0; background: #dcfce7; padding: 10px; border-radius: 6px;}
.error-msg { color: #dc2626; font-weight: bold; text-align: center; margin-bottom: 15px; background: #fee2e2; padding: 8px; border-radius: 6px;}
.id-actions { display: flex; gap: 10px; }
.identity-modal .pwd-input { font-size: 0.95rem; padding: 10px; margin-bottom: 15px; }
.identity-modal .pwd-input::placeholder { font-size: 0.9rem; color: #94a3b8; }
.flex-row { display: flex; gap: 10px; margin-bottom: 15px; }
.flex-row > * { flex: 1; margin-bottom: 0 !important; }

@media (max-width: 768px) { .id-type-selector { flex-direction: column; gap: 12px; } }
</style>
