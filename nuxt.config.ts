// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/supabase'],
  runtimeConfig: {
    // Server-only. Configure NUXT_PERSONAL_HOME_SECRET in Vercel.
    personalHomeSecret: '',
    teacherLoginPassword: '',
    studentBroadcastSupabaseUrl: '',
    studentBroadcastServiceKey: ''
  },
  
  // supabase 模組的設定，告訴它不要強制所有頁面都要登入才能看
  supabase: {
    redirect: false 
  }
})
