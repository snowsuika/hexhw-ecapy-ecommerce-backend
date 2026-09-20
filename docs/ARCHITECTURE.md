# 架構文件

## 目錄結構

```
.
├── .github/
│   └── workflows/
│       └── test.yml        # GitHub Actions：push／PR 到 main 時執行 unit 與 integration 測試
├── app.js                  # Express app 設定（middleware、路由掛載）
├── server.js               # 進入點，監聽 PORT，啟動前驗證 JWT_SECRET
├── generate-openapi.js     # 產生 openapi.json 的腳本
├── swagger-config.js       # swagger-jsdoc 設定
├── vitest.config.js        # Vitest 共用設定（記憶體 DB；測試路徑由指令行傳入）
├── playwright.config.js    # E2E 測試設定（使用已啟動的 server）
├── public/
│   ├── css/
│   │   ├── input.css       # Tailwind 來源
│   │   └── output.css      # 編譯後（git ignored 建議）
│   └── js/                 # 前端 JS（各頁面對應一支）
├── views/
│   ├── layouts/
│   │   ├── front.ejs       # 前台 layout（含 navbar、footer）
│   │   └── admin.ejs       # 後台 layout（含側邊欄）
│   ├── pages/
│   │   ├── index.ejs       # 首頁
│   │   ├── product-detail.ejs
│   │   ├── cart.ejs
│   │   ├── checkout.ejs
│   │   ├── login.ejs
│   │   ├── orders.ejs
│   │   ├── order-detail.ejs
│   │   ├── 404.ejs
│   │   └── admin/
│   │       ├── products.ejs
│   │       └── orders.ejs
│   └── partials/           # 共用片段（navbar、footer 等）
├── src/
│   ├── database.js         # DB 初始化、schema 定義、seed 資料
│   ├── middleware/
│   │   ├── authMiddleware.js    # JWT 驗證（Bearer token）
│   │   ├── adminMiddleware.js   # role === 'admin' 檢查
│   │   ├── sessionMiddleware.js # X-Session-Id header 注入 req.sessionId
│   │   └── errorHandler.js     # 全域錯誤處理（避免洩漏內部訊息）
│   ├── utils/
│   │   ├── ecpay.js             # 綠界 CheckMacValue、AIO 參數、QueryTradeInfo
│   │   └── shipping.js          # 配送運費計算（純函式）
│   └── routes/
│       ├── authRoutes.js        # /api/auth
│       ├── productRoutes.js     # /api/products
│       ├── cartRoutes.js        # /api/cart（雙模式認證）
│       ├── orderRoutes.js       # /api/orders
│       ├── adminProductRoutes.js # /api/admin/products
│       ├── adminOrderRoutes.js  # /api/admin/orders
│       └── pageRoutes.js        # EJS 頁面路由
├── scripts/
│   └── generate-postman.js # openapi.json → Postman Collection（輸出至 postman/，git ignored）
├── e2e/
│   ├── fixtures.js         # 瀏覽器來源（E2E_CDP_URL attach 或 Playwright Chromium）
│   └── checkout-payment.spec.js # 結帳 + 綠界網路 ATM 付款 E2E
└── tests/
    ├── setup.js            # 測試輔助函式（getAdminToken、registerUser）
    ├── unit/
    │   └── shipping.test.js    # Shipping 模組單元測試（不經 API／DB）
    └── integration/            # 走 API 與記憶體資料庫
        ├── auth.test.js
        ├── products.test.js
        ├── cart.test.js
        ├── orders.test.js
        ├── adminProducts.test.js
        ├── adminOrders.test.js
        └── order-flow.test.js  # 建單流程整合測試（DB 寫入、庫存、rollback）
```

## 啟動流程

1. `server.js` 啟動，確認 `JWT_SECRET` 已設定
2. `require('./app')` 觸發 `app.js`
3. `app.js` 執行 `require('./src/database')` — 初始化 DB、建表、seed admin 帳號與商品
4. 掛載 middleware（cors、json parser、urlencoded、sessionMiddleware）
5. 掛載所有 API 路由、頁面路由
6. 掛載 404 handler 和 errorHandler
7. `app.listen(PORT)` 開始接受請求

