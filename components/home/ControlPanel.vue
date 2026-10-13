<template>
  <div class="control-card">
    
    <BroadcastWidget :isIpBrownlisted="isIpBrownlisted" />
    <MarqueeWidget :marqueeData="marqueeSettings" />

    <div v-show="!isSmallSeatMapVisible" class="top-status-bar">
      <div class="clock-date-group">
        <div class="date-display" :style="{ fontSize: (clockConfig?.dateSize || 18) + 'px' }">
          {{ currentDateStr }}
        </div>
        
        <!-- 💡 隱密時鐘點擊區：外面包一層 relative，點擊觸發隱形密碼框 -->
        <div class="clock-wrapper" @click="focusStealthInput">
          <ClockWidget 
            :clockConfig="clockConfig"
            :clockFontSize="clockFontSize"
            :currentTime="currentTime"
            :unreadMsgCount="unreadMsgCount"
          />
          <!-- 💡 隱藏的密碼輸入框 -->
          <input 
            type="password" 
            ref="stealthAdminInput" 
            class="stealth-input" 
            v-model="adminBypassAttempt" 
            @keyup.enter="handleAdminBypass"
          />
        </div>
      </div>
      <WeatherWidget />
    </div>
    <div v-if="isSmallSeatMapVisible" id="homepage-small-seat-map" class="small-seat-cover" :style="examStatusPalette">
      <ExamSeatMap :seating-chart="seatingChart" :status-by-seat="seatStatusByNumber" compact />
    </div>

    <!-- 💡 加入 mobile-hide -->
    <div v-if="isButtonsCollapsed" class="floating-btn-container btn-pos mobile-hide" @click="isButtonsCollapsed = false" title="展開功能選單">
      <div class="floating-btn">
        <span class="icon">⚙️</span>
        <span class="text">功<br>能<br>鍵</span>
      </div>
    </div>

    <!-- 💡 移除 v-show，改用 class -->
    <div class="action-buttons-wrapper relative-wrap" :class="{ 'desktop-collapsed': isButtonsCollapsed }">
      
      <!-- 💡 加入 mobile-hide -->
      <button v-if="!isClassTime" @click="isButtonsCollapsed = true" class="btn-collapse-float mobile-hide">
        收起功能 ➔
      </button>

      <HomeActionButtons 
        :scheduleDisplay="scheduleDisplay"
        :scheduleButtonConfig="scheduleButtonConfig"
        :isIpBrownlisted="isIpBrownlisted"
        :examData="examData"
        :indexButtonSettings="indexButtonSettings"
        :isScheduleButtonVisible="isScheduleButtonVisible"
        :seatingChart="seatingChart"
        :showSeatingChartLocal="showSeatingChartLocal"
        :showSmallSeatMap="showSmallSeatMap"
        :hygieneData="hygieneData"
        :showHygieneLocal="showHygieneLocal"
        :isHistoryVisibleOnIndex="isHistoryVisibleOnIndex"
        @enterExam="$emit('enterExam')"
        @openLargeSchedule="$emit('openLargeSchedule')"
        @openPwd="(val) => $emit('openPwd', val)"
        @update:showSeatingChartLocal="(val) => $emit('update:showSeatingChartLocal', val)"
        @update:showSmallSeatMap="(val) => $emit('update:showSmallSeatMap', val)"
        @update:showHygieneLocal="(val) => $emit('update:showHygieneLocal', val)"
      />
    </div>

  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import BroadcastWidget from './BroadcastWidget.vue'
import MarqueeWidget from './MarqueeWidget.vue'
import ClockWidget from './ClockWidget.vue'
import HomeActionButtons from './HomeActionButtons.vue'
import WeatherWidget from './WeatherWidget.vue'
import ExamSeatMap from './ExamSeatMap.vue'
import { examSeatStatusByNumber, examStatusPalette } from '../../app/utils/examAttendance.js'
// 💡 匯入 Nuxt 內建的路由跳轉功能
import { navigateTo } from '#app' 

