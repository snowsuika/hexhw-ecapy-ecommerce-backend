# 功能列表

## 功能狀態總覽

| 功能模組 | 狀態 |
|----------|------|
| 會員系統（Auth） | ✅ 完成 |
| 商品目錄（Products） | ✅ 完成 |
| 購物車（Cart） | ✅ 完成 |
| 訂單（Orders） | ✅ 完成 |
| 後台商品管理（Admin Products） | ✅ 完成 |
| 後台訂單管理（Admin Orders） | ✅ 完成 |
| EJS 前台頁面 | ✅ 完成 |
| EJS 後台頁面 | ✅ 完成 |
| ECPay 金流整合 | ✅ 完成 |
| 配送運費（Shipping） | ✅ 完成 |

---

## 會員系統（Auth）

**路由前綴：** `/api/auth`

### 註冊 `POST /api/auth/register`

- **必填：** `email`（合法格式）、`password`（最少 6 字元）、`name`
- 若 email 已存在回傳 409 CONFLICT
- 成功回傳 `{ user: { id, email, name, role }, token }`，HTTP 201
- 同時回傳 JWT token，前端可直接登入無需再次呼叫 login

### 登入 `POST /api/auth/login`

- **必填：** `email`、`password`
- Email 或密碼錯誤統一回傳 401（不區分哪個錯，防止帳號枚舉）
- 成功回傳 `{ user: { id, email, name, role }, token }`

### 個人資料 `GET /api/auth/profile`

- 需要 Bearer token
- 從 DB 查詢最新資料回傳（不從 token payload 取，確保資料最新）

---

## 商品目錄（Products）

**路由前綴：** `/api/products`，無需認證

### 商品列表 `GET /api/products`

- **查詢參數：** `page`（預設 1）、`limit`（預設 10，最大 100，最小 1）
- 回傳 `{ products: [...], pagination: { total, page, limit, totalPages } }`
- 依 `created_at DESC` 排序

### 商品詳情 `GET /api/products/:id`

- 商品不存在回傳 404

---

## 購物車（Cart）

**路由前綴：** `/api/cart`  
**認證方式：** 雙模式（JWT Bearer token 或 `X-Session-Id` header 擇一）

