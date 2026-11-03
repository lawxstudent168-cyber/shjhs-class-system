<template>
  <div class="delay-control">
    <button type="button" class="delay-fab" @click="toggle">⏭ 延後到隔天</button>
    <form v-if="open" class="password-popover" @submit.prevent="submit">
      <label>導師動態密碼</label>
      <input ref="inputEl" v-model="password" type="password" inputmode="numeric" autocomplete="off" />
      <div><button type="button" @click="close">取消</button><button type="submit" :disabled="busy">{{ busy ? '處理中…' : '確認延後' }}</button></div>
    </form>
  </div>
</template>

<script setup>
import { nextTick, ref } from 'vue'
const props = defineProps({ onDelay: { type: Function, required: true } })
const open = ref(false)
const password = ref('')
const busy = ref(false)
const inputEl = ref(null)
const close = () => { open.value = false; password.value = '' }
const toggle = async () => { open.value = !open.value; if (open.value) { await nextTick(); inputEl.value?.focus() } }
const submit = async () => {
  if (!password.value || busy.value) return
  busy.value = true
  try { await props.onDelay(password.value) } finally { busy.value = false; close() }
}
</script>

<style scoped>
.delay-control { position: relative; margin-left: auto; }
.delay-fab { border: 0; border-radius: 999px; padding: 7px 12px; background: #475569; color: white; font-size: .82rem; font-weight: bold; cursor: pointer; box-shadow: 0 3px 8px rgba(0,0,0,.18); }
.password-popover { position: absolute; z-index: 20; top: calc(100% + 8px); right: 0; width: 230px; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: white; box-shadow: 0 10px 25px rgba(15,23,42,.2); }
.password-popover label { display: block; margin-bottom: 6px; color: #334155; font-size: .85rem; font-weight: bold; }
.password-popover input { width: 100%; box-sizing: border-box; padding: 8px; border: 1px solid #94a3b8; border-radius: 5px; }
.password-popover div { display: flex; justify-content: flex-end; gap: 7px; margin-top: 9px; }
.password-popover button { border: 0; border-radius: 5px; padding: 6px 9px; cursor: pointer; }
.password-popover button[type='submit'] { background: #2563eb; color: white; }
</style>
