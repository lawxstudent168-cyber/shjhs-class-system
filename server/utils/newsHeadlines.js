import { XMLParser, XMLValidator } from 'fast-xml-parser'

const sources = {
  abc: { name: 'ABC News', home: 'https://abcnews.go.com/', host: 'abcnews.go.com', feeds: ['https://abcnews.go.com/abcnews/topstories'] },
  fox: { name: 'Fox News', home: 'https://www.foxnews.com/', host: 'foxnews.com', feeds: ['https://moxie.foxnews.com/google-publisher/latest.xml', 'https://feeds.foxnews.com/foxnews/latest'] },
  cnn: { name: 'CNN', home: 'https://edition.cnn.com/', host: 'cnn.com', feeds: ['https://rss.cnn.com/rss/edition.rss'] }
}
const list = value => value == null ? [] : Array.isArray(value) ? value : [value]
const text = value => String(typeof value === 'object' && value ? value['#text'] || '' : value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false, trimValues: true })
export const isNewsProvider = provider => Object.hasOwn(sources, provider)
const onHost = (url, host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
const safeUrl = (value, base) => {
  try {
    if (!text(value)) return ''
    const url = new URL(text(value), base)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return ''
    url.protocol = 'https:'
    return url.href
  } catch { return '' }
}

export function parseNewsFeed(xml, provider, { aggregated = false, aggregator = 'google', now = Date.now() } = {}) {
  if (!isNewsProvider(provider)) throw new Error('Unknown news provider')
  if (typeof xml !== 'string' || xml.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Invalid news feed')
  const source = sources[provider]
  const document = parser.parse(xml)
  const items = list(document.rss?.channel?.item || document.feed?.entry)
  for (const item of items) {
    const title = text(item.title)
    const rawLink = list(item.link).find(link => typeof link === 'string' || !link['@_rel'] || link['@_rel'] === 'alternate')
    let link = safeUrl(rawLink?.['@_href'] || rawLink, source.home)
    if (aggregated && aggregator === 'bing' && link) {
      const redirect = new URL(link)
      if (onHost(redirect, 'bing.com')) link = safeUrl(redirect.searchParams.get('url'))
    }
    if (!title || !link || title.length > 1000) continue
    if (aggregated && aggregator === 'google') {
      const publisher = safeUrl(item.source?.['@_url'])
      if (!publisher || !onHost(new URL(publisher), source.host) || new URL(link).hostname !== 'news.google.com') continue
    } else if (!onHost(new URL(link), source.host)) continue
    const date = Date.parse(text(item.pubDate || item.published || item.updated))
    // Some retired feeds still return 200 with years-old headlines.
    if (Number.isFinite(date) && (date < now - 7 * 86400_000 || date > now + 86400_000)) continue
    const media = [...list(item['media:content']), ...list(item['media:group']).flatMap(group => list(group['media:content'])), ...list(item['media:thumbnail']), ...list(item.enclosure)]
    const image = media.filter(entry => entry['@_medium'] !== 'video' && (!entry['@_type'] || entry['@_type'].startsWith('image/'))).map(entry => safeUrl(entry['@_url'], source.home)).find(Boolean) || ''
    return { title, link, image, publishedAt: Number.isFinite(date) ? new Date(date).toISOString() : null, source: source.name, aggregated, aggregator: aggregated ? aggregator : null }
  }
  throw new Error('No recent headlines in feed')
}

export function createNewsService({ fetchImpl = globalThis.fetch, now = Date.now, freshMs = 5 * 60_000, staleMs = 24 * 3600_000, retryMs = 60_000, timeoutMs = 4500, onFailure = () => {} } = {}) {
  const cache = new Map()
  const pending = new Map()
  const retryAfter = new Map()
  const load = async provider => {
    const source = sources[provider]
    const feeds = [...source.feeds.map(url => ({ url, aggregated: false })), {
      url: `https://news.google.com/rss/search?${new URLSearchParams({ q: `site:${source.host} when:7d`, hl: 'en-US', gl: 'US', ceid: 'US:en' })}`, aggregated: true, aggregator: 'google'
    }, {
      url: `https://www.bing.com/news/search?${new URLSearchParams({ q: `site:${source.host}`, format: 'rss' })}`, aggregated: true, aggregator: 'bing'
    }]
    const controllers = []
    const failures = []
    try {
      // Race independent sources so a slow/blocked origin cannot hold up its backups.
      const headline = await Promise.any(feeds.map(async feed => {
        const controller = new AbortController()
        controllers.push(controller)
        const timeout = setTimeout(() => controller.abort(), timeoutMs)
        try {
          const response = await fetchImpl(feed.url, { signal: controller.signal, headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'ClassSystemNews/1.0' } })
          if (!response.ok) throw new Error(`Feed HTTP ${response.status}`)
          return parseNewsFeed(await response.text(), provider, { aggregated: feed.aggregated, aggregator: feed.aggregator, now: now() })
        } catch (error) {
          failures.push({ host: new URL(feed.url).hostname, reason: String(error.message).slice(0, 160) })
          throw error
        } finally { clearTimeout(timeout) }
      }))
      const result = { ...headline, fetchedAt: new Date(now()).toISOString(), stale: false }
      cache.set(provider, { at: now(), result })
      retryAfter.delete(provider)
      return result
    } catch {
      // Keep operational failures visible in deployment logs without exposing feed content.
      try { onFailure(provider, failures) } catch {}
    }
    finally { controllers.forEach(controller => controller.abort()) }
    retryAfter.set(provider, now() + retryMs)
    const previous = cache.get(provider)
    if (previous && now() - previous.at < staleMs) return { ...previous.result, stale: true }
    throw new Error('News temporarily unavailable')
  }
  return async provider => {
    if (!isNewsProvider(provider)) throw new Error('Unknown news provider')
    const previous = cache.get(provider)
    if (previous && now() - previous.at < freshMs) return previous.result
    if (retryAfter.get(provider) > now()) {
      if (previous && now() - previous.at < staleMs) return { ...previous.result, stale: true }
      throw new Error('News temporarily unavailable')
    }
    if (!pending.has(provider)) pending.set(provider, load(provider).finally(() => pending.delete(provider)))
    return pending.get(provider)
  }
}
