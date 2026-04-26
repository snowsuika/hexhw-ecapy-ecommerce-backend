---
# 全域規則，無 paths 限制
---

# Git Commit 規則

- Commit message 格式：`<type>: <描述>`（全小寫，繁體中文或英文均可）
- 有效的 type：
  - `feat` — 新功能
  - `fix` — 修復 bug
  - `refactor` — 重構（不影響功能）
  - `test` — 測試相關
  - `docs` — 文件更新
  - `chore` — 建置、設定、依賴更新
  - `style` — 格式調整（CSS、程式碼排版）
- 禁止 commit 以下檔案：`.env`、`database.sqlite`、`database.sqlite-shm`、`database.sqlite-wal`、`node_modules/`
- 每次 commit 聚焦單一目的，不要將不相關的修改混在同一個 commit
- `public/css/output.css` 應列入 `.gitignore`，不要 commit 編譯產物