## API 路由總覽

| 前綴 | 檔案 | 認證 | 說明 |
|------|------|------|------|
| `POST /api/auth/register` | authRoutes.js | 無 | 註冊 |
| `POST /api/auth/login` | authRoutes.js | 無 | 登入 |
| `GET /api/auth/profile` | authRoutes.js | JWT | 個人資料 |
| `GET /api/products` | productRoutes.js | 無 | 商品列表（分頁） |
| `GET /api/products/:id` | productRoutes.js | 無 | 商品詳情 |
| `GET /api/cart` | cartRoutes.js | JWT 或 Session | 購物車內容 |
| `POST /api/cart` | cartRoutes.js | JWT 或 Session | 加入購物車 |
| `PATCH /api/cart/:itemId` | cartRoutes.js | JWT 或 Session | 修改數量 |
| `DELETE /api/cart/:itemId` | cartRoutes.js | JWT 或 Session | 移除品項 |
| `POST /api/orders` | orderRoutes.js | JWT | 建立訂單（含運費計算） |
| `GET /api/orders/shipping-quote` | orderRoutes.js | JWT | 依購物車試算運費與總額 |
| `GET /api/orders` | orderRoutes.js | JWT | 我的訂單列表 |
| `GET /api/orders/:id` | orderRoutes.js | JWT | 訂單詳情 |
| `PATCH /api/orders/:id/pay` | orderRoutes.js | JWT | 模擬付款 |
| `GET /api/admin/products` | adminProductRoutes.js | JWT + Admin | 後台商品列表 |
| `POST /api/admin/products` | adminProductRoutes.js | JWT + Admin | 新增商品 |
| `PUT /api/admin/products/:id` | adminProductRoutes.js | JWT + Admin | 編輯商品 |
| `DELETE /api/admin/products/:id` | adminProductRoutes.js | JWT + Admin | 刪除商品 |
| `GET /api/admin/orders` | adminOrderRoutes.js | JWT + Admin | 後台訂單列表 |
| `GET /api/admin/orders/:id` | adminOrderRoutes.js | JWT + Admin | 後台訂單詳情 |

## 統一回應格式

所有 API 回應均遵循以下結構：

```json
{
  "data": { ... } | null,
  "error": "ERROR_CODE" | null,
  "message": "說明文字"
}
```

錯誤碼一覽：

| 錯誤碼 | HTTP 狀態 | 說明 |
|--------|-----------|------|
| `VALIDATION_ERROR` | 400 | 輸入格式錯誤 |
| `CART_EMPTY` | 400 | 購物車為空 |
| `STOCK_INSUFFICIENT` | 400 | 庫存不足 |
| `INVALID_STATUS` | 400 | 訂單狀態不允許此操作 |
| `UNAUTHORIZED` | 401 | 未登入或 token 無效 |
| `FORBIDDEN` | 403 | 權限不足（非 admin） |
| `NOT_FOUND` | 404 | 資源不存在 |
| `CONFLICT` | 409 | 資源衝突（Email 重複、商品有 pending 訂單） |
| `INTERNAL_ERROR` | 500 | 伺服器內部錯誤 |

## 認證與授權機制

### authMiddleware（標準 JWT 認證）

用於 `/api/auth/profile`、`/api/orders`、`/api/admin/*`。

1. 從 `Authorization: Bearer <token>` 取得 token
2. 使用 `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })` 驗證
3. 驗證 `decoded.userId` 在 DB 中存在（防止 token 有效但帳號已刪除）
4. 將 `{ userId, email, role }` 注入 `req.user`

### adminMiddleware

接在 authMiddleware 之後，檢查 `req.user.role === 'admin'`，否則回傳 403。

### dualAuth（購物車雙模式認證）

用於 `/api/cart` 所有路由。

```
有 Authorization header?
  ├── 是 → 驗證 JWT → 成功：req.user 注入，以 user_id 識別購物車
  │                → 失敗（token 無效）：立即 401，不 fallback
  └── 否 → 有 req.sessionId（來自 X-Session-Id header）?
              ├── 是 → 繼續，以 session_id 識別購物車
              └── 否 → 401
```

