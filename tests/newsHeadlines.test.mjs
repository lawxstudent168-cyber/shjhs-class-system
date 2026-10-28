import test from 'node:test'
import assert from 'node:assert/strict'
import { createNewsService, parseNewsFeed, isNewsProvider } from '../server/utils/newsHeadlines.js'

const now = Date.parse('2026-10-28T02:00:00Z')
const date = new Date(now).toUTCString()
const item = (overrides = {}) => {
  const fields = { title: '<![CDATA[Latest news & context]]>', link: 'https://abcnews.go.com/story?id=123', pubDate: date, ...overrides }
  return `<item>${Object.entries(fields).map(([key, value]) => `<${key}>${value}</${key}>`).join('')}</item>`
}
const feed = (...items) => `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>${items.join('')}</channel></rss>`
const response = body => ({ ok: true, text: async () => body })

test('parses official ABC, Fox and CNN RSS, CDATA, media and enclosure images', () => {
  const abc = parseNewsFeed(feed(item({ 'media:group': '<media:content url="https://images.example.com/news.jpg" type="image/jpeg" />' })), 'abc', { now })
  assert.equal(abc.title, 'Latest news & context')
  assert.equal(abc.link, 'https://abcnews.go.com/story?id=123')
  assert.equal(abc.image, 'https://images.example.com/news.jpg')
  assert.equal(abc.aggregated, false)
  for (const [provider, link] of [['fox', 'http://www.foxnews.com/world/story'], ['cnn', 'https://edition.cnn.com/2026/news']]) {
    const result = parseNewsFeed(feed(item({ link, enclosure: '<ignored />' }).replace('<enclosure><ignored /></enclosure>', '<enclosure url="https://images.example.com/photo.jpg" type="image/jpeg" />')), provider, { now })
    assert.equal(result.link, link.replace('http:', 'https:'))
    assert.equal(result.image, 'https://images.example.com/photo.jpg')
  }
})

test('headlines without images work, missing links and unsafe or wrong-publisher links are skipped', () => {
  const result = parseNewsFeed(feed(item({ link: '' }), item({ link: 'javascript:alert(1)' }), item({ link: 'https://abcnews.go.com.attacker.example/story' }), item()), 'abc', { now })
  assert.equal(result.image, '')
  const video = parseNewsFeed(feed(item({ 'media:content': '<ignored />' }).replace('<media:content><ignored /></media:content>', '<media:content url="https://images.example.com/clip.mp4" medium="video" />')), 'abc', { now })
  assert.equal(video.image, '')
  assert.match(result.link, /id=123/)
  assert.throws(() => parseNewsFeed(feed(item({ link: '' })), 'abc', { now }))
})

test('rejects malformed, HTML, entity declarations, oversized and obsolete feeds', () => {
  for (const xml of ['<rss><bad></rss>', '<html><body>Blocked</body></html>', '<!DOCTYPE rss [<!ENTITY x "abc">]><rss/>', 'x'.repeat(2_000_001), feed(item({ pubDate: 'Mon, 01 Jan 2024 00:00:00 GMT' }))]) {
    assert.throws(() => parseNewsFeed(xml, 'abc', { now }))
  }
  assert.throws(() => parseNewsFeed(feed(item({ pubDate: new Date(now + 3 * 86400_000).toUTCString() })), 'abc', { now }))
})

test('supports Atom feeds and only accepts the chosen publisher in Google News fallback', () => {
  const atom = '<feed><entry><title>Atom headline</title><link href="https://abcnews.go.com/story" rel="alternate" /></entry></feed>'
  assert.equal(parseNewsFeed(atom, 'abc', { now }).title, 'Atom headline')
  const google = feed(item({ link: 'https://news.google.com/rss/articles/abc', source: 'Other publisher' }).replace('<source>Other publisher</source>', '<source url="https://abcnews.go.com">ABC News</source>'))
  assert.equal(parseNewsFeed(google, 'abc', { now, aggregated: true }).aggregated, true)
  assert.throws(() => parseNewsFeed(google, 'fox', { now, aggregated: true }))
  assert.throws(() => parseNewsFeed(google, 'abc', { now }))
})

