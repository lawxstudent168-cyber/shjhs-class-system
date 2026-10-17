<template>
  <div ref="board" class="blackboard contact-board" data-track-feature="今日聯絡簿" :data-track-context="trackingDate ? '聯絡簿日期：' + trackingDate : ''">
    <div class="board-header">
      <div>
        <h2 class="board-title contact-title">⭐ 今日聯絡簿</h2>
        <p class="board-date">{{ todayDisplay }}</p>
      </div>
      <button v-if="!isEditingContact" @click="$emit('open-pwd')" class="edit-btn">✏️ 編輯</button>
    </div>
    
    <div class="dashed-divider"></div>
    
    <div class="board-content">
      <div v-if="!isEditingContact">
        <div v-if="contactBookItems.length === 0" class="empty-text-italic">目前尚無聯絡簿事項...</div>
        <ul v-else class="item-list contact-list">
          <li v-for="(item, index) in contactBookItems" :key="'c-'+index">{{ index + 1 }}. {{ privacyFilter(item) }}</li>
        </ul>
      </div>
      
      <div v-else class="edit-mode">
        <div v-for="(item, index) in editingContactItems" :key="'edit-'+index" class="edit-row">
          <span class="row-num">{{ index + 1 }}.</span>
          <input 
            :value="item" 
            @input="$emit('update-item', index, $event.target.value)" 
            type="text" 
            placeholder="輸入事項..." 
            class="edit-input"
          />
          <button @click="$emit('remove-item', index)" class="del-row-btn">🗑️</button>
        </div>
        
        <div class="edit-actions">
          <button @click="$emit('add-item')" class="add-btn">➕ 新增事項</button>
          <div class="action-right">
            <button @click="$emit('cancel-edit')" class="cancel-btn">取消</button>
            <button @click="$emit('save-items')" class="save-btn">💾 儲存</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useFeatureExposure } from '../../app/composables/useFeatureExposure.js'
const props = defineProps({
  trackingReady: { type: Boolean, default: false },
  trackingDate: { type: String, default: '' },
  contactBookItems: Array,
  editingContactItems: Array,
  isEditingContact: Boolean,
  todayDisplay: String,
  privacyFilter: Function
})

const board = ref(null)
useFeatureExposure(board, () => ({ ready: props.trackingReady && !props.isEditingContact, feature: '今日聯絡簿', context: props.trackingDate ? '聯絡簿日期：' + props.trackingDate : '' }))

defineEmits(['open-pwd', 'cancel-edit', 'save-items', 'add-item', 'remove-item', 'update-item'])
</script>

<style scoped>
.blackboard { background-color: #315243; border: 10px solid #754d29; border-radius: 8px; padding: 20px 25px; box-shadow: 0 6px 12px rgba(0,0,0,0.15), inset 0 0 10px rgba(0,0,0,0.3); margin-bottom: 20px;}
.board-title { margin: 0; font-size: 1.4rem; font-weight: bold; }
.contact-title { color: #f59e0b; }
.board-date { color: #cbd5e1; margin: 8px 0 0 0; font-size: 0.95rem; }
.dashed-divider { border-bottom: 2px dashed #94a3b8; margin: 15px 0; opacity: 0.6; }
.board-content { color: white; min-height: 40px; }
.empty-text-italic { color: #94a3b8; font-style: italic; font-size: 1.1rem; }
.item-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }

.board-header { display: flex; justify-content: space-between; align-items: flex-start; }
.edit-btn { background: #f59e0b; color: #1e293b; border: none; padding: 6px 16px; border-radius: 6px; font-weight: bold; font-size: 0.95rem; cursor: pointer; }

.edit-mode { background: rgba(0, 0, 0, 0.2); padding: 15px; border-radius: 8px; }
.edit-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.row-num { font-size: 1.1rem; color: #f59e0b; width: 25px; font-weight: bold; }
.edit-input { flex: 1; padding: 8px 12px; font-size: 1rem; border-radius: 6px; border: none; }
.del-row-btn { background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; }

.edit-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
.add-btn { background: transparent; color: white; border: 1px dashed #cbd5e1; padding: 8px 15px; border-radius: 6px; cursor: pointer; }
.action-right { display: flex; gap: 10px; }
.cancel-btn { background: #64748b; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; }
.save-btn { background: #10b981; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; }

@media (max-width: 768px) {
  .blackboard { padding: 15px 10px; border-width: 8px; }
  .board-header { flex-direction: column; align-items: stretch; gap: 12px; }
  .board-header > div { text-align: center; }
  .contact-title { font-size: 1.3rem; }
  .board-date { font-size: 0.9rem; margin-top: 5px;}
  .edit-btn { width: 100%; padding: 10px; text-align: center; font-size: 1.05rem;}
  
  .contact-list li { line-height: 1.6; word-break: break-word; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed rgba(255,255,255,0.15); font-size: 1.05rem;}
  .contact-list li:last-child { border-bottom: none; padding-bottom: 0; margin-bottom: 0;}
  
  .edit-mode { padding: 12px; background: rgba(0,0,0,0.25); border-radius: 8px;}
  .edit-row { display: flex; align-items: stretch; gap: 8px; flex-wrap: nowrap; margin-bottom: 12px; }
  .row-num { width: 25px; flex-shrink: 0; display: flex; align-items: center; font-size: 1.05rem; }
  .edit-input { flex: 1; min-width: 0; padding: 10px; font-size: 1rem; border-radius: 6px; }
  .del-row-btn { flex-shrink: 0; padding: 0 15px; display: flex; align-items: center; justify-content: center; }
  
  .edit-actions { flex-direction: column; align-items: stretch; gap: 15px; margin-top: 15px;}
  .add-btn { width: 100%; padding: 12px; font-size: 1.05rem; }
  .action-right { display: flex; width: 100%; gap: 10px; }
  .cancel-btn, .save-btn { flex: 1; text-align: center; padding: 12px; font-size: 1.05rem; justify-content: center;}
}
</style>
