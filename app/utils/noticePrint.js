export const removePrintUrls = (value) => String(value ?? '')
  .replace(/(?:https?:\/\/|www\.)[^\s<>"'，。；！？、（）「」『』]+/giu, '')
  .replace(/[ \t]+(?=\n|$)/gm, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

export const escapePrintHtml = (value) => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character])

export const normalizePrintQrCodes = (value, legacyUrl = '') => {
  if (Array.isArray(value)) return value.map(item => ({
    name: String(item?.name ?? ''), url: String(item?.url ?? '')
  }))
  return legacyUrl ? [{ name: '手機掃描查看', url: String(legacyUrl) }] : []
}

export const isPrintQrUrl = (value) => {
  try {
    const url = new URL(String(value ?? '').trim())
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname)
  } catch { return false }
}

export const extractPrintUrls = (value) => {
  const source = String(value ?? '').replace(/&amp;/gi, '&')
  const matches = source.match(/(?:https?:\/\/|www\.)[^\s<>"'，。；！？、（）「」『』]+/giu) || []
  return [...new Set(matches.map(match => {
    const cleaned = match.replace(/[.,;!?，。；！？、)）]+$/u, '')
    return /^www\./i.test(cleaned) ? `https://${cleaned}` : cleaned
  }).filter(isPrintQrUrl))]
}

export const collectPrintQrSources = (notices, template = '') => {
  const sources = new Map()
  const add = (url, title = '') => {
    if (!isPrintQrUrl(url)) return
    const normalized = String(url).trim()
    const existing = sources.get(normalized)
    if (!existing || (!existing.suggestedName && title)) {
      sources.set(normalized, { url: normalized, suggestedName: String(title).trim() })
    }
  }
  for (const notice of notices || []) {
    const content = String(notice?.content ?? '')
    for (const match of content.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/giu)) {
      const title = match[2].replace(/<[^>]*>/g, '').trim()
      for (const url of extractPrintUrls(match[1])) add(url, title)
    }
    for (const url of extractPrintUrls(content)) add(url)
    for (const link of notice?.links || []) {
      for (const url of extractPrintUrls(link?.url)) add(url, link?.title)
    }
  }
  for (const url of extractPrintUrls(template)) add(url)
  return [...sources.values()]
}
