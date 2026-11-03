const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'])

export function youtubeVideoId(url) {
  try {
    const parsed = new URL(String(url || '').trim())
    if (!YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase())) return null
    const id = parsed.hostname.toLowerCase() === 'youtu.be' ? parsed.pathname.slice(1).split('/')[0] : parsed.searchParams.get('v') || parsed.pathname.match(/^\/(?:embed|shorts)\/([^/?]+)/)?.[1]
    return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null
  } catch {
    return null
  }
}

export function youtubePlaylistId(url) {
  try {
    const parsed = new URL(String(url || '').trim())
    if (!YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase()) || parsed.hostname.toLowerCase() === 'youtu.be') return null
    const id = parsed.searchParams.get('list') || ''
    return /^[A-Za-z0-9_-]{10,80}$/.test(id) ? id : null
  } catch {
    return null
  }
}

const rendererObjects = html => {
  const marker = '"playlistVideoRenderer":'
  const objects = []
  let cursor = 0
  while ((cursor = html.indexOf(marker, cursor)) !== -1) {
    const start = html.indexOf('{', cursor + marker.length)
    if (start === -1) break
    let depth = 0
    let quoted = false
    let escaped = false
    for (let index = start; index < html.length; index++) {
      const char = html[index]
      if (quoted) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === '"') quoted = false
        continue
      }
      if (char === '"') quoted = true
      else if (char === '{') depth++
      else if (char === '}' && --depth === 0) {
        objects.push(html.slice(start, index + 1))
        cursor = index + 1
        break
      }
    }
    if (cursor <= start) break
  }
  return objects
}

export function parseYouTubePlaylistHtml(html) {
  const items = []
  const seen = new Set()
  for (const text of rendererObjects(String(html || ''))) {
    try {
      const renderer = JSON.parse(text)
      const id = renderer.videoId
      const title = renderer.title?.runs?.map(run => run.text || '').join('') || renderer.title?.simpleText || ''
      if (!/^[A-Za-z0-9_-]{11}$/.test(id || '') || seen.has(id)) continue
      seen.add(id)
      items.push({ url: `https://www.youtube.com/watch?v=${id}`, title: String(title).replace(/\s+/g, ' ').trim().slice(0, 200) || `YouTube 影片 ${id}` })
    } catch {}
  }
  return items
}

const decodeXml = value => String(value || '')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

export function parseYouTubePlaylistFeed(xml) {
  const items = []
  const seen = new Set()
  for (const match of String(xml || '').matchAll(/<entry\b[\s\S]*?<\/entry>/g)) {
    const entry = match[0]
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]?.trim()
    const title = decodeXml(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]).replace(/\s+/g, ' ').trim()
    if (!/^[A-Za-z0-9_-]{11}$/.test(id || '') || seen.has(id)) continue
    seen.add(id)
    items.push({ url: `https://www.youtube.com/watch?v=${id}`, title: title.slice(0, 200) || `YouTube 影片 ${id}` })
  }
  return items
}
