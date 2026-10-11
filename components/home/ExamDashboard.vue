<template>
  <div class="exam-dashboard" :style="currentThemeStyles">
    <button @click="$emit('exit')" class="exit-exam-btn">✖ 結束大考模式</button>
    
    <h1 class="exam-main-title">{{ examData.title }}</h1>
    
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
        <div class="clock-label">目前時間</div>
        <div class="exam-clock">{{ currentTime }}</div>

        <div class="exam-status-display">
          <div v-if="examStatus.state === 'WAITING'" class="status-text waiting">⏳ 準備中...</div>
          <div v-else-if="examStatus.state === 'FINISHED'" class="status-text finished">🎉 今日全數結束</div>
          
          <div v-else-if="examStatus.state === 'TESTING'" class="status-text testing">
            <div class="status-label">✏️ 目前進行</div>
            <div class="status-subject">{{ examStatus.current.subject }}</div>
            
            <div v-if="examStatus.current.isExam" class="countdown-wrapper">
              <div class="countdown-label">距離本節結束還有</div>
              <div class="exam-countdown" :class="{ 'text-danger': countdownMinutes < 5 }">
                {{ countdownText }}
              </div>
            </div>
            <div v-else class="study-mode-text">📖 溫書自習中</div>
          </div>
          
          <div v-else-if="examStatus.state === 'BREAK'" class="status-text break">
            <div class="status-label">☕ 休息時間</div>
            <div class="status-next" v-if="examStatus.next">
              下一節：<span class="highlight">{{ examStatus.next.subject }}</span> 
              <br>
              <span class="next-time">({{ examStatus.next.startTime }} 開始)</span>
            </div>
          </div>
        </div>

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
defineProps({
  examData: { type: Object, required: true },
  examStatus: { type: Object, required: true },
  currentTime: { type: String, required: true },
  countdownMinutes: { type: Number, required: true },
  countdownText: { type: String, required: true },
  currentThemeStyles: { type: Object, required: true }
})

defineEmits(['exit'])
</script>

<style scoped>
.exam-dashboard { background-color: var(--ex-bg); color: var(--ex-text); min-height: 100vh; padding: 40px 60px; display: flex; flex-direction: column; position: relative; align-items: stretch; transition: background-color 0.5s ease;}
.exit-exam-btn { position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: var(--ex-text); padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 1.1rem; transition: 0.2s; z-index: 10;}
.exit-exam-btn:hover { background: rgba(255,255,255,0.2); color: var(--ex-title); }
.exam-main-title { font-size: 3.5rem; margin: 0 0 40px 0; color: var(--ex-title); letter-spacing: 2px; text-align: center; border-bottom: 2px solid var(--ex-border); padding-bottom: 20px;}
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

.exam-right-panel { flex: 1; max-width: 800px; background: var(--ex-panel-bg); border-radius: 20px; padding: 50px; text-align: center; border: 1px solid var(--ex-border); box-shadow: 0 10px 30px rgba(0,0,0,0.3); display: flex; flex-direction: column; justify-content: flex-start; align-items: center;}
.clock-label { font-size: 1.5rem; color: var(--ex-text); margin-bottom: 10px; opacity: 0.8;}
.exam-clock { font-size: var(--ex-clock-size, 120px); font-weight: bold; font-family: monospace; color: var(--ex-clock); margin-bottom: 40px; line-height: 1; text-shadow: 0 0 15px rgba(0,0,0,0.3);}
.exam-status-display { width: 100%; border-top: 1px solid var(--ex-border); padding-top: 40px;}
.status-text { font-size: 2.5rem; font-weight: bold; }
.status-text.waiting { color: var(--ex-text); opacity: 0.7;}
.status-text.finished { color: var(--ex-success); }
.status-label { font-size: 1.5rem; color: var(--ex-text); margin-bottom: 10px; opacity: 0.8;}
.status-subject { font-size: var(--ex-subject-size, 88px); color: var(--ex-accent); letter-spacing: 5px; line-height: 1.2; margin: 10px 0 40px 0; text-shadow: 0 0 15px rgba(0,0,0,0.3); overflow-wrap: anywhere;}
.countdown-wrapper { background: rgba(0,0,0,0.2); padding: 30px; border-radius: 16px; border: 1px solid var(--ex-border);}
.countdown-label { font-size: 1.5rem; color: var(--ex-text); margin-bottom: 10px; }
.exam-countdown { font-size: var(--ex-countdown-size, 104px); color: var(--ex-success); font-family: monospace; line-height: 1; text-shadow: 0 0 15px rgba(0,0,0,0.3);}
.text-danger { color: var(--ex-danger) !important; animation: blink 1s infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
.study-mode-text { font-size: 4rem; color: var(--ex-success); letter-spacing: 2px; margin-top: 20px; padding: 30px; border: 2px dashed var(--ex-success); border-radius: 16px; background: rgba(255,255,255, 0.05);}
.status-text.break .status-next { margin-top: 20px; font-size: 2rem; color: var(--ex-text); }
.status-text.break .highlight { color: var(--ex-success); font-size: var(--ex-next-subject-size, 57px); margin: 15px 0; display: block; overflow-wrap: anywhere;}
.next-time { font-size: var(--ex-next-time-size, 30px); color: var(--ex-text); font-family: monospace; opacity: 0.8;}

/* 💡 前台提醒事項 CSS */
.exam-notes-display { margin-top: 30px; background: rgba(255,255,255,0.05); border: 2px dashed var(--ex-border); border-radius: 12px; padding: 20px; text-align: left; width: 100%; box-sizing: border-box;}
.notes-title { font-size: calc(var(--ex-notes-size, 24px) + 5px); margin: 0 0 15px 0; color: var(--ex-danger); border-bottom: 1px dashed var(--ex-border); padding-bottom: 10px;}
.notes-list-preview { margin: 0; padding-left: 30px; font-size: var(--ex-notes-size, 24px); line-height: 1.6; color: var(--ex-text); }
.notes-list-preview li { margin-bottom: 8px; }

@media (max-width: 1024px) {
  .exam-split-layout { flex-direction: column; align-items: center; }
  .exam-left-panel, .exam-right-panel { width: 100%; max-width: 100%; }
  .exam-main-title { font-size: 2.5rem; }
}
@media (max-width: 768px) {
  .exam-dashboard { padding: 20px; }
  .exam-main-title { font-size: 2rem; }
  .exam-table { font-size: 1.2rem; }
  .exam-table th, .exam-table td { padding: 12px; }
  .exam-table th { font-size: min(var(--ex-left-header-size, 22px), 5vw); }
  .exam-cell-period { font-size: min(var(--ex-left-period-size, 29px), 5vw); }
  .exam-cell-subject { font-size: min(var(--ex-left-subject-size, 29px), 5vw); }
  .exam-cell-time { font-size: min(var(--ex-left-time-size, 29px), 5vw); }
  .exam-clock { font-size: min(var(--ex-clock-size, 120px), 15vw); }
  .status-subject { font-size: min(var(--ex-subject-size, 88px), 12vw); }
  .exam-countdown { font-size: min(var(--ex-countdown-size, 104px), 14vw); }
}
</style>
