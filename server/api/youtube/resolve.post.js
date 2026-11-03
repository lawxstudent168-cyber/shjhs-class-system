import { parseYouTubePlaylistFeed, parseYouTubePlaylistHtml, youtubePlaylistId, youtubeVideoId } from '../../utils/youtubePlaylist.js'

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try { return await fetch(url, { ...options, signal: controller.signal }) }
  finally { clearTimeout(timer) }
}

export default defineEventHandler(async event => {
  const body = await readBody(event)
  const input = String(body?.url || '').trim()
  const playlistId = youtubePlaylistId(input)
  const videoId = youtubeVideoId(input)
  if (!playlistId && !videoId) throw createError({ statusCode: 400, statusMessage: '請輸入有效的 YouTube 影片或播放清單網址' })

  if (playlistId) {
    let items = []
    let pageHtml = ''
    try {
      const response = await fetchWithTimeout(`https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}&hl=zh-TW`, {
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; ClassSchedule/1.0)', 'accept-language': 'zh-TW,zh;q=0.9,en;q=0.7' }
      })
      if (response.ok) { pageHtml = await response.text(); items = parseYouTubePlaylistHtml(pageHtml) }
    } catch {}
    if (!items.length) {
      try {
        const embed = await fetchWithTimeout(`https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(playlistId)}&hl=zh-TW`, {
          headers: { 'user-agent': 'Mozilla/5.0 (compatible; ClassSchedule/1.0)', 'accept-language': 'zh-TW,zh;q=0.9,en;q=0.7' }
        })
        if (embed.ok) { const embedHtml = await embed.text(); pageHtml ||= embedHtml; items = parseYouTubePlaylistHtml(embedHtml) }
      } catch {}
    }
    if (!items.length && pageHtml) {
      const apiKey = pageHtml.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/)?.[1]
      const clientVersion = pageHtml.match(/"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"]+)"/)?.[1]
      if (apiKey && clientVersion) {
        try {
          const browse = await fetchWithTimeout(`https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion, hl: 'zh-TW' } }, browseId: `VL${playlistId}` })
          })
          if (browse.ok) items = parseYouTubePlaylistHtml(await browse.text())
        } catch {}
      }
    }
    if (!items.length) {
      try {
        const feed = await fetchWithTimeout(`https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`)
        if (feed.ok) items = parseYouTubePlaylistFeed(await feed.text())
      } catch {}
    }
    if (!items.length) throw createError({ statusCode: 422, statusMessage: '播放清單沒有公開影片，或清單設為私人' })
    return { type: 'playlist', playlistId, count: items.length, items }
  }

  const url = `https://www.youtube.com/watch?v=${videoId}`
  let title = `YouTube 影片 ${videoId}`
  try {
    const response = await fetchWithTimeout(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
    if (response.ok) title = String((await response.json())?.title || title).replace(/\s+/g, ' ').trim().slice(0, 200)
  } catch {}
  return { type: 'video', count: 1, items: [{ url, title }] }
})
