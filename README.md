# SOBER HR Portal v1.0

可直接部署至 GitHub Pages 的靜態網站，包含首頁 Dashboard、公告查詢、薪資調整文件、本月新增判斷與 RWD。

## 資料更新

- 公告資料：編輯 `data/announcements.json`。
- 薪資調整資料：編輯 `data/salary-files.json`。
- 公告附件：放入 `docs/announcements/公告字號/`。
- 薪資附件：放入 `docs/salary/年-月/人員資料夾/`。

JSON 日期一律使用 `YYYY-MM-DD`。當日期與使用者裝置的目前年月相同，首頁會顯示「本月新增 X 件」；沒有資料時顯示「無新增」。

## GitHub Pages

將本資料夾內所有內容上傳至 `hr-portal` Repository 的 `main` 分支根目錄。Repository 的 Settings → Pages 選擇 Deploy from a branch、main、/(root)。

正式網址：`https://hr001hr002-cyber-256.github.io/hr-portal/`

## 重要提醒

GitHub Pages 公開 Repository 內的檔案可被取得。正式上傳薪資調整文件前，請確認符合公司的個資與資訊安全政策；若文件含個人薪資，建議改用有權限控管的 SharePoint、OneDrive 或私人系統，網站只保留經授權的文件連結。