test('independent official and aggregate feeds race without waiting for blocked origins', async () => {
  const calls = []
  const service = createNewsService({ now: () => now, fetchImpl: async url => {
    calls.push(url)
    if (url.includes('moxie.')) return { ok: false, status: 503 }
    return response(feed(item({ link: 'https://www.foxnews.com/story' })))
  } })
  assert.equal((await service('fox')).source, 'Fox News')
  assert.equal(calls.length, 4)
  assert.ok(calls[0].includes('moxie.foxnews.com'))
  let calls2 = 0
  const fallback = createNewsService({ now: () => now, timeoutMs: 5, fetchImpl: async (url, { signal }) => {
    calls2++
    if (!url.includes('news.google.com')) return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true }))
    return response(feed(item({ link: 'https://news.google.com/rss/articles/abc', source: 'ABC' }).replace('<source>ABC</source>', '<source url="https://abcnews.go.com">ABC</source>')))
  } })
  assert.equal((await fallback('abc')).aggregated, true)
  assert.equal(calls2, 3)
})

test('deduplicates concurrent requests, caches successes, returns marked stale data and expires it', async () => {
  let clock = now
  let calls = 0
  let fail = false
  const service = createNewsService({ now: () => clock, freshMs: 10, staleMs: 100, retryMs: 10, fetchImpl: async () => {
    calls++
    if (fail) throw new Error('offline')
    return response(feed(item()))
  } })
  const results = await Promise.all([service('abc'), service('abc'), service('abc')])
  assert.equal(calls, 3)
  assert.equal(results[0].stale, false)
  await service('abc')
  assert.equal(calls, 3)
  clock += 11
  fail = true
  const stale = await service('abc')
  assert.equal(stale.stale, true)
  assert.equal(stale.fetchedAt, results[0].fetchedAt)
  assert.equal(calls, 6)
  await service('abc')
  assert.equal(calls, 6)
  clock += 100
  await assert.rejects(service('abc'), /unavailable/)
  assert.equal(calls, 9)
  await assert.rejects(service('abc'), /unavailable/)
  assert.equal(calls, 9)
})

test('provider allowlist rejects arbitrary URLs and prototype keys before any network request', async () => {
  const service = createNewsService({ fetchImpl: () => { throw new Error('Must not fetch') } })
  for (const provider of ['__proto__', 'constructor', 'https://example.com/', 'unknown']) {
    assert.equal(isNewsProvider(provider), false)
    await assert.rejects(service(provider), /Unknown/)
  }
})

test('Bing redirect headlines resolve to the correct publisher and reject other publishers', () => {
  const bing = url => feed(item({ link: `https://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;url=${encodeURIComponent(url)}` }))
  const result = parseNewsFeed(bing('https://abcnews.go.com/story?id=456'), 'abc', { now, aggregated: true, aggregator: 'bing' })
  assert.equal(result.link, 'https://abcnews.go.com/story?id=456')
  assert.equal(result.aggregator, 'bing')
  assert.throws(() => parseNewsFeed(bing('https://www.foxnews.com/story'), 'abc', { now, aggregated: true, aggregator: 'bing' }))
  assert.throws(() => parseNewsFeed(bing('javascript:alert(1)'), 'abc', { now, aggregated: true, aggregator: 'bing' }))
})

test('a Bing headline succeeds even when official and Google feeds both fail', async () => {
  const service = createNewsService({ now: () => now, fetchImpl: async url => {
    if (!url.includes('www.bing.com/')) throw new Error('blocked')
    return response(feed(item({ link: `https://www.bing.com/news/apiclick.aspx?url=${encodeURIComponent('https://abcnews.go.com/story')}` })))
  } })
  const result = await service('abc')
  assert.equal(result.aggregator, 'bing')
  assert.equal(result.link, 'https://abcnews.go.com/story')
})

test('a fast backup returns before a slow origin times out and aborts the loser', async () => {
  let officialSignal
  const service = createNewsService({ now: () => now, timeoutMs: 10_000, fetchImpl: async (url, { signal }) => {
    if (url.includes('abcnews.go.com/')) {
      officialSignal = signal
      return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))
    }
    if (url.includes('news.google.com/')) throw new Error('blocked')
    return response(feed(item({ link: 'https://abcnews.go.com/story' })))
  } })
  const result = await service('abc')
  assert.equal(result.aggregator, 'bing')
  assert.equal(officialSignal.aborted, true)
})
