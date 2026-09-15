# 花店電商後端

以 Express 4 + SQLite 實作的花卉商品購物平台後端，提供完整的 RESTful API 及 EJS 伺服器渲染頁面。

## 技術棧

| 類別 | 技術 |
|------|------|
| Runtime | Node.js |
| Web 框架 | Express ~4.16.1 |
| 模板引擎 | EJS 5.0 |
| 資料庫 | SQLite（better-sqlite3 12.x） |
| 認證 | JWT（jsonwebtoken 9.x）+ Session Header |
| 密碼雜湊 | bcrypt 6.x |
| CSS | Tailwind CSS 4.x |
| 測試 | Vitest 2.x + supertest |
| ID 生成 | uuid v4 |

## 快速開始

```bash
# 1. 安裝依賴
npm install

# 2. 建立 .env（必填 JWT_SECRET）
cp .env.example .env
# 編輯 .env，至少設定 JWT_SECRET

# 3. 啟動開發伺服器
npm run dev:server

# 4. 另開 terminal，啟動 CSS watch（前端開發時）
npm run dev:css
```

Server 預設在 `http://localhost:3001` 啟動。

## 常用指令

| 指令 | 說明 |
|------|------|
| `npm start` | 建置 CSS + 啟動正式環境 server |
| `npm run dev:server` | 開發用：僅啟動 server |
| `npm run dev:css` | 開發用：Tailwind watch mode |
| `npm run css:build` | 建置並 minify CSS |
| `npm run openapi` | 產生 `openapi.json`（swagger-jsdoc） |
| `npm test` | 執行所有測試（循序） |
| `npm run test:unit` | 執行所有測試，含 `test/shipping.test.js` 運費單元測試 |

## 文件索引

| 文件 | 說明 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 系統架構、目錄結構、API 路由總覽、資料庫 schema |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 開發規範、命名規則、環境變數、新增模組的步驟 |
| [FEATURES.md](./FEATURES.md) | 功能列表與詳細行為描述 |
| [TESTING.md](./TESTING.md) | 測試規範、執行順序、輔助函式說明 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本更新日誌 |
