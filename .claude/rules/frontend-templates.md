---
paths:
  - "views/**"
  - "public/js/**"
  - "public/css/**"
---

# 前端/模板規則

- 模板引擎為 EJS 5.x，使用 `<%= %>` 輸出（自動 HTML escape），禁止使用 `<%- %>` 輸出未信任的用戶資料（XSS 風險）
- 頁面分為前台（front layout）和後台（admin layout），新增頁面必須透過 `pageRoutes.js` 的 `renderFront` 或 `renderAdmin` helper 渲染，不要直接呼叫 `res.render()`
- 每個頁面對應一支 `public/js/<pageScript>.js`，由 layout template 依 `pageScript` 變數動態載入
- CSS 框架為 Tailwind CSS 4.x，來源檔 `public/css/input.css`，編譯後 `public/css/output.css`；直接修改 `output.css` 的變更在下次 build 後會被覆蓋
- 前台頁面透過 API 取得資料（fetch），不在 EJS template 中直接查詢 DB
- 新增前台頁面路由時，locals 必須包含 `title`（頁籤標題）和 `pageScript`（對應 JS 檔名）
- 新增後台頁面路由時，locals 還需包含 `currentPath`（供 sidebar active 狀態判斷）
