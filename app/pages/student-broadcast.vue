<template>
  <main class="receiver">
    <NuxtLink to="/personal">← 個人首頁</NuxtLink>
    <h1>學生廣播</h1>
    <p>完成一次學生身分驗證後，這個瀏覽器開著本網站時會自動接收文字廣播，不需申請裝置或等待核准。</p>
    <p>離線時的未讀訊息會保留 24 小時，下次開啟網站時自動補收。右下角廣播面板可查看訊息與標記已讀。</p>
    <p role="status">{{ notice }}</p>
    <NuxtLink v-if="!bound" to="/personal?verify=student">驗證學生身分並綁定此瀏覽器</NuxtLink>
    <p>文字不需要啟用聲音；需要提示音時，在廣播面板按一次「啟用新通知提示音」。離線補收不會補播提示音。</p>
    <p>綁定的是目前瀏覽器，不代表手機所有權。家長請使用家長身分；共用設備使用完畢請解除綁定或登出。</p>
  </main>
</template>
<script setup>
import { ref, onMounted } from 'vue'
useHead({ title: '學生廣播', meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
const bound = ref(false), notice = ref('正在檢查瀏覽器綁定…')
onMounted(async () => {
  try {
    const result = await $fetch('/api/personal-home/broadcast', { method: 'POST', body: { action: 'inbox' }, retry: 0 })
    bound.value = true
    notice.value = `目前接收身分：${result.student.seat_number} 號 ${result.student.real_name}。文字廣播會自動接收。`
  } catch { notice.value = '此瀏覽器尚未綁定，或綁定已失效。請以學生身分驗證一次。' }
})
</script>
<style scoped>
.receiver { max-width: 640px; margin: 32px auto; padding: 24px 24px 260px; color: #183b35; font: 16px/1.8 system-ui,sans-serif; }
h1 { font-size: 28px; } a { color: #17654f; }
</style>
