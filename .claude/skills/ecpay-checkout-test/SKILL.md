---
name: ecpay-checkout-test
description: 使用 Playwright 瀏覽器自動化，端對端測試花漾生活電商網站的完整購物結帳流程，涵蓋登入、加入購物車、結帳建立訂單、跳轉至綠界 ECPay 金流頁面、選擇網路ATM（WebATM）+ 台灣土地銀行付款、完成模擬轉帳、驗證訂單狀態變為已付款。當使用者要求「測試結帳流程」「測試綠界金流」「測試 ATM 付款」「驗證訂單付款」「用 playwright 跑一次完整購物流程」時，主動使用此 skill，即使使用者沒有講出 skill 這個詞、或只講了「幫我測一下下單流程」這種簡短說法。
---

# ECPay 結帳流程端對端測試

這個 skill 讓 Claude 扮演 QA，實際操作瀏覽器走一遍「登入 → 加入購物車 → 結帳 → 綠界付款（WebATM + 土地銀行）→ 驗證訂單已付款」的完整流程，並在最後附上截圖與問題回報。

這是**真實打綠界測試站、真實寫入本機 SQLite 資料庫**的操作，不是模擬測試，所以每次執行都要用全新的訂單（見下方「常見陷阱」），不要重複用同一張訂單重跑付款步驟。

## 前置準備

1. **確認 server 是否已啟動**：`lsof -i :3001 -sTCP:LISTEN`。若沒有輸出，代表 server 未啟動，執行 `npm run dev:server`（背景執行），並等待 `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/` 回傳 200 再繼續。

2. **取得登入帳密**：讀取專案根目錄的 `.env`，使用 `ADMIN_EMAIL` / `ADMIN_PASSWORD`（沒有設定時預設為 `admin@hexschool.com` / `12345678`，見 CLAUDE.md）。不要用假造的帳密硬 code 在對話裡，永遠從 `.env` 讀取當下實際值，因為使用者可能已覆寫。

3. **載入 Playwright MCP 工具**：用 ToolSearch 一次載入 `mcp__playwright__browser_navigate`、`browser_snapshot`、`browser_click`、`browser_type`、`browser_fill_form`、`browser_take_screenshot`、`browser_wait_for`，不要分次載入浪費來回。

## 測試步驟

依序執行，每一步用 `browser_snapshot` 取得目前頁面的 accessibility snapshot，並用 snapshot 回傳的 `ref`（例如 `f3e25`）當作 `browser_click` / `browser_fill_form` 的 target —— **不要直接把按鈕的文字或角色描述字串傳給 target 參數**，那是 `element`（人類可讀描述）用的欄位，把文字塞進 `target` 會丟出 `Unexpected token` 的 CSS selector 解析錯誤。

1. **登入**：前往 `http://localhost:3001/login`，用 `browser_fill_form` 填入 Email 與密碼欄位，點擊登入按鈕。確認頁面導回首頁且右上角出現使用者資訊（例如 `Admin` 或登出按鈕），代表登入成功。

2. **加入購物車**：在首頁任選一項商品，點擊「加入購物車」按鈕。

3. **前往結帳**：導覽至 `/cart` 確認品項已加入，點擊「前往結帳」進入 `/checkout`。用 `browser_fill_form` 填寫收件人姓名、Email、收件地址（測試資料即可，例如「測試使用者」「台北市信義區松高路1號」），點擊「確認送出訂單」。

4. **確認訂單建立**：頁面會導向 `/orders/{orderId}`，狀態應顯示「待付款」。記下訂單編號（例如 `ORD-20260701-EE87A`），稍後驗證要用。

5. **前往綠界付款**：點擊「前往綠界付款」按鈕，會導到 `https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5`。用 `browser_snapshot` 檢查「付款方式」列表。

   - **若列表中沒有「網路ATM」選項**（只看到信用卡、Apple Pay、iPASS MONEY、街口支付、綠界Pay 這 5 項），代表後端 `src/utils/ecpay.js` 的 `ChoosePayment` 參數目前不是 `'ALL'`（可能被改回 `'Credit'` 或其他單一方式）。**不要自己動手改程式碼**——這涉及修改既有邏輯，先把發現的狀況回報給使用者，問清楚要不要調整，等對方確認後才動手，並記得修改完要重啟 server（純 `node server.js`，沒有 nodemon watch，改完程式碼不會自動生效）。

6. **選擇網路ATM + 土地銀行**：點擊「網路ATM」（WebATM）付款方式，在「選擇銀行」下拉選單選擇「台灣土地銀行」，點擊「前往付款」。

7. **處理提醒視窗**：綠界會跳出一個「將跳轉至銀行頁面」的提醒視窗，點擊「關閉」按鈕關掉它，會直接導到模擬的土地銀行頁面（URL 類似 `.../MockMPPost/LandWebAtm`）。

8. **完成模擬付款**：模擬頁面會預先填好 `RC=0`、`MSG=交易成功` 等欄位，代表模擬「付款成功」的情境。點擊「Save」按鈕送出。

9. **驗證付款結果**：頁面會導回 `http://localhost:3001/orders/{orderId}?payment=ecpay`。用 `browser_snapshot` 確認：
   - 頁面出現「付款成功！感謝您的購買。」文字
   - 訂單狀態從「待付款」變成「已付款」
   - 訂單編號與步驟 4 記下的一致

