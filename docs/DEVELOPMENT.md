# 開發規範

## 命名規則

| 項目 | 規則 | 範例 |
|------|------|------|
| 路由檔案 | camelCase + Routes | `cartRoutes.js` |
| Middleware 檔案 | camelCase + Middleware | `authMiddleware.js` |
| DB 欄位 | snake_case | `password_hash`、`created_at` |
| API request body 欄位 | camelCase | `productId`、`recipientName` |
| API response / DB 回傳欄位 | snake_case | `product_id`、`order_no` |
| 環境變數 | SCREAMING_SNAKE_CASE | `JWT_SECRET` |
| 訂單編號 | `ORD-YYYYMMDD-XXXXX` | `ORD-20260426-A3F9B` |

> Request body 用 camelCase，DB 欄位與 response 用 snake_case，兩者不混用。

## 模組系統

專案使用 **CommonJS**（`require`/`module.exports`）。`vitest.config.js` 使用 ES Module（`import`），為唯一例外。不要在 `.js` 檔案中混用 `import`/`export`。

## 新增 API 路由的步驟

1. 在 `src/routes/` 新增路由檔（參考現有檔案結構）
2. 在路由 handler 上方加 `@openapi` JSDoc 註解（供 `npm run openapi` 使用）
3. 在 `app.js` 中以 `app.use('/api/...', require('./src/routes/...'))` 掛載
4. 所有回應使用統一格式：`res.json({ data, error: null, message })`

## 新增 Middleware 的步驟

1. 在 `src/middleware/` 新增檔案，export 單一 function
2. 全域 middleware 在 `app.js` 以 `app.use()` 掛載
3. 路由級 middleware 直接在路由定義中使用（例：`router.use(authMiddleware, adminMiddleware)`）

## 資料庫 Schema 變更

目前無 migration 工具，schema 變更直接修改 `src/database.js` 的 `initializeDatabase()` 函式。

**注意：** `CREATE TABLE IF NOT EXISTS` 不會修改已存在的 schema，若需變更欄位，必須手動刪除 `database.sqlite` 重新初始化（僅限開發環境）。

## 環境變數

| 變數 | 用途 | 必要 | 預設值 |
|------|------|------|------|
| `JWT_SECRET` | JWT 簽名密鑰 | **必填** | 無（缺少時 server 拒絕啟動） |
| `PORT` | Server 監聽 port | 否 | `3001` |
| `ADMIN_EMAIL` | Seed admin 帳號 email | 否 | `admin@hexschool.com` |
| `ADMIN_PASSWORD` | Seed admin 帳號密碼 | 否 | `12345678` |
| `FRONTEND_URL` | CORS 允許來源 | 否 | `http://localhost:3001` |
| `NODE_ENV` | 環境識別 | 否 | 無（`test` 時 bcrypt saltRounds=1） |

## JSDoc 格式（OpenAPI）

路由 handler 使用 `@openapi` 標籤，格式遵循 OpenAPI 3.0：

```javascript
/**
 * @openapi
 * /api/example:
 *   get:
 *     summary: 摘要說明
 *     tags: [TagName]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 */
```

## 計畫歸檔流程

1. 功能開發前，在 `docs/plans/` 建立計畫文件，命名格式：`YYYY-MM-DD-<feature-name>.md`
2. 計畫文件結構：User Story → Spec → Tasks
3. 功能完成後：將計畫移至 `docs/plans/archive/`
4. 更新 `docs/FEATURES.md` 的功能狀態與描述
5. 在 `docs/CHANGELOG.md` 新增版本記錄
