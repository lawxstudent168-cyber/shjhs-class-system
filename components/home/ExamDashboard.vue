<template>
  <div class="exam-dashboard" :class="{ 'is-preview': preview, 'is-focused': isFocusedExam }" :style="[currentThemeStyles, examStatusPalette]">
    <button v-if="!preview" @click="$emit('exit')" class="exit-exam-btn" title="結束大考模式">✖ 結束</button>
    
    <div class="exam-header">
      <h1 class="exam-main-title">{{ examData.title }}</h1>
      <section class="exam-attendance" aria-label="今日出缺席統計">
        <span class="attendance-expected">應到 <strong>{{ attendanceSummary.expected }}</strong></span>
        <span class="attendance-present">已到 <strong>{{ attendanceSummary.present }}</strong></span>
        <span class="attendance-leave">全天請假 <strong>{{ attendanceSummary.leave }}</strong></span>
        <span class="attendance-late-leave">晚到請假 <strong>{{ attendanceSummary.lateLeave }}</strong></span>
        <span class="attendance-early-leave">早退請假 <strong>{{ attendanceSummary.earlyLeave }}</strong></span>
        <span class="attendance-late">遲到 <strong>{{ attendanceSummary.late }}</strong></span>
        <span class="attendance-absent">未到 <strong>{{ attendanceSummary.absent }}</strong>（{{ attendanceSummary.absentSeats.join('、') || '無' }}）</span>
        <span class="attendance-leave">請假座號 {{ attendanceSummary.leaveSeats.join('、') || '無' }}</span>
      </section>
    </div>
    
    <div class="exam-split-layout">
      <div class="exam-left-panel">
        <div v-if="isFocusedExam" class="exam-focus-panel">
          <div class="exam-focus-item"><span>目前時間</span><strong class="focus-clock">{{ currentTime }}</strong></div>
          <div class="exam-focus-item"><span>考試科目</span><strong class="focus-subject">{{ examStatus.current.subject }}</strong></div>
          <div class="exam-focus-item"><span>剩餘時間</span><strong class="focus-countdown">{{ countdownText }}</strong></div>
        </div>
        <table v-else class="exam-table">
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
        <ExamLiveRow v-if="!isFocusedExam" :exam-status="examStatus" :current-time="currentTime"
          :countdown-minutes="countdownMinutes" :countdown-text="countdownText" />

        <div v-if="!isFocusedExam" class="exam-detail-tabs" role="tablist" aria-label="考試資訊">
          <button role="tab" :aria-selected="detailTab === 'notes'" :class="{ active: detailTab === 'notes' }" @click="detailTab = 'notes'">⚠️ 考前提醒</button>
          <button role="tab" :aria-selected="detailTab === 'seats'" :class="{ active: detailTab === 'seats' }" @click="detailTab = 'seats'">🪑 目前座位表</button>
        </div>
        <ExamSeatMap v-show="isFocusedExam || detailTab === 'seats'" :seating-chart="seatingChart"
          :status-by-seat="seatStatusByNumber" :compact="isFocusedExam" role="tabpanel" />
        <ExamNotes v-show="isFocusedExam || detailTab === 'notes'" :notes="examData.notes || []" role="tabpanel" />

      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import ExamLiveRow from './ExamLiveRow.vue'
import ExamSeatMap from './ExamSeatMap.vue'
import ExamNotes from './ExamNotes.vue'
import { examSeatStatusByNumber, examStatusPalette, summarizeExamAttendance } from '../../app/utils/examAttendance.js'
const props = defineProps({
  examData: { type: Object, required: true },
  examStatus: { type: Object, required: true },
  currentTime: { type: String, required: true },
  countdownMinutes: { type: Number, required: true },
  countdownText: { type: String, required: true },
  currentThemeStyles: { type: Object, required: true },
  allStudents: { type: Array, default: () => [] },
  todayAttendances: { type: Array, default: () => [] },
  seatingChart: { type: Object, default: () => ({ seats: [], isRotated: false }) },
  preview: { type: Boolean, default: false }
})

const attendanceSummary = computed(() => summarizeExamAttendance(props.allStudents, props.todayAttendances))
const seatStatusByNumber = computed(() => examSeatStatusByNumber(props.allStudents, props.todayAttendances))
const detailTab = ref('notes')
const isFocusedExam = computed(() => props.examStatus.state === 'TESTING' && props.examStatus.current?.isExam === true)
defineEmits(['exit'])
</script>

