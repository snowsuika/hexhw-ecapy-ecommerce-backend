---
# 全域規則，無 paths 限制
---

# 安全性規則

- 所有 SQL 查詢使用 parameterized query，禁止字串拼接（SQL Injection 防護）
- 密碼必須使用 bcrypt hash 儲存（`bcrypt.hashSync`），salt rounds 正式環境為 10，測試環境可降為 1
- 禁止在回應中回傳 `password_hash` 欄位
- JWT 必須使用 `{ algorithms: ['HS256'] }` 指定演算法（防止 algorithm confusion attack）
- JWT Secret 必須從環境變數 `JWT_SECRET` 讀取，不得 hardcode
- `.env` 檔案禁止 commit 到 git
- CORS 來源限制為 `FRONTEND_URL` 環境變數（預設 `http://localhost:3001`），不使用 `origin: '*'`
- EJS 模板使用 `<%= %>` 輸出用戶資料（自動 escape），禁止使用 `<%- %>` 輸出未信任資料
- Admin 路由必須同時套用 `authMiddleware`（驗證 token）和 `adminMiddleware`（驗證 role），順序不可互換
- 錯誤訊息不洩漏 stack trace 或 SQL 內容（`errorHandler` 僅回傳安全訊息）
- 輸入驗證在路由 handler 中進行，不信任任何來自 `req.body`、`req.params`、`req.query` 的資料
