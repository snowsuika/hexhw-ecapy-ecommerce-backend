#!/bin/bash
# Context 壓縮後重新注入關鍵規則
INPUT=$(cat)
TRIGGER=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('trigger',''))" 2>/dev/null)

if [ "$TRIGGER" != "compact" ]; then
  exit 0
fi

cat <<'EOF'
=== 專案關鍵規則（Compact 後重新注入）===
- 所有 API 回應格式：{ data, error, message }，不得偏離
- 購物車（/api/cart）使用雙模式認證：JWT Bearer 或 X-Session-Id，其他 API 只接受 JWT
- 訂單建立必須在 db.transaction() 中原子完成：建立 order + order_items + 扣庫存 + 清購物車
- 刪除商品前檢查 pending 訂單，有則 409，不可強制刪除
- SQL 一律使用 parameterized query，禁止字串拼接
- 測試循序執行，順序：auth → products → cart → orders → adminProducts → adminOrders
EOF

exit 0
