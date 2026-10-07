// School dates must not depend on the viewer's device timezone.
export function schoolDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now)
}

// Read every page: PostgREST otherwise silently caps results.
export async function fetchAllRows(makeQuery) {
  const rows = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await makeQuery().range(offset, offset + pageSize - 1)
    if (error) throw error
    if (!Array.isArray(data)) throw new Error('資料回應格式錯誤')
    rows.push(...data)
    if (data.length < pageSize) return rows
  }
}
