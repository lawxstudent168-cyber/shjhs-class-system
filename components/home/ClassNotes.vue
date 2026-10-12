<template>
  <div class="notes-board">
    <!-- 💡 將原本的 header 改造為可點擊的摺疊開關群組 -->
    <div class="board-header">
      <div class="title-group" @click="toggleExpand" title="點擊展開/收合">
        <h2 class="board-title notes-title">⚡ 本週班級注意事項</h2>
        <span class="toggle-icon">{{ isExpanded ? '▲' : '▼' }}</span>
        <p class="board-date">{{ todayDisplay }}</p>
      </div>
      <button v-if="!isEditingClassNotes" @click.stop="$emit('open-pwd')" class="edit-btn">✏️ 編輯</button>
    </div>
    
    <div class="dashed-divider"></div>
    
    <!-- 💡 加上控制高度的折疊外層 -->
    <div class="collapsible-section" :class="{ 'is-open': isExpanded || isEditingClassNotes }">
      <div class="board-content">
        
        <div v-if="!isEditingClassNotes">
          <div v-if="classNoteItems.length === 0" class="empty-text-italic">未來 7 天尚無班級注意事項...</div>
          <ul v-else class="item-list notes-list">
            <li v-for="(item, index) in classNoteItems" :key="'cn-'+index">
              <span class="note-date">{{ classNoteDateLabel(item.date) }}</span>
              <span>{{ privacyFilter(item.content) }}</span>
            </li>
          </ul>
        </div>
        
        <div v-else class="edit-mode">
          <div v-for="(item, index) in editingClassNoteItems" :key="'edit-note-'+index" class="edit-row">
            <span class="row-num">{{ index + 1 }}.</span>
            <input :value="item.date" :min="currentDate" @input="$emit('update-date', index, $event.target.value)"
              type="date" class="edit-date" aria-label="事項日期" />
            <input 
              :value="item.content"
              @input="$emit('update-item', index, $event.target.value)" 
              type="text" 
              placeholder="輸入注意事項..." 
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
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { classNoteDateLabel } from '~~/app/utils/classNotes.js'

const props = defineProps({
  classNoteItems: Array,
  editingClassNoteItems: Array,
  isEditingClassNotes: Boolean,
  todayDisplay: String,
  currentDate: String,
  privacyFilter: Function
})

defineEmits(['open-pwd', 'cancel-edit', 'save-items', 'add-item', 'remove-item', 'update-item', 'update-date'])

const isExpanded = ref(false)

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
}

// 💡 智慧連動機制：有資料自動展開，沒資料自動縮起
watch(() => props.classNoteItems?.length, (count) => {
  if (count > 0) {
    isExpanded.value = true
  } else {
    isExpanded.value = false
  }
}, { immediate: true })

// 💡 進入編輯模式時，自動強制展開
watch(() => props.isEditingClassNotes, (newVal) => {
  if (newVal) {
    isExpanded.value = true
  }
})
</script>

