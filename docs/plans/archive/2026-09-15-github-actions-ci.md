# GitHub Actions 自動化測試

## User Story

身為開發者，我希望每次 push 或開 PR 到 main 時，GitHub 自動執行 Unit Test 與 Integration Test，並在 Actions 頁面清楚看到兩個測試步驟的結果，以便在合併或交付前就發現壞掉的程式。

## Spec

### 背景與現況

- 目標：建立 `.github/workflows/test.yml`；分成 `npm run test:unit`、`npm run test:integration` 兩個明確步驟；不跑 Playwright E2E、不啟動額外服務；YAML 格式正確、兩個測試步驟成功、最終狀態通過
- 專案尚無 `.github/`；兩個測試指令已存在，皆用 `DB_PATH=:memory:`，不需資料庫檔案或外部服務
- 本機 Node v24.4.1、npm 11.4.2，有 `package-lock.json`
- 原生模組：`better-sqlite3@12.8.0`（engines Node 20–25，prebuild-install 失敗才 node-gyp）、`bcrypt@6`（node-gyp-build）
- `@playwright/test` 無 install／postinstall，`npm ci` 不會下載瀏覽器
- 測試需要 `JWT_SECRET`（`src/routes/authRoutes.js` 的 `jwt.sign`、`authMiddleware.js` 與 `cartRoutes.js` 的 `jwt.verify`）；本機由 `.env` 提供，CI 沒有 `.env`。ECPay 相關變數 unit／integration 不使用
- `actions/checkout` 最新 v7.0.1、`actions/setup-node` 最新 v7.0.0（2026-07 發布）
- GitHub Actions 已啟用

### 已確認決策

| 議題 | 決定 | 理由 |
|---|---|---|
| `JWT_SECRET` 來源 | workflow `env` 設測試用假值 `test-only-not-a-real-secret` | 只用於 CI 記憶體 DB 的短暫 token，不保護任何真實資源；程式仍從 `process.env` 讀取，不違反「不得 hardcode」；免設定 secret，fork PR 也能執行 |
| Node 版本 | 24 | 與本機開發環境一致 |
| 觸發條件 | `push`（main）、`pull_request`（main）、`workflow_dispatch` | 涵蓋直接 push、PR 審查，並可在 Actions 頁手動重跑 |
| commit type | `chore:`（workflow）、`docs:`（文件） | 專案 commit 規範允許的 type 中沒有 `ci` |
| 本機驗證範圍 | 專案目錄內設 `JWT_SECRET` 跑兩個測試指令 + `npm ci --dry-run` | 已知限制：本機讀得到 `.env`、使用現成 `node_modules`，乾淨環境以 Actions 結果為準 |
| YAML 驗證 | `js-yaml` 語法 + 逐欄位結構檢查 | 不另裝工具；語意最終以 GitHub 解析為準 |

### Workflow 規格（`.github/workflows/test.yml`）

| 項目 | 設定 |
|---|---|
| `name` | `Test` |
| `on` | `push.branches: [main]`、`pull_request.branches: [main]`、`workflow_dispatch` |
| `permissions` | `contents: read`（最小權限） |
| `concurrency` | `group: test-${{ github.ref }}`、`cancel-in-progress: true` |
| job | `test`，`runs-on: ubuntu-latest`，`timeout-minutes: 10` |
| job `env` | `JWT_SECRET: test-only-not-a-real-secret`（上方註解說明僅供 CI 測試簽發 token、非正式金鑰） |

| # | 步驟名稱 | 內容 |
|---|---|---|
| 1 | Checkout | `actions/checkout@v7` |
| 2 | Setup Node.js | `actions/setup-node@v7`，`node-version: 24`，`cache: npm` |
| 3 | Install dependencies | `npm ci` |
| 4 | Unit Test | `npm run test:unit` |
| 5 | Integration Test | `npm run test:integration` |

不執行 Playwright、不啟動 server、不建置 CSS。

### 文件更新

