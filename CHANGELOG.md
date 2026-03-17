# Changelog / 更新日誌

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
