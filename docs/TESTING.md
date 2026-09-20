# 測試規範

## 測試框架

| 層級 | 工具 | 設定檔 | 資料庫 |
|------|------|--------|--------|
| Unit | Vitest 2.x（純函式，不經 HTTP／DB） | `vitest.config.js` | 不使用 |
| Integration | Vitest 2.x + supertest | `vitest.config.js` | 記憶體 SQLite（`DB_PATH=:memory:`） |
| E2E | Playwright | `playwright.config.js` | 已啟動 server 的 `database.sqlite`（會真實新增訂單） |

- Vitest 測試直接打 Express app，不 mock 資料庫（使用真實 SQLite 引擎，但為記憶體資料庫）
- Vitest 預設 `isolate: true`：**每個測試檔各自取得一個全新的記憶體 DB**（啟動時自動建表與 seed），執行 unit / integration 測試**不會修改** `database.sqlite`

## 測試檔案

| 檔案 | 說明 | 依賴 |
|------|------|------|
| `tests/unit/shipping.test.js` | Shipping 模組單元測試（直接 require `src/utils/shipping.js`，不經 API／DB） | 無 |
| `tests/setup.js` | 輔助函式（getAdminToken、registerUser） | 無 |
| `tests/integration/auth.test.js` | 註冊、登入、個人資料 | 無 |
| `tests/integration/products.test.js` | 商品列表、詳情 | 需有商品資料（seed） |
| `tests/integration/cart.test.js` | 購物車 CRUD，含雙模式認證 | 需有商品資料 |
| `tests/integration/orders.test.js` | 訂單建立、列表、詳情、付款 | 需有購物車商品 |
| `tests/integration/adminProducts.test.js` | 後台商品 CRUD | 需 admin token |
| `tests/integration/adminOrders.test.js` | 後台訂單列表、詳情 | 需有訂單資料 |
| `tests/integration/order-flow.test.js` | 會員 → 購物車 → 建立含配送資訊的訂單，驗證 DB 寫入、庫存、購物車與失敗 rollback | 需有商品資料（seed） |
| `e2e/checkout-payment.spec.js` | 登入 → 加入購物車 → 結帳 → 綠界網路 ATM（土地銀行）付款 → 驗證已付款 | 需 server 已啟動 |

## 執行順序與依賴

`fileParallelism: false`：測試檔一次只跑一個，不並行。這是為了避免多個檔案同時操作各自的記憶體資料庫時互相干擾執行時間與輸出。

- **檔案之間沒有順序依賴**：`npx vitest run --sequence.shuffle.files` 打亂檔案順序後仍全數通過
- **單一檔案內部有順序依賴**：同一個 `describe` 內的測試會沿用前面建立的 token 與資料，`npx vitest run --sequence.shuffle.tests` 會失敗。新增測試時請維持檔案內的先後關係

## 執行測試

```bash
npm test                  # test:unit + test:integration
npm run test:unit         # tests/unit/（純函式測試）
npm run test:integration  # tests/integration/（走 API 與資料庫）
npm run test:e2e          # Playwright E2E（需先啟動 server）
npm run postman           # 重新產生 openapi.json 並轉換為 Postman Collection
```

兩個指令共用 `vitest.config.js`，差別只在指令行傳入的測試路徑，因此兩組測試互不重複。

### Integration Test 情境

| 情境 | 驗證重點 |
|------|----------|
| 宅配、小計 < 1,500 | 201 與回應格式、`orders` 寫入（配送欄位、運費 120、總額）、`order_items` 價格快照、庫存扣除、購物車清空 |
| 宅配 + 偏遠 + 急件、小計 ≥ 1,500 | 基本運費免除、附加費 450 照收、總額、庫存、購物車 |
| 庫存不足 | 400 `STOCK_INSUFFICIENT`，不建立訂單、不扣庫存、購物車保留 |
| 交易中途失敗 | 以 `TEMP TRIGGER` 讓 `order_items` INSERT 失敗 → 500，驗證 `db.transaction()` 整批 rollback：無殘單、無孤兒品項、庫存不變、購物車保留 |
| 配送方式不合法 | 400 `VALIDATION_ERROR`，不寫入任何資料 |

測試檔於 `afterAll` 刪除自己建立的會員、訂單、品項與購物車，並還原庫存；記憶體 DB 在測試結束時亦會釋放。

### E2E Test 前置條件

1. 先啟動專案：`npm start`（E2E 不會另外啟動測試伺服器），`.env` 需設定綠界測試環境參數
2. 擇一提供瀏覽器：
   - **attach 既有 Chrome**：以 `--remote-debugging-port=9222` 啟動 Chrome，執行 `E2E_CDP_URL=http://127.0.0.1:9222 npm run test:e2e`（測試使用獨立 context，不影響既有分頁與登入狀態）
   - **Playwright 自帶 Chromium**：先執行 `npx playwright install chromium`，再執行 `npm run test:e2e`
3. 付款成功並返回站點後的截圖存於 `e2e/screenshots/paid-<訂單編號>.png`；失敗時的截圖與 trace 在 `test-results/`，HTML 報告在 `playwright-report/`（皆已 gitignore）

**注意：** E2E 會在 `database.sqlite` 真實新增訂單並扣除庫存；綠界頁面為第三方，選擇器集中於 spec 開頭的 `ECPAY` 常數，改版時只需修改該處。