<style scoped>
/* 💡 完全保留您的深海藍色系看板設計 */
.notes-board { background-color: #1e293b; border: 10px solid #475569; border-radius: 8px; padding: 20px 25px; box-shadow: 0 6px 12px rgba(0,0,0,0.15), inset 0 0 10px rgba(0,0,0,0.3); margin-bottom: 20px;}

.board-header { display: flex; justify-content: space-between; align-items: flex-start; }

/* 💡 新增：讓標題區域變成可點擊的視覺效果 */
.title-group {
  display: flex;
  flex-direction: column; /* 讓日期保持在標題下方 */
  position: relative;
  cursor: pointer;
  user-select: none;
  transition: opacity 0.2s;
  padding-right: 30px; /* 留空間給箭頭 */
}
.title-group:hover { opacity: 0.8; }

.board-title { margin: 0; font-size: 1.4rem; font-weight: bold; display: inline-flex; align-items: center; }
.notes-title { color: #38bdf8; } /* 天空藍字體 */

/* 💡 箭頭樣式 */
.toggle-icon {
  position: absolute;
  top: 5px;
  right: 0;
  color: #94a3b8;
  font-size: 0.85rem;
}

.board-date { color: #94a3b8; margin: 8px 0 0 0; font-size: 0.95rem; }

.dashed-divider { border-bottom: 2px dashed #64748b; margin: 15px 0; opacity: 0.6; }

/* =======================================
   💡 新增：核心折疊特效 (透過 max-height 控制)
   ======================================= */
.collapsible-section {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.35s ease-in-out, opacity 0.35s ease-in-out;
  opacity: 0;
}
.collapsible-section.is-open {
  max-height: 2000px; /* 給予足夠大的高度確保內容都能展開 */
  opacity: 1;
}

/* 以下完全保留您的原始排版 */
.board-content { color: white; min-height: 40px; }
.empty-text-italic { color: #94a3b8; font-style: italic; font-size: 1.1rem; }
.item-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
.notes-list li { display: flex; align-items: baseline; gap: 12px; }
.note-date { color: #7dd3fc; font-weight: bold; white-space: nowrap; }

.edit-btn { background: #0ea5e9; color: white; border: none; padding: 6px 16px; border-radius: 6px; font-weight: bold; font-size: 0.95rem; cursor: pointer; transition: 0.2s;}
.edit-btn:hover { background: #0284c7; }

.edit-mode { background: rgba(0, 0, 0, 0.3); padding: 15px; border-radius: 8px; }
.edit-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.row-num { font-size: 1.1rem; color: #38bdf8; width: 25px; font-weight: bold; }
.edit-input { flex: 1; padding: 8px 12px; font-size: 1rem; border-radius: 6px; border: none; }
.edit-date { width: 165px; padding: 8px; font-size: 1rem; border-radius: 6px; border: none; }
.del-row-btn { background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; }

.edit-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
.add-btn { background: transparent; color: white; border: 1px dashed #cbd5e1; padding: 8px 15px; border-radius: 6px; cursor: pointer; }
.action-right { display: flex; gap: 10px; }
.cancel-btn { background: #64748b; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; }
.save-btn { background: #10b981; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; }

@media (max-width: 768px) {
  .notes-board { padding: 15px 10px; border-width: 8px; }
  .board-header { flex-direction: column; align-items: stretch; gap: 12px; }
  .title-group { align-items: center; padding-right: 0; }
  .toggle-icon { position: static; margin-left: 10px; display: inline-block; }
  .notes-title { font-size: 1.3rem; }
  .board-date { font-size: 0.9rem; margin-top: 5px; text-align: center; }
  .edit-btn { width: 100%; padding: 10px; text-align: center; font-size: 1.05rem;}
  
  .notes-list li { line-height: 1.6; word-break: break-word; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed rgba(255,255,255,0.15); font-size: 1.05rem; flex-direction: column; gap: 2px;}
  .notes-list li:last-child { border-bottom: none; padding-bottom: 0; margin-bottom: 0;}
  
  .edit-mode { padding: 12px; background: rgba(0,0,0,0.3); border-radius: 8px;}
  .edit-row { display: flex; align-items: stretch; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
  .row-num { width: 25px; flex-shrink: 0; display: flex; align-items: center; font-size: 1.05rem; }
  .edit-input { flex: 1; min-width: 0; padding: 10px; font-size: 1rem; border-radius: 6px; }
  .edit-date { width: 100%; box-sizing: border-box; }
  .del-row-btn { flex-shrink: 0; padding: 0 15px; display: flex; align-items: center; justify-content: center; }
  
  .edit-actions { flex-direction: column; align-items: stretch; gap: 15px; margin-top: 15px;}
  .add-btn { width: 100%; padding: 12px; font-size: 1.05rem; }
  .action-right { display: flex; width: 100%; gap: 10px; }
  .cancel-btn, .save-btn { flex: 1; text-align: center; padding: 12px; font-size: 1.05rem; justify-content: center;}
}
</style>
