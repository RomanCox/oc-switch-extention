#!/usr/bin/env bash
# Добавляет HTTPS_PROXY в ~/.claude/settings.json, не затирая остальное.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../unix/config.sh

PATH_JSON="$HOME/.claude/settings.json"
PROXY="http://127.0.0.1:${OCSWITCH_HTTP_PORT}"

mkdir -p "$(dirname "$PATH_JSON")"
[[ -f "$PATH_JSON" ]] && cp "$PATH_JSON" "$PATH_JSON.bak"

python3 - "$PATH_JSON" "$PROXY" <<'PY'
import json, sys, os

path, proxy = sys.argv[1], sys.argv[2]
if os.path.exists(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
else:
    data = {}

data.setdefault("env", {})["HTTPS_PROXY"] = proxy

with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")
PY

echo "Готово: $PATH_JSON"
echo "HTTPS_PROXY = $PROXY"
echo
echo "Перезапустите claude и проверьте /status — строку Proxy."
