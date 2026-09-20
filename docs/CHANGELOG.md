# Changelog

## [Unreleased]

### Added

- `src/utils/shipping.js`：配送運費計算模組（宅配 120、超商 60、小計滿 1,500 免宅配基本運費、偏遠地區 +200、當日急件 +250）
- `GET /api/orders/shipping-quote`：依登入者購物車試算運費與訂單總額
- `orders` 表新增 `shipping_method`、`is_remote_area`、`is_express`、`subtotal_amount`、`shipping_fee` 欄位（自動 migration，舊訂單 `subtotal_amount` 補為 `total_amount`）
- 結帳頁新增配送方式、偏遠地區、當日急件選項與運費明細；訂單詳情與後台訂單詳情顯示運費
- `tests/unit/shipping.test.js`：Shipping 模組單元測試；`npm run test:unit` 指令
- `tests/integration/order-flow.test.js`：建單流程整合測試（配送費用、總額、DB 寫入、庫存扣除、購物車清空、失敗 rollback）；`npm run test:integration` 指令
- `e2e/checkout-payment.spec.js`：Playwright E2E，走完結帳與綠界網路 ATM（台灣土地銀行）付款並驗證 `paid`；`npm run test:e2e` 指令
- `scripts/generate-postman.js`：由 `openapi.json` 產生 Postman Collection（`{{baseUrl}}`、`token`、`sessionId` 變數、登入自動存 JWT）；`npm run postman` 指令
- 環境變數 `DB_PATH`（SQLite 路徑）、`E2E_CDP_URL`（E2E attach 既有 Chrome）、`E2E_BASE_URL`
- `.github/workflows/test.yml`：GitHub Actions 於 push／PR 到 `main` 或手動觸發時，依序執行 `npm run test:unit` 與 `npm run test:integration`（Node.js 24）

### Changed

- `POST /api/orders`：`shippingMethod` 改為必填，`total_amount` 改為商品小計 + 運費（綠界付款金額隨之包含運費）
- 訂單相關 API 的 `is_remote_area`、`is_express` 一律回傳布林值
- 購物車、首頁、商品頁移除舊的「滿 500 免運／運費 150」顯示，改為 1,500 宅配免運門檻
- Vitest 測試改用記憶體 SQLite（`DB_PATH=:memory:`），執行測試不再寫入 `database.sqlite`
- `npm test` 改為依序執行 `test:unit` 與 `test:integration`
- 測試改為依性質分層：`tests/unit/`（純函式）與 `tests/integration/`（走 API 與資料庫），原有 6 支 API 測試依實際性質歸入 integration
- 移除 `vitest.integration.config.js`，兩層共用 `vitest.config.js`，測試路徑改由指令行傳入
- 移除 `vitest.config.js` 無效的 `sequence.files` 設定（vitest 2.1.9 的 `sequence` 沒有此欄位，從未生效）

## [1.1.1] - 2026-04-26

### Fixed

- 修正 `POST /api/orders/:id/ecpay-return` 被 `router.use(authMiddleware)` 攔截導致 401 的問題，將該路由移至 authMiddleware 掛載之前

## [1.1.0] - 2026-04-26

### Added

- ECPay AIO 金流整合：以信用卡付款取代原模擬按鈕
- `src/utils/ecpay.js`：CheckMacValue 計算（處理 Node.js 與 PHP urlencode 差異）、QueryTradeInfo 查詢
- `POST /api/orders/:id/ecpay-form`：產生並回傳 auto-submit HTML 至綠界 AIO
- `POST /api/orders/:id/ecpay-return`：接收綠界瀏覽器回跳，redirect 至訂單詳情頁
- `POST /api/orders/:id/verify-payment`：主動查詢 QueryTradeInfo 確認付款結果（冪等）
- `orders` 表新增 `ecpay_trade_no` 欄位（自動 migration）

## [1.0.0] - 2026-04-26

### Added

- 會員系統：註冊、登入、個人資料（JWT HS256，7 天效期）
- 商品目錄：列表（分頁）、詳情
- 購物車：雙模式認證（JWT Bearer + X-Session-Id），支援訪客與登入用戶
- 訂單：建立（含 db.transaction 原子操作）、列表、詳情、模擬付款
- 後台商品管理：CRUD（含刪除保護：pending 訂單商品不可刪）
- 後台訂單管理：列表（可依 status 篩選）、詳情（含用戶資訊）
- EJS 前台頁面：首頁、商品詳情、購物車、結帳、登入、訂單列表、訂單詳情
- EJS 後台頁面：商品管理、訂單管理
- OpenAPI spec 產生（swagger-jsdoc）
- Vitest 整合測試（6 個測試檔，循序執行）
