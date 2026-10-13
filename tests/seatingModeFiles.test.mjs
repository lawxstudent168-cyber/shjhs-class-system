import test from 'node:test'
import assert from 'node:assert/strict'
import {
  exportSeatingModeCsv, exportSeatingModeJson, importSeatingModeCsv, importSeatingModeJson
} from '../app/utils/seatingModeFiles.js'

const layout = () => ({
  seats: Array.from({ length: 30 }, (_, index) => ({
    id: 30 - index,
    seatNum: `${index + 1}號`,
    name: index === 0 ? '=危險公式,"學生"\n第二行' : `學生${index + 1}`,
    other: index === 1 ? '備註,含逗號' : '',
    isHidden: index === 29
  })),
  isRotated: true,
  isVisible: false,
  settings: { numberSize: 22, numberColor: '#123456', nameSize: 25, nameColor: '#abcdef', otherSize: 15, otherColor: '#789abc' },
  printData: { title: '考試座位表', date: '2026/10/13', rolesLeft: '一行\n二行' }
})

test('each mode exports and imports a complete JSON or CSV layout', () => {
  const expected = layout()
  assert.deepEqual(importSeatingModeJson(exportSeatingModeJson(expected, 'backupB')), expected)
  const csv = exportSeatingModeCsv(expected)
  assert.match(csv, /"\t=危險公式/)
  assert.deepEqual(importSeatingModeCsv(csv), expected)
})

test('imports reject incomplete or duplicate seat files', () => {
  const incomplete = layout()
  incomplete.seats.pop()
  assert.throws(() => exportSeatingModeCsv(incomplete), /30 個座位/)
  const duplicate = layout()
  duplicate.seats[0].id = duplicate.seats[1].id
  assert.throws(() => importSeatingModeJson(JSON.stringify({ format: 'shjhs-seating-mode', version: 1, layout: duplicate })), /不重複/)
})
