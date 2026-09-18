#!/usr/bin/env bash
# Ставит launchd-агента: туннель поднимается при входе в систему,
# без окна, с перезапуском при сбое.
#
#   ./macos/install.sh
#
# Перед запуском проверьте unix/config.sh.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../unix/config.sh

LABEL=dev.romancox.ocswitch-tunnel
AGENT_DIR="$HOME/Library/LaunchAgents"
AGENT_PATH="$AGENT_DIR/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs"
TUNNEL_SH="$(cd ../unix && pwd)/tunnel.sh"

if [[ "$OCSWITCH_USER" == "CHANGE_ME" ]]; then
    echo "Сначала впишите OCSWITCH_USER в ../unix/config.sh" >&2
    exit 1
fi

# --- проверка ключа -------------------------------------------------
# Поднимаем настоящий туннель на временном порту и смотрим, слушает ли он.
# Проверять ключ командой вроде 'echo ok' нельзя: ключ намеренно
# ограничен только пробросом портов и команды выполнять не может.

echo "==> Проверяю вход по ключу"

PROBE_PORT=11099
probe_args=(
    -N -D "127.0.0.1:$PROBE_PORT"
    -o BatchMode=yes
    -o ConnectTimeout=10
    -o ExitOnForwardFailure=yes
    -o StrictHostKeyChecking=accept-new
    -p "$OCSWITCH_SSH_PORT"
)
[[ -n "$OCSWITCH_KEY_PATH" ]] && probe_args+=(-i "$OCSWITCH_KEY_PATH")
probe_args+=("$OCSWITCH_USER@$OCSWITCH_SERVER")

ssh "${probe_args[@]}" &
probe_pid=$!
sleep 5

key_ok=0
(exec 3<>"/dev/tcp/127.0.0.1/$PROBE_PORT") 2>/dev/null && { key_ok=1; exec 3>&- 3<&-; }

kill "$probe_pid" 2>/dev/null || true
wait "$probe_pid" 2>/dev/null || true

if [[ "$key_ok" != 1 ]]; then
    echo "    Туннель не поднялся." >&2
    echo "    Посмотрите причину:" >&2
    echo "      ssh -v -N -D 11080 -i '$OCSWITCH_KEY_PATH' $OCSWITCH_USER@$OCSWITCH_SERVER" >&2
    exit 1
fi
echo "    OK"

# --- агент -----------------------------------------------------------
echo "==> Устанавливаю launchd-агента '$LABEL'"

mkdir -p "$AGENT_DIR" "$LOG_DIR"
sed -e "s#__TUNNEL_SH__#$TUNNEL_SH#" -e "s#__LOG_DIR__#$LOG_DIR#" \
    "$LABEL.plist" > "$AGENT_PATH"

launchctl bootout "gui/$(id -u)" "$AGENT_PATH" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$AGENT_PATH"
launchctl enable "gui/$(id -u)/$LABEL"

echo "    Агент установлен и запущен"
echo
sleep 4
../unix/check.sh
