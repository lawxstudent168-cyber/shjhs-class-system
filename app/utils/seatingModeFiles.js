const FILE_FORMAT = 'shjhs-seating-mode'
const CSV_COLUMNS = ['位置', '網格編號', '座號', '姓名', '其他標註', '是否隱藏', '是否旋轉', '首頁顯示', '座號大小', '座號顏色', '姓名大小', '姓名顏色', '其他大小', '其他顏色', '列印設定JSON']

const text = value => String(value ?? '')

export function validateSeatingMode(layout) {
  if (!layout || !Array.isArray(layout.seats) || layout.seats.length !== 30) throw new Error('座位檔案必須有 30 個座位')
  const ids = layout.seats.map(seat => Number(seat?.id))
  if (ids.some(id => !Number.isInteger(id) || id < 1 || id > 30) || new Set(ids).size !== 30) throw new Error('網格編號必須為不重複的 1–30')
  const seats = layout.seats.map(seat => ({
    id: Number(seat.id),
    seatNum: text(seat.seatNum),
    name: text(seat.name),
    other: text(seat.other),
    isHidden: seat.isHidden === true
  }))
  const settings = layout.settings || {}
  const defaults = { numberSize: 16, numberColor: '#64748b', nameSize: 20, nameColor: '#e11d48', otherSize: 14, otherColor: '#94a3b8' }
  for (const key of ['numberSize', 'nameSize', 'otherSize']) {
    const size = Number(settings[key] ?? defaults[key])
    if (!Number.isFinite(size) || size < 1 || size > 200) throw new Error(`${key} 文字大小無效`)
    defaults[key] = size
  }
  for (const key of ['numberColor', 'nameColor', 'otherColor']) {
    const color = text(settings[key] ?? defaults[key])
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error(`${key} 顏色無效`)
    defaults[key] = color
  }
  const printData = layout.printData && typeof layout.printData === 'object' && !Array.isArray(layout.printData) ? layout.printData : {}
  return { seats, isRotated: layout.isRotated === true, isVisible: layout.isVisible !== false, settings: defaults, printData: { ...printData } }
}

export function exportSeatingModeJson(layout, mode) {
  return JSON.stringify({ format: FILE_FORMAT, version: 1, mode, layout: validateSeatingMode(layout) }, null, 2)
}

export function importSeatingModeJson(source) {
  const data = JSON.parse(source.replace(/^\uFEFF/, ''))
  if (data?.format !== FILE_FORMAT || data.version !== 1) throw new Error('不是支援的座位模式 JSON 檔案')
  return validateSeatingMode(data.layout)
}

function csvCell(value) {
  let valueText = text(value)
  if (/^[=+\-@]/.test(valueText)) valueText = `\t${valueText}`
  return `"${valueText.replace(/"/g, '""')}"`
}

function parseCsv(source) {
  const rows = []
  let row = [], cell = '', quoted = false
  const input = source.replace(/^\uFEFF/, '')
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { cell += '"'; i++ }
      else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(cell); cell = '' }
    else if (char === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = '' }
    else cell += char
  }
  if (quoted) throw new Error('CSV 引號未關閉')
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row) }
  return rows
}

const unguard = value => value.startsWith('\t') && /^[=+\-@]/.test(value.slice(1)) ? value.slice(1) : value

export function exportSeatingModeCsv(layout) {
  const mode = validateSeatingMode(layout)
  const rows = mode.seats.map((seat, index) => [
    index + 1, seat.id, seat.seatNum, seat.name, seat.other, seat.isHidden ? '是' : '否',
    mode.isRotated ? '是' : '否', mode.isVisible ? '是' : '否',
    mode.settings.numberSize, mode.settings.numberColor, mode.settings.nameSize, mode.settings.nameColor,
    mode.settings.otherSize, mode.settings.otherColor, JSON.stringify(mode.printData)
  ])
  return `\uFEFF${CSV_COLUMNS.map(csvCell).join(',')}\r\n${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

export function importSeatingModeCsv(source) {
  const [header, ...rows] = parseCsv(source)
  if (!header || header.join(',') !== CSV_COLUMNS.join(',') || rows.length !== 30 || rows.some(row => row.length !== CSV_COLUMNS.length)) {
    throw new Error('CSV 格式或座位數不正確，請使用本系統匯出的檔案')
  }
  const ordered = rows.map(row => row.map(unguard)).sort((a, b) => Number(a[0]) - Number(b[0]))
  if (ordered.some((row, index) => Number(row[0]) !== index + 1)) throw new Error('CSV 位置必須為不重複的 1–30')
  const first = ordered[0]
  let printData
  try { printData = JSON.parse(first[14]) } catch { throw new Error('CSV 列印設定無效') }
  const metadata = row => row.slice(6).join('\u0000')
  if (ordered.some(row => metadata(row) !== metadata(first))) throw new Error('CSV 各列的模式設定不一致')
  return validateSeatingMode({
    seats: ordered.map(row => ({ id: Number(row[1]), seatNum: row[2], name: row[3], other: row[4], isHidden: row[5] === '是' })),
    isRotated: first[6] === '是', isVisible: first[7] === '是',
    settings: { numberSize: first[8], numberColor: first[9], nameSize: first[10], nameColor: first[11], otherSize: first[12], otherColor: first[13] },
    printData
  })
}
