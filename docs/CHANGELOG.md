# Changelog

## [Unreleased]

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
