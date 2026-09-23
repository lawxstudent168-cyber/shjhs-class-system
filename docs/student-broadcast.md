# 學生手機廣播（第一版）

功能：導師在「廣播」管理頁的獨立區塊核准學生專用裝置，選取目前收聽的單一裝置，發送最多 200 字文字與短提示音。不是麥克風直播，也不會朗讀文字、推播系統通知或在背景播放。既有教室廣播維持獨立。

## 部署

1. 在與個人首頁相同的 Supabase 專案執行 `supabase/migrations/202609230001_student_broadcast.sql`。新增一張表，不改既有學生資料。RLS 開啟且撤銷 anon/authenticated 權限；不要為此表新增公開 policy。
2. Vercel 設定以下 **伺服器端**環境變數，重新部署：
   - `NUXT_PERSONAL_HOME_SECRET`：沿用個人首頁的至少 32 字元隨機金鑰。
   - `NUXT_STUDENT_BROADCAST_ADMIN_KEY`：另外產生至少 32 字元隨機金鑰，僅提供導師；不是既有前端管理密碼。
   - `NUXT_STUDENT_BROADCAST_SUPABASE_URL`：同一 Supabase 的 HTTPS project URL。
   - `NUXT_STUDENT_BROADCAST_SERVICE_KEY`：該專案的 server secret 或 service_role key。此金鑰具有資料庫特權，僅存 Vercel 伺服器環境；不可放在 `NUXT_PUBLIC_*`、Git 或網頁輸入欄。
3. 先在測試部署用測試學生及專用手機驗收，再正式啟用。不要把正式 service key 提供給不可信的預覽分支。

多個 Vercel 使用同一 Supabase 時，會共用裝置清單；不同網域的 cookie 分離，學生在另一網域必須重新申請裝置。建議固定單一正式網域用於收聽，測試使用獨立 Supabase。

## 操作

1. 學生在 `/personal` 完成學生身分驗證，點「學生手機廣播」。家長不顯示此入口；直接呼叫 API 也會拒絕家長身分。
2. 申請裝置，出示接收頁八碼核對碼。導師必須當面確認學生、手機與碼，勾選確認學生專用後核准。學生填寫的裝置名稱不可信，不能單看名稱核准。
3. 學生更新狀態並主動按「開始收聽」。音訊只在此操作建立，單次最多 15 分鐘，不會重新整理後自動恢復。
4. 導師輸入獨立管理金鑰更新清單，選取正在收聽的裝置發送。需更新清單才能看到剛開始收聽的裝置；伺服器在送出當下再檢查。
5. 停止按鈕、離開頁面、切背景、離線、登入或切换身分都會停止；同源其他分頁也會收到停止訊號。撤銷核准在下一次檢查生效，通常約 1 秒；網路延遲時最遲由 5 秒本地 watchdog 停止。短提示音本身最多 0.3 秒。

每秒輪詢會產生 Vercel/Supabase 請求用量。每則通知僅保存最新一則、5 秒內有效，不排隊不補播。送出成功只表示寫入符合条件的接收裝置，不是「已聽見」回條。管理頁金鑰僅存元件記憶體，鎖定／離開即清除。

## 保證範圍與驗收

系統可檢查帳號角色、已核准瀏覽器、目前登入 session 與收聽 lease，無法辨識手機實際擁有人或此刻持有人。家長若拿到學生已核准且開著接收頁的手機，仍可能聽見。因此「不能在家長手機發聲」依賴導師當面確認學生專用裝置，不能只靠學生帳號保證。這個新通道不會載入家長首頁的音訊，也不使用既有教室廣播資料。

實機驗收：iPhone Safari、Android Chrome 各測主動開始後收到文字／提示音；家長登入拒絕、未核准拒絕、停止途中、切背景、鎖屏、斷網、跨分頁登入家長／登出、撤銷、15 分鐘到期、重新進入不補播。手機靜音與浏览器音訊政策可能讓提示音聽不到，不能當作緊急廣播唯一管道。

參考：[MDN 自動播放限制](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)、[頁面可見性](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)。

本機驗證：`node --test tests/*.test.js`、`npm run build`、`node --test tests/personalHome.integration.mjs tests/studentBroadcast.integration.mjs`。整合測試只使用本機假資料庫，沒有對正式 Supabase 發送或寫入。
