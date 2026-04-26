#!/bin/bash
# 編輯原始碼後自動執行測試
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# 只在 src/ 原始碼變更時觸發，排除 tests/ 和 docs/
case "$FILE_PATH" in
  *src/*.js|*src/**/*.js|*/app.js|*/server.js)
    ;;
  *)
    exit 0
    ;;
esac

cd "$(dirname "$0")/../../.." || exit 0

echo "原始碼已變更，執行測試..."
npm test 2>&1

exit 0
