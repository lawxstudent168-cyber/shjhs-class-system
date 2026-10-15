<template>
  <div class="time-select">
    <select :value="hour" aria-label="時" @change="setHour($event.target.value)">
      <option v-if="allowEmpty" value="">時</option>
      <option v-for="value in hours" :key="value" :value="value">{{ value }} 時</option>
    </select>
    <span aria-hidden="true">:</span>
    <select :value="minute" aria-label="分" @change="setMinute($event.target.value)">
      <option v-if="allowEmpty" value="">分</option>
      <option v-for="value in minutes" :key="value" :value="value">{{ value }} 分</option>
    </select>
    <button v-if="allowEmpty && modelValue" type="button" @click="$emit('update:modelValue', '')">清除</button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ modelValue: { type: String, default: '' }, allowEmpty: Boolean })
const emit = defineEmits(['update:modelValue'])
const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
const hour = computed(() => props.modelValue?.split(':')[0] || (props.allowEmpty ? '' : '00'))
const minute = computed(() => props.modelValue?.split(':')[1] || (props.allowEmpty ? '' : '00'))
const setHour = value => emit('update:modelValue', value ? `${value}:${minute.value || '00'}` : '')
const setMinute = value => emit('update:modelValue', value ? `${hour.value || '00'}:${value}` : '')
</script>

<style scoped>
.time-select { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
select, button { font: inherit; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; background: white; color: #334155; cursor: pointer; }
select { flex: 1; min-width: 70px; }
</style>
