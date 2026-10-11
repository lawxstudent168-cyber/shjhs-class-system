import test from 'node:test'
import assert from 'node:assert/strict'
import { removePrintUrls, escapePrintHtml, normalizePrintQrCodes, isPrintQrUrl, extractPrintUrls, collectPrintQrSources } from '../app/utils/noticePrint.js'

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

test('hidden URLs become named QR sources from notice text, hyperlinks, attachments and print template', () => {
  const sources = collectPrintQrSources([
    { content: '請讀 https://school.example/rules。<a href="https://forms.example/apply?a=1&amp;b=2">報名表</a>', links: [
      { title: '報名表單', url: 'https://forms.example/apply?a=1&b=2' },
      { title: '課程資料', url: 'www.class.example/info' }
    ] }
  ], '補充說明：https://school.example/rules')
  assert.deepEqual(sources, [
    { url: 'https://forms.example/apply?a=1&b=2', suggestedName: '報名表' },
    { url: 'https://school.example/rules', suggestedName: '' },
    { url: 'https://www.class.example/info', suggestedName: '課程資料' }
  ])
  assert.deepEqual(extractPrintUrls('網址 www.school.example/a、非網址 test@example.com'), ['https://www.school.example/a'])
})
