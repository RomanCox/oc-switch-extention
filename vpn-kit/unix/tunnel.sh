#!/usr/bin/env bash
# Поднимает туннель и держит его. Запускается сервисом (systemd/launchd),
# руками его звать не нужно — для проверки есть check.sh.

set -u
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./config.sh

ssh_args=(
    -N
    -D "127.0.0.1:${OCSWITCH_SOCKS_PORT}"
    -L "127.0.0.1:${OCSWITCH_HTTP_PORT}:127.0.0.1:${OCSWITCH_REMOTE_PROXY_PORT}"
    -p "${OCSWITCH_SSH_PORT}"
    -o ServerAliveInterval=30
    -o ServerAliveCountMax=3
    -o ExitOnForwardFailure=yes
    -o StrictHostKeyChecking=accept-new
    -o BatchMode=yes
)

if [[ -n "${OCSWITCH_KEY_PATH}" ]]; then
    ssh_args+=(-i "${OCSWITCH_KEY_PATH}")
fi
ssh_args+=("${OCSWITCH_USER}@${OCSWITCH_SERVER}")

# Внешний цикл: ssh выходит при разрыве, мы поднимаем заново.
# Сервис тоже перезапустит процесс, если он умрёт совсем.
while true; do
    ssh "${ssh_args[@]}"
    sleep 5
done
