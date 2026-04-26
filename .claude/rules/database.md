---
paths:
  - "src/database.js"
  - "src/routes/**"
---

# 資料庫規則

- 所有 SQL 查詢必須使用 parameterized query（`db.prepare('... WHERE id = ?').get(id)`），禁止字串拼接
- 涉及多個寫入操作的業務邏輯必須使用 `db.transaction()`，例如：建立訂單（insert order + insert order_items + update stock + delete cart_items）
- DB 欄位命名使用 snake_case（`created_at`、`password_hash`），不使用 camelCase
- 主鍵統一使用 UUID v4（`uuidv4()`），不使用自增整數 ID
- 價格、金額儲存為 INTEGER（新台幣整數），不使用 FLOAT 避免精度問題
- `updated_at` 欄位在 UPDATE 時必須手動更新：`updated_at = datetime('now')`
- 刪除具有外鍵關聯的資料前，先查詢依賴關係（例：刪除商品前檢查 pending 訂單）
- Schema 變更直接修改 `src/database.js` 的 `initializeDatabase()`，`CREATE TABLE IF NOT EXISTS` 不會 alter 既有表格，須手動刪除 DB 重建
- 不引入新的 ORM，現有專案維持使用 better-sqlite3 直接操作 SQL