const props = defineProps({
  marqueeSettings: { type: Object, default: () => ({}) },
  clockConfig: { type: Object, default: () => ({}) },
  clockFontSize: Number,
  currentTime: String,
  unreadMsgCount: Number,
  scheduleDisplay: Object,
  scheduleButtonConfig: Object,
  isIpBrownlisted: Boolean,
  examData: Object,
  indexButtonSettings: { type: Object, default: () => ({}) },
  isScheduleButtonVisible: Boolean,
  seatingChart: Object,
  showSeatingChartLocal: Boolean,
  showSmallSeatMap: Boolean,
  allStudents: { type: Array, default: () => [] },
  todayAttendances: { type: Array, default: () => [] },
  hygieneData: Object,
  showHygieneLocal: Boolean,
  isHistoryVisibleOnIndex: Boolean,
  isClassTime: { type: Boolean, default: false }
})

defineEmits(['enterExam', 'openLargeSchedule', 'openPwd', 'update:showSeatingChartLocal', 'update:showSmallSeatMap', 'update:showHygieneLocal'])

const isButtonsCollapsed = ref(false)
const isSmallSeatMapVisible = computed(() => props.isIpBrownlisted && props.indexButtonSettings.smallSeatMap && props.showSmallSeatMap)
const seatStatusByNumber = computed(() => examSeatStatusByNumber(props.allStudents, props.todayAttendances))

// 💡 特務級後台解鎖邏輯
const stealthAdminInput = ref(null)
const adminBypassAttempt = ref('')

const focusStealthInput = () => {
  if (stealthAdminInput.value) {
    stealthAdminInput.value.focus()
  }
}

const handleAdminBypass = () => {
  // 自動生成今日動態密碼
  const d = new Date()
  const yy = String(d.getFullYear()).slice(2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const expectedDynamic = `${yy}${mm}${dd}59`

  // 驗證通過
  if (adminBypassAttempt.value === expectedDynamic || adminBypassAttempt.value === '168168168') {
    // 將登入狀態寫入 sessionStorage，讓 admin.vue 不要再擋人
    sessionStorage.setItem('main_admin_logged_in', 'true')
    // 直接瞬移到後台
    navigateTo('/admin')
  }
  
  // 保持無痕：不論成敗都清空
  adminBypassAttempt.value = ''
}

watch(() => props.isClassTime, (newIsClassTime) => {
  isButtonsCollapsed.value = !newIsClassTime
}, { immediate: true })

const currentDateStr = ref('')
let dateTimer = null

const updateDate = () => {
  const d = new Date()
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  currentDateStr.value = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${days[d.getDay()]}`
}

onMounted(() => {
  updateDate()
  dateTimer = setInterval(updateDate, 60000) 
})

onUnmounted(() => {
  if (dateTimer) clearInterval(dateTimer)
})
</script>

<style scoped>
.control-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; text-align: center; }
.top-status-bar { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 15px; margin-bottom: 25px; }
.small-seat-cover { --ex-border: #cbd5e1; --ex-bg: #f8fafc; --ex-text: #334155; --ex-seat-number-size: 18px; width: 100%; margin-bottom: 25px; padding: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; box-sizing: border-box; }

.clock-date-group { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.date-display { font-weight: 900; color: #475569; letter-spacing: 2px; }

/* 💡 讓時鐘區塊變成可點擊，但外觀看不出來 */
.clock-wrapper {
  position: relative;
  cursor: default; /* 不顯示可點擊的游標，保持隱密 */
}

/* 💡 隱形的盲打輸入框 */
.stealth-input {
  position: absolute;
  left: -9999px;
  top: 0;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.relative-wrap {
  position: relative;
  transition: all 0.3s ease;
  width: 100%;
}

/* 💡 RWD：螢幕寬度超過 850px (電腦、大平板) 才執行收合 */
@media (min-width: 851px) {
  .desktop-collapsed { display: none !important; }
}

/* 💡 RWD：螢幕寬度小於 850px (手機、小平板) 隱藏所有手動收起按鈕與懸浮列 */
@media (max-width: 850px) {
  .mobile-hide { display: none !important; }
}

.btn-collapse-float {
  position: absolute;
  top: -25px; 
  right: 0;
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

.floating-btn-container {
  position: fixed;
  left: 0;
  z-index: 100;
  cursor: pointer;
}
.btn-pos { top: 50%; transform: translateY(-50%); } 

.floating-btn {
  background-color: #f59e0b; 
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
  border: 1px solid #d97706;
  border-left: none;
}
.floating-btn:hover { background-color: #d97706; padding-left: 18px; }

@media (min-width: 768px) { .top-status-bar { flex-direction: row; flex-wrap: wrap; } }
</style>
