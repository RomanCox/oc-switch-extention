#!/usr/bin/env bash
# Убирает launchd-агента и останавливает туннель.
# Настройки приложений не трогает.

set -u
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../unix/config.sh

LABEL=dev.romancox.ocswitch-tunnel
AGENT_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$(id -u)" "$AGENT_PATH" 2>/dev/null
rm -f "$AGENT_PATH"

# Гасим только наши ssh-процессы — те, в командной строке которых есть наш порт
pkill -f -- "-D 127.0.0.1:${OCSWITCH_SOCKS_PORT}" 2>/dev/null

echo "Агент удалён, туннель остановлен."
echo "settings.json, ярлыки и расширение не тронуты."
