import test from 'node:test'
import assert from 'node:assert/strict'
import { readNewsHeadline, writeNewsHeadline, validNewsHeadline } from '../app/utils/newsHeadlineCache.js'

const now = Date.parse('2026-10-28T02:00:00Z')
const headline = { title: 'Actual headline', link: 'https://abcnews.go.com/story', image: '', fetchedAt: new Date(now).toISOString(), stale: false }
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } }

test('last successful headline survives a new page load and stays marked stale during failed updates', () => {
  const saved = storage()
  writeNewsHeadline(saved, 'abc', headline)
  const recovered = readNewsHeadline(saved, 'abc', now + 60_000)
  assert.equal(recovered.title, headline.title)
  assert.equal(recovered.stale, true)
  assert.equal(readNewsHeadline(saved, 'fox', now), null)
  writeNewsHeadline(saved, 'abc', { ...headline, title: 'Stale result', stale: true })
  assert.equal(readNewsHeadline(saved, 'abc', now).title, headline.title)
  assert.equal(readNewsHeadline(saved, 'abc', now + 24 * 3600_000), null)
  assert.equal(readNewsHeadline(saved, 'abc', now - 1000), null)
})

test('cache is optional and malformed or unsafe headlines are ignored', () => {
  const unavailable = { getItem: () => { throw new Error('disabled') }, setItem: () => { throw new Error('full') } }
  assert.equal(readNewsHeadline(unavailable, 'abc', now), null)
  assert.doesNotThrow(() => writeNewsHeadline(unavailable, 'abc', headline))
  for (const link of ['javascript:alert(1)', 'https://abcnews.go.com.attacker.example/story', 'https://user:pass@abcnews.go.com/story']) assert.equal(validNewsHeadline({ ...headline, link }, 'abc'), false)
  assert.equal(validNewsHeadline({ ...headline, title: '' }, 'abc'), false)
  assert.equal(readNewsHeadline({ getItem: () => '{invalid' }, 'abc', now), null)
  assert.equal(validNewsHeadline({ ...headline, link: 'https://news.google.com/rss/articles/token', aggregated: true }, 'abc'), true)
})