<style scoped>
.exam-dashboard { background-color: var(--ex-bg); color: var(--ex-text); min-height: 100vh; padding: 28px 30px 20px; display: flex; flex-direction: column; position: relative; align-items: stretch; transition: background-color 0.5s ease;}
.exit-exam-btn { position: fixed; top: 4px; right: 12px; background: var(--ex-panel-bg); border: 1px solid var(--ex-border); color: var(--ex-text); padding: 3px 8px; border-radius: 7px; cursor: pointer; font-size: 0.75rem; line-height: 1; opacity: 0.65; transition: opacity 0.2s; z-index: 50; }
.exit-exam-btn:hover, .exit-exam-btn:focus-visible { opacity: 1; }
.exam-header { display: flex; align-items: center; gap: 18px; min-width: 0; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid var(--ex-border); }
.exam-main-title { flex: 1 1 40%; min-width: 0; font-size: min(var(--ex-title-size, 56px), 2.9vw); margin: 0; color: var(--ex-title); letter-spacing: 1px; text-align: center; white-space: nowrap; }
.exam-attendance { flex: 0 1 60%; min-width: 0; display: flex; align-items: center; justify-content: flex-start; gap: 6px; overflow-x: auto; white-space: nowrap; scrollbar-width: thin; font-size: var(--ex-attendance-size, 14px); line-height: 1.3; }
.exam-attendance span { flex: none; padding: 4px 5px; border-radius: 5px; border: 1px solid transparent; }
.exam-attendance strong { color: inherit; }
.exam-attendance .attendance-expected { background: #e2e8f0; color: #334155; border-color: #94a3b8; }
.exam-attendance .attendance-present { background: var(--ex-status-present-bg); color: var(--ex-status-present-text); border-color: var(--ex-status-present-border); }
.exam-attendance .attendance-leave { background: var(--ex-status-leave-bg); color: var(--ex-status-leave-text); border-color: var(--ex-status-leave-border); font-weight: bold; }
.exam-attendance .attendance-late-leave { background: var(--ex-status-late-leave-bg); color: var(--ex-status-late-leave-text); border-color: var(--ex-status-late-leave-border); font-weight: bold; }
.exam-attendance .attendance-early-leave { background: var(--ex-status-early-leave-bg); color: var(--ex-status-early-leave-text); border-color: var(--ex-status-early-leave-border); font-weight: bold; }
.exam-attendance .attendance-late { background: var(--ex-status-late-bg); color: var(--ex-status-late-text); border-color: var(--ex-status-late-border); }
.exam-attendance .attendance-absent { background: var(--ex-status-absent-bg); color: var(--ex-status-absent-text); border-color: var(--ex-status-absent-border); font-weight: bold; }
.exam-split-layout { display: flex; gap: 60px; flex: 1; align-items: flex-start; justify-content: center; }
.exam-left-panel { flex: 1; max-width: 900px; }
.exam-focus-panel { min-height: 560px; background: var(--ex-panel-bg); border: 1px solid var(--ex-border); border-radius: 16px; padding: 30px; display: flex; flex-direction: column; justify-content: space-around; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
.exam-focus-item { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
.exam-focus-item span { color: var(--ex-accent); font-size: var(--ex-focus-label-size, 24px); }
.exam-focus-item strong { display: block; max-width: 100%; overflow-wrap: anywhere; line-height: 1.1; }
.focus-clock { color: var(--ex-clock); font-size: var(--ex-clock-size, 120px); font-family: monospace; }
.focus-subject { color: var(--ex-title); font-size: var(--ex-subject-size, 88px); }
.focus-countdown { color: var(--ex-danger); font-size: var(--ex-countdown-size, 104px); font-family: monospace; }
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
.is-focused .exam-right-panel { gap: 14px; padding: 18px; }
.is-focused .exam-focus-panel { min-height: 640px; }
.is-preview { min-height: 800px; }

.exam-detail-tabs { display: flex; gap: 8px; align-self: stretch; margin-top: 22px; }
.exam-detail-tabs button { flex: 1; border: 1px solid var(--ex-border); border-radius: 8px; padding: 9px; background: var(--ex-bg); color: var(--ex-text); font-size: 1rem; cursor: pointer; }
.exam-detail-tabs button.active { border-color: var(--ex-accent); color: var(--ex-title); font-weight: bold; box-shadow: inset 0 -3px var(--ex-accent); }

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
