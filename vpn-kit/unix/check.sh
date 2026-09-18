#!/usr/bin/env bash
# Показывает, жив ли туннель и куда реально уходит трафик.

set -u
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./config.sh

is_listening() {
    # /dev/tcp работает и в bash на Linux, и в bash на macOS — без lsof/ss/nc.
    (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && exec 3>&- 3<&-
}

get_external_ip() {
    curl -s --max-time 12 "$@" https://ifconfig.me 2>/dev/null
}

show_value() {
    local label="$1" value="$2"
    if [[ -n "$value" ]]; then
        printf '  %-16s%s\n' "$label" "$value"
    else
        printf '  %-16sнет ответа\n' "$label"
    fi
}

echo
echo '  ocswitch — состояние туннеля'
echo '  ----------------------------'

if is_listening "${OCSWITCH_SOCKS_PORT}"; then
    socks_up=1
    echo "  SOCKS5  127.0.0.1:${OCSWITCH_SOCKS_PORT}  слушает"
else
    socks_up=0
    echo "  SOCKS5  127.0.0.1:${OCSWITCH_SOCKS_PORT}  НЕ слушает"
fi

if is_listening "${OCSWITCH_HTTP_PORT}"; then
    http_up=1
    echo "  HTTP    127.0.0.1:${OCSWITCH_HTTP_PORT}  слушает"
else
    http_up=0
    echo "  HTTP    127.0.0.1:${OCSWITCH_HTTP_PORT}  НЕ слушает"
fi

echo

direct=$(get_external_ip)
socks=""
http=""
[[ "$socks_up" == 1 ]] && socks=$(get_external_ip --socks5-hostname "127.0.0.1:${OCSWITCH_SOCKS_PORT}")
[[ "$http_up" == 1 ]] && http=$(get_external_ip --proxy "http://127.0.0.1:${OCSWITCH_HTTP_PORT}")

show_value "напрямую" "$direct"
show_value "через SOCKS5" "$socks"
show_value "через HTTP" "$http"

echo

if [[ -n "$socks" && -n "$http" && -n "$direct" ]]; then
    if [[ "$socks" == "$direct" ]]; then
        echo '  ВНИМАНИЕ: адреса совпадают.'
        echo '  Проверьте, не включён ли на машине системный VPN.'
        echo '  Выключите его — иначе "мимо VPN" не существует как состояние.'
    elif [[ "$socks" == "$http" ]]; then
        echo '  Всё в порядке: оба прокси выходят через сервер, система — напрямую.'
    else
        echo '  SOCKS и HTTP дают разные адреса. Проверьте tinyproxy на сервере.'
    fi
elif [[ "$socks_up" == 0 && "$http_up" == 0 ]]; then
    echo '  Туннель не поднят.'
    echo '    Linux:  systemctl --user status ocswitch-tunnel'
    echo '    macOS:  launchctl print gui/$(id -u)/dev.romancox.ocswitch-tunnel'
fi
echo
