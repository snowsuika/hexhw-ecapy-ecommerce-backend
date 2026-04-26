---
paths:
  - "src/routes/**"
  - "app.js"
---

# API 設計規則

- 所有 API 回應必須使用統一格式：`{ data, error, message }`，成功時 `error: null`，失敗時 `data: null`
- HTTP 狀態碼：成功 200/201，資源建立 201，驗證失敗 400，未認證 401，權限不足 403，不存在 404，衝突 409
- 路由命名使用 kebab-case（例：`/api/admin/orders`），不使用 camelCase 或 snake_case
- Request body 欄位使用 camelCase（`productId`），DB 欄位與 response 欄位使用 snake_case（`product_id`）
- 每個路由 handler 前必須加 `@openapi` JSDoc 註解，供 `npm run openapi` 產生文件
- 分頁查詢參數統一為 `page`（預設 1）和 `limit`（預設 10，最大 100），回傳 `{ items, pagination: { total, page, limit, totalPages } }`
- 錯誤訊息不得洩漏內部實作細節（stack trace、SQL 語句、資料庫欄位名稱）
- 401 錯誤不區分「帳號不存在」vs「密碼錯誤」，統一回傳相同訊息，防止帳號枚舉攻擊
