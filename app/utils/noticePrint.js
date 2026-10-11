export const removePrintUrls = (value) => String(value ?? '')
  .replace(/(?:https?:\/\/|www\.)[^\s<>"']+/giu, '')
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
