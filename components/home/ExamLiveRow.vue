<template>
  <div class="exam-live-row" :class="{ 'without-countdown': !showCountdown }">
    <div class="live-item clock-item">
      <div class="live-label">{{ preview ? '目前時間（預覽）' : '目前時間' }}</div>
      <div class="exam-clock">{{ currentTime }}</div>
    </div>

    <div v-if="showCountdown" class="live-item countdown-item">
      <div class="live-label">距離本節結束</div>
      <div class="exam-countdown" :class="{ 'text-danger': countdownMinutes < 5 }">{{ countdownText }}</div>
    </div>

    <div v-if="examStatus.state === 'TESTING' && examStatus.current" class="live-item subject-item">
      <div class="live-label">目前進行</div>
      <div class="status-subject">{{ examStatus.current.subject }}</div>
      <div v-if="!showCountdown" class="study-mode-text">📖 溫書自習中</div>
    </div>
    <div v-else class="live-item state-item">
      <div v-if="examStatus.state === 'WAITING'" class="status-text waiting">⏳ 準備中...</div>
      <div v-else-if="examStatus.state === 'FINISHED'" class="status-text finished">🎉 今日全數結束</div>
      <div v-else-if="examStatus.state === 'BREAK'" class="status-text break">
        <div>☕ 休息時間</div>
        <div v-if="examStatus.next" class="status-next">
          下一節：<span class="highlight">{{ examStatus.next.subject }}</span>
          <span class="next-time">（{{ examStatus.next.startTime }} 開始）</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  examStatus: { type: Object, required: true },
  currentTime: { type: String, required: true },
  countdownMinutes: { type: Number, required: true },
  countdownText: { type: String, required: true },
  preview: { type: Boolean, default: false }
})

const showCountdown = computed(() => props.examStatus.state === 'TESTING' && Boolean(props.examStatus.current?.isExam))
</script>

<style scoped>
.exam-live-row { width: 100%; container-type: inline-size; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: center; gap: 12px; }
.exam-live-row.without-countdown { grid-template-columns: repeat(2, minmax(0, 1fr)); justify-content: center; }
.live-item { min-width: 0; text-align: center; overflow-wrap: anywhere; }
.live-label { color: var(--ex-text); opacity: 0.82; font-size: clamp(14px, 2.7cqw, 24px); margin-bottom: 10px; }
.exam-clock { color: var(--ex-clock); font-family: monospace; font-weight: bold; font-size: min(var(--ex-row-clock-size, 62px), 6cqw); line-height: 1.15; white-space: nowrap; }
.exam-countdown { color: var(--ex-success); font-family: monospace; font-weight: bold; font-size: min(var(--ex-row-countdown-size, 73px), 10cqw); line-height: 1.15; white-space: nowrap; }
.status-subject { color: var(--ex-accent); font-weight: bold; font-size: min(var(--ex-row-subject-size, 62px), 9cqw); line-height: 1.18; }
.without-countdown .exam-clock { font-size: min(var(--ex-row-clock-wide-size, 90px), 9cqw); }
.without-countdown .status-subject { font-size: min(var(--ex-subject-size, 88px), 12cqw); }
.text-danger { color: var(--ex-danger) !important; animation: blink 1s infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
.study-mode-text { color: var(--ex-success); font-size: clamp(13px, 2.3cqw, 20px); margin-top: 12px; }
.status-text { font-size: clamp(18px, 3.2cqw, 32px); font-weight: bold; }
.status-text.waiting { color: var(--ex-text); opacity: 0.7; }
.status-text.finished { color: var(--ex-success); }
.status-text.break { color: var(--ex-text); }
.status-next { margin-top: 12px; font-size: clamp(14px, 2.5cqw, 24px); }
.highlight { display: block; color: var(--ex-success); font-size: min(var(--ex-next-subject-size, 57px), 6cqw); font-weight: bold; }
.next-time { display: block; color: var(--ex-text); font-size: min(var(--ex-next-time-size, 30px), 3.5cqw); opacity: 0.8; }
</style>
