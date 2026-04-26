#!/bin/bash
# 編輯 JS 檔後自動格式化（若有 prettier 或 eslint）
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# 只處理 JS 檔
case "$FILE_PATH" in
  *.js)
    ;;
  *)
    exit 0
    ;;
esac

cd "$(dirname "$0")/../../.." || exit 0

# prettier 優先，其次 eslint --fix
if [ -f "node_modules/.bin/prettier" ]; then
  node_modules/.bin/prettier --write "$FILE_PATH" --log-level silent 2>/dev/null
elif [ -f "node_modules/.bin/eslint" ]; then
  node_modules/.bin/eslint --fix "$FILE_PATH" 2>/dev/null
fi

exit 0
