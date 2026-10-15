<template>
  <dialog ref="dialog" aria-labelledby="partial-leave-title" @cancel.prevent="$emit('cancel')" @click="closeOnBackdrop">
    <form @submit.prevent="$emit('confirm', { direction, time })">
      <h3 id="partial-leave-title">部份公假</h3>
      <p>{{ studentName }}</p>
      <label>入班／離班
        <select v-model="direction" autofocus>
          <option value="入班">入班</option>
          <option value="離班">離班</option>
        </select>
      </label>
      <label>時間 <input v-model="time" type="time" required /></label>
      <div class="actions">
        <button type="button" @click="$emit('cancel')">取消</button>
        <button type="submit" class="confirm">確定</button>
      </div>
    </form>
  </dialog>
</template>

<script setup>
import { ref, onMounted } from 'vue'
defineProps({ studentName: { type: String, default: '' } })
const emit = defineEmits(['confirm', 'cancel'])
const dialog = ref(null)
const direction = ref('入班')
const time = ref('10:00')
onMounted(() => dialog.value.showModal())
const closeOnBackdrop = event => {
  if (event.target !== dialog.value) return
  const rect = dialog.value.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) emit('cancel')
}
</script>

<style scoped>
dialog { border: 0; border-radius: 16px; padding: 24px; width: min(360px, 90vw); color: #1e293b; box-shadow: 0 20px 60px #0003; }
dialog::backdrop { background: #0f172a80; }
h3 { margin-top: 0; }
label { display: flex; flex-direction: column; gap: 8px; margin: 16px 0; font-weight: bold; }
select, input, button { font: inherit; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; }
.actions { display: flex; justify-content: flex-end; gap: 12px; }
button { cursor: pointer; background: white; }
.confirm { background: #0f766e; color: white; }
</style>
