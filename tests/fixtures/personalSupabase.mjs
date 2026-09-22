// Local-only fake PostgREST. Never connect this fixture to a real project.
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { schoolDate } from '../../app/utils/teacherTodos.js'

export async function startPersonalFixture(port = 0) {
  const today = schoolDate()
  const yesterday = schoolDate(new Date(Date.now() - 86400000))
  const tomorrow = schoolDate(new Date(Date.now() + 86400000))
  const tables = {
    students: [
      { id: 'child-a', real_name: '測試小安', seat_number: 1, birthday: '20130514', id_last_5: '12345', parent_email: 'parent@example.test' },
      { id: 'child-b', real_name: '測試小晴', seat_number: 2, birthday: '20140514', id_last_5: '23456', parent_email: 'parent@example.test' },
      { id: 'child-c', real_name: '其他家庭', seat_number: 3, birthday: '20130514', id_last_5: '34567', parent_email: 'other@example.test' }
    ],
    parents: [],
    assignments: [
      { id: 'work-a', title: '數學習作 P.12–14', subject_name: '數學', deadline: yesterday },
      { id: 'work-b', title: '課文生字練習', subject_name: '國文', deadline: today },
      { id: 'work-c', title: '準備自然實驗紀錄', subject_name: '自然', deadline: tomorrow }
    ],
    assignment_submissions: [{ id: 'submission-a', assignment_id: 'work-c', student_id: 'child-a' }],
    private_messages: [
      { id: 'msg-a', student_id: 'child-a', chat_type: '家長', sender_role: '導師', content: '小安今天在分組討論中很投入，謝謝家長的陪伴。', created_at: new Date().toISOString(), is_read_by_teacher: true },
      { id: 'msg-b', student_id: 'child-a', chat_type: '學生', sender_role: '導師', content: '學生專屬：記得帶自然課本。', created_at: new Date().toISOString(), is_read_by_teacher: true },
      { id: 'msg-c', student_id: 'child-b', chat_type: '家長', sender_role: '導師', content: '小晴的家長訊息', created_at: new Date().toISOString(), is_read_by_teacher: true },
      { id: 'leave-a', student_id: 'child-a', chat_type: '家長', sender_role: '家長', content: `【系統自動推播：線上請假通知】\n請假日期：${yesterday}\n請假節數：第1節\n假別/事由：病假`, created_at: new Date().toISOString(), is_read_by_teacher: false }
    ],
    attendances: [{ id: 'att-a', student_id: 'child-a', record_date: today, status: '已到' }],
    contact_books: [{ record_date: today, contact_items: ['明天帶水壺與體育服', '請完成數學習作與課文生字'] }],
    system_settings: [
      { setting_key: 'announcements_data', setting_value: [{ id: 'notice-a', title: '班級閱讀日', content: '週五一起分享最近讀到的好書。', date: today }] },
      { setting_key: 'class_notes_data', setting_value: { [tomorrow]: ['體育課請穿運動服並攜帶水壺'] } },
      { setting_key: 'parent_announcements_data', setting_value: [{ id: 'notice-b', title: '家長交流提醒', content: '有需要討論的事項，可以使用家長私訊。', date: today }] }
    ]
  }
  const requests = []
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    requests.push({ method: req.method, url: url.href })
    res.setHeader('Content-Type', 'application/json')
    const table = url.pathname.replace('/rest/v1/', '')
    if (!tables[table] || req.method !== 'GET') { res.writeHead(400); res.end(JSON.stringify({ message: 'Unexpected fixture request' })); return }
    let rows = [...tables[table]]
    for (const [key, filter] of url.searchParams) {
      if (['select', 'order', 'offset', 'limit'].includes(key)) continue
      const dot = filter.indexOf('.')
      const op = filter.slice(0, dot), value = filter.slice(dot + 1)
      rows = rows.filter(row => {
        if (op === 'eq') return String(row[key]) === value
        if (op === 'in') return value.slice(1, -1).split(',').map(v => v.replace(/^"|"$/g, '')).includes(String(row[key]))
        if (op === 'gte') return String(row[key]) >= value
        if (op === 'lte') return String(row[key]) <= value
        if (op === 'like') return String(row[key]).startsWith(value.replace(/[%*]$/, ''))
        return false
      })
    }
    rows = rows.slice(Number(url.searchParams.get('offset') || 0), Number(url.searchParams.get('offset') || 0) + Number(url.searchParams.get('limit') || 1000))
    const columns = url.searchParams.get('select')
    if (columns && columns !== '*') rows = rows.map(row => Object.fromEntries(columns.split(',').map(key => [key, row[key]])))
    res.end(JSON.stringify(rows))
  })
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve))
  return { server, requests, url: `http://127.0.0.1:${server.address().port}` }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fixture = await startPersonalFixture(Number(process.argv[2] || 54421))
  console.log(`Personal home fixture listening on ${fixture.url}`)
}