10. **截圖存證**：用 `browser_take_screenshot`（`fullPage: true`）對最終的訂單詳情頁截圖。`filename` 參數**要帶上 `.playwright-mcp/` 這個目錄前綴**（例如 `.playwright-mcp/ecpay-verify-{訂單編號}.png`），只給純檔名的話預設會存到專案根目錄，弄髒 git working tree。檔名建議帶上訂單編號方便辨識。**測試完成後一定要把這張截圖用 Read 工具讀出來，讓使用者在對話中直接看到結果**，不要只回報文字說「已截圖存到某路徑」就結束。

## Edge Case 測試（選用，使用者要求「測完整」「含失敗情境」時執行）

預設只跑上方 Happy Path（步驟 1-10）。以下情境只在使用者明確要求時才執行，執行前務必用步驟 1-5 建立**全新訂單**（同一張訂單不可重複送出付款）：

1. **付款失敗（RC≠0）**：在步驟 8「模擬土地銀行頁面」，將預先填好的 `RC` 欄位改成非 `0` 的值（例如 `1`）、`MSG` 改成任意失敗訊息，點擊「Save」送出。驗證：
   - 頁面導回 `/orders/{orderId}?payment=ecpay` 並顯示「付款失敗」文字
   - 訂單狀態仍是「待付款」（不可被誤標成「已付款」）

2. **重複送出同一張訂單付款**：對一張已經成功付款或已在步驟 5 送出過一次的訂單，再次點擊「前往綠界付款」。驗證：
   - 綠界回傳「訊息代碼：10300028，訂單編號重覆」或前端顯示對應錯誤，而不是靜默成功
   - 這個情境本身就是「常見陷阱」提到的限制，此處是刻意驗證錯誤處理是否正確

3. **購物車為空時前往結帳**：清空購物車（或用全新帳號，未加入任何商品），直接前往 `/checkout`。驗證：
   - 頁面阻擋送出（顯示提示訊息）或導回 `/cart`，不可建立空品項訂單

4. **結帳表單缺漏必填欄位**：在 `/checkout` 留空收件人姓名或地址，點擊「確認送出訂單」。驗證：
   - 前端出現驗證錯誤提示，不送出請求；或後端回傳 400 且畫面顯示對應錯誤訊息，不可靜默失敗或建立不完整訂單

## 回報格式

測試結束後一律使用以下固定模板回報，不要用鬆散條列：

```
## ECPay 結帳流程測試報告

- 測試時間：{YYYY-MM-DD HH:mm}
- 測試環境：{server URL，例如 http://localhost:3001}
- 測試帳號：{email，不含密碼}
- 訂單編號：{order_no}

### 測試結果

| 步驟 | 說明 | 結果 |
|---|---|---|
| 1 | 登入 | Pass/Fail |
| 2 | 加入購物車 | Pass/Fail |
| 3 | 前往結帳並填寫表單 | Pass/Fail |
| 4 | 確認訂單建立（狀態：待付款） | Pass/Fail |
| 5 | 前往綠界付款頁面 | Pass/Fail |
| 6 | 選擇網路ATM + 土地銀行 | Pass/Fail |
| 7 | 處理跳轉提醒視窗 | Pass/Fail |
| 8 | 完成模擬付款 | Pass/Fail |
| 9 | 驗證訂單狀態變為已付款 | Pass/Fail |
| 10 | 截圖存證 | Pass/Fail |
（若有執行 Edge Case，比照上表格式另列一段，標明情境名稱）

### 截圖
{用 Read 工具內嵌顯示最終訂單詳情頁截圖}

### 發現的問題
{列點；若無問題則寫「無」。非預期行為（付款方式選項缺失、表單驗證錯誤、跳轉失敗等）都列在這裡，並詢問使用者是否要進一步處理，不要自作主張去修 `src/` 底下的程式碼}
```

## 常見陷阱

- **不可重複用同一張訂單走第二次付款流程**：ECPay 用 `order.order_no` 生成 `MerchantTradeNo`，同一張訂單再次點「前往綠界付款」送出交易，綠界會回傳「訊息代碼：10300028，訂單編號重覆，建立失敗」。若需要重跑測試，必須從加入購物車開始建立一張全新訂單。
- **付款方式選項會依後端 `ChoosePayment` 參數而變**：`'Credit'` 只會顯示 5 種（信用卡/Apple Pay/iPASS MONEY/街口支付/綠界Pay）；`'ALL'` 才會顯示完整的 12 種選項（含 WebATM、ATM虛擬帳號、超商條碼、超商代碼、TWQR、微信支付、無卡分期）。這是後端程式碼決定的，不是瀏覽器操作能改變的。
- **`browser_click` 的 `target` 一定要用 snapshot 給的 `ref`**，不能填角色文字描述（那會被當成 CSS selector 解析，含中文或空白會直接報錯）。
- **server 是 `node server.js` 純執行，不會 hot reload**：只要改了 `src/` 底下任何檔案，一定要重啟 server 才會生效，否則會用舊邏輯跑出誤導人的結果。
