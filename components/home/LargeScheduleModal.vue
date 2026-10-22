<template>
  <div class="large-schedule-overlay">
    <div class="large-header">
      <h1 class="large-title">📅 班級課表<span v-if="scheduleData?.semesterLabel"> · {{ scheduleData.semesterLabel }}</span></h1>
      
      <div class="large-controls">
        <label class="control-label">
          <input type="checkbox" v-model="showNonAcademicPeriods"> 顯示早/午休
        </label>
        <label class="control-label" v-if="!scheduleButtonConfig.teacherOnlyInBrownlist || isIpBrownlisted">
          <input type="checkbox" v-model="showTeacherNames"> 顯示老師
        </label>
        <label class="control-label">
          <input type="checkbox" v-model="isSplitLayout"> 左右雙欄顯示
        </label>
        <button class="btn-close-large" @click="emit('close')">✖ 關閉</button>
      </div>
    </div>

    <div class="large-schedule-content">
      <!-- 桌機/平板：雙欄模式 -->
      <div v-if="isSplitLayout" class="split-desktop-grid">
        <div class="schedule-half">
          <div class="desktop-grid" :class="{'dense-mode': morningPeriods.length > 5}">
            <div class="grid-header time-header">節次 / 時間</div>
            <div class="grid-header">星期一</div><div class="grid-header">星期二</div><div class="grid-header">星期三</div><div class="grid-header">星期四</div><div class="grid-header">星期五</div>
            <template v-for="(period, pIdx) in morningPeriods" :key="'lg-m-'+pIdx">
              <div class="grid-cell time-cell">
                <div class="p-name">{{ period.name }}</div>
                <div class="p-time">{{ period.startTime }} - {{ period.endTime }}</div>
              </div>
              <div v-for="day in 5" :key="'lgc-m-'+day" class="grid-cell subject-cell" :class="{'empty-cell': !period.days[day-1].subject}">
                <div class="cell-subject">{{ privacyFilter(period.days[day-1].subject) || '-' }}</div>
                <div class="cell-teacher" v-if="showTeacherNames && (!scheduleButtonConfig.teacherOnlyInBrownlist || isIpBrownlisted) && period.days[day-1].teacher">
                  {{ privacyFilter(period.days[day-1].teacher) }}
                </div>
              </div>
            </template>
          </div>
        </div>
        <div class="schedule-half">
          <div class="desktop-grid" :class="{'dense-mode': afternoonPeriods.length > 5}">
            <div class="grid-header time-header">節次 / 時間</div>
            <div class="grid-header">星期一</div><div class="grid-header">星期二</div><div class="grid-header">星期三</div><div class="grid-header">星期四</div><div class="grid-header">星期五</div>
            <template v-for="(period, pIdx) in afternoonPeriods" :key="'lg-a-'+pIdx">
              <div class="grid-cell time-cell">
                <div class="p-name">{{ period.name }}</div>
                <div class="p-time">{{ period.startTime }} - {{ period.endTime }}</div>
              </div>
              <div v-for="day in 5" :key="'lgc-a-'+day" class="grid-cell subject-cell" :class="{'empty-cell': !period.days[day-1].subject}">
                <div class="cell-subject">{{ privacyFilter(period.days[day-1].subject) || '-' }}</div>
                <div class="cell-teacher" v-if="showTeacherNames && (!scheduleButtonConfig.teacherOnlyInBrownlist || isIpBrownlisted) && period.days[day-1].teacher">
                  {{ privacyFilter(period.days[day-1].teacher) }}
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- 桌機/平板：單欄模式 -->
      <div v-else class="desktop-grid" :class="{'dense-mode': displayPeriods.length > 8}">
        <div class="grid-header time-header">節次 / 時間</div>
        <div class="grid-header">星期一</div>
        <div class="grid-header">星期二</div>
        <div class="grid-header">星期三</div>
        <div class="grid-header">星期四</div>
        <div class="grid-header">星期五</div>
        
        <template v-for="(period, pIdx) in displayPeriods" :key="'lg-'+pIdx">
          <div class="grid-cell time-cell">
            <div class="p-name">{{ period.name }}</div>
            <div class="p-time">{{ period.startTime }} - {{ period.endTime }}</div>
          </div>
          <div v-for="day in 5" :key="'lgc-'+day" class="grid-cell subject-cell" :class="{'empty-cell': !period.days[day-1].subject}">
            <div class="cell-subject">{{ privacyFilter(period.days[day-1].subject) || '-' }}</div>
            <div class="cell-teacher" v-if="showTeacherNames && (!scheduleButtonConfig.teacherOnlyInBrownlist || isIpBrownlisted) && period.days[day-1].teacher">
              {{ privacyFilter(period.days[day-1].teacher) }}
            </div>
          </div>
        </template>
      </div>

      <!-- 手機：單日卡片清單 -->
      <div class="mobile-view">
        <div class="mobile-day-selector">
           <button v-for="d in 5" :key="'btn-'+d" 
                   :class="{active: mobileDay === d}" 
                   @click="mobileDay = d">星期{{ ['一','二','三','四','五'][d-1] }}</button>
        </div>
        <div class="mobile-list">
          <div v-for="(period, pIdx) in displayPeriods" :key="'ml-'+pIdx" class="mobile-card">
            <div class="m-time-box">
              <span class="m-name">{{ period.name }}</span>
              <span class="m-time">{{ period.startTime }} - {{ period.endTime }}</span>
            </div>
            <div class="m-subject-box" :class="{'m-empty': !period.days[mobileDay-1].subject}">
               <div class="m-subject">{{ privacyFilter(period.days[mobileDay-1].subject) || '無課程' }}</div>
               <div class="m-teacher" v-if="showTeacherNames && (!scheduleButtonConfig.teacherOnlyInBrownlist || isIpBrownlisted) && period.days[mobileDay-1].teacher">
                 {{ privacyFilter(period.days[mobileDay-1].teacher) }}
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  scheduleData: Object,
  scheduleButtonConfig: Object,
  isIpBrownlisted: Boolean,
  privacyFilter: Function
})

