#!/usr/bin/env bash
set -euo pipefail

USER_NAME="${1:?укажите пользователя}"
SERVER="${2:?укажите сервер}"
PORT="${3:-11080}"

echo "SOCKS5 на 127.0.0.1:${PORT} -> ${USER_NAME}@${SERVER}"
echo "Проверка из другого окна:"
echo "  curl --socks5-hostname 127.0.0.1:${PORT} https://ifconfig.me"
echo

exec ssh -D "${PORT}" -N \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  "${USER_NAME}@${SERVER}"
