import { privateResponse, checkPersonalRequest, clearPersonalSession } from '../../utils/personalHomeHttp.js'
export default defineEventHandler(event => {
  privateResponse(event)
  checkPersonalRequest(event)
  clearPersonalSession(event)
  return { success: true }
})
