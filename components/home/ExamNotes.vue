<template>
  <div class="exam-notes-display">
    <h4 class="notes-title">⚠️ 考前提醒</h4>
    <ul v-if="notes.length" class="notes-list-preview">
      <li v-for="(note, index) in notes" :key="index">{{ note }}</li>
    </ul>
    <p v-else>目前沒有考前提醒。</p>
  </div>
</template>

<script setup>
defineProps({ notes: { type: Array, default: () => [] } })
</script>

<style scoped>
.exam-notes-display { margin-top: 10px; background: rgba(255,255,255,0.05); border: 2px dashed var(--ex-border); border-radius: 12px; padding: 20px; text-align: left; width: 100%; box-sizing: border-box; }
.notes-title { font-size: calc(var(--ex-notes-size, 24px) + 5px); margin: 0 0 15px; color: var(--ex-danger); border-bottom: 1px dashed var(--ex-border); padding-bottom: 10px; }
.notes-list-preview { margin: 0; padding-left: 30px; font-size: var(--ex-notes-size, 24px); line-height: 1.6; color: var(--ex-text); }
.notes-list-preview li { margin-bottom: 8px; }
</style>
