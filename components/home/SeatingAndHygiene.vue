<template>
  <div class="extra-modules">
    <!-- 座位表顯示區 -->
    <div v-if="seatingChart.isVisible && showSeatingChartLocal && indexButtonSettings.showSeats" class="seating-display-board">
      <h3 class="seating-title">🪑 班級座位表</h3>
      <div class="seating-wrapper">
        <div :class="['seating-area', { 'is-rotated': seatingChart.isRotated }]">
          <div class="labels-grid-readonly">
            <div v-for="n in 6" :key="'readonly-label-'+n" class="row-label-readonly">第{{ n }}排</div>
          </div>
          <div class="seats-grid-readonly">
            <div v-for="seat in seatingChart.seats" :key="seat.id" :class="['seat-card-readonly', { 'is-hidden-seat-readonly': seat.isHidden }]">
              <div class="seat-id-readonly">{{ seat.id }}</div>
              <div class="seat-text-container">
                <div :style="{ fontSize: (seatingChart.settings?.numberSize || 16) + 'px', color: seatingChart.settings?.numberColor || '#64748b' }">{{ seat.seatNum }}</div>
                <div :style="{ fontSize: (seatingChart.settings?.nameSize || 20) + 'px', color: seatingChart.settings?.nameColor || '#e11d48' }">{{ privacyFilter(seat.name) }}</div>
                <div v-if="seat.other" :style="{ fontSize: (seatingChart.settings?.otherSize || 14) + 'px', color: seatingChart.settings?.otherColor || '#94a3b8' }">{{ privacyFilter(seat.other) }}</div>
              </div>
            </div>
          </div>
          <div class="teacher-desk-readonly"><h3>講桌</h3></div>
        </div>
      </div>
    </div>

    <!-- 班級衛生工作顯示區 -->
    <div v-if="hygieneData.isVisibleOnIndex && showHygieneLocal && indexButtonSettings.showHygiene" class="hygiene-display-board">
      <h3 class="hygiene-main-title">🧹 班級衛生工作管理</h3>
      <div class="tabs-container-readonly">
        <button class="tab-btn" :class="{ active: activeHygieneTab === 'morning' }" @click="activeHygieneTab = 'morning'">🌅 早上掃地</button>
        <button class="tab-btn" :class="{ active: activeHygieneTab === 'lunch' }" @click="activeHygieneTab = 'lunch'">🍱 中午搬餐</button>
        <button class="tab-btn" :class="{ active: activeHygieneTab === 'squad' }" @click="activeHygieneTab = 'squad'">🛡️ 小隊工作</button>
      </div>
      
      <div class="hygiene-wrapper">
        <!-- 早上掃地 -->
        <div v-show="activeHygieneTab === 'morning'" class="hygiene-content">
          <h3 class="hygiene-content-title" v-html="formatNL(hygieneData.morning.title)"></h3>
          <table class="custom-table morning-table">
            <thead><tr><th colspan="2" width="20%">教室</th><th width="30%">座號</th><th width="50%">工作內容</th></tr></thead>
            <tbody>
              <tr><td colspan="2" v-html="formatNL(hygieneData.morning.in_hygiene)"></td><td v-html="formatNL(hygieneData.morning.in_hygiene_names)"></td><td v-html="formatNL(hygieneData.morning.in_hygiene_work)"></td></tr>
              <tr><td colspan="2" v-html="formatNL(hygieneData.morning.board)"></td><td v-html="formatNL(hygieneData.morning.board_names)"></td><td v-html="formatNL(hygieneData.morning.board_work)"></td></tr>
              <tr><td colspan="2" v-html="formatNL(hygieneData.morning.sweep)"></td><td v-html="formatNL(hygieneData.morning.sweep_names)"></td><td rowspan="2" v-html="formatNL(hygieneData.morning.sweep_mop_work)"></td></tr>
              <tr><td colspan="2" v-html="formatNL(hygieneData.morning.mop)"></td><td v-html="formatNL(hygieneData.morning.mop_names)"></td></tr>
              <tr><td colspan="2" v-html="formatNL(hygieneData.morning.window)"></td><td v-html="formatNL(hygieneData.morning.window_names)"></td><td v-html="formatNL(hygieneData.morning.window_work)"></td></tr>
              <tr><td colspan="2" v-html="formatNL(hygieneData.morning.hallway)"></td><td v-html="formatNL(hygieneData.morning.hallway_names)"></td><td v-html="formatNL(hygieneData.morning.hallway_work)"></td></tr>
              <tr><td colspan="2" v-html="formatNL(hygieneData.morning.trash)"></td><td v-html="formatNL(hygieneData.morning.trash_names)"></td><td v-html="formatNL(hygieneData.morning.trash_work)"></td></tr>
              
              <tr class="header-row"><th>外掃區</th><th>打掃區域</th><th>座號</th><th>工作內容</th></tr>
              
              <!-- 💡 判斷：如果是舊版資料 (尚未設定動態陣列)，維持舊的死板 4 列 -->
              <template v-if="!hygieneData.morning.out_dynamic_areas || hygieneData.morning.out_dynamic_areas.length === 0">
                <tr><td rowspan="4" v-html="formatNL(hygieneData.morning.out_area)"></td><td v-html="formatNL(hygieneData.morning.out_hygiene)"></td><td v-html="formatNL(hygieneData.morning.out_hygiene_names)"></td><td v-html="formatNL(hygieneData.morning.out_hygiene_work)"></td></tr>
                <tr><td rowspan="3" v-html="formatNL(hygieneData.morning.out_sweep1)"></td><td v-html="formatNL(hygieneData.morning.out_sweep1_names)"></td><td rowspan="3" v-html="formatNL(hygieneData.morning.out_sweep_work)"></td></tr>
                <tr><td v-html="formatNL(hygieneData.morning.out_sweep2_names)"></td></tr>
                <tr><td v-html="formatNL(hygieneData.morning.out_sweep3_names)"></td></tr>
              </template>
              
              <!-- 💡 判斷：如果是新版資料 (後台已新增動態陣列)，則跑無限迴圈 -->
              <template v-else>
                <tr v-for="(item, idx) in hygieneData.morning.out_dynamic_areas" :key="'out-'+idx">
                  <!-- 第一列需要跨越所有的列來顯示大標題 -->
                  <td v-if="idx === 0" :rowspan="hygieneData.morning.out_dynamic_areas.length" v-html="formatNL(hygieneData.morning.out_area)"></td>
                  
                  <td v-html="formatNL(item.area)"></td>
                  <td v-html="formatNL(item.names)"></td>
                  <td v-html="formatNL(item.work)"></td>
                </tr>
              </template>

            </tbody>
          </table>
          <div class="footer-note" v-html="formatNL(hygieneData.morning.note)"></div>
        </div>

        <!-- 中午搬餐 -->
        <div v-show="activeHygieneTab === 'lunch'" class="hygiene-content">
          <h3 class="hygiene-content-title" v-html="formatNL(hygieneData.lunch.title)"></h3>
          <div class="hygiene-sub-title" v-html="formatNL(hygieneData.lunch.sub)"></div>
          <table class="custom-table lunch-table">
            <tbody>
              <tr>
                <th rowspan="2" width="10%" v-html="formatNL(hygieneData.lunch.clean_header)"></th>
                <th width="15%" v-html="formatNL(hygieneData.lunch.clean_h1)"></th><th width="15%" v-html="formatNL(hygieneData.lunch.clean_h2)"></th>
                <th width="15%" v-html="formatNL(hygieneData.lunch.clean_h3)"></th><th width="15%" v-html="formatNL(hygieneData.lunch.clean_h4)"></th>
                <th width="15%" v-html="formatNL(hygieneData.lunch.clean_h5)"></th><th width="15%" v-html="formatNL(hygieneData.lunch.clean_h6)"></th>
              </tr>
              <tr>
                <td v-html="formatNL(hygieneData.lunch.clean_n1)"></td><td v-html="formatNL(hygieneData.lunch.clean_n2)"></td><td v-html="formatNL(hygieneData.lunch.clean_n3)"></td>
                <td v-html="formatNL(hygieneData.lunch.clean_n4)"></td><td v-html="formatNL(hygieneData.lunch.clean_n5)"></td><td v-html="formatNL(hygieneData.lunch.clean_n6)"></td>
              </tr>
              <tr>
                <th rowspan="2" v-html="formatNL(hygieneData.lunch.move_header)"></th>
                <th v-html="formatNL(hygieneData.lunch.move_h1)"></th><th v-html="formatNL(hygieneData.lunch.move_h2)"></th><th v-html="formatNL(hygieneData.lunch.move_h3)"></th>
                <th v-html="formatNL(hygieneData.lunch.move_h4)"></th><th v-html="formatNL(hygieneData.lunch.move_h5)"></th><th v-html="formatNL(hygieneData.lunch.move_h6)"></th>
              </tr>
              <tr>
                <td v-html="formatNL(hygieneData.lunch.move_n1)"></td><td v-html="formatNL(hygieneData.lunch.move_n2)"></td><td v-html="formatNL(hygieneData.lunch.move_n3)"></td>
                <td v-html="formatNL(hygieneData.lunch.move_n4)"></td><td v-html="formatNL(hygieneData.lunch.move_n5)"></td><td v-html="formatNL(hygieneData.lunch.move_n6)"></td>
              </tr>
              <tr>
                <th rowspan="2" v-html="formatNL(hygieneData.lunch.serve_header)"></th>
                <th v-html="formatNL(hygieneData.lunch.serve_h1)"></th><th v-html="formatNL(hygieneData.lunch.serve_h2)"></th><th v-html="formatNL(hygieneData.lunch.serve_h3)"></th>
                <th v-html="formatNL(hygieneData.lunch.serve_h4)"></th><th v-html="formatNL(hygieneData.lunch.serve_h5)"></th><th v-html="formatNL(hygieneData.lunch.serve_h6)"></th>
              </tr>
              <tr>
                <td v-html="formatNL(hygieneData.lunch.serve_n1)"></td><td v-html="formatNL(hygieneData.lunch.serve_n2)"></td><td v-html="formatNL(hygieneData.lunch.serve_n3)"></td>
                <td v-html="formatNL(hygieneData.lunch.serve_n4)"></td><td v-html="formatNL(hygieneData.lunch.serve_n5)"></td><td v-html="formatNL(hygieneData.lunch.serve_n6)"></td>
              </tr>
            </tbody>
          </table>
          <div class="footer-note mt-15 text-sm" v-html="formatNL(hygieneData.lunch.note1)"></div>
          <div class="footer-note mt-10 text-sm" v-html="formatNL(hygieneData.lunch.note2)"></div>
        </div>

        <!-- 小隊工作 -->
        <div v-show="activeHygieneTab === 'squad'" class="hygiene-content">
          <h3 class="hygiene-content-title" v-html="formatNL(hygieneData.squad.title)"></h3>
          <table class="custom-table squad-table">
            <thead>
              <tr><th width="15%">小隊職務</th><th width="20%">細項</th><th width="20%">座號</th><th width="45%">工作內容</th></tr>
            </thead>
            <tbody>
              <tr v-for="n in 6" :key="'ld-'+n">
                <td v-if="n===1" rowspan="6">小隊長</td><td>小隊長 {{n}}</td>
                <td v-html="formatNL(hygieneData.squad.leaders[n-1])"></td>
                <td v-if="n===1" rowspan="6" v-html="formatNL(hygieneData.squad.leader_desc)"></td>
              </tr>
              <tr v-for="n in 6" :key="'dy-'+n">
                <td v-if="n===1" rowspan="6">值日生<br><span class="text-xs">(每天第 7 節下課到辦公室簽到)</span></td><td>值日生 {{n}}</td>
                <td v-html="formatNL(hygieneData.squad.duties[n-1])"></td><td v-html="formatNL(hygieneData.squad.duty_desc[n-1])"></td>
              </tr>
              <tr v-for="n in 5" :key="'hp-'+n">
                <td v-if="n===1" rowspan="5">小幫手<br><span class="text-xs">(每天第 1 節下課到辦公室簽到)</span></td><td>小幫手 {{n}}</td>
                <td v-html="formatNL(hygieneData.squad.helpers[n-1])"></td><td v-html="formatNL(hygieneData.squad.helper_desc[n-1])"></td>
              </tr>
              <tr v-for="n in 4" :key="'er-'+n">
                <td v-if="n===1" rowspan="4">公差<br><span class="text-xs">(每天第 2 節下課到辦公室簽到...)</span></td><td>公差 {{n}}</td>
                <td v-html="formatNL(hygieneData.squad.errands[n-1])"></td><td v-html="formatNL(hygieneData.squad.errand_desc[n-1])"></td>
              </tr>

            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const props = defineProps({
  seatingChart: Object,
  showSeatingChartLocal: Boolean,
  indexButtonSettings: Object,
  hygieneData: Object,
  showHygieneLocal: Boolean,
  privacyFilter: Function,
  formatNL: Function
})