**付款完成後的返回方式：**
- 專案 `src/utils/ecpay.js` 設定了 `OrderResultURL`、未設定 `ClientBackURL`。依[綠界文件](https://developers.ecpay.com.tw/?p=2862)，未設定 `ClientBackURL` 時付款完成頁不會顯示「返回商店」按鈕，且兩者同時設定時以 `OrderResultURL` 為主，因此按 `Save` 後綠界會直接把使用者導回 `/api/orders/:id/ecpay-return`，不會停留在綠界的付款成功頁。這是專案設定造成的，不是綠界 staging 的行為。
- 為了不更動既有付款流程，維持 `OrderResultURL`。spec 兩種情況都接受：出現「返回商店」就點擊，否則接受自動導回；實際路徑記錄在報告的 `ecpay-return` annotation（`auto-redirect` 或 `back-to-store-button`），目前實測皆為 `auto-redirect`。

**綠界 staging 與執行環境已知狀況：**
- 綠界 staging 偶爾回應逾時（例如 `pay-stage.ecpay.com.tw/Scripts/jquery-3.7.1.min.js` 回 504），頁面會停在「交易資料傳輸中」；屬第三方環境問題，稍後重跑即可。每次失敗都會留下一筆 `pending` 訂單。
- attach 模式下，若 Chrome 沒有任何開啟的視窗，`connectOverCDP` 可能出現 `Browser context management is not supported`，先在該 Chrome 開一個分頁再執行。

### Postman Collection

- 產生器：`scripts/generate-postman.js`（`openapi-to-postmanv2`），輸出 `postman/flower-shop.postman_collection.json`（已 gitignore，執行 `npm run postman` 即可重新產生）
- 所有請求使用 `{{baseUrl}}`（預設 `http://localhost:3001`），另有 `token`、`sessionId` 變數
- 登入／註冊成功後自動把 JWT 存入 `{{token}}`；需要登入的 API 繼承 collection 層級的 Bearer `{{token}}`
- 購物車請求附有停用中的 `X-Session-Id: {{sessionId}}` header，訪客模式時啟用

### GitHub Actions

Workflow：`.github/workflows/test.yml`

| 項目 | 設定 |
|------|------|
| 觸發條件 | push 到 `main`、對 `main` 開 Pull Request、在 Actions 頁手動執行（`workflow_dispatch`） |
| 執行環境 | `ubuntu-latest`、Node.js 24（`actions/setup-node` 快取 npm）、逾時 10 分鐘 |
| 步驟 | `npm ci` → **Unit Test**（`npm run test:unit`）→ **Integration Test**（`npm run test:integration`） |
| 重複執行 | `concurrency` 以分支為群組，同一分支有新的 push 時取消尚未完成的舊執行 |
| 權限 | `contents: read` |

- **`JWT_SECRET`**：CI 沒有 `.env`，由 workflow 的 `env` 提供測試用假值 `test-only-not-a-real-secret`。它只用來在記憶體資料庫中簽發短暫 token，不是正式金鑰；程式仍透過 `process.env.JWT_SECRET` 讀取。正式環境的金鑰不可寫入 workflow。
- **不在 CI 執行 E2E**：E2E 需要已啟動的 server、瀏覽器與綠界 staging 外部服務，且會寫入真實資料庫；CI 只跑不依賴外部服務的 unit 與 integration 測試。
- 任一步驟失敗時 workflow 即失敗，可在 Actions 頁點開該步驟查看 log。

### Shipping 單元測試涵蓋情境

宅配基本運費、超商取貨費用、小計 1,499、小計 1,500 免運、偏遠地區附加費、當日急件附加費、多項附加費同時成立、滿額免運與附加費同時成立；另含超商滿 1,500 不免運、非法配送方式與非法小計的防呆。


## 輔助函式（tests/setup.js）

```javascript
const { app, request, getAdminToken, registerUser } = require('../setup');
```

| 函式 | 說明 | 回傳 |
|------|------|------|
| `getAdminToken()` | 以 seed admin 帳號登入，取得 JWT | `Promise<string>` |
| `registerUser(overrides?)` | 註冊新測試帳號（email 自動唯一化） | `Promise<{ token, user }>` |

`overrides` 可傳 `{ email, password, name }` 覆寫預設值。

## 撰寫新測試

1. 依測試性質選資料夾：只驗純函式放 `tests/unit/`，需要打 API 或碰資料庫放 `tests/integration/`
2. 檔名為 `xxx.test.js`，不需要登記到任何設定檔（指令直接掃該資料夾）
3. 使用 `tests/setup.js` 的輔助函式，避免重複實作 auth 流程
4. 確認測試不依賴其他測試檔的執行結果；同一檔案內部的先後關係則需自行維持

範例：

```javascript
const { app, request, registerUser } = require('../setup');

describe('My Feature', () => {
  let token;

  beforeAll(async () => {
    const { token: t } = await registerUser();
    token = t;
  });

  it('should do something', async () => {
    const res = await request(app)
      .get('/api/some-endpoint')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });
});
```

## 常見陷阱

- **bcrypt 速度：** `NODE_ENV=test` 時 seed 使用 `saltRounds=1`，但測試中 `registerUser` 呼叫 `/api/auth/register` 走正常流程（saltRounds=10）。若測試跑很慢，可在測試 `.env` 中設定 `NODE_ENV=test`。
- **每個測試檔的 DB 互相獨立：** 記憶體 DB 以檔案為單位重建，測試檔之間不能依賴彼此建立的資料，需要的資料請在該檔 `beforeAll` 自行建立。
- **不要在 vitest 以外的地方依賴 `DB_PATH=:memory:`：** 直接 `node server.js` 時未設定 `DB_PATH`，仍會使用 `database.sqlite`。
- **訂單建立需 user_id 購物車：** 訪客（session_id）購物車的商品**不能**直接建立訂單，需先登入後重新加入。
- **建立訂單必須帶 `shippingMethod`：** 缺少時回傳 400 VALIDATION_ERROR；測試中建單請帶 `shippingMethod: 'home_delivery'`。
