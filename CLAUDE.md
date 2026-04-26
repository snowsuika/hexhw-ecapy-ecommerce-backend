# CLAUDE.md

## 專案概述

花店電商後端 — Express 4 + SQLite (better-sqlite3) + EJS 模板，提供花卉商品購物平台的完整後端服務，含會員系統、購物車（支援訪客與登入雙模式）、訂單管理及管理員後台。

## 常用指令

```bash
npm start          # 建置 CSS + 啟動 server（Port 3001）
npm run dev:server # 僅啟動 server（不重建 CSS）
npm run dev:css    # Tailwind watch mode（另開 terminal）
npm run css:build  # 建置並 minify CSS
npm run openapi    # 產生 OpenAPI spec（swagger-jsdoc）
npm test           # 執行所有測試（vitest run，循序執行）
```

## 關鍵規則

- 所有 API 回應格式固定為 `{ data, error, message }`，不得偏離
- 購物車路由使用雙模式認證（JWT Bearer token 或 `X-Session-Id` header），其他 API 路由僅接受 JWT
- 訂單建立必須使用 `db.transaction()`，確保扣庫存、建立 order_items、清空購物車的原子性
- 刪除商品前必須檢查是否有 `pending` 狀態訂單，有則回傳 409
- 功能開發使用 `docs/plans/` 記錄計畫；完成後移至 `docs/plans/archive/`

## 詳細文件

- `./docs/README.md` — 項目介紹與快速開始
- `./docs/ARCHITECTURE.md` — 架構、目錄結構、資料流
- `./docs/DEVELOPMENT.md` — 開發規範、命名規則、環境變數
- `./docs/FEATURES.md` — 功能列表與行為描述
- `./docs/TESTING.md` — 測試規範與指南
- `./docs/CHANGELOG.md` — 更新日誌

## 必要遵守項目

- 啟動前必須設定 `JWT_SECRET` 環境變數，缺少時 server 會直接 `process.exit(1)`
- 資料庫 schema 變更必須手動修改 `src/database.js` 的 `initializeDatabase()`，目前無 migration 機制
- Admin 帳號由 seed 產生（預設 `admin@hexschool.com` / `12345678`），可透過 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 環境變數覆寫
- 測試使用同一份 SQLite 資料庫，順序依賴 `vitest.config.js` 中定義的 `sequence.files`，不可任意調整
