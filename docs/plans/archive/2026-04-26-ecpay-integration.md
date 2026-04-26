# ECPay 金流整合

## User Story

身為消費者，我希望在結帳後能使用真實的信用卡付款，而非模擬按鈕，以便完成實際的購買流程。

## Spec

由於專案只運行於 localhost，無法接收 ECPay Server Notify（ReturnURL），改以本地端主動呼叫 QueryTradeInfo 查詢付款結果。

**付款流程：**
1. 訂單詳情頁點「前往綠界付款」
2. 前端 fetch `POST /api/orders/:id/ecpay-form`（帶 JWT）
3. Server 回傳 auto-submit HTML → 瀏覽器自動 POST 至綠界 AIO
4. 用戶在綠界 staging 環境完成付款
5. 綠界將瀏覽器重導回 `POST /api/orders/:id/ecpay-return`
6. Server redirect → `/orders/:id?payment=ecpay`
7. 前端偵測 `?payment=ecpay` → 自動呼叫 `POST /api/orders/:id/verify-payment`
8. Server 呼叫 QueryTradeInfo，`TradeStatus=1` 則更新狀態為 `paid`

## Tasks

- [x] 建立 `src/utils/ecpay.js`（CheckMacValue、buildAioParams、queryTradeInfo）
- [x] `src/database.js` 加 `ecpay_trade_no` 欄位 migration
- [x] `src/routes/orderRoutes.js` 新增三個端點（ecpay-form、ecpay-return、verify-payment）
- [x] 更新 `public/js/pages/order-detail.js`（移除模擬按鈕，改為綠界付款流程）
- [x] 更新 `views/pages/order-detail.ejs`（UI 按鈕替換）
- [x] 確認 32 個現有測試全數通過
