<template>
  <div v-if="matchedStudent && studentStats" class="student-assign-card" data-track-feature="個人作業／物品繳交確認">
    <div class="card-header">
      <h3>📝 {{ matchedStudent.real_name }} 的作業/物品繳交確認清單</h3>
      <span v-if="studentStats.missing.length === 0" class="badge success">💯 作業全齊，太棒了！</span>
      <span v-else class="badge warning">⚠️ 目前缺交 {{ studentStats.missing.length }} 項作業</span>
    </div>
    
    <div class="card-body">
      <!-- ❌ 缺交區塊 -->
      <div class="hw-list missing-list">
        <div class="hw-title">❌ 尚未繳交：</div>
        <ul>
          <li v-for="m in studentStats.missing" :key="'m'+m.id">
            <span class="subject-tag">[{{ m.subject_name }}]</span> {{ m.title }}
            <span v-if="m.deadline" class="deadline-tag">(期限: {{ m.deadline }})</span>
          </li>
          <li v-if="studentStats.missing.length === 0" class="none-text">目前無缺交作業</li>
        </ul>
      </div>

      <!-- ✅ 已交區塊 -->
      <div class="hw-list submitted-list">
        <div class="hw-title">✅ 已經繳交：</div>
        <ul>
          <li v-for="s in studentStats.submitted" :key="'s'+s.id">
            <span class="subject-tag">[{{ s.subject_name }}]</span> {{ s.title }}
          </li>
          <li v-if="studentStats.submitted.length === 0" class="none-text">目前尚無已交作業</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  currentIdentity: String,
  allStudents: Array,
  assignments: Array,
  submissions: Array,
  excludedIds: Array
})

// 💡 1. 根據登入字串找出對應的學生
const matchedStudent = computed(() => {
  if (!props.currentIdentity || props.currentIdentity === '匿名來訪者') return null
  const sortedStudents = [...(props.allStudents || [])].sort((a, b) => (b.real_name || '').length - (a.real_name || '').length)
  return sortedStudents.find(s => s.real_name && props.currentIdentity.includes(s.real_name))
})

// 💡 2. 修正關鍵：過濾掉導師設定「不列入報表」的作業
const activeAssignments = computed(() => {
  // 強制將排除名單的 ID 全數轉換為字串 (String)
  const excluded = (props.excludedIds || []).map(id => String(id))
  
  // 比對時，也將作業本身的 ID 轉換為字串，避免型別不一致導致漏網之魚
  return (props.assignments || []).filter(a => !excluded.includes(String(a.id)))
})

// 💡 3. 計算該學生的缺交與已交狀態
const studentStats = computed(() => {
  if (!matchedStudent.value) return null
  
  // 取出該學生的所有已繳交的作業 ID (一樣強制轉字串確保安全)
  const mySubIds = (props.submissions || [])
    .filter(sub => String(sub.student_id) === String(matchedStudent.value.id))
    .map(sub => String(sub.assignment_id))

  return {
    submitted: activeAssignments.value.filter(a => mySubIds.includes(String(a.id))),
    missing: activeAssignments.value.filter(a => !mySubIds.includes(String(a.id)))
  }
})
</script>

<style scoped>
.student-assign-card {
  background: white;
  border-radius: 8px;
  padding: 20px 25px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
  border: 1px solid #e2e8f0;
  border-top: 5px solid #3b82f6; /* 藍色頂部強調線 */
  margin-bottom: 25px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px dashed #e2e8f0;
  padding-bottom: 15px;
  margin-bottom: 15px;
  flex-wrap: wrap;
  gap: 10px;
}

.card-header h3 {
  margin: 0;
  color: #1e3a8a;
  font-size: 1.3rem;
}

.badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.95rem;
  font-weight: bold;
}
.badge.success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
.badge.warning { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }

.card-body {
  display: flex;
  gap: 20px;
}

.hw-list {
  flex: 1;
  background: #f8fafc;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.hw-title {
  font-size: 1.05rem;
  font-weight: bold;
  margin-bottom: 10px;
  border-bottom: 1px solid #cbd5e1;
  padding-bottom: 8px;
}
.missing-list .hw-title { color: #dc2626; }
.submitted-list .hw-title { color: #16a34a; }

.hw-list ul {
  margin: 0;
  padding-left: 20px;
  color: #334155;
  font-size: 1rem;
  line-height: 1.8;
}

.subject-tag {
  color: #8b5cf6;
  font-weight: bold;
  margin-right: 4px;
}

.deadline-tag {
  color: #ef4444;
  font-size: 0.85rem;
  margin-left: 8px;
}

.none-text {
  list-style: none;
  color: #94a3b8;
  font-style: italic;
  margin-left: -20px;
}

/* 💡 RWD：手機端最佳化 */
@media (max-width: 768px) {
  .student-assign-card { padding: 15px; }
  .card-header { flex-direction: column; align-items: flex-start; }
  .card-body { flex-direction: column; gap: 15px; }
  .hw-list { width: 100%; box-sizing: border-box; }
  .hw-list ul { font-size: 0.95rem; line-height: 1.6; }
}
</style>
