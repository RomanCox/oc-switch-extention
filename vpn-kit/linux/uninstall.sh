#!/usr/bin/env bash
# Убирает сервис и останавливает туннель.
# Настройки приложений не трогает.

set -u
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../unix/config.sh

SERVICE_NAME=ocswitch-tunnel
UNIT_PATH="$HOME/.config/systemd/user/$SERVICE_NAME.service"

systemctl --user disable --now "$SERVICE_NAME" 2>/dev/null
rm -f "$UNIT_PATH"
systemctl --user daemon-reload

# Гасим только наши ssh-процессы — те, в командной строке которых есть наш порт
pkill -f -- "-D 127.0.0.1:${OCSWITCH_SOCKS_PORT}" 2>/dev/null

echo "Сервис удалён, туннель остановлен."
echo "settings.json, ярлыки и расширение не тронуты."
