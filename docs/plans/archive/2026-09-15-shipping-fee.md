# 配送運費模組 + Unit Test

## User Story

身為消費者，我希望結帳時能選擇配送方式並看到正確的運費與總額，而且實際付款金額與畫面一致，以便清楚知道要付多少錢。

身為開發者，我希望運費規則封裝在可獨立測試的模組中，以便規則調整時只改一處並能用 Unit Test 確認正確。

## Spec

### 背景與現況

- 後端建單 `src/routes/orderRoutes.js` 只加總商品金額，**完全不收運費**
- 前端 `cart.ejs` / `checkout.ejs` 寫死「小計 ≥ 500 免運、否則 NT$ 150」，只做顯示、與後端不一致；因現有商品最低 580 元，畫面實際上永遠顯示「免運」
- 首頁、商品頁文案寫「滿 NT$ 500 免運」
- 基準：`npm test` 6 檔 32 條全過

### 運費規則（唯一來源 `src/utils/shipping.js`）

| 條件 | 金額 |
|---|---|
| 宅配 `home_delivery` 基本運費 | 120 |
| 超商取貨 `convenience_store` | 60（**不是**基本運費，滿額不免） |
| 商品小計 ≥ 1,500 且宅配 | 基本運費 → 0 |
| 偏遠地區 `isRemoteArea` | +200（任何配送方式，滿額照收） |
| 當日急件 `isExpress` | +250（任何配送方式，滿額照收） |

- 門檻判斷為 `subtotal >= 1500`（1,499 收費、1,500 免運）
- 偏遠、急件由消費者在結帳頁勾選，不解析地址

### 已確認決策

| 議題 | 決定 | 理由 |
|---|---|---|
| Unit Test 位置 | `test/shipping.test.js` | 與 `tests/` 的 API 測試分開；vitest 預設 include 會同時抓 `test/` 與 `tests/` |
| 缺少 `shippingMethod` | 必填，回 400 | 避免隱性預設收 120 元 |
| 前端運費來源 | 呼叫試算 API | 與建單共用 `calculateShipping()`，規則只維護一份 |

### 模組介面 `src/utils/shipping.js`

- CommonJS、零依賴（不碰 Express 與 SQLite）
- 常數：`SHIPPING_METHODS`、`SHIPPING_FEES`、`FREE_SHIPPING_THRESHOLD`
- `calculateShipping({ subtotal, shippingMethod, isRemoteArea = false, isExpress = false })`
  - 回傳 `{ base_fee, remote_area_fee, express_fee, shipping_fee, free_shipping_applied }`
  - `subtotal` 非「≥ 0 的整數」、`shippingMethod` 不在清單、旗標非 boolean → `throw`
- `validateShippingInput({ shippingMethod, isRemoteArea, isExpress })` → 錯誤訊息字串或 `null`，供路由回 400
- `formatOrderShipping(order)` → 將 DB 的 `is_remote_area` / `is_express`（0/1）轉為布林

### 資料庫

沿用既有 `migrateOrders()`（與 `ecpay_trade_no` 相同做法）以 `ALTER TABLE` 新增欄位，**不需刪 DB**：

| 欄位 | 型別與約束 | 說明 |
|---|---|---|
| `shipping_method` | `TEXT CHECK IN ('home_delivery','convenience_store')` | 舊訂單為 `NULL` |
| `is_remote_area` | `INTEGER NOT NULL DEFAULT 0` | API 回傳布林 |
| `is_express` | `INTEGER NOT NULL DEFAULT 0` | API 回傳布林 |
| `subtotal_amount` | `INTEGER` | 舊訂單以 `UPDATE ... SET subtotal_amount = total_amount` 補值 |
| `shipping_fee` | `INTEGER NOT NULL DEFAULT 0` | 運費 |

### API

**`POST /api/orders`（修改）**
- body 新增 `shippingMethod`（必填）、`isRemoteArea`、`isExpress`（選填 boolean，預設 `false`）
- 驗證順序：收件資訊 → Email 格式 → 配送資訊（不合法回 400 `VALIDATION_ERROR`）→ 購物車 → 庫存
- `subtotal_amount` = Σ（價格 × 數量）；`shipping_fee` = `calculateShipping()`；`total_amount` = 兩者相加
- INSERT 帶入新欄位，仍在既有 `db.transaction()` 內
- 回應新增 `subtotal_amount`、`shipping_method`、`is_remote_area`、`is_express`、`shipping_fee`

**`GET /api/orders/shipping-quote`（新增）**
- 需 JWT；宣告在 `GET /:id` 之前，避免 `shipping-quote` 被當成訂單 id
- query：`shippingMethod`（必填）、`isRemoteArea`、`isExpress`（字串 `'true'` / `'false'`，其他值回 400）
- 商品小計由後端依登入者購物車以 SQL `SUM` 計算，不信任前端金額
- 回傳 `{ subtotal_amount, base_fee, remote_area_fee, express_fee, shipping_fee, free_shipping_applied, total_amount }`

**其他回應轉布林**：`GET /api/orders/:id`、`PATCH /api/orders/:id/pay`、`GET /api/admin/orders`、`GET /api/admin/orders/:id`

**綠界**：`ecpay.js` 使用 `order.total_amount`，含運費後自動正確，不修改

### 前端

