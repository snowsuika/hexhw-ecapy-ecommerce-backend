---
paths:
  - "tests/**"
  - "vitest.config.js"
---

# 測試規則

- 測試框架為 Vitest + supertest，不使用 Jest
- 測試循序執行（`fileParallelism: false`），但檔案之間沒有順序依賴；單一檔案內部的測試有先後關係，新增時要維持
- 測試分兩層：純函式放 `tests/unit/`，走 API 與資料庫的放 `tests/integration/`。指令直接掃資料夾，新增檔案不需要登記到設定檔
- 禁止 mock 資料庫（`better-sqlite3`），所有測試必須操作真實 SQLite DB
- 共用輔助函式統一放在 `tests/setup.js`，測試檔案透過 `require('../setup')` 引入 `{ app, request, getAdminToken, registerUser }`
- `registerUser()` 的 email 預設包含 `Date.now()` 確保唯一性，不要 hardcode 固定 email（會導致第二次執行失敗）
- Admin 相關測試使用 `getAdminToken()` 取得 token，不要在測試中 hardcode 帳密
- 測試 assertion 使用 `expect(res.status).toBe(xxx)` 和 `expect(res.body.data).toBeDefined()`，優先驗證 HTTP 狀態碼和回應結構
- 執行測試使用 `npm test`（`vitest run`），不使用 `vitest --watch`
