import { createNewsService, isNewsProvider } from '../../utils/newsHeadlines.js'

const getHeadline = createNewsService({
  onFailure: (provider, failures) => console.warn('[news] All sources failed', { provider, failures })
})

export default defineEventHandler(async event => {
  const provider = getRouterParam(event, 'provider')
  if (!isNewsProvider(provider)) throw createError({ statusCode: 404, statusMessage: 'Unknown news provider' })
  try {
    const headline = await getHeadline(provider)
    setHeader(event, 'Cache-Control', headline.stale ? 'no-store' : 'public, max-age=60, s-maxage=300')
    return headline
  } catch {
    setHeader(event, 'Cache-Control', 'no-store')
    throw createError({ statusCode: 503, statusMessage: 'News temporarily unavailable' })
  }
})