const emit = defineEmits(['close'])

const showNonAcademicPeriods = ref(false) 
const showTeacherNames = ref(true)        
const isSplitLayout = ref(false)
const mobileDay = ref(new Date().getDay() >= 1 && new Date().getDay() <= 5 ? new Date().getDay() : 1)

const nonAcademicKeywords = ['早修', '早掃', '午餐', '午休']
const displayPeriods = computed(() => {
  if (!props.scheduleData?.periods) return []
  return props.scheduleData.periods.filter(p => {
    if (showNonAcademicPeriods.value) return true
    return !nonAcademicKeywords.some(kw => p.name.includes(kw))
  })
})

const morningPeriods = computed(() => {
  const mid = Math.ceil(displayPeriods.value.length / 2)
  return displayPeriods.value.slice(0, mid)
})

const afternoonPeriods = computed(() => {
  const mid = Math.ceil(displayPeriods.value.length / 2)
  return displayPeriods.value.slice(mid)
})
</script>

<style scoped>
.large-schedule-overlay { 
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
  background: #f8fafc; z-index: 9999; display: flex; flex-direction: column;
}
.large-header { 
  padding: 10px 20px; background: #1e293b; color: white; 
  display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); flex-wrap: wrap; gap: 10px;
}
.large-title { margin: 0; font-size: 1.6rem; letter-spacing: 2px;}