購物車以 `user_id`（登入用戶）或 `session_id`（訪客）識別所有者，兩者在 DB 中各自獨立，不會互相影響。`dualAuth` middleware 的判斷邏輯詳見 [ARCHITECTURE.md](./ARCHITECTURE.md#dualauth購物車雙模式認證)。

### 查看購物車 `GET /api/cart`

- 回傳當前使用者/session 的所有購物車品項，含商品名稱、價格、庫存、圖片
- 回傳 `{ items: [...], total: <總金額整數> }`

### 加入購物車 `POST /api/cart`

- **必填：** `productId`、`quantity`（預設 1，必須為正整數）
- 若商品已在購物車中，**累加**數量（不是覆蓋）
- 加入或累加後若總數量超過庫存，回傳 400 STOCK_INSUFFICIENT
- 成功回傳 `{ id, product_id, quantity }`（最新數量）

### 修改數量 `PATCH /api/cart/:itemId`

- **必填：** `quantity`（正整數）
- 若目標數量超過庫存，回傳 400 STOCK_INSUFFICIENT
- 只能修改屬於自己（同一 user_id 或 session_id）的品項

### 移除品項 `DELETE /api/cart/:itemId`

- 只能移除屬於自己的品項，否則 404

---

## 訂單（Orders）

**路由前綴：** `/api/orders`  
**認證方式：** JWT 必填（訪客無法下訂）

### 建立訂單 `POST /api/orders`

- **必填：** `recipientName`、`recipientEmail`（合法格式）、`recipientAddress`、`shippingMethod`（`home_delivery` 或 `convenience_store`）
- **選填：** `isRemoteArea`、`isExpress`（布林值，預設 `false`；非布林值回傳 400）
- 配送資訊不合法回傳 400 VALIDATION_ERROR
- **前置條件：** 登入用戶的購物車（`user_id` 綁定）不能為空
- **金額計算（一律由後端重算，不信任前端金額）：**
  - `subtotal_amount` = Σ（商品價格 × 數量）
  - `shipping_fee` = `calculateShipping()` 的結果，規則見下方「配送運費」
  - `total_amount` = `subtotal_amount` + `shipping_fee`（綠界付款金額即此值）
- **原子操作（db.transaction）：**
  1. 建立 `orders` 記錄，寫入配送資訊、`subtotal_amount`、`shipping_fee`、`total_amount`
  2. 將購物車所有品項複製為 `order_items`（包含價格快照）
  3. 每件商品扣除對應庫存（`stock - quantity`）
  4. 清空該用戶的購物車（`DELETE FROM cart_items WHERE user_id = ?`）
- 訂單初始狀態為 `pending`
- 訂單編號格式：`ORD-YYYYMMDD-XXXXX`（XXXXX 為 UUID 前 5 碼大寫）
- 成功回傳 201，含訂單完整資訊（含 `subtotal_amount`、`shipping_method`、`is_remote_area`、`is_express`、`shipping_fee`）

### 運費試算 `GET /api/orders/shipping-quote`

- **查詢參數：** `shippingMethod`（必填）、`isRemoteArea`、`isExpress`（字串 `true` / `false`，預設 `false`）
- 商品小計由後端依登入者購物車計算，回傳 `{ subtotal_amount, base_fee, remote_area_fee, express_fee, shipping_fee, free_shipping_applied, total_amount }`
- 僅供結帳頁顯示；建立訂單時會重新計算
- 路由宣告在 `GET /:id` 之前，避免 `shipping-quote` 被當成訂單 id

### 訂單列表 `GET /api/orders`

- 回傳當前用戶的所有訂單，依 `created_at DESC` 排序

### 訂單詳情 `GET /api/orders/:id`

- 只能查看屬於自己的訂單，否則 404（不回傳 403，防止洩漏訂單存在資訊）

### 模擬付款 `PATCH /api/orders/:id/pay`

- **必填：** `action`（`"success"` 或 `"fail"`）
- 只能對 `pending` 狀態的訂單操作，否則 400 INVALID_STATUS
- `success` → 狀態改為 `paid`
- `fail` → 狀態改為 `failed`
- 不會回滾庫存（即付款失敗後庫存不會還原）

---

## 配送運費（Shipping）

**模組：** `src/utils/shipping.js`（純函式，不依賴 Express 與 SQLite，可獨立單元測試）

### 費率規則

| 配送條件 | 費用 |
|----------|------|
| 宅配基本運費（`home_delivery`） | 120 元 |
| 超商取貨（`convenience_store`） | 60 元 |
| 商品小計滿 1,500 元 | 免宅配基本運費 |
| 偏遠地區（`isRemoteArea`） | 加收 200 元 |
| 當日急件（`isExpress`） | 加收 250 元 |

- **滿額免運只免「宅配基本運費」**：超商取貨費不是基本運費，滿 1,500 仍收 60 元
- 偏遠地區與當日急件附加費**不受滿額免運影響**，可同時成立
- 門檻判斷為 `subtotal >= 1500`（1,499 收費、1,500 免運）

### 計算範例

| 商品小計 | 配送方式 | 偏遠 | 急件 | 運費 |
|----------|----------|------|------|------|
| 1,000 | 宅配 | | | 120 |
| 1,000 | 超商 | | | 60 |
| 1,499 | 宅配 | | | 120 |
| 1,500 | 宅配 | | | 0 |
| 1,000 | 宅配 | ✓ | | 320 |
| 1,000 | 宅配 | | ✓ | 370 |
| 1,000 | 宅配 | ✓ | ✓ | 570 |
| 1,500 | 宅配 | ✓ | ✓ | 450 |
| 1,500 | 超商 | | | 60 |

### 匯出函式

| 函式 | 說明 |
|------|------|
| `calculateShipping({ subtotal, shippingMethod, isRemoteArea, isExpress })` | 回傳 `{ base_fee, remote_area_fee, express_fee, shipping_fee, free_shipping_applied }`；輸入不合法時 throw |
| `validateShippingInput({ shippingMethod, isRemoteArea, isExpress })` | 回傳錯誤訊息字串或 `null`，供路由回傳 400 |
| `formatOrderShipping(order)` | 將 DB 的 `is_remote_area` / `is_express`（0/1）轉為布林值 |

### 前端

- 結帳頁（`/checkout`）選擇配送方式、偏遠地區、當日急件，變更時呼叫 `shipping-quote` 顯示運費明細與總計
- 購物車頁（`/cart`）僅顯示距離 1,500 宅配免運門檻的差額，運費於結帳時計算
- 訂單詳情頁與後台訂單詳情顯示商品小計、配送方式與運費
- 舊訂單（功能上線前建立）`shipping_method` 為 `null`、`shipping_fee` 為 0、`subtotal_amount` 等於 `total_amount`

---

## 後台商品管理（Admin Products）

**路由前綴：** `/api/admin/products`  
**認證方式：** JWT + role === 'admin'

### 後台商品列表 `GET /api/admin/products`

- 與前台列表相同資料，含分頁（`page`、`limit`）

### 新增商品 `POST /api/admin/products`

- **必填：** `name`、`price`（正整數）、`stock`（非負整數）
- **選填：** `description`、`image_url`
- 成功回傳 201 含完整商品資料

### 編輯商品 `PUT /api/admin/products/:id`

- 支援部分更新（只傳要改的欄位）
- 未傳的欄位保持原值（server 端合併）
- 更新時自動設定 `updated_at = datetime('now')`

### 刪除商品 `DELETE /api/admin/products/:id`

- 若商品存在於任何 `pending` 狀態的 `order_items` 中，回傳 409 CONFLICT
- 已付款（`paid`）或失敗（`failed`）訂單的商品可以刪除

---

## 後台訂單管理（Admin Orders）

**路由前綴：** `/api/admin/orders`  
**認證方式：** JWT + role === 'admin'

### 後台訂單列表 `GET /api/admin/orders`

- **查詢參數：** `page`（預設 1）、`limit`（預設 10）、`status`（`pending`/`paid`/`failed`，選填）
- 可依狀態篩選，未傳 `status` 回傳所有訂單

### 後台訂單詳情 `GET /api/admin/orders/:id`

- 可查看任何用戶的訂單（不受 user_id 限制）
- 回傳資料額外包含 `user: { name, email }`

---

## EJS 頁面路由

| 路徑 | Layout | pageScript | 說明 |
|------|--------|------------|------|
| `GET /` | front | index | 首頁 |
| `GET /products/:id` | front | product-detail | 商品詳情 |
| `GET /cart` | front | cart | 購物車 |
| `GET /checkout` | front | checkout | 結帳 |
| `GET /login` | front | login | 登入 |
| `GET /orders` | front | orders | 我的訂單 |
| `GET /orders/:id` | front | order-detail | 訂單詳情（含 `?payment=` 查詢參數） |
| `GET /admin/products` | admin | admin-products | 後台商品管理 |
| `GET /admin/orders` | admin | admin-orders | 後台訂單管理 |

頁面路由以 `renderFront` / `renderAdmin` helper 進行兩段式渲染（先渲染頁面片段，再嵌入 layout）。`pageScript` 對應 `public/js/` 下的 JS 檔名，由 layout template 動態載入。

---

## ECPay 金流整合

由於專案運行於 localhost，無法接收 ECPay Server Notify，改採本地端主動查詢模式。

### 付款端點

| 方法 | 端點 | 認證 | 說明 |
|------|------|------|------|
| `POST` | `/api/orders/:id/ecpay-form` | JWT | 回傳 auto-submit HTML，瀏覽器自動 POST 至綠界 AIO |
| `POST` | `/api/orders/:id/ecpay-return` | 無 | 接收綠界瀏覽器回跳（OrderResultURL），redirect 至訂單詳情頁 |
| `POST` | `/api/orders/:id/verify-payment` | JWT | 呼叫 QueryTradeInfo 查詢，依結果更新訂單狀態 |

### 付款流程

1. 訂單詳情頁（`status=pending`）顯示「前往綠界付款」按鈕
2. 前端 fetch `POST /api/orders/:id/ecpay-form`（帶 JWT）→ 取得 HTML → `document.write` 觸發自動提交
3. 用戶在綠界 staging 完成信用卡付款（測試卡：`4311-9522-2222-2222`，到期 `49/12`，CVV `222`）
4. 綠界 redirect 瀏覽器回 `/api/orders/:id/ecpay-return` → Server redirect → `/orders/:id?payment=ecpay`
5. 前端偵測 `?payment=ecpay` → 自動呼叫 `POST /api/orders/:id/verify-payment`
6. Server 呼叫 QueryTradeInfo：`TradeStatus=1` → `paid`；其他 → `failed`

### DB 欄位

`orders` 表新增 `ecpay_trade_no TEXT`（儲存綠界交易號，初始為 NULL）。

### 環境變數

```
ECPAY_MERCHANT_ID=3002607
ECPAY_HASH_KEY=pwFHCqoQZGmho4w6
ECPAY_HASH_IV=EkRm7iFT261dpevs
ECPAY_ENV=staging
BASE_URL=http://localhost:3001
```
