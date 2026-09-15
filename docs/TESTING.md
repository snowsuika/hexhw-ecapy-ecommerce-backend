# 測試規範

## 測試框架

- **Vitest 2.x** + **supertest**（HTTP 整合測試）
- 測試直接打 Express app，不 mock 資料庫（使用真實 SQLite DB）
- 所有測試共用同一份 `database.sqlite`（測試環境不隔離 DB）

## 測試檔案

| 檔案 | 說明 | 依賴 |
|------|------|------|
| `test/shipping.test.js` | Shipping 模組單元測試（直接 require `src/utils/shipping.js`，不經 API／DB） | 無 |
| `tests/setup.js` | 輔助函式（getAdminToken、registerUser） | 無 |
| `tests/auth.test.js` | 註冊、登入、個人資料 | 無 |
| `tests/products.test.js` | 商品列表、詳情 | 需有商品資料（seed） |
| `tests/cart.test.js` | 購物車 CRUD，含雙模式認證 | 需有商品資料 |
| `tests/orders.test.js` | 訂單建立、列表、詳情、付款 | 需有購物車商品 |
| `tests/adminProducts.test.js` | 後台商品 CRUD | 需 admin token |
| `tests/adminOrders.test.js` | 後台訂單列表、詳情 | 需有訂單資料 |

## 執行順序與依賴

測試**必須循序執行**，順序固定於 `vitest.config.js`：

```
auth → products → cart → orders → adminProducts → adminOrders
```

- `fileParallelism: false` 確保不並行執行
- `orders` 測試依賴 `cart` 測試建立的購物車狀態
- `adminOrders` 測試依賴 `orders` 測試建立的訂單

**不要任意調整 `sequence.files` 的順序。**

## 執行測試

```bash
npm test           # 執行全部測試（vitest run）
npm run test:unit  # 同上：執行 test/ 與 tests/ 下所有測試（含 Shipping 單元測試）
```

`vitest run` 使用 Vitest 預設 include（`**/*.{test,spec}.?(c|m)[jt]s?(x)`），因此 `test/` 與 `tests/` 兩個資料夾都會被執行。

### Shipping 單元測試涵蓋情境

宅配基本運費、超商取貨費用、小計 1,499、小計 1,500 免運、偏遠地區附加費、當日急件附加費、多項附加費同時成立、滿額免運與附加費同時成立；另含超商滿 1,500 不免運、非法配送方式與非法小計的防呆。

Vitest 不支援 watch mode 與 `vitest.config.js` 中的 `sequence.files` 同時使用，請一律用 `vitest run`（即 `npm test`）。

## 輔助函式（tests/setup.js）

```javascript
const { app, request, getAdminToken, registerUser } = require('./setup');
```

| 函式 | 說明 | 回傳 |
|------|------|------|
| `getAdminToken()` | 以 seed admin 帳號登入，取得 JWT | `Promise<string>` |
| `registerUser(overrides?)` | 註冊新測試帳號（email 自動唯一化） | `Promise<{ token, user }>` |

`overrides` 可傳 `{ email, password, name }` 覆寫預設值。

## 撰寫新測試

1. 在 `tests/` 建立 `xxx.test.js`
2. 在 `vitest.config.js` 的 `sequence.files` 加入正確位置
3. 使用 `setup.js` 的輔助函式，避免重複實作 auth 流程
4. 確認測試不依賴外部 DB 狀態（或依賴的資料是更早的測試所建立的）

範例：

```javascript
const { app, request, registerUser } = require('./setup');

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
- **DB 狀態殘留：** 測試結束後 DB 不會自動清除，下次執行 `npm test` 時資料仍在。若 auth 測試的 email 唯一性驗證失敗，通常是因為前次測試殘留資料（`registerUser` 的 email 含 `Date.now()` 應不重複，但 admin seed 固定）。
- **訂單建立需 user_id 購物車：** 訪客（session_id）購物車的商品**不能**直接建立訂單，需先登入後重新加入。
- **建立訂單必須帶 `shippingMethod`：** 缺少時回傳 400 VALIDATION_ERROR；測試中建單請帶 `shippingMethod: 'home_delivery'`。
