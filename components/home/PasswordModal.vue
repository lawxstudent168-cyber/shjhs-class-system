<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="pwd-modal-content">
      <h3>{{ title }}</h3>
      <p class="pwd-desc">{{ desc }}</p>
      <input type="password" v-model="pwdInput" @keyup.enter="submit" class="pwd-input" placeholder="請輸入密碼..." autofocus />
      <div class="pwd-actions">
        <button @click="$emit('close')" class="cancel-btn">取消</button>
        <button @click="submit" class="confirm-btn">解鎖</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { trackVisitorEvent } from '../../app/utils/visitorTrackingClient.js'
import { passwordModalRole } from '../../app/utils/teacherUnlock.js'

const props = defineProps({
  show: Boolean,
  target: String,
  title: String,
  desc: String,
  officerPasswords: Object
})

const emit = defineEmits(['close', 'success'])
const pwdInput = ref('')

watch(() => props.show, () => { pwdInput.value = '' })

const submit = () => {
  const role = passwordModalRole(pwdInput.value, props.target, props.officerPasswords)
  if (role) emit('success', { target: props.target, role })
  else {
    void trackVisitorEvent({ kind: 'operation', label: '密碼驗證', details: props.target, outcome: '失敗' })
    alert('❌ 密碼錯誤！請確認密碼是否正確。')
  }
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
</style>
