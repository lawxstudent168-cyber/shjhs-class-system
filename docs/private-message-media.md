# 私訊圖片與影片

家長與學生在既有私訊頁面可上傳圖片或影片；只有導師登入後可修改附件說明、替換原檔或刪除任一附件。家長／學生上傳後無修改或刪除入口，伺服器也拒絕這兩類操作。附件依學生與家長／學生對話頻道分隔，與原有文字私訊並排顯示。

## 儲存方式

附件不放進 GitHub 儲存庫。原檔存在同一個 Supabase 專案的私有 Storage bucket `private-message-media`，資料庫 `private_message_media` 只存所屬學生、對話頻道、檔案路徑及說明。匿名／一般角色沒有直接讀寫資料表或私有 bucket 的權限。網頁只有在伺服器核對個人首頁或導師登入後，才取得限時讀取網址。影片直接從瀏覽器上傳到 Storage，不經 Vercel 函式傳送檔案內容。

## 部署

1. 在共用 Supabase 專案的 SQL Editor 執行 `supabase/migrations/202610070001_private_message_media.sql` 一次。若同一專案已執行過，勿重跑。
2. 在 Supabase **Storage** 新增 bucket，名稱精確填入 `private-message-media`，設為 **Private**，單檔上限 50 MB，允許的 MIME 類型為 `image/jpeg`、`image/png`、`image/webp`、`image/gif`、`video/mp4`、`video/webm`、`video/quicktime`。專案的 Storage 全域單檔上限也須至少 50 MB。不要新增對 anon/authenticated 開放讀寫的 Storage policy。若 bucket 已存在，核對上述設定即可；不要刪除既有物件。
3. 此分支沿用 PR #7 的 `NUXT_PERSONAL_HOME_SECRET`、`NUXT_STUDENT_BROADCAST_SUPABASE_URL`、`NUXT_STUDENT_BROADCAST_SERVICE_KEY`。後者是既有伺服器端 service key，絕不可設成 `NUXT_PUBLIC_*` 或放入前端程式。
4. 家長／學生先於 `/personal` 完成個人驗證，再開啟私訊。舊私訊頁面的簡易驗證可繼續傳文字，但**不能**單靠它取得附件權限。家長切換孩子時，只能查看已在個人首頁驗證過的孩子附件。

圖片允許 JPEG、PNG、WebP、GIF，最多 20 MB；影片允許 MP4、WebM、MOV，最多 50 MB。來源檔案仍受 Supabase 專案本身的 Storage 上限約束。上傳授權 15 分鐘內須完成，讀取網址有效 15 分鐘。請勿將限時網址分享給其他人。

目前附件與既有文字訊息是同一對話中的兩個區塊；附件不會寫入舊 `private_messages` 表，因此舊的文字未讀數與郵件提醒不計入附件。舊文字私訊沿用原有資料表權限，本功能未改造其存取政策。
