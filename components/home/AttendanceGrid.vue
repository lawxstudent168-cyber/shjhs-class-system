<template>
  <!-- 下課時縮小為左側懸浮按鈕 -->
  <div v-if="isCollapsed" class="floating-btn-container" @click="isCollapsed = false" title="展開點名板">
    <div class="floating-btn">
      <span class="icon">📋</span>
      <span class="text">點<br>名<br>板</span>
    </div>
  </div>

  <!-- 展開時的完整點名板 (加入 relative-wrap) -->
  <div v-show="!isCollapsed" class="attendance-wrapper relative-wrap">
    
    <div class="attendance-floating-actions">
      <button
        type="button"
        class="btn-lock-float"
        :class="{ 'is-unlocked': isUnlocked }"
        :title="isUnlocked ? '點名板已解鎖，確認完成後鎖上' : '點名板已鎖定，輸入導師密碼解鎖'"
        :aria-label="isUnlocked ? '鎖上點名板' : '解鎖點名板'"
        @click="$emit(isUnlocked ? 'lock-attendance' : 'unlock-attendance')"
      >
        {{ isUnlocked ? '🔓 鎖上' : '🔒 解鎖' }}
      </button>
      <button v-if="!isClassTime" type="button" @click="isCollapsed = true" class="btn-collapse-float">
        收起點名板 ➔
      </button>
    </div>

    <!-- 📊 頂部統計數據列 -->
    <div class="stats-row">
      <div class="stat-box stat-expected">
        應到: <strong>{{ expectedCount }}</strong>
      </div>
      <div class="stat-box stat-absent">未到: <strong>{{ absentCount }}</strong></div>
      <div class="stat-box stat-present">已到: <strong>{{ presentCount }}</strong></div>
      <div class="stat-box stat-late">遲到: <strong>{{ lateCount }}</strong></div>
      <div class="stat-box stat-leave">全天請假: <strong>{{ leaveCount }}</strong></div>
      <div class="stat-box stat-late-leave">晚到請假: <strong>{{ lateLeaveCount }}</strong></div>
      <div class="stat-box stat-early-leave">早退請假: <strong>{{ earlyLeaveCount }}</strong></div>
      <div class="stat-box stat-public-leave">部份公假: <strong>{{ partialPublicLeaveCount }}</strong></div>
      <div class="stat-box stat-public-leave">全天公假: <strong>{{ fullPublicLeaveCount }}</strong></div>
    </div>

    <div class="attendance-tabs" role="tablist" aria-label="點名板排列方式">
      <button type="button" role="tab" :aria-selected="layoutMode === 'number'" :class="{ active: layoutMode === 'number' }" @click="$emit('update:layoutMode', 'number')">按照座號排列</button>
      <button type="button" role="tab" :aria-selected="layoutMode === 'seating'" :class="{ active: layoutMode === 'seating' }" @click="$emit('update:layoutMode', 'seating')">按目前座位排列</button>
    </div>

    <!-- 👨‍🎓 原本的座號排列 -->
    <div v-if="layoutMode === 'number'" class="grid-container" role="tabpanel">
      <button 
        v-for="student in allStudents" 
        :key="student.id"
        class="student-card"
        :class="getStatusClass(student.id)"
        @click="$emit('toggle-attendance', student)"
      >
        <div class="st-num">{{ student.seat_number }}</div>
        <div class="st-name">{{ privacyFilter(student.real_name || student.hidden_name) }}</div>
        <div class="st-status">{{ getStatusText(student.id) }}</div>
      </button>
    </div>

    <!-- 座位模式沿用首頁目前生效的座位表，空位仍保留其位置。 -->
    <div v-else role="tabpanel" class="seating-view">
      <div class="seating-toolbar">
        <span>目前座位表</span>
        <button type="button" @click="flipSeats = !flipSeats">轉180度</button>
      </div>
      <div v-if="seatingLayout.slots.length" class="seating-scroll">
        <div class="seating-layout" :class="{ 'is-rotated': Boolean(seatingChart.isRotated) !== flipSeats }">
          <div class="seating-grid">
            <div v-for="slot in seatingLayout.slots" :key="slot.key" class="seat-slot" :class="{ 'is-hidden-slot': slot.isHidden }">
              <button v-if="slot.student" type="button" class="student-card" :class="getStatusClass(slot.student.id)" @click="$emit('toggle-attendance', slot.student)">
                <div class="st-num">{{ slot.student.seat_number }}</div>
                <div class="st-name">{{ privacyFilter(slot.student.real_name || slot.student.hidden_name) }}</div>
                <div class="st-status">{{ getStatusText(slot.student.id) }}</div>
              </button>
            </div>
          </div>
          <div class="teacher-desk">講桌</div>
        </div>
      </div>
      <p v-else class="seating-hint">目前尚未儲存座位表；所有學生列在下方，仍可點名。</p>
      <div v-if="seatingLayout.unplaced.length" class="unplaced-section">
        <div class="unplaced-title">未排入目前座位表</div>
        <div class="grid-container">
          <button v-for="student in seatingLayout.unplaced" :key="student.id" type="button" class="student-card" :class="getStatusClass(student.id)" @click="$emit('toggle-attendance', student)">
            <div class="st-num">{{ student.seat_number }}</div>
            <div class="st-name">{{ privacyFilter(student.real_name || student.hidden_name) }}</div>
            <div class="st-status">{{ getStatusText(student.id) }}</div>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { displayAttendanceStatus } from '../../app/utils/attendanceStatus.js'
