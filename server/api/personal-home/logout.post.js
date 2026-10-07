import { privateResponse, checkPersonalRequest, clearPersonalSession } from '../../utils/personalHomeHttp.js'
import { forgetBroadcastBrowser } from '../../utils/studentBroadcast.js'
export default defineEventHandler(async event => {
  privateResponse(event)
  checkPersonalRequest(event)
  clearPersonalSession(event)
  try { await forgetBroadcastBrowser(event, useRuntimeConfig(event)) } catch {}
  return { success: true }
})