**重要：** 若有 Authorization header 但 token 無效，不會 fallback 到 session，直接回傳 401。

### sessionMiddleware

全域掛載，從 `X-Session-Id` header 取值注入 `req.sessionId`。無 header 時 `req.sessionId` 為 `undefined`。

### JWT 規格

- 演算法：HS256
- Payload：`{ userId, email, role }`
- 有效期：7 天
- Secret：環境變數 `JWT_SECRET`

## 資料庫 Schema

### users

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PK | UUID v4 |
| email | TEXT | UNIQUE NOT NULL | 登入帳號 |
| password_hash | TEXT | NOT NULL | bcrypt hash |
| name | TEXT | NOT NULL | 顯示名稱 |
| role | TEXT | NOT NULL, DEFAULT 'user', CHECK IN ('user','admin') | 角色 |
| created_at | TEXT | DEFAULT datetime('now') | 建立時間 |

### products

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PK | UUID v4 |
| name | TEXT | NOT NULL | 商品名稱 |
| description | TEXT | - | 商品描述 |
| price | INTEGER | NOT NULL, CHECK > 0 | 售價（新台幣整數） |
| stock | INTEGER | NOT NULL, DEFAULT 0, CHECK >= 0 | 庫存數量 |
| image_url | TEXT | - | 商品圖片 URL |
| created_at | TEXT | DEFAULT datetime('now') | 建立時間 |
| updated_at | TEXT | DEFAULT datetime('now') | 更新時間（PUT 時手動更新） |

### cart_items

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PK | UUID v4 |
| session_id | TEXT | - | 訪客 session（與 user_id 擇一） |
| user_id | TEXT | FK users.id | 登入用戶（與 session_id 擇一） |
| product_id | TEXT | NOT NULL, FK products.id | 商品 ID |
| quantity | INTEGER | NOT NULL, DEFAULT 1, CHECK > 0 | 數量 |

### orders

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PK | UUID v4 |
| order_no | TEXT | UNIQUE NOT NULL | 格式：ORD-YYYYMMDD-XXXXX |
| user_id | TEXT | NOT NULL, FK users.id | 下訂用戶 |
| recipient_name | TEXT | NOT NULL | 收件人姓名 |
| recipient_email | TEXT | NOT NULL | 收件人 Email |
| recipient_address | TEXT | NOT NULL | 收件地址 |
| shipping_method | TEXT | CHECK IN ('home_delivery','convenience_store') | 配送方式（舊訂單為 NULL） |
| is_remote_area | INTEGER | NOT NULL, DEFAULT 0 | 偏遠地區（0/1，API 回傳布林） |
| is_express | INTEGER | NOT NULL, DEFAULT 0 | 當日急件（0/1，API 回傳布林） |
| subtotal_amount | INTEGER | | 商品小計（舊訂單 migration 時補為 total_amount） |
| shipping_fee | INTEGER | NOT NULL, DEFAULT 0 | 運費 |
| total_amount | INTEGER | NOT NULL | 訂單總金額 = subtotal_amount + shipping_fee（新台幣整數） |
| ecpay_trade_no | TEXT | | 綠界交易編號 |
| status | TEXT | NOT NULL, DEFAULT 'pending', CHECK IN ('pending','paid','failed') | 狀態 |
| created_at | TEXT | DEFAULT datetime('now') | 建立時間 |

### order_items

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PK | UUID v4 |
| order_id | TEXT | NOT NULL, FK orders.id | 所屬訂單 |
| product_id | TEXT | NOT NULL, FK products.id | 商品 ID（快照，商品刪除後仍保留） |
| product_name | TEXT | NOT NULL | 商品名稱快照 |
| product_price | INTEGER | NOT NULL | 下訂時的價格快照 |
| quantity | INTEGER | NOT NULL | 數量 |

## 資料庫設定

- WAL mode（`PRAGMA journal_mode = WAL`）：提升並發讀取效能
- Foreign keys ON（`PRAGMA foreign_keys = ON`）：強制外鍵約束
- 檔案位置：`database.sqlite`（專案根目錄）
