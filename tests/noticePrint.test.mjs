import test from 'node:test'
import assert from 'node:assert/strict'
import { removePrintUrls, escapePrintHtml, normalizePrintQrCodes, isPrintQrUrl } from '../app/utils/noticePrint.js'

test('paper copy removes URLs while keeping the surrounding notice text', () => {
  assert.equal(removePrintUrls('請閱讀 https://school.example/path?a=1\n報名：www.example.org/form'), '請閱讀\n報名：')
  assert.equal(removePrintUrls('https://example.org\n\n下一項'), '下一項')
})

test('QR settings migrate the previous single URL and accept multiple saved entries', () => {
  assert.deepEqual(normalizePrintQrCodes(undefined, 'https://old.example'), [{ name: '手機掃描查看', url: 'https://old.example' }])
  assert.deepEqual(normalizePrintQrCodes([], 'https://old.example'), [])
  assert.deepEqual(normalizePrintQrCodes([{ name: '報名', url: 'https://forms.example' }]), [{ name: '報名', url: 'https://forms.example' }])
  assert.equal(isPrintQrUrl('https://forms.example'), true)
  assert.equal(isPrintQrUrl('javascript:alert(1)'), false)
})

test('print markup escapes notice and QR names', () => {
  assert.equal(escapePrintHtml('<img src="x"> &'), '&lt;img src=&quot;x&quot;&gt; &amp;')
})
