#!/bin/bash
# 編輯路由檔後自動重新產生 openapi.json
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# 只在路由檔變更時觸發
case "$FILE_PATH" in
  *src/routes/*.js|*swagger-config.js|*generate-openapi.js)
    ;;
  *)
    exit 0
    ;;
esac

cd "$(dirname "$0")/../../.." || exit 0

if [ -f "generate-openapi.js" ]; then
  node generate-openapi.js 2>/dev/null && echo "openapi.json 已更新"
fi

exit 0
