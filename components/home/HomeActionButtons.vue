<template>
  <div>
    <!-- 📅 課表狀態列 -->
    <div v-if="scheduleDisplay" class="schedule-ticker">
      <div class="current-class">
        <span class="pulse-dot" v-if="scheduleDisplay.current.status === '上課中'"></span>
        <strong>{{ scheduleDisplay.current.label }}：</strong>
        <span class="subject-text">{{ scheduleDisplay.current.subject }}</span>
        <span class="teacher-text" v-if="scheduleDisplay.current.teacher && (!scheduleButtonConfig.teacherOnlyInBrownlist || isIpBrownlisted)">
          ({{ scheduleDisplay.current.teacher }})
        </span>
      </div>
      <div class="next-class" v-if="scheduleDisplay.next">
        <strong>下節課：</strong>
        <span>{{ scheduleDisplay.next.subject }}</span>
      </div>
    </div>

    <!-- 🎓 考試模式按鈕 -->
    <button v-if="isIpBrownlisted && examData.isExamModeEnabled && examData.periods && examData.periods.length > 0" 
            @click="$emit('enterExam')" class="btn-enter-exam">
      🎓 切換至大考看板模式
    </button>

    <!-- 🎯 所有功能按鈕 -->
    <div class="button-group">
      <NuxtLink v-if="indexButtonSettings.parentBind" to="/parent-bind" class="btn btn-orange">👨‍👩‍👧 綁定</NuxtLink>
      <NuxtLink v-if="indexButtonSettings.parentMsg" to="/parent-message" class="btn btn-green">💬 家長私訊</NuxtLink>
      <NuxtLink v-if="indexButtonSettings.studentMsg" to="/student-message" class="btn btn-blue">💬 學生私訊</NuxtLink>
      <button type="button" class="btn btn-settings" @click="openSpecialMessage">設定</button>
      
      <NuxtLink v-if="indexButtonSettings.parentLeave" to="/leave-application" class="btn btn-teal-light">📝 家長代學生請假</NuxtLink>
      
      <button v-if="isScheduleButtonVisible && indexButtonSettings.schedule" @click="$emit('openLargeSchedule')" class="btn btn-lime">🗓️ 顯示班級大課表</button>

      <NuxtLink v-if="indexButtonSettings.assignments" to="/assignments" class="btn btn-purple">📚 作業管理</NuxtLink>
      <NuxtLink v-if="indexButtonSettings.discipline" to="/discipline" class="btn btn-dark-blue">⚖️ 秩序管理</NuxtLink>
      <NuxtLink v-if="indexButtonSettings.hygiene" to="/hygiene" class="btn btn-cyan">🧹 衛生管理</NuxtLink>            
      <NuxtLink v-if="indexButtonSettings.seats" to="/seats" class="btn btn-seat">🪑 座位管理</NuxtLink>
      <NuxtLink v-if="indexButtonSettings.manageSchedule" to="/schedule" class="btn btn-amber">⚙️ 課表管理</NuxtLink>

      <!-- 💡 修正：直接使用 NuxtLink 導向 pages/teacher-broadcast.vue -->
      <NuxtLink v-if="indexButtonSettings.broadcast" to="/teacher-broadcast" class="btn btn-violet">📢 教師廣播站</NuxtLink>

      <NuxtLink v-if="indexButtonSettings.exams" to="/exams" class="btn btn-rose">📝 大考管理</NuxtLink>
      <button v-if="indexButtonSettings.emergency" @click="$emit('openPwd', 'emergency')" class="btn btn-red">🚨 緊急通知</button>
      <NuxtLink v-if="indexButtonSettings.admin" to="/admin" class="btn btn-dark">⚙️ 後台</NuxtLink>
      
      <button v-if="isIpBrownlisted && seatingChart.isVisible && indexButtonSettings.showSeats"
              @click="$emit('update:showSeatingChartLocal', !showSeatingChartLocal)" class="btn btn-indigo">
        {{ showSeatingChartLocal ? '🙈 隱藏教室座位表' : '👀 顯示教室座位表' }}
      </button>
      <button v-if="isIpBrownlisted && indexButtonSettings.smallSeatMap && attendanceLayoutMode !== 'seating'"
              @click="$emit('update:showSmallSeatMap', !showSmallSeatMap)" class="btn btn-indigo"
              :aria-expanded="showSmallSeatMap" aria-controls="homepage-small-seat-map">
        {{ showSmallSeatMap ? '🙈 隱藏小座位表' : '👀 顯示小座位表' }}
      </button>
      
      <button v-if="isIpBrownlisted && hygieneData.isVisibleOnIndex && indexButtonSettings.showHygiene"
              @click="$emit('update:showHygieneLocal', !showHygieneLocal)" class="btn btn-sky">
        {{ showHygieneLocal ? '🙈 隱藏衛生工作' : '🧹 顯示衛生工作' }}
      </button>
      
      <NuxtLink v-if="isHistoryVisibleOnIndex && indexButtonSettings.contactHistory" to="/history" class="btn btn-pink">📅 查詢近期聯絡簿</NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { advanceSpecialMessageGate } from '../../app/utils/specialMessageGate.js'