| 檔案 | 變更 |
|---|---|
| `views/pages/checkout.ejs`、`public/js/pages/checkout.js` | 新增配送方式 radio（宅配 / 超商）、偏遠地區與當日急件 checkbox；未選配送方式時前端擋下；選項變動時呼叫 `shipping-quote`（以 request id 忽略過期回應），摘要顯示商品小計、基本運費、附加費、運費合計、總計 |
| `views/pages/cart.ejs` | 提示改為距 1,500 宅配免運的差額；運費列顯示「結帳時依配送方式計算」；總計標示「未含運費」 |
| `views/pages/index.ejs`、`views/pages/product-detail.ejs` | 文案 500 → 1,500（宅配） |
| `views/pages/order-detail.ejs`、`views/pages/admin/orders.ejs` | 總計上方顯示商品小計、配送方式（含偏遠／急件）與運費 |

### Unit Test 情境（`test/shipping.test.js`）

| # | 情境 | 輸入 | 預期運費 |
|---|---|---|---|
| 1 | 宅配基本運費 | 宅配、1,000 | 120 |
| 2 | 超商取貨費用 | 超商、1,000 | 60 |
| 3 | 小計 1,499 | 宅配、1,499 | 120 |
| 4 | 小計 1,500 免運 | 宅配、1,500 | 0 |
| 5 | 偏遠地區附加費 | 宅配、1,000、偏遠 | 320 |
| 6 | 當日急件附加費 | 宅配、1,000、急件 | 370 |
| 7 | 多項附加費同時成立 | 宅配、1,000、偏遠 + 急件 | 570 |
| 8 | 滿額免運與附加費同時成立 | 宅配、1,500、偏遠 + 急件 | 450 |
| 補 | 超商滿額不免運 | 超商、1,500 | 60 |
| 補 | 非法配送方式、負數／小數／字串小計 | — | throw |
| 補 | `validateShippingInput` 合法、缺配送方式、非布林旗標 | — | `null` / 錯誤訊息 |

### 不在範圍

- `app.js` 既有未 commit 的 `/images` 改動
- 既有測試寫入真實 `database.sqlite` 的問題（另案處理）
- 購物車頁是否顯示預估運費（決定不調整）

### 實作與原計畫差異

- 依專案測試規範將 `test/shipping.test.js` 登記進 `vitest.config.js` 的 `sequence.files`（原計畫不動該檔；該選項在 vitest 2.1.9 的 `SequenceOptions` 中不存在，實際不生效）
- `formatOrderShipping()` 放在 `src/utils/shipping.js`，並額外套用到後台訂單列表 `GET /api/admin/orders`
- 購物車頁「總計（未含運費）」與商品小計數字相同，驗收後決定維持現狀

## Tasks

- [x] **Shipping 模組**：建立 `src/utils/shipping.js`
- [x] **DB migration**：`src/database.js` 的 `migrateOrders()` 新增 5 個欄位與舊訂單補值
- [x] **建單整合**：`src/routes/orderRoutes.js` 驗證配送資訊、計算運費、寫入新欄位、回應新增欄位
- [x] **試算 API**：新增 `GET /api/orders/shipping-quote`（含 `@openapi`）
- [x] **回應型別一致**：訂單詳情、付款、後台列表與詳情轉布林，更新各路由 `@openapi`
- [x] **結帳頁**：`checkout.ejs`、`checkout.js` 配送選項與運費明細
- [x] **其他頁面**：購物車、首頁、商品頁門檻文案；訂單詳情與後台詳情顯示運費
- [x] **CSS**：`npm run css:build`
- [x] **Unit Test**：`test/shipping.test.js` 共 14 條
- [x] **既有測試**：`tests/orders.test.js`、`tests/adminOrders.test.js` 建單 body 補 `shippingMethod: 'home_delivery'`，不改斷言
- [x] **指令**：`package.json` 新增 `test:unit`
- [x] **文件**：`docs/FEATURES.md`（運費規則、計算範例、試算端點）、`ARCHITECTURE.md`（目錄樹、API 總覽、orders schema）、`TESTING.md`、`README.md`、`CHANGELOG.md`、`CLAUDE.md`；`npm run openapi` 重新產生 `openapi.json`
- [x] **驗證－腳本**
  - `npm run test:unit`：7 檔 46 條全過（原 32 + Shipping 14），清單含原 6 支測試
  - `npm run openapi`：`openapi.json` 含 `/api/orders/shipping-quote`，建單 `required` 含 `shippingMethod`
  - API 冒煙測試（supertest）：迷你多肉 ×1 宅配試算 → 運費 120／總計 700；旗標非 `true`/`false` → 400；建單缺 `shippingMethod` → 400；`isExpress: 'true'`（字串）→ 400；超商 + 偏遠 → 運費 260／總計 840；詳情 `is_remote_area` 為 boolean
- [x] **驗證－瀏覽器（肉眼驗收）**：下表 5 組結果皆與預期一致，未選配送方式送出時前端有擋下

  | 購物車 | 結帳選項 | 預期運費 / 總計 |
  |---|---|---|
  | 迷你多肉 ×1（580） | 宅配 | 120 / 700 |
  | 迷你多肉 ×1（580） | 超商 | 60 / 640 |
  | 紫色鬱金香 ×2（1,500） | 宅配 | 0 / 1,500 |
  | 紫色鬱金香 ×2（1,500） | 宅配 + 偏遠 + 急件 | 450 / 1,950 |
  | 紫色鬱金香 ×2（1,500） | 超商 | 60 / 1,560 |

  每筆核對結帳頁、`POST /api/orders` 回應、訂單詳情頁、後台詳情四處一致；未選配送方式送出應顯示「請選擇配送方式」
- [x] **收尾**：`git status` 確認無 `database.sqlite*` 與備份檔被加入
