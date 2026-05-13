# Changelog / 更新日誌

## v1.1.0 (2026-05-14)

### ✨ New Features / 新功能

**EN:**
- Added Arknights daily sign-in support
- Added install welcome page and update summary page
- Popup now shows separate sign-in status for Endfield and Arknights
- Added sign-in site toggles for Endfield and Arknights
- Welcome page now lets users set the daily sign-in time; skipping uses 00:10

**中文:**
- 新增明日方舟每日簽到支援
- 新增安裝歡迎頁與更新摘要頁
- Popup 現在會分別顯示 Endfield 與明日方舟的簽到狀態
- 新增 Endfield 與明日方舟簽到網站開關
- 歡迎頁現在可設定每日簽到時間；略過時使用 00:10

### 🐛 Bug Fixes / 錯誤修復

**EN:**
- Fixed duplicate sign-in tab openings caused by race conditions between startup checks and alarm triggers
- Added auto-check dedup protection with execution lock and short attempt window to prevent repeated openings
- Improved background-mode reliability: when opening a tab fails, fallback to creating a window for sign-in flow
- Improved background tab tracking so successful automated sign-in tabs close more reliably
- Kept existing Endfield sign-in date records by migrating them into the new per-game status format

**中文:**
- 修復啟動檢查與鬧鐘觸發競態條件造成重複開啟簽到頁的問題
- 新增自動檢查防重機制（執行鎖與短時間嘗試去重），避免短時間內重複開頁
- 改善背景模式可靠性：當分頁建立失敗時，改以建立視窗作為簽到流程備援
- 改善背景分頁追蹤，讓自動簽到成功後更可靠地關閉分頁
- 保留既有 Endfield 簽到日期紀錄，並遷移到新的分遊戲狀態格式

---

## v1.0.6 (2026-03-17)

### 🐛 Bug Fixes / 錯誤修復

**EN:**
- Fixed duplicate sign-in tab openings caused by race conditions between startup checks and alarm triggers
- Added auto-check dedup protection with execution lock and short attempt window to prevent repeated openings
- Improved background-mode reliability: when opening a tab fails (no browser window), fallback to creating a window for sign-in flow

**中文:**
- 修復啟動檢查與鬧鐘觸發競態條件造成重複開啟簽到頁的問題
- 新增自動檢查防重機制（執行鎖與短時間嘗試去重），避免短時間內重複開頁
- 改善背景模式可靠性：當無視窗導致分頁建立失敗時，改以建立視窗作為簽到流程備援

---

## v1.0.5 (2026-02-08)

### 🐛 Bug Fixes / 錯誤修復

**EN:**
- Fixed sign-in detection logic that incorrectly reported "already signed in" even when the current day was not yet checked in
- The issue was caused by detecting `#completed-overlay` globally (which exists on all past days), instead of checking the current day's status
- Now uses `#lottie-container` presence to accurately identify the current unchecked day

**中文:**
- 修復簽到檢測邏輯錯誤判斷「今日已簽到」的問題
- 原因是全局檢測 `#completed-overlay`（所有已簽到的日期都有此元素），而非正確檢查當天狀態
- 現在使用 `#lottie-container` 的存在與否來準確識別當天待簽到的項目

### ✨ New Features / 新功能

**EN:**
- Added informational text in popup explaining background execution behavior
- Added Chrome background apps permission instructions
- Added GitHub repository link in popup footer

**中文:**
- 在彈出視窗中新增背景執行說明文字
- 新增 Chrome 背景應用程式權限設定指引
- 在彈出視窗底部新增 GitHub 連結

### 📝 UI Improvements / 介面改進

**EN:**
- Improved popup layout with dedicated info section
- Added version number display in footer

**中文:**
- 改進彈出視窗布局，新增專屬資訊區塊
- 在底部顯示版本號

---

## v1.0.4 and earlier

See GitHub commit history for previous changes.
