#!/usr/bin/env bash
# Ставит пользовательский systemd-сервис: туннель поднимается при входе
# в систему, без окна, с перезапуском при сбое.
#
#   ./linux/install.sh
#
# Перед запуском проверьте unix/config.sh.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../unix/config.sh

SERVICE_NAME=ocswitch-tunnel
UNIT_DIR="$HOME/.config/systemd/user"
UNIT_PATH="$UNIT_DIR/$SERVICE_NAME.service"
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

# --- сервис -----------------------------------------------------------
echo "==> Устанавливаю сервис '$SERVICE_NAME'"

mkdir -p "$UNIT_DIR"
sed "s#__TUNNEL_SH__#$TUNNEL_SH#" ocswitch-tunnel.service > "$UNIT_PATH"

systemctl --user daemon-reload
systemctl --user enable --now "$SERVICE_NAME"

# Без linger сервис остановится, когда закончится последняя сессия входа
# (например, по SSH). Для рабочего стола это не важно — сессия живёт
# постоянно, но на headless-машине стоит включить явно:
if ! loginctl show-user "$USER" -p Linger 2>/dev/null | grep -q 'Linger=yes'; then
    if loginctl enable-linger "$USER" 2>/dev/null; then
        echo "    Включён linger — сервис переживёт выход из сессии"
    else
        echo "    Не удалось включить linger автоматически."
        echo "    На headless-машине выполните: sudo loginctl enable-linger $USER"
    fi
fi

echo "    Сервис установлен и запущен"
echo
sleep 4
../unix/check.sh