- `docs/TESTING.md`：新增「GitHub Actions」段（觸發條件、兩個測試步驟、`JWT_SECRET` 假值說明、不跑 E2E 的原因）
- `docs/ARCHITECTURE.md`：目錄樹加入 `.github/workflows/test.yml`
- `docs/DEVELOPMENT.md`：環境變數表 `JWT_SECRET` 註明 CI 由 workflow 提供測試值
- `docs/CHANGELOG.md`：`[Unreleased]` 新增 CI workflow
- **`docs/FEATURES.md` 不更新**：CI 非產品功能，歸檔流程第 4 步不適用，於本計畫 Tasks 註明
- 文件中引用 commit 一律用 commit 標題，不寫 SHA

### 不在範圍

- E2E 進 CI、測試覆蓋率報告、Node 版本矩陣

### 實作與原計畫差異

- workflow 內容與上方規格一致，無實作差異
- 首次執行（push 觸發）結果為 `success`；runner 實際使用 Node.js v24.20.0，`npm ci` 在 Linux 上成功安裝原生模組，Unit Test 7 檔 46 條、Integration Test 1 檔 5 條全數通過，與本機結果一致
- `Post Checkout` 清理步驟出現 warning：`fatal: No url found for submodule path '.claude/skills/ecpay' in .gitmodules`。原因是 repo 中既有的 `.claude/skills/ecpay` 為 gitlink（mode `160000`）且無 `.gitmodules`，與本 workflow 無關，不影響測試步驟與執行結果；已另以 `chore: 移除無效的 .claude/skills/ecpay submodule 紀錄` 移除該 gitlink
- `npm ci` 輸出數個相依套件的 `npm warn deprecated`（如 `prebuild-install`、`glob@7`、`uuid@8`），為間接相依的棄用提示，不影響安裝與測試

## Tasks

- [x] **建立計畫文件（開發前）**：將本計畫存為 `docs/plans/2026-09-15-github-actions-ci.md`
- [x] **Workflow**：新增 `.github/workflows/test.yml`（依上方 Workflow 規格）
- [x] **驗證－YAML**：用專案已安裝的 `js-yaml` 解析 `test.yml`（語法），再逐項檢查欄位結構符合上方 Workflow 規格：`on` 三個觸發、`permissions.contents`、`concurrency.group` 與 `cancel-in-progress`、`jobs.test.runs-on`、`timeout-minutes`、`env.JWT_SECRET`、steps 依序為 checkout@v7 → setup-node@v7（node 24、cache npm）→ `npm ci` → `Unit Test`（`npm run test:unit`）→ `Integration Test`（`npm run test:integration`）；語意最終以 push 後 GitHub 實際解析為準
- [x] **驗證－本機模擬 CI**：以 `JWT_SECRET=test-only-not-a-real-secret` 執行 `npm run test:unit`（預期 7 檔 46 條）與 `npm run test:integration`（預期 5 條）皆通過；執行 `npm ci --dry-run`。已知限制：本機仍會由 `dotenv` 讀到 `.env` 其他變數、使用現成 `node_modules`，且 `--dry-run` 不保證檢查 lockfile 一致性；乾淨環境下的安裝與 `.env` 獨立性以 GitHub Actions 實際結果為準
- 已查證：lockfile v3 含 Linux x64 原生選用套件（rollup、tailwind oxide、lightningcss、esbuild、parcel watcher）；46 個 JS 檔相對 `require` 路徑大小寫與實際檔名一致，Linux 大小寫敏感不致出錯
- [x] **文件**：更新 `docs/TESTING.md`、`docs/ARCHITECTURE.md`、`docs/DEVELOPMENT.md`、`docs/CHANGELOG.md`
- [x] **FEATURES.md**：不適用（CI 非產品功能），不修改
- [x] **commit**：`chore: 新增 GitHub Actions 自動化測試 workflow`（`.github/`）、`docs: 補充 GitHub Actions 說明`（文件）
- [x] **push**：push `main`
- [x] **驗證－GitHub Actions**：`gh run list --workflow test.yml`、`gh run watch` 確認 conclusion 為 `success`，`Checkout`、`Setup Node.js`、`Install dependencies`、`Unit Test`、`Integration Test` 各步驟皆 `success`；log 中 Unit Test `Tests 46 passed`、Integration Test `Tests 5 passed`
- [x] **歸檔（完成後）**：勾選 Tasks、補「實作與原計畫差異」，將計畫移至 `docs/plans/archive/`，並另以 `docs:` commit 提交