import { attendanceSeatingLayout } from '../../app/utils/attendanceSeating.js'

const props = defineProps({
  allStudents: { type: Array, default: () => [] },
  todayAttendances: { type: Array, default: () => [] },
  seatingChart: { type: Object, default: () => ({ seats: [], isRotated: false }) },
  isUnlocked: { type: Boolean, default: false },
  layoutMode: { type: String, default: 'number' },
  expectedCount: { type: Number, default: 0 },
  presentCount: { type: Number, default: 0 },
  leaveCount: { type: Number, default: 0 },
  lateLeaveCount: { type: Number, default: 0 },
  earlyLeaveCount: { type: Number, default: 0 },
  lateCount: { type: Number, default: 0 },
  fullPublicLeaveCount: { type: Number, default: 0 },
  partialPublicLeaveCount: { type: Number, default: 0 },
  absentCount: { type: Number, default: 0 },
  privacyFilter: { type: Function, default: (val) => val },
  isClassTime: { type: Boolean, default: false }
})

defineEmits(['toggle-attendance', 'update:layoutMode', 'lock-attendance', 'unlock-attendance'])

const seatingLayout = computed(() => attendanceSeatingLayout(props.allStudents, props.seatingChart))
const flipSeats = ref(false)

const isCollapsed = ref(false)

watch(() => props.isClassTime, (newIsClassTime) => {
  isCollapsed.value = !newIsClassTime
}, { immediate: true })

const getStatusText = (studentId) => {
  const record = props.todayAttendances.find(a => a.student_id === studentId)
  return displayAttendanceStatus(record?.status)
}

const getStatusClass = (studentId) => {
  const status = getStatusText(studentId)
  if ((status.startsWith('部份公假') || status === '全天公假')) return 'is-public-leave'
  if (status === '已到') return 'is-present'
  if (status === '全天請假' || status === '請假') return 'is-leave'
  if (status.startsWith('晚到請假')) return 'is-late-leave'
  if (status.startsWith('早退請假')) return 'is-early-leave'
  if (status.startsWith('遲到')) return 'is-late'
  return 'is-absent' 
}
</script>

