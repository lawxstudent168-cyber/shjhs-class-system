import { broadcastStop } from '../utils/broadcastStop.js'
export default defineNuxtPlugin(nuxtApp => {
  // Opening another page in this origin stops any existing receiver tab.
  nuxtApp.hook('page:finish', () => {
    if (window.location.pathname !== '/student-broadcast') broadcastStop()
  })
})
