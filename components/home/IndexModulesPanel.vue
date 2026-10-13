<template>
  <div class="index-modules-panel">
    <!-- 💡 根據後台設定與動態洗牌邏輯，依序渲染模組 -->
    <template v-for="mod in displayModules" :key="mod.id">
      
      <div v-if="mod.id === 'wikiImage' && mod.isVisible" class="wiki-image-section">
        <template v-if="isIpBrownlisted">
          <div v-if="showSmallSeatMap" id="homepage-small-seat-map" class="small-seat-map" :style="examStatusPalette">
            <ExamSeatMap :seating-chart="seatingChart" :status-by-seat="seatStatusByNumber" compact />
          </div>
        </template>
        <WikiDailyImage />
      </div>
      
      <WikiOnThisDay v-if="mod.id === 'wikiOtd' && mod.isVisible" />
      
      <HomeYouTubeVideo 
        v-if="mod.id === 'youtube' && mod.isVisible"
        :videoUrl="todayVideoUrl" 
        :isMuted="youtubeIsMuted"
        :isClassTime="isClassTime"
        :isScheduledBlackout="isVideoBlackout"
      />

      <HomeFoxNews v-if="mod.id === 'foxNews' && mod.isVisible" />
      
      <!-- 💡 加入 CNN 與 ABC -->
      <HomeCnnNews v-if="mod.id === 'cnnNews' && mod.isVisible" />
      
      <HomeAbcNews v-if="mod.id === 'abcNews' && mod.isVisible" />
      
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// 💡 集中管理引入，保持 index.vue 乾淨
import WikiDailyImage from '~~/components/home/WikiDailyImage.vue'
import WikiOnThisDay from '~~/components/home/WikiOnThisDay.vue'
import HomeYouTubeVideo from '~~/components/home/HomeYouTubeVideo.vue'
import HomeFoxNews from '~~/components/home/HomeFoxNews.vue'
import HomeCnnNews from '~~/components/home/HomeCnnNews.vue'
import HomeAbcNews from '~~/components/home/HomeAbcNews.vue'
import ExamSeatMap from '~~/components/home/ExamSeatMap.vue'
import { examSeatStatusByNumber, examStatusPalette } from '../../app/utils/examAttendance.js'

const props = defineProps({
  indexModulesConfig: { type: Array, default: () => [] },
  indexDynamicSorting: { type: Boolean, default: false },
  isClassTime: { type: Boolean, default: false },
  todayVideoUrl: { type: String, default: '' },
  youtubeIsMuted: { type: Boolean, default: true },
  isVideoBlackout: { type: Boolean, default: false },
  isIpBrownlisted: { type: Boolean, default: false },
  showSmallSeatMap: { type: Boolean, default: false },
  seatingChart: { type: Object, default: () => ({ seats: [], isRotated: false }) },
  allStudents: { type: Array, default: () => [] },
  todayAttendances: { type: Array, default: () => [] }
})

const seatStatusByNumber = computed(() => examSeatStatusByNumber(props.allStudents, props.todayAttendances))

// 💡 動態重組模組順序
const displayModules = computed(() => {
  let mods = [...props.indexModulesConfig]
  
  if (props.indexDynamicSorting) {
    const ytIndex = mods.findIndex(m => m.id === 'youtube')
    if (ytIndex !== -1) {
      const ytMod = mods.splice(ytIndex, 1)[0]
      if (props.isClassTime) {
        mods.push(ytMod)    // 上課：塞到最下面
      } else {
        mods.unshift(ytMod) // 下課：提到最上面
      }
    }
  }
  return mods
})
</script>

<style scoped>
.index-modules-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
}
.wiki-image-section { width: 100%; }
.small-seat-map { --ex-border: #cbd5e1; --ex-bg: #f8fafc; --ex-text: #334155; --ex-seat-number-size: 18px; margin-top: 20px; padding: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; box-sizing: border-box; }
</style>
