<template>
  <div class="exam-seats-display" :class="{ compact }">
    <div class="exam-seats-heading">
      <strong>目前座位表（僅顯示座號）</strong>
      <button type="button" @click="flipSeats = !flipSeats">轉180度</button>
    </div>
    <div v-if="seatingChart.seats?.length" class="exam-seats-layout" :class="{ 'is-flipped': Boolean(seatingChart.isRotated) !== flipSeats }">
      <div class="exam-seat-grid">
        <div v-for="(seat, index) in seatingChart.seats" :key="seat.id ?? index"
          class="exam-seat" :class="[seatStatusClass(seat), { 'is-hidden': seat.isHidden }]">
          <span v-if="!seat.isHidden">{{ seat.seatNum }}</span>
        </div>
      </div>
      <div class="exam-teacher-desk">講桌</div>
    </div>
    <p v-else>尚未儲存座位表。</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  seatingChart: { type: Object, default: () => ({ seats: [], isRotated: false }) },
  statusBySeat: { type: Object, default: () => ({}) },
  compact: { type: Boolean, default: false }
})
const flipSeats = ref(false)
const seatStatusClass = seat => {
  const number = String(seat.seatNum ?? '').match(/\d+/)?.[0]
  const status = number === undefined ? null : props.statusBySeat[String(Number(number))]
  return status ? `is-${status}` : ''
}
</script>

<style scoped>
.exam-seats-display { width: 100%; margin-top: 10px; padding: 14px; box-sizing: border-box; border: 2px dashed var(--ex-border); border-radius: 12px; }
.exam-seats-display.compact { max-width: 560px; margin: 0 auto; padding: 10px; }
.exam-seats-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; font-size: calc(var(--ex-seat-number-size, 20px) * 0.8); }
.exam-seats-heading button { border: 1px solid var(--ex-border); border-radius: 6px; background: var(--ex-bg); color: var(--ex-text); padding: 5px 9px; cursor: pointer; white-space: nowrap; font-size: 0.85rem; }
.exam-seats-layout { width: 100%; transition: transform 0.25s ease; }
.exam-seats-layout.is-flipped { transform: rotate(180deg); }
.exam-seat-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 5px; }
.exam-seat { min-height: 42px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--ex-border); border-radius: 5px; font-size: var(--ex-seat-number-size, 20px); font-weight: bold; background: var(--ex-bg); overflow-wrap: anywhere; }
.compact .exam-seat { min-height: 32px; }
.exam-seat.is-hidden { visibility: hidden; }
.exam-seat.is-present { background: var(--ex-status-present-bg); border-color: var(--ex-status-present-border); color: var(--ex-status-present-text); }
.exam-seat.is-leave { background: var(--ex-status-leave-bg); border: 2px solid var(--ex-status-leave-border); color: var(--ex-status-leave-text); font-weight: 900; }
.exam-seat.is-late-leave { background: var(--ex-status-late-leave-bg); border: 2px solid var(--ex-status-late-leave-border); color: var(--ex-status-late-leave-text); font-weight: 900; }
.exam-seat.is-early-leave { background: var(--ex-status-early-leave-bg); border: 2px solid var(--ex-status-early-leave-border); color: var(--ex-status-early-leave-text); font-weight: 900; }
.exam-seat.is-late { background: var(--ex-status-late-bg); border-color: var(--ex-status-late-border); color: var(--ex-status-late-text); }
.exam-seat.is-absent { background: var(--ex-status-absent-bg); border: 2px solid var(--ex-status-absent-border); color: var(--ex-status-absent-text); font-weight: 900; }
.exam-teacher-desk { width: 34%; margin: 10px auto 0; padding: 5px; border: 2px solid var(--ex-border); border-radius: 6px; font-size: var(--ex-seat-number-size, 20px); font-weight: bold; }
.exam-seats-layout.is-flipped .exam-seat, .exam-seats-layout.is-flipped .exam-teacher-desk { transform: rotate(180deg); }
</style>
