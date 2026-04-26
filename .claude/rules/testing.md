---
paths:
  - "tests/**"
  - "vitest.config.js"
---

# 測試規則

- 測試框架為 Vitest + supertest，不使用 Jest
- 測試必須循序執行（`fileParallelism: false`），順序固定為：auth → products → cart → orders → adminProducts → adminOrders
- 新增測試檔案後，必須加入 `vitest.config.js` 的 `sequence.files` 陣列，並放在正確位置
- 禁止 mock 資料庫（`better-sqlite3`），所有測試必須操作真實 SQLite DB
- 共用輔助函式統一放在 `tests/setup.js`，測試檔案透過 `require('./setup')` 引入 `{ app, request, getAdminToken, registerUser }`
- `registerUser()` 的 email 預設包含 `Date.now()` 確保唯一性，不要 hardcode 固定 email（會導致第二次執行失敗）
- Admin 相關測試使用 `getAdminToken()` 取得 token，不要在測試中 hardcode 帳密
- 測試 assertion 使用 `expect(res.status).toBe(xxx)` 和 `expect(res.body.data).toBeDefined()`，優先驗證 HTTP 狀態碼和回應結構
- 執行測試使用 `npm test`（`vitest run`），不使用 `vitest --watch`
