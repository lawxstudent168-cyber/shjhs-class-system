<template>
  <section class="news-card" :class="`${provider}-news-card`">
    <header><h3>{{ source.icon }} {{ source.name }} 焦點頭條</h3></header>
    <div v-if="isLoading" class="status" role="status">⏳ 正在取得 {{ source.name }} 最新頭條…</div>
    <div v-else-if="!newsData" class="status" role="status">
      暫時無法取得新聞，請稍後重試。
      <button type="button" @click="fetchNews">重新載入</button>
      <a :href="source.home" target="_blank" rel="noopener noreferrer">前往 {{ source.name }}</a>
    </div>
    <div v-else class="news-layout-wrapper">
      <p v-if="newsData.stale" class="notice" role="status">目前顯示上次成功取得的新聞，更新暫時延遲。</p>
      <a :href="newsData.link" target="_blank" rel="noopener noreferrer" class="news-link" :title="`前往 ${source.name} 閱讀新聞`">
        <div v-if="newsData.image && !imageFailed" class="news-image-wrapper">
          <img :src="newsData.image" :alt="newsData.title" class="news-image" loading="lazy" @error="imageFailed = true" />
        </div>
        <div class="news-title-box"><p class="news-title">{{ newsData.title }}</p></div>
      </a>
      <p v-if="newsData.aggregated" class="notice">{{ source.name }} 新聞（Google 新聞彙整）</p>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
const props = defineProps({ provider: { type: String, required: true } })
const source = {
  abc: { name: 'ABC News', icon: '⬛', home: 'https://abcnews.go.com/' },
  fox: { name: 'Fox News', icon: '🦊', home: 'https://www.foxnews.com/' },
  cnn: { name: 'CNN News', icon: '🟥', home: 'https://edition.cnn.com/' }
}[props.provider]
const isLoading = ref(true)
const newsData = ref(null)
const imageFailed = ref(false)
let controller
const fetchNews = async () => {
  controller?.abort()
  controller = new AbortController()
  const request = controller
  const timeout = setTimeout(() => request.abort(), 20_000)
  isLoading.value = true
  try {
    const response = await fetch(`/api/news/${props.provider}`, { signal: request.signal })
    if (!response.ok) throw new Error('News request failed')
    const data = await response.json()
    if (!data.title || !data.link) throw new Error('No headline')
    newsData.value = data
    imageFailed.value = false
  } catch { newsData.value = null }
  finally { clearTimeout(timeout); isLoading.value = false }
}
onMounted(fetchNews)
onBeforeUnmount(() => controller?.abort())
</script>

<style scoped>
.news-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,.05); border: 1px solid #e2e8f0; margin-top: 20px; }
header { border-bottom: 2px dashed #e2e8f0; padding-bottom: 10px; margin-bottom: 15px; }
h3 { margin: 0; color: #003366; font-size: 1.25rem; }
.abc-news-card h3 { color: black; }
.news-layout-wrapper { width: 66.66%; margin: 0 auto; }
.news-link { display: block; text-decoration: none; overflow: hidden; border-radius: 8px; background: #f8fafc; box-shadow: 0 2px 8px rgba(0,0,0,.15); }
.news-link:hover { box-shadow: 0 8px 16px rgba(0,0,0,.2); }
.news-image-wrapper { width: 100%; aspect-ratio: 16 / 9; overflow: hidden; background: #e2e8f0; }
.news-image { width: 100%; height: 100%; object-fit: cover; display: block; }
.news-title-box { padding: 15px 20px; background: white; border-top: 4px solid #c00; }
.abc-news-card .news-title-box { border-color: #3b82f6; }
.news-title { color: #1e293b; font-size: 1.2rem; font-weight: bold; line-height: 1.5; margin: 0; }
.status { text-align: center; padding: 30px; color: #64748b; background: #f8fafc; border-radius: 6px; line-height: 2; }
.status button, .status a { margin: 0 8px; }
.status button { cursor: pointer; padding: 4px 12px; border: 1px solid #94a3b8; border-radius: 5px; background: white; }
.notice { color: #64748b; font-size: .85rem; line-height: 1.5; }
@media (max-width: 768px) { .news-layout-wrapper { width: 100%; } }
</style>
