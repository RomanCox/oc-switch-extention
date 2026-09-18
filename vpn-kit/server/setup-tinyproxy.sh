#!/usr/bin/env bash
#
# Запускать НА СЕРВЕРЕ (admin.romancox.dev), под sudo.
#
#   scp server/tinyproxy.conf server/setup-tinyproxy.sh user@admin.romancox.dev:~
#   ssh user@admin.romancox.dev
#   sudo bash setup-tinyproxy.sh
#
set -euo pipefail

CONF_SRC="$(dirname "$0")/tinyproxy.conf"
CONF_DST="/etc/tinyproxy/tinyproxy.conf"

if [[ $EUID -ne 0 ]]; then
  echo "Нужен root: sudo bash $0" >&2
  exit 1
fi

if [[ ! -f "$CONF_SRC" ]]; then
  echo "Рядом со скриптом нет tinyproxy.conf" >&2
  exit 1
fi

echo "==> Установка tinyproxy"
apt-get update -qq
apt-get install -y tinyproxy

echo "==> Сохраняю прежний конфиг в ${CONF_DST}.bak"
[[ -f "$CONF_DST" ]] && cp -n "$CONF_DST" "${CONF_DST}.bak"

echo "==> Кладу новый конфиг"
install -m 0644 "$CONF_SRC" "$CONF_DST"

echo "==> Перезапуск"
systemctl enable tinyproxy
systemctl restart tinyproxy
sleep 1

echo "==> Проверка: слушает ли только localhost"
if ss -lntp 2>/dev/null | grep -q '127.0.0.1:8888'; then
  echo "    OK — 127.0.0.1:8888"
else
  echo "    ВНИМАНИЕ: не вижу 127.0.0.1:8888. Проверьте: systemctl status tinyproxy" >&2
fi

if ss -lntp 2>/dev/null | grep -E '(0\.0\.0\.0|\*|\[::\]):8888' >/dev/null; then
  echo "    ОПАСНО: слушает на внешнем интерфейсе. Проверьте строку Listen в $CONF_DST" >&2
  exit 1
fi

echo "==> Проверка работы прокси"
if curl -s --max-time 10 --proxy http://127.0.0.1:8888 https://ifconfig.me >/dev/null; then
  echo "    OK — прокси отвечает, внешний адрес: $(curl -s --proxy http://127.0.0.1:8888 https://ifconfig.me)"
else
  echo "    Прокси не ответил. Логи: journalctl -u tinyproxy -n 50" >&2
  exit 1
fi

echo
echo "Готово. Дальше — на Windows: windows\\install.ps1"
