<template>
  <div class="exam-dashboard" :style="currentThemeStyles">
    <button @click="$emit('exit')" class="exit-exam-btn" title="結束大考模式">✖ 結束</button>
    
    <div class="exam-header">
      <h1 class="exam-main-title">{{ examData.title }}</h1>
      <section class="exam-attendance" aria-label="今日出缺席統計">
        <span>應到 <strong>{{ attendanceSummary.expected }}</strong></span>
        <span>已到 <strong>{{ attendanceSummary.present }}</strong></span>
        <span class="attendance-leave">全天請假 <strong>{{ attendanceSummary.leave }}</strong></span>
        <span class="attendance-leave">晚到請假 <strong>{{ attendanceSummary.lateLeave }}</strong></span>
        <span class="attendance-leave">早退請假 <strong>{{ attendanceSummary.earlyLeave }}</strong></span>
        <span>遲到 <strong>{{ attendanceSummary.late }}</strong></span>
        <span class="attendance-absent">未到 <strong>{{ attendanceSummary.absent }}</strong>（{{ attendanceSummary.absentSeats.join('、') || '無' }}）</span>
        <span class="attendance-leave">請假座號 {{ attendanceSummary.leaveSeats.join('、') || '無' }}</span>
      </section>
    </div>
    
    <div class="exam-split-layout">
      <div class="exam-left-panel">
        <table class="exam-table">
          <thead>
            <tr>
              <th width="120">節次</th>
              <th>考科</th>
              <th>開始時間</th>
              <th>結束時間</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, i) in examStatus.periods" :key="i" :class="{ 'active-row': p.isActive }">
              <td class="exam-cell-period">第 {{ i + 1 }} 節</td>
              <td class="exam-cell-subject font-bold">{{ p.subject }}</td>
              <td class="exam-cell-time font-mono">{{ p.startTime }}</td>
              <td class="exam-cell-time font-mono">{{ p.endTime }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="exam-right-panel">
        <ExamLiveRow :exam-status="examStatus" :current-time="currentTime"
          :countdown-minutes="countdownMinutes" :countdown-text="countdownText" />

        <!-- 💡 核心新增：前台讀取並展示「大考提醒事項」區塊 -->
        <div class="exam-notes-display" v-if="examData.notes && examData.notes.length > 0">
          <h4 class="notes-title">⚠️ 考前提醒</h4>
          <ul class="notes-list-preview">
            <li v-for="(note, idx) in examData.notes" :key="'front-note-'+idx">{{ note }}</li>
          </ul>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ExamLiveRow from './ExamLiveRow.vue'
import { summarizeExamAttendance } from '../../app/utils/examAttendance.js'
const props = defineProps({
  examData: { type: Object, required: true },
  examStatus: { type: Object, required: true },
  currentTime: { type: String, required: true },
  countdownMinutes: { type: Number, required: true },
  countdownText: { type: String, required: true },
  currentThemeStyles: { type: Object, required: true },
  allStudents: { type: Array, default: () => [] },
  todayAttendances: { type: Array, default: () => [] }
})

const attendanceSummary = computed(() => summarizeExamAttendance(props.allStudents, props.todayAttendances))
defineEmits(['exit'])
</script>

<style scoped>
.exam-dashboard { background-color: var(--ex-bg); color: var(--ex-text); min-height: 100vh; padding: 28px 30px 20px; display: flex; flex-direction: column; position: relative; align-items: stretch; transition: background-color 0.5s ease;}
.exit-exam-btn { position: fixed; top: 4px; right: 12px; background: var(--ex-panel-bg); border: 1px solid var(--ex-border); color: var(--ex-text); padding: 3px 8px; border-radius: 7px; cursor: pointer; font-size: 0.75rem; line-height: 1; opacity: 0.65; transition: opacity 0.2s; z-index: 50; }
.exit-exam-btn:hover, .exit-exam-btn:focus-visible { opacity: 1; }
.exam-header { display: flex; align-items: center; gap: 18px; min-width: 0; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid var(--ex-border); }
.exam-main-title { flex: 1 1 40%; min-width: 0; font-size: min(var(--ex-title-size, 56px), 2.9vw); margin: 0; color: var(--ex-title); letter-spacing: 1px; text-align: center; white-space: nowrap; }
.exam-attendance { flex: 0 1 60%; min-width: 0; display: flex; align-items: center; justify-content: flex-start; gap: 6px; overflow-x: auto; white-space: nowrap; scrollbar-width: thin; font-size: clamp(11px, 0.75vw, 15px); line-height: 1.3; }
.exam-attendance span { flex: none; padding: 4px 5px; border-radius: 5px; background: var(--ex-panel-bg); }
.exam-attendance strong { color: var(--ex-title); }
.exam-attendance .attendance-leave { background: #fef3c7; color: #78350f; font-weight: bold; }
.exam-attendance .attendance-leave strong { color: inherit; }
.exam-attendance .attendance-absent { background: #fee2e2; color: #991b1b; font-weight: bold; }
.exam-attendance .attendance-absent strong { color: inherit; }
.exam-split-layout { display: flex; gap: 60px; flex: 1; align-items: flex-start; justify-content: center; }
.exam-left-panel { flex: 1; max-width: 900px; }
.exam-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 1.8rem; background: var(--ex-panel-bg); border-radius: 16px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.2);}
.exam-table th, .exam-table td { padding: 22px; text-align: center; border-bottom: 1px solid var(--ex-border); }
.exam-table th { background: var(--ex-border); color: var(--ex-left-header-color, var(--ex-title)); font-weight: normal; font-size: var(--ex-left-header-size, 22px); }
.exam-table tr:last-child td { border-bottom: none; }
.active-row { background: rgba(255,255,255,0.1); border-left: 5px solid var(--ex-accent);}
.active-row td { font-weight: bold; border-bottom-color: transparent;}
.exam-cell-period { font-size: var(--ex-left-period-size, 29px); color: var(--ex-left-period-color, var(--ex-text)); }
.exam-cell-subject { font-size: var(--ex-left-subject-size, 29px); color: var(--ex-left-subject-color, var(--ex-text)); }
.exam-cell-time { font-size: var(--ex-left-time-size, 29px); color: var(--ex-left-time-color, var(--ex-text)); }
.active-row .exam-cell-period { color: var(--ex-left-period-active-color, var(--ex-accent)); }
.active-row .exam-cell-subject { color: var(--ex-left-subject-active-color, var(--ex-accent)); }
.active-row .exam-cell-time { color: var(--ex-left-time-active-color, var(--ex-accent)); }
.font-mono { font-family: monospace; }
.font-bold { font-weight: bold; letter-spacing: 1px; }

.exam-right-panel { flex: 1; max-width: 800px; background: var(--ex-panel-bg); border-radius: 20px; padding: 36px; text-align: center; border: 1px solid var(--ex-border); box-shadow: 0 10px 30px rgba(0,0,0,0.3); display: flex; flex-direction: column; justify-content: flex-start; align-items: center;}

/* 💡 前台提醒事項 CSS */
.exam-notes-display { margin-top: 30px; background: rgba(255,255,255,0.05); border: 2px dashed var(--ex-border); border-radius: 12px; padding: 20px; text-align: left; width: 100%; box-sizing: border-box;}
.notes-title { font-size: calc(var(--ex-notes-size, 24px) + 5px); margin: 0 0 15px 0; color: var(--ex-danger); border-bottom: 1px dashed var(--ex-border); padding-bottom: 10px;}
.notes-list-preview { margin: 0; padding-left: 30px; font-size: var(--ex-notes-size, 24px); line-height: 1.6; color: var(--ex-text); }
.notes-list-preview li { margin-bottom: 8px; }

@media (max-width: 1024px) {
  .exam-header { flex-direction: column; align-items: stretch; }
  .exam-attendance { flex: none; width: 100%; font-size: 13px; }
  .exam-split-layout { flex-direction: column; align-items: center; }
  .exam-left-panel, .exam-right-panel { width: 100%; max-width: 100%; }
  .exam-main-title { font-size: min(var(--ex-title-size, 56px), 48px); }
}
@media (max-width: 768px) {
  .exam-dashboard { padding: 28px 20px 20px; }
  .exam-main-title { font-size: min(var(--ex-title-size, 56px), 32px); }
  .exam-table { font-size: 1.2rem; }
  .exam-table th, .exam-table td { padding: 12px; }
  .exam-table th { font-size: min(var(--ex-left-header-size, 22px), 5vw); }
  .exam-cell-period { font-size: min(var(--ex-left-period-size, 29px), 5vw); }
  .exam-cell-subject { font-size: min(var(--ex-left-subject-size, 29px), 5vw); }
  .exam-cell-time { font-size: min(var(--ex-left-time-size, 29px), 5vw); }
  .exam-right-panel { padding: 20px; }
}
</style>
