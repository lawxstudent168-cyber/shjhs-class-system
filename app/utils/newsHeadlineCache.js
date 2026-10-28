const hosts = { abc: 'abcnews.go.com', fox: 'foxnews.com', cnn: 'cnn.com' }
const maxAge = 24 * 3600_000
const key = provider => `class-news-headline-v1:${provider}`

export function validNewsHeadline(value, provider) {
  if (!Object.hasOwn(hosts, provider) || typeof value?.title !== 'string' || !value.title.trim() || value.title.length > 1000) return false
  try {
    const url = new URL(value.link)
    if (url.protocol !== 'https:' || url.username || url.password) return false
    return url.hostname === hosts[provider] || url.hostname.endsWith(`.${hosts[provider]}`) || (value.aggregated === true && url.hostname === 'news.google.com')
  } catch { return false }
}

export function readNewsHeadline(storage, provider, now = Date.now()) {
  try {
    const value = JSON.parse(storage.getItem(key(provider)))
    const fetchedAt = Date.parse(value?.fetchedAt)
    if (!validNewsHeadline(value, provider) || !Number.isFinite(fetchedAt) || now - fetchedAt >= maxAge || fetchedAt > now) return null
    return { ...value, stale: true }
  } catch { return null }
}

export function writeNewsHeadline(storage, provider, value) {
  try {
    if (!validNewsHeadline(value, provider) || value.stale) return
    storage.setItem(key(provider), JSON.stringify(value))
  } catch { /* Storage can be unavailable in private browsing or when full. */ }
}