const specialGate = ref({ count: 0, lastTap: 0 })
const openSpecialMessage = async () => {
  specialGate.value = advanceSpecialMessageGate(specialGate.value)
  if (specialGate.value.unlocked) {
    sessionStorage.setItem('special_message_entry', String(Date.now()))
    await navigateTo('/special-message')
  }
}

const props = defineProps({
  scheduleDisplay: Object,
  scheduleButtonConfig: Object,
  isIpBrownlisted: Boolean,
  examData: Object,
  indexButtonSettings: { type: Object, default: () => ({}) },
  isScheduleButtonVisible: Boolean,
  seatingChart: Object,
  showSeatingChartLocal: Boolean,
  showSmallSeatMap: Boolean,
  attendanceLayoutMode: { type: String, default: 'number' },
  hygieneData: Object,
  showHygieneLocal: Boolean,
  isHistoryVisibleOnIndex: Boolean
})

// 💡 修正：移除多餘的 openBroadcast 事件
defineEmits(['enterExam', 'openLargeSchedule', 'openPwd', 'update:showSeatingChartLocal', 'update:showSmallSeatMap', 'update:showHygieneLocal'])
</script>

<style scoped>
.schedule-ticker { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 10px 15px; margin-bottom: 20px; display: flex; justify-content: center; gap: 20px; align-items: center; flex-wrap: wrap; }
.subject-text { font-weight: bold; color: #047857;}
.teacher-text { font-size: 0.95rem; color: #475569; }
.next-class { color: #64748b; font-size: 1rem; border-left: 2px solid #cbd5e1; padding-left: 20px; }
.pulse-dot { width: 10px; height: 10px; background: #3b82f6; border-radius: 50%; display: inline-block; animation: pulse 1.5s infinite; margin-right: 5px;}
@keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); } }

.button-group { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
.btn { padding: 8px 12px; border-radius: 6px; font-size: 0.95rem; font-weight: bold; color: white !important; border: none; cursor: pointer; display: inline-block; text-decoration: none !important; transition: filter 0.2s;}
.btn:hover { filter: brightness(0.9); }

.btn-orange { background: #f59e0b; }
.btn-green { background: #10b981; }
.btn-blue { background: #3b82f6; }
.btn-settings { background: #64748b; }
.btn-teal-light { background: #14b8a6; }
.btn-lime { background: #84cc16; color: #14532d; border: 1px solid #65a30d;}
.btn-dark { background: #64748b; }
.btn-purple { background: #8b5cf6; }
.btn-violet { background: #8b5cf6; } 
.btn-red { background: #ef4444; }
.btn-dark-blue { background: #1e3a8a; } 
.btn-seat { background: #0f766e; } 
.btn-cyan { background: #06b6d4; }
.btn-indigo { background: #6366f1; } 
.btn-sky { background: #0ea5e9; }
.btn-pink { background: #ec4899; } 
.btn-amber { background: #d97706; }
.btn-rose { background: #be123c; }

.btn-enter-exam { width: 100%; padding: 12px; background: #991b1b; color: white; border: none; border-radius: 6px; font-size: 1.1rem; font-weight: bold; cursor: pointer; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(153, 27, 27, 0.3); animation: subtle-pulse 2s infinite;}

@media (max-width: 768px) {
  .schedule-ticker { flex-direction: column; gap: 10px; text-align: center; }
  .next-class { border-left: none; padding-left: 0; border-top: 1px dashed #cbd5e1; padding-top: 10px; width: 100%;}
}
</style>
