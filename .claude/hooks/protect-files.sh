#!/bin/bash
# 讀取 tool input JSON，若目標檔案為敏感檔案則阻止操作
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

BASENAME=$(basename "$FILE_PATH")

# 阻止編輯敏感檔案
case "$BASENAME" in
  .env|.env.*|*.sqlite|*.sqlite-shm|*.sqlite-wal|package-lock.json)
    echo "blocked: 禁止直接編輯 $BASENAME，這是受保護的敏感或自動產生的檔案。" >&2
    exit 2
    ;;
esac