<style scoped>
.attendance-floating-actions { position: absolute; bottom: calc(100% + 4px); right: 0; display: flex; align-items: center; gap: 6px; z-index: 10; }
.btn-lock-float { padding: 4px 10px; min-height: 30px; border: 1px solid #94a3b8; border-radius: 16px; background: #f8fafc; color: #334155; font: inherit; font-size: 0.85rem; font-weight: bold; white-space: nowrap; cursor: pointer; box-shadow: 0 2px 5px #0f172a14; }
.btn-lock-float.is-unlocked { background: #f0fdfa; color: #115e59; border-color: #5eead4; }
.btn-lock-float:hover { filter: brightness(0.95); }
.attendance-floating-actions button:focus-visible { outline: 3px solid #2563eb; outline-offset: 2px; }
.attendance-wrapper { background: transparent; width: 100%; transition: all 0.3s ease; }

/* 💡 讓點名板相對定位，以便裡面的迷你按鈕絕對定位 */
.relative-wrap {
  position: relative;
}

/* 收起與鎖定共用右上角懸浮區，避免互相遮擋。 */
.btn-collapse-float {
  background-color: transparent;
  color: #64748b;
  border: 1px dashed #cbd5e1;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 0.85rem;
  font-weight: bold;
  cursor: pointer;
  transition: 0.2s;
  z-index: 10;
}
.btn-collapse-float:hover {
  background-color: #e2e8f0;
  color: #334155;
  border-color: #94a3b8;
}

/* 左側懸浮按鈕樣式 */
.floating-btn-container {
  position: fixed;
  left: 0;
  top: 70%;
  transform: translateY(-50%);
  z-index: 100;
  cursor: pointer;
}

.floating-btn {
  background-color: #3b82f6; 
  color: white;
  padding: 15px 8px 15px 12px;
  border-radius: 0 12px 12px 0;
  box-shadow: 2px 4px 10px rgba(0,0,0,0.25);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-weight: bold;
  font-size: 1.1rem;
  line-height: 1.2;
  transition: background-color 0.2s, padding-left 0.2s, transform 0.2s;
  border: 1px solid #2563eb;
  border-left: none;
}

.floating-btn:hover {
  background-color: #2563eb;
  padding-left: 18px; 
}

/* --- 📊 統計列樣式 --- */
.stats-row { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; justify-content: center; }
.attendance-tabs { display: flex; gap: 6px; margin-bottom: 14px; border-bottom: 2px solid #cbd5e1; }
.attendance-tabs button { flex: 1; padding: 9px 5px; border: 0; border-radius: 8px 8px 0 0; background: #f1f5f9; color: #475569; font: inherit; font-weight: 700; cursor: pointer; }
.attendance-tabs button.active { background: #dbeafe; color: #1d4ed8; box-shadow: inset 0 -3px #2563eb; }
.attendance-tabs button:focus-visible { outline: 3px solid #2563eb; outline-offset: 2px; }
.stat-box { flex: 1; text-align: center; padding: 10px; border-radius: 8px; font-size: 1rem; border: 1px solid transparent; min-width: 90px; }
.stat-box strong { font-size: 1.15rem; margin-left: 2px; }

.stat-expected { background-color: #f8fafc; border-color: #e2e8f0; color: #334155; }
.stat-present { background-color: #dcfce7; border-color: #bbf7d0; color: #166534; }
.stat-leave { background-color: #fef9c3; border-color: #fde047; color: #a16207; }
.stat-late-leave { background-color: #ffedd5; border-color: #fdba74; color: #c2410c; }
.stat-early-leave { background-color: #f3e8ff; border-color: #d8b4fe; color: #6b21a8; }
.stat-late { background-color: #dbeafe; border-color: #bfdbfe; color: #1d4ed8; }
.stat-absent { background-color: #fee2e2; border-color: #fca5a5; color: #991b1b; }

/* --- 👨‍🎓 學生網格樣式 --- */
.grid-container { display: grid; grid-template-columns: repeat(6, 1fr); gap: 15px; }
.seating-scroll { width: 100%; overflow-x: auto; padding-bottom: 4px; }
.seating-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; color: #334155; font-weight: 700; }
.seating-toolbar button { padding: 5px 9px; border: 1px solid #94a3b8; border-radius: 6px; background: #f8fafc; color: #334155; font: inherit; font-size: 0.85rem; cursor: pointer; }
.seating-layout { min-width: 540px; transition: transform 0.2s ease; }
.seating-layout.is-rotated { transform: rotate(180deg); }
.seating-layout.is-rotated .student-card, .seating-layout.is-rotated .teacher-desk { transform: rotate(180deg); }
.seating-layout.is-rotated .student-card:hover { transform: rotate(180deg) translateY(2px); }
.seating-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
.seat-slot { min-height: 84px; border: 1px dashed #cbd5e1; border-radius: 8px; }
.seat-slot.is-hidden-slot { visibility: hidden; }
.seat-slot .student-card { width: 100%; min-height: 84px; height: 100%; padding: 5px 2px; box-sizing: border-box; }
.seat-slot .st-num { font-size: 0.95rem; margin-bottom: 2px; }
.seat-slot .st-name { font-size: 0.95rem; margin-bottom: 3px; letter-spacing: 0; overflow-wrap: anywhere; }
.seat-slot .st-status { font-size: 0.77rem; }
.teacher-desk { width: 34%; margin: 10px auto 0; padding: 4px; text-align: center; border: 2px solid #94a3b8; border-radius: 6px; font-weight: 700; box-sizing: border-box; }
.seating-hint { margin: 0 0 12px; color: #475569; }
.unplaced-section { margin-top: 18px; }
.unplaced-title { margin-bottom: 9px; font-weight: 700; color: #475569; }

.student-card { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 5px; border-radius: 10px; cursor: pointer; border: 1px solid transparent; transition: all 0.2s ease; font-family: inherit; }
.student-card:hover { filter: brightness(0.95); transform: translateY(-2px); box-shadow: 0 4px 6px rgba(0,0,0,0.05); }

.st-num { font-size: 1.1rem; font-weight: bold; margin-bottom: 5px; }
.st-name { font-size: 1.2rem; font-weight: 900; margin-bottom: 8px; letter-spacing: 1px; }
.st-status { font-size: 0.9rem; font-weight: bold; white-space: pre-wrap; line-height: 1.3;}

.stat-public-leave, .is-public-leave { background-color: #ccfbf1; border-color: #5eead4; color: #115e59; }

.is-absent { background-color: #fee2e2; border-color: #fca5a5; color: #991b1b; } 
.is-present { background-color: #dcfce7; border-color: #86efac; color: #14532d; } 
.is-leave { background-color: #fef9c3; border-color: #fde047; color: #713f12; }  
.is-late-leave { background-color: #ffedd5; border-color: #fdba74; color: #c2410c; } 
.is-early-leave { background-color: #f3e8ff; border-color: #d8b4fe; color: #6b21a8; } 
.is-late { background-color: #dbeafe; border-color: #93c5fd; color: #1e3a8a; }    

@media (max-width: 1024px) { .grid-container { grid-template-columns: repeat(5, 1fr); } }
@media (max-width: 768px) {
  .grid-container { grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .stats-row { gap: 8px; }
}
@media (max-width: 480px) {
  .grid-container { grid-template-columns: repeat(3, 1fr); }
  .st-name { font-size: 1.1rem; }
}
</style>
