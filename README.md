# 花店電商後端

Express 4 + SQLite + EJS 的花卉電商，六角學院「AI 開發進化營」作業專案。
完整文件在 [`docs/`](./docs/README.md)。

## 快速開始

```bash
cp .env.example .env      # 至少填入 JWT_SECRET
npm install
npm start                 # http://localhost:3001
```

## 測試

```bash
npm test                  # unit + integration
npm run test:unit         # tests/unit/ —— 純函式，不經 API 與資料庫
npm run test:integration  # tests/integration/ —— 走 API 與記憶體 SQLite
npm run test:e2e          # Playwright，需先 npm start（詳見 docs/TESTING.md）
```

詳細說明見 [`docs/TESTING.md`](./docs/TESTING.md)。

## 與作業規格的差異說明

作業規格寫「請在 `./test/` 資料夾中加入 Shipping 模組的測試」，本專案改放在 `tests/unit/shipping.test.js`，原因與影響如下：

- 起始 repo 已有 `tests/`，再開一個 `test/` 會出現兩個只差一個字母的測試目錄，不利維護
- 測試改依性質分層：`tests/unit/`（純函式）、`tests/integration/`（走 API 與資料庫）、`e2e/`（Playwright）
- 起始 repo 原有的 6 支測試使用 supertest 走完路由與資料庫，性質上屬於整合測試，因此歸入 `tests/integration/`
- 因此 `npm run test:unit` 為 14 條（Shipping 模組），`npm run test:integration` 為 37 條（原有 6 支 API 測試 32 條 + 建單流程整合測試 5 條）
- 規格要求的「原有 Unit Test 維持通過」仍然成立：`npm test` 會依序跑完兩層，GitHub Actions 也是兩個步驟都執行，沒有任何測試被排除