.large-controls { display: flex; align-items: center; gap: 15px; flex-wrap: wrap; background: rgba(255,255,255,0.1); padding: 6px 12px; border-radius: 8px; }
.control-label { display: flex; align-items: center; gap: 6px; font-size: 1rem; color: #f8fafc; cursor: pointer; font-weight: bold; }
.control-label input { transform: scale(1.2); cursor: pointer; }

.btn-close-large { background: #ef4444; color: white; border: none; padding: 6px 15px; border-radius: 6px; font-size: 1rem; font-weight: bold; cursor: pointer; margin-left: 10px; }

.large-schedule-content { 
  padding: 10px 15px; flex: 1; width: 100%; box-sizing: border-box;
  display: flex; flex-direction: column; overflow: hidden;
}

.desktop-grid { 
  flex: 1;
  display: grid; 
  grid-template-columns: 140px repeat(5, 1fr); 
  grid-template-rows: auto; 
  grid-auto-rows: minmax(0, 1fr); 
  gap: 8px; 
  min-height: 0; 
}

.grid-header { background: #e2e8f0; color: #0f172a; font-size: 1.2rem; font-weight: bold; padding: 8px; text-align: center; border-radius: 6px; display: flex; align-items: center; justify-content: center;}
.time-header { background: #94a3b8; color: white; }

.split-desktop-grid { display: flex; gap: 15px; height: 100%; width: 100%; }
.schedule-half { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.split-desktop-grid .desktop-grid { min-height: 0; grid-template-columns: 120px repeat(5, 1fr); gap: 6px;}
.split-desktop-grid .cell-subject { font-size: 1.5rem; }
.split-desktop-grid .cell-teacher { font-size: 1.05rem; }
.split-desktop-grid .p-name { font-size: 1.1rem; }
.split-desktop-grid .p-time { font-size: 0.85rem; }
.split-desktop-grid .grid-header { font-size: 1.05rem; padding: 6px; }

.grid-cell { background: white; border: 2px solid #cbd5e1; border-radius: 6px; padding: 5px 10px; text-align: center; display: flex; flex-direction: column; justify-content: center; min-height: 0;}
.time-cell { background: #f1f5f9; border-color: #94a3b8; }
.p-name { font-size: 1.2rem; font-weight: bold; color: #334155; margin-bottom: 2px;}
.p-time { font-size: 0.95rem; color: #64748b; font-family: monospace; font-weight: bold;}

.subject-cell { box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
.empty-cell { background: #f8fafc; border-style: dashed; opacity: 0.6; }
.cell-subject { font-size: 1.8rem; font-weight: bold; color: #0f766e; margin-bottom: 2px; }
.cell-teacher { font-size: 1.1rem; color: #0369a1; font-weight: bold;}

.dense-mode { gap: 6px; }
.dense-mode .grid-cell { padding: 4px; border-width: 1px;}
.dense-mode .cell-subject { font-size: 1.5rem; margin-bottom: 2px; }
.dense-mode .cell-teacher { font-size: 1rem; }
.dense-mode .p-name { font-size: 1.1rem; }
.dense-mode .p-time { font-size: 0.85rem; }
.dense-mode .grid-header { font-size: 1.1rem; padding: 6px; }

.mobile-view { display: none; }

@media (max-width: 900px) {
  .large-schedule-content { overflow-y: auto; display: block; }
  .desktop-grid, .split-desktop-grid { display: none; }
  .mobile-view { display: block; }
  
  .mobile-day-selector { display: flex; overflow-x: auto; gap: 10px; padding-bottom: 15px; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0;}
  .mobile-day-selector button { flex: 1; min-width: 80px; padding: 12px; background: white; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 1.1rem; font-weight: bold; color: #475569;}
  .mobile-day-selector button.active { background: #3b82f6; color: white; border-color: #2563eb; }

  .mobile-list { display: flex; flex-direction: column; gap: 12px; padding-bottom: 30px;}
  .mobile-card { display: flex; background: white; border: 2px solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05);}
  .m-time-box { background: #f1f5f9; width: 120px; padding: 15px 10px; display: flex; flex-direction: column; justify-content: center; align-items: center; border-right: 2px solid #cbd5e1;}
  .m-name { font-size: 1.2rem; font-weight: bold; color: #334155; margin-bottom: 5px;}
  .m-time { font-size: 0.95rem; color: #64748b; font-weight: bold;}
  
  .m-subject-box { flex: 1; padding: 15px; display: flex; flex-direction: column; justify-content: center; align-items: center;}
  .m-empty { background: #f8fafc; opacity: 0.6; }
  .m-subject { font-size: 1.8rem; font-weight: bold; color: #0f766e; text-align: center;}
  .m-teacher { font-size: 1.1rem; color: #0369a1; font-weight: bold; margin-top: 5px;}
}
</style>