const activeHygieneTab = ref('morning')
</script>

<style scoped>
.extra-modules { width: 100%; }
.seating-display-board { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; margin-top: 10px; }
.seating-title { margin-top: 0; color: #0f766e; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 25px; text-align: center; font-size: 1.4rem; }
.seating-wrapper { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 15px; }
.seating-area { width: 100%; min-width: 900px; margin: 0 auto; transition: transform 0.5s ease; }
.seating-area.is-rotated { transform: rotate(180deg); }
.seating-area.is-rotated .seat-card-readonly, .seating-area.is-rotated .row-label-readonly, .seating-area.is-rotated .teacher-desk-readonly { transform: rotate(-180deg); }
.labels-grid-readonly { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 15px; }
.row-label-readonly { text-align: center; font-weight: bold; color: #0f766e; font-size: 1.1rem; transition: transform 0.5s ease; }
.seats-grid-readonly { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 35px; }
.seat-card-readonly { border: 2px solid #cbd5e1; border-radius: 8px; background: #f8fafc; padding: 10px; text-align: center; min-height: 110px; display: flex; flex-direction: column; transition: transform 0.5s ease; }
.seat-card-readonly.is-hidden-seat-readonly { opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }
.seat-id-readonly { font-size: 0.8rem; color: #94a3b8; text-align: left; margin-bottom: 5px; font-weight: bold; }
.seat-text-container { display: flex; flex-direction: column; gap: 4px; font-weight: bold; justify-content: center; flex: 1;}
.teacher-desk-readonly { border: 3px solid #0f766e; background: #f0fdfa; padding: 15px 20px; border-radius: 8px; text-align: center; width: 250px; margin: 0 auto; transition: transform 0.5s ease; }
.teacher-desk-readonly h3 { margin: 0; color: #0f766e; font-size: 1.2rem; }

.hygiene-display-board { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; margin-top: 10px; }
.hygiene-main-title { margin-top: 0; color: #0891b2; text-align: center; font-size: 1.4rem; margin-bottom: 15px; }
.tabs-container-readonly { display: flex; gap: 10px; overflow-x: auto; white-space: nowrap; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; justify-content: center;}
.tab-btn { padding: 8px 16px; border: none; background: #f1f5f9; color: #64748b; font-weight: bold; font-size: 1.05rem; cursor: pointer; border-radius: 6px; transition: 0.2s;}
.tab-btn:hover { background: #e2e8f0; }
.tab-btn.active { background: #0891b2; color: white; }

.hygiene-wrapper { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.hygiene-content { min-width: 800px; padding-bottom: 15px; }
.hygiene-content-title { text-align: center; margin-bottom: 10px; font-size: 1.3rem; color: #1e293b; }
.hygiene-sub-title { text-align: center; margin-bottom: 15px; color: #475569; font-size: 0.95rem; }

.custom-table { width: 100%; border-collapse: collapse; text-align: center; font-size: 0.95rem; background: white;}
.custom-table th, .custom-table td { border: 1px solid #94a3b8; padding: 8px; vertical-align: middle; line-height: 1.4; word-break: break-word;}
.custom-table th { background: #f1f5f9; font-weight: bold; }
.header-row th { background: #e2e8f0; }
.morning-table td:nth-child(1), .morning-table td:nth-child(2) { font-weight: bold; }
.lunch-table th { background: #f8fafc; font-weight: bold;}

.footer-note { margin-top: 15px; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; color: #334155; line-height: 1.6; text-align: left;}
.mt-10 { margin-top: 10px; }
.mt-15 { margin-top: 15px; }
.text-sm { font-size: 0.9rem; }
.text-xs { font-size: 0.75rem; color: #64748b; font-weight: normal;}

@media (max-width: 768px) {
  .seats-grid-readonly, .labels-grid-readonly { gap: 5px; }
  .seat-card-readonly { padding: 5px; min-height: 90px; }
  .tabs-container-readonly { justify-content: flex-start; padding-bottom: 10px; }
}
</style>
